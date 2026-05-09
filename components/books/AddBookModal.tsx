import React, { useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Download,
  FileText,
  Globe,
  Image as ImageIcon,
  Loader2,
  Plus,
  Search,
  Sparkles,
  Upload,
  X,
} from 'lucide-react';
import { Book } from '../../types';
import { db } from '../../services/db';
import {
  BookLookupResult,
  fetchBookText,
  searchBooks,
} from '../../services/bookLookup';
import { classNames } from '../../utils/classNames';
import styles from './AddBookModal.module.css';

interface AddBookModalProps {
  isOpen: boolean;
  userId: string;
  onClose: () => void;
  onBookSaved: (book: Book) => void;
}

type AddMode = 'search' | 'manual';

interface DraftBook {
  title: string;
  author: string;
  coverUrl: string;
  content: string;
}

const EMPTY_BOOK: DraftBook = {
  title: '',
  author: '',
  coverUrl: '',
  content: '',
};

const getFallbackCover = (title: string) => {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(title || 'Book')}&background=random&size=512`;
};

const getManualContentHint = (book: BookLookupResult) => {
  const baseHint = book.description ? `${book.description}\n\n` : '';
  return `${baseHint}[Полный текст не найден автоматически. Можно загрузить EPUB, PDF или TXT вручную.]`;
};

export const AddBookModal: React.FC<AddBookModalProps> = ({
  isOpen,
  userId,
  onClose,
  onBookSaved,
}) => {
  const [mode, setMode] = useState<AddMode>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<BookLookupResult[]>([]);
  const [selectedBookId, setSelectedBookId] = useState<string | null>(null);
  const [draftBook, setDraftBook] = useState<DraftBook>(EMPTY_BOOK);

  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingText, setIsFetchingText] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textRequestRef = useRef<AbortController | null>(null);

  const isBusy = isSaving || isFetchingText;

  useEffect(() => {
    if (!isOpen) return;

    const trimmedQuery = query.trim();
    if (trimmedQuery.length < 2) {
      setResults([]);
      setIsSearching(false);
      return;
    }

    const controller = new AbortController();
    const searchTimer = window.setTimeout(async () => {
      setIsSearching(true);
      setError(null);

      try {
        const books = await searchBooks(trimmedQuery, controller.signal);
        setResults(books);
      } catch (searchError: any) {
        if (searchError.name !== 'AbortError') {
          setError('Не удалось найти книги. Проверьте локальный API и интернет.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, 420);

    return () => {
      window.clearTimeout(searchTimer);
      controller.abort();
    };
  }, [isOpen, query]);

  const resetModal = () => {
    setMode('search');
    setQuery('');
    setResults([]);
    setSelectedBookId(null);
    setDraftBook(EMPTY_BOOK);
    setError(null);
    setUploadProgress('');
  };

  const closeModal = () => {
    if (isBusy) return;
    textRequestRef.current?.abort();
    resetModal();
    onClose();
  };

  const parsePdf = async (file: File): Promise<string> => {
    setUploadProgress('Загрузка движка PDF...');
    // @ts-ignore - runtime import keeps the parser out of the main bundle.
    const pdfjsLib = await import('https://esm.sh/pdfjs-dist@3.11.174');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    let text = '';

    for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
      setUploadProgress(`Обработка страницы ${pageNumber} из ${pdf.numPages}...`);
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();
      text += `${textContent.items.map((item: any) => item.str).join(' ')}\n\n`;
    }

    return text;
  };

  const parseEpub = async (file: File): Promise<string> => {
    setUploadProgress('Распаковка EPUB...');
    // @ts-ignore - runtime import keeps the parser out of the main bundle.
    const { default: JSZip } = await import('https://esm.sh/jszip@3.10.1');
    const zip = await JSZip.loadAsync(file);
    const parser = new DOMParser();
    const contentFiles = Object.keys(zip.files)
      .filter((fileName) => /\.(x?html?|htm)$/i.test(fileName))
      .sort();

    let text = '';

    for (let index = 0; index < contentFiles.length; index += 1) {
      setUploadProgress(`Чтение главы ${index + 1} из ${contentFiles.length}...`);
      const fileData = await zip.files[contentFiles[index]].async('string');
      const document = parser.parseFromString(fileData, 'text/html');
      text += `${document.body.innerText || document.body.textContent || ''}\n\n`;
    }

    if (!text.trim()) {
      throw new Error('Не удалось извлечь текст из EPUB.');
    }

    return text;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsFetchingText(true);
    setUploadProgress('Начинаем обработку...');
    setError(null);

    try {
      let extractedText = '';

      if (file.type === 'application/pdf') {
        extractedText = await parsePdf(file);
      } else if (file.type === 'application/epub+zip' || file.name.endsWith('.epub')) {
        extractedText = await parseEpub(file);
      } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        extractedText = await file.text();
      } else {
        throw new Error('Неподдерживаемый формат. Используйте PDF, EPUB или TXT.');
      }

      if (extractedText.trim().length < 50) {
        throw new Error('Текст не найден или файл пуст.');
      }

      const fileTitle = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
      setDraftBook((currentBook) => ({
        ...currentBook,
        title: currentBook.title || fileTitle,
        content: extractedText,
      }));
      setUploadProgress('');
    } catch (uploadError: any) {
      setError(uploadError.message || 'Не удалось прочитать файл.');
      setUploadProgress('');
    } finally {
      setIsFetchingText(false);
      event.target.value = '';
    }
  };

  const selectBook = async (book: BookLookupResult) => {
    textRequestRef.current?.abort();
    const controller = new AbortController();
    textRequestRef.current = controller;

    setMode('manual');
    setSelectedBookId(book.id);
    setError(null);
    setIsFetchingText(true);
    setUploadProgress(book.hasReadableText ? 'Ищем доступный текст...' : '');

    setDraftBook({
      title: book.title,
      author: book.author,
      coverUrl: book.coverUrl,
      content: book.description ? `${book.description}\n\n` : '',
    });

    try {
      const textResult = book.hasReadableText
        ? await fetchBookText(book.iaIds, controller.signal)
        : null;

      setDraftBook((currentBook) => ({
        ...currentBook,
        content: textResult?.content || getManualContentHint(book),
      }));
    } catch (textError: any) {
      if (textError.name !== 'AbortError') {
        setDraftBook((currentBook) => ({
          ...currentBook,
          content: getManualContentHint(book),
        }));
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsFetchingText(false);
        setUploadProgress('');
      }
    }
  };

  const saveBook = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!draftBook.title.trim() || !draftBook.author.trim()) {
      setError('Укажите название и автора.');
      return;
    }

    setIsSaving(true);
    setError(null);

    try {
      const content = draftBook.content.trim() || 'Текст книги пока не добавлен...';
      const savedBook = await db.addBook(
        {
          id: '',
          title: draftBook.title.trim(),
          author: draftBook.author.trim(),
          coverUrl: draftBook.coverUrl.trim() || getFallbackCover(draftBook.title),
          content,
          progress: 0,
          status: 'want_to_read',
          totalPages: Math.max(1, Math.ceil(content.length / 2500)),
        },
        userId,
      );

      onBookSaved(savedBook);
      resetModal();
      onClose();
    } catch (saveError) {
      console.error('Save book error:', saveError);
      setError('Не удалось сохранить книгу в локальную базу.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={styles.modalLayer}>
      <button
        type="button"
        className={styles.backdrop}
        onClick={closeModal}
        aria-label="Закрыть окно добавления книги"
      />

      <section className={styles.dialog} role="dialog" aria-modal="true" aria-labelledby="add-book-title">
        <header className={styles.header}>
          <div className={styles.heading}>
            <span className={styles.headingIcon}>
              <Search size={24} />
            </span>
            <h3 id="add-book-title" className={styles.title}>
              Добавить книгу
            </h3>
          </div>

          <button type="button" onClick={closeModal} className={styles.closeButton} aria-label="Закрыть">
            <X size={32} />
          </button>
        </header>

        <div className={styles.tabs}>
          <button
            type="button"
            onClick={() => setMode('search')}
            className={classNames(styles.tabButton, mode === 'search' && styles.tabButtonActive)}
          >
            Глобальный поиск
          </button>
          <button
            type="button"
            onClick={() => setMode('manual')}
            className={classNames(styles.tabButton, mode === 'manual' && styles.tabButtonActive)}
          >
            Вручную / Файл
          </button>
        </div>

        {error && <div className={styles.error}>{error}</div>}

        {mode === 'search' ? (
          <div className={styles.searchView}>
            <div className={styles.searchBox}>
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className={styles.searchInput}
                placeholder="Название книги или автор..."
                autoFocus
              />
              <span className={styles.searchButton}>
                {isSearching ? <Loader2 className={styles.spinner} size={18} /> : <Globe size={18} />}
                Искать
              </span>
            </div>

            <div className={styles.results}>
              {isSearching ? (
                <div className={styles.emptyState}>
                  <Loader2 size={48} className={classNames(styles.spinner, styles.accentSpinner)} />
                  <p>Просматриваем Open Library...</p>
                </div>
              ) : results.length === 0 ? (
                <div className={styles.emptyState}>
                  <BookOpen size={64} />
                  <p>Начните вводить название или автора</p>
                </div>
              ) : (
                <div className={styles.resultGrid}>
                  {results.map((book) => (
                    <button
                      type="button"
                      key={book.id}
                      onClick={() => selectBook(book)}
                      className={classNames(
                        styles.resultCard,
                        selectedBookId === book.id && styles.resultCardSelected,
                      )}
                    >
                      <span className={styles.coverWrap}>
                        <img src={book.coverUrl} className={styles.cover} alt="" />
                      </span>
                      <span className={styles.resultText}>
                        <span className={styles.resultTitle}>{book.title}</span>
                        <span className={styles.resultAuthor}>{book.author}</span>
                        <span className={styles.resultMeta}>
                          <span>{book.firstPublishYear || 'год ?'}</span>
                          <span>{book.pageCount || '?'} стр.</span>
                          {book.hasReadableText && (
                            <span className={styles.textBadge}>
                              <FileText size={12} />
                              текст
                            </span>
                          )}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <form onSubmit={saveBook} className={styles.form}>
            {isFetchingText && (
              <div className={styles.progress}>
                <Download className={styles.bounce} size={18} />
                <div>
                  <p>Подгружаем текст книги...</p>
                  {uploadProgress && <span>{uploadProgress}</span>}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className={styles.uploadBox}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".txt,.pdf,.epub"
                onChange={handleFileUpload}
                className={styles.fileInput}
              />
              <span className={styles.uploadIcon}>
                <Upload size={24} />
              </span>
              <span className={styles.uploadText}>
                <strong>Загрузите файл книги</strong>
                <small>EPUB, PDF или TXT</small>
              </span>
            </button>

            <div className={styles.fields}>
              <div className={styles.metaFields}>
                <label className={styles.field}>
                  <span>Название книги</span>
                  <input
                    required
                    value={draftBook.title}
                    onChange={(event) =>
                      setDraftBook((currentBook) => ({
                        ...currentBook,
                        title: event.target.value,
                      }))
                    }
                    placeholder="Напр. Гордость и предубеждение"
                  />
                </label>

                <label className={styles.field}>
                  <span>Автор</span>
                  <input
                    required
                    value={draftBook.author}
                    onChange={(event) =>
                      setDraftBook((currentBook) => ({
                        ...currentBook,
                        author: event.target.value,
                      }))
                    }
                    placeholder="Джейн Остин"
                  />
                </label>

                <label className={styles.field}>
                  <span>Ссылка на обложку</span>
                  <div className={styles.coverInput}>
                    <ImageIcon size={18} />
                    <input
                      value={draftBook.coverUrl}
                      onChange={(event) =>
                        setDraftBook((currentBook) => ({
                          ...currentBook,
                          coverUrl: event.target.value,
                        }))
                      }
                      placeholder="https://example.com/cover.jpg"
                    />
                  </div>
                </label>
              </div>

              <label className={styles.contentField}>
                <span>
                  Текст книги
                  {isFetchingText && <Sparkles size={12} className={styles.bounce} />}
                </span>
                <textarea
                  value={draftBook.content}
                  onChange={(event) =>
                    setDraftBook((currentBook) => ({
                      ...currentBook,
                      content: event.target.value,
                    }))
                  }
                  placeholder="Здесь появится текст книги, если Open Library или файл его предоставит..."
                />
              </label>
            </div>

            <footer className={styles.actions}>
              <button type="button" onClick={() => setMode('search')} className={styles.backButton}>
                Назад к поиску
              </button>
              <button
                type="submit"
                disabled={isSaving || !draftBook.title.trim()}
                className={styles.saveButton}
              >
                {isSaving ? <Loader2 className={styles.spinner} size={18} /> : <Plus size={18} />}
                Сохранить в библиотеку
              </button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
};
