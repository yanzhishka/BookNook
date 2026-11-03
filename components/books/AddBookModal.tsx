import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Download, ExternalLink, Image as ImageIcon, Loader2, Plus, Search, Upload, X } from 'lucide-react';
import { Book } from '../../types';
import { db } from '../../services/db';
import { EpubDocument, paginateDocument } from '../../services/epub/document';
import { fetchBookText, languageInfo, type BookLookupResult } from '../../services/bookLookup';
import { BookSearch } from './BookSearch';
import { classNames } from '../../utils/classNames';
import styles from './AddBookModal.module.css';

interface AddBookModalProps { isOpen: boolean; userId: string; onClose: () => void; onBookSaved: (book: Book) => void }
interface DraftBook { title: string; author: string; coverUrl: string; content: string; document?: EpubDocument }
const EMPTY_BOOK: DraftBook = { title: '', author: '', coverUrl: '', content: '' };
const fallbackCover = (title: string) => `https://ui-avatars.com/api/?name=${encodeURIComponent(title || 'Book')}&background=random&size=512`;

export const AddBookModal: React.FC<AddBookModalProps> = ({ isOpen, userId, onClose, onBookSaved }) => {
  const [mode, setMode] = useState<'search' | 'manual'>('search');
  const [draft, setDraft] = useState<DraftBook>(EMPTY_BOOK);
  const [selected, setSelected] = useState<BookLookupResult | null>(null);
  const [editions, setEditions] = useState<BookLookupResult[]>([]);
  const [allowCard, setAllowCard] = useState(false);
  const [sourceInfo, setSourceInfo] = useState('');
  const [isFetching, setIsFetching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [progress, setProgress] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const draftId = useRef<string | null>(null);
  const saving = useRef(false);
  const isBusy = isSaving || isFetching;
  const hasContent = Boolean(draft.content.trim());
  const canSave = !isBusy && Boolean(draft.title.trim() && draft.author.trim()) && !editions.length &&
    (hasContent || !selected?.hasReadableText || allowCard);

  const cancelRead = () => { generation.current++; request.current?.abort(); request.current = null; };
  useEffect(() => () => { generation.current++; request.current?.abort(); }, []);
  useEffect(() => { if (!isOpen) { generation.current++; request.current?.abort(); } }, [isOpen]);

  const reset = () => {
    cancelRead(); draftId.current = null; setMode('search'); setDraft(EMPTY_BOOK); setSelected(null); setEditions([]);
    setAllowCard(false); setSourceInfo(''); setIsFetching(false); setError(''); setLoadError(''); setProgress('');
  };
  const close = () => { if (!saving.current) { reset(); onClose(); } };
  const backToSearch = () => { if (!saving.current) { cancelRead(); setIsFetching(false); setMode('search'); setError(''); } };
  const openManual = () => {
    if (saving.current) return;
    cancelRead(); draftId.current = null; setDraft(EMPTY_BOOK); setSelected(null); setEditions([]); setAllowCard(false);
    setSourceInfo(''); setIsFetching(false); setError(''); setLoadError(''); setProgress(''); setMode('manual');
  };

  const selectBook = async (book: BookLookupResult) => {
    cancelRead();
    const version = generation.current;
    const controller = new AbortController(); request.current = controller;
    draftId.current = null;
    setMode('manual'); setSelected(book); setEditions([]); setAllowCard(false); setSourceInfo('');
    setDraft({ title: book.title, author: book.author, coverUrl: book.coverUrl, content: '' });
    setError(''); setLoadError(''); setProgress(''); setIsFetching(book.hasReadableText);
    if (!book.hasReadableText) return;
    try {
      const result = await fetchBookText(book, controller.signal, message => { if (version === generation.current) setProgress(message); });
      if (version !== generation.current || controller.signal.aborted) return;
      if (result.kind === 'editions') {
        setEditions(result.books);
        setDraft(previous => ({ ...previous, author: previous.author || result.books[0]?.author || '' }));
      } else {
        const author = result.book.author === 'Автор не указан' && book.author ? book.author : result.book.author;
        setDraft({ ...result.book, author, document: { ...result.book.document, author }, coverUrl: result.book.coverUrl || book.coverUrl });
        setSourceInfo(`Текст загружен · ${languageInfo(book.language)?.label} · ${result.chapterCount} разделов · Викитека`);
      }
    } catch (error) {
      if (version === generation.current && !controller.signal.aborted) setLoadError(error instanceof Error ? error.message : 'Не удалось загрузить текст.');
    } finally { if (version === generation.current) { setIsFetching(false); setProgress(''); } }
  };

  const parsePdf = async (file: File, report: (message: string) => void) => {
    report('Загружаем движок PDF…');
    // @ts-ignore - loaded only for local PDF uploads.
    const pdfjs = await import('https://esm.sh/pdfjs-dist@3.11.174');
    pdfjs.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
    const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    let text = '';
    for (let page = 1; page <= pdf.numPages; page++) {
      report(`Читаем страницу ${page} из ${pdf.numPages}…`);
      const content = await (await pdf.getPage(page)).getTextContent();
      text += `${content.items.map((item: { str?: string }) => item.str || '').join(' ')}\n\n`;
    }
    return text;
  };

  const upload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    cancelRead(); const version = generation.current;
    setIsFetching(true); setError(''); setLoadError(''); setEditions([]); setProgress('Читаем файл…');
    const report = (message: string) => { if (version === generation.current) setProgress(message); };
    try {
      let content: string;
      let imported: Awaited<ReturnType<typeof import('../../services/epub/import')['importEpub']>> | undefined;
      if (/\.epub$/i.test(file.name) || file.type === 'application/epub+zip') {
        const { importEpub } = await import('../../services/epub/import');
        imported = await importEpub(await file.arrayBuffer(), report); content = imported.content;
      } else if (/\.pdf$/i.test(file.name) || file.type === 'application/pdf') content = await parsePdf(file, report);
      else if (/\.txt$/i.test(file.name) || file.type === 'text/plain') content = await file.text();
      else throw new Error('Используйте EPUB, PDF или TXT.');
      if (!content.trim()) throw new Error('В файле не найден текст.');
      if (version !== generation.current) return;
      setDraft(previous => ({ ...previous, title: imported?.title || previous.title || file.name.replace(/\.[^.]+$/, ''),
        author: imported?.author || previous.author, coverUrl: imported?.coverUrl || previous.coverUrl, content, document: imported?.document }));
      setSelected(null); setAllowCard(false); setSourceInfo(`Файл загружен: ${file.name}`);
    } catch (error) { if (version === generation.current) setError(error instanceof Error ? error.message : 'Не удалось прочитать файл.'); }
    finally { if (version === generation.current) { setIsFetching(false); setProgress(''); } event.target.value = ''; }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSave || saving.current) return;
    saving.current = true; setIsSaving(true); setError('');
    try {
      const content = draft.document ? draft.content : draft.content.trim();
      const book = await db.addBook({ id: draftId.current || (draftId.current = crypto.randomUUID()),
        title: draft.title.trim(), author: draft.author.trim(), coverUrl: draft.coverUrl.trim() || fallbackCover(draft.title),
        content: content || undefined, document: content ? draft.document : undefined,
        progress: 0, status: 'want_to_read', currentPage: 1, readingOffset: 0,
        totalPages: draft.document && content ? paginateDocument(draft.document).length : Math.max(1, Math.ceil(content.length / 2500)),
      }, userId);
      onBookSaved(book); reset(); onClose();
    } catch (error) { console.error('Book save failed', error); setError('Не удалось сохранить книгу. Данные остались в форме — попробуйте ещё раз.'); }
    finally { saving.current = false; setIsSaving(false); }
  };

  if (!isOpen) return null;
  return createPortal(<div className={styles.modalLayer}>
    <button type="button" className={styles.backdrop} onClick={close} disabled={isSaving} aria-label="Закрыть окно добавления книги" />
    <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="add-book-title">
      <header className={styles.header}>
        <div className={styles.heading}><span className={styles.headingIcon}><Search size={24} /></span><h3 id="add-book-title" className={styles.title}>Добавить книгу</h3></div>
        <button type="button" onClick={close} disabled={isSaving} className={styles.closeButton} aria-label="Закрыть"><X size={28} /></button>
      </header>
      <div className={styles.tabs}>
        <button type="button" disabled={isSaving} onClick={backToSearch} className={classNames(styles.tabButton, mode === 'search' && styles.tabButtonActive)}>Поиск</button>
        <button type="button" disabled={isSaving} onClick={() => { if (mode !== 'manual') openManual(); }} className={classNames(styles.tabButton, mode === 'manual' && styles.tabButtonActive)}>Вручную</button>
      </div>
      {error && <div role="alert" className={styles.error}>{error}</div>}
      <div hidden={mode !== 'search'}><BookSearch active={mode === 'search'} onSelect={book => void selectBook(book)} onManual={openManual} /></div>
      {mode === 'manual' && <form onSubmit={save} className={styles.form}>
        {isFetching && <div role="status" className={styles.progress}><Download size={20} /><div><p>Загружаем книгу</p><span>{progress}</span></div></div>}
        {editions.length > 0 && <div className={styles.editions}>
          <h4>Выберите издание</h4><p>У произведения несколько версий. Загрузим текст выбранного издания.</p>
          {editions.map(book => <button type="button" key={book.id} onClick={() => void selectBook(book)}>{book.editionLabel || book.sourcePage}</button>)}
        </div>}
        {loadError && <div role="alert" className={styles.error}><p>{loadError}</p><div className={styles.recovery}>
          <button type="button" onClick={() => { if (selected) void selectBook(selected); }}>Повторить загрузку</button>
          <button type="button" onClick={() => { setAllowCard(true); setEditions([]); }}>Добавить в планы без текста</button>
        </div></div>}
        {sourceInfo && <p className={styles.sourceInfo}>{sourceInfo}</p>}
        {selected && <p className={styles.sourceInfo}>{selected.editionLabel && <span>{selected.editionLabel} · </span>}<a href={selected.sourceUrl} target="_blank" rel="noopener noreferrer">Открыть источник <ExternalLink size={13} /></a></p>}
        {!isFetching && !hasContent && !editions.length && (!selected?.hasReadableText || allowCard) && <p className={styles.cardNotice}>Без текста · можно добавить в планы</p>}
        <input ref={fileInput} type="file" accept=".txt,.pdf,.epub" onChange={upload} className={styles.fileInput} aria-label="Файл книги" />
        <button type="button" disabled={isBusy} onClick={() => fileInput.current?.click()} className={styles.uploadBox}>
          <span className={styles.uploadIcon}><Upload size={24} /></span><span className={styles.uploadText}><strong>Загрузить файл</strong><small>EPUB, PDF или TXT</small></span>
        </button>
        <div className={styles.fields}>
          <div className={styles.metaFields}>
            <label className={styles.field}><span>Название книги</span><input required disabled={isBusy} value={draft.title} onChange={event => setDraft(previous => ({ ...previous, title: event.target.value }))} placeholder="Название" /></label>
            <label className={styles.field}><span>Автор</span><input required disabled={isBusy} value={draft.author} onChange={event => setDraft(previous => ({ ...previous, author: event.target.value }))} placeholder="Имя автора" /></label>
            <label className={styles.field}><span>Ссылка на обложку</span><div className={styles.coverInput}><ImageIcon size={18} /><input disabled={isBusy} value={draft.coverUrl} onChange={event => setDraft(previous => ({ ...previous, coverUrl: event.target.value }))} placeholder="https://…" /></div></label>
          </div>
          <label className={styles.contentField}><span>{draft.document ? 'Предпросмотр' : 'Текст'}</span>
            <textarea disabled={isBusy} readOnly={!!draft.document} value={draft.document ? draft.content.slice(0,8000) : draft.content}
              onChange={event => setDraft(previous => ({ ...previous, content: event.target.value }))} placeholder="Вставьте текст или загрузите файл" />
          </label>
        </div>
        <footer className={styles.actions}>
          <button type="button" disabled={isSaving} onClick={backToSearch} className={styles.backButton}>Назад</button>
          <button type="submit" disabled={!canSave} className={styles.saveButton}>{isSaving ? <Loader2 className={styles.spinner} size={18} /> : <Plus size={18} />}{isFetching ? 'Загружаем…' : editions.length ? 'Выберите издание' : hasContent ? 'Сохранить' : 'В планы'}</button>
        </footer>
      </form>}
    </section>
  </div>, document.body);
};
