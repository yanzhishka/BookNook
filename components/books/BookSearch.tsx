import { useEffect, useState } from 'react';
import { BookOpen, ChevronDown, Loader2, Search } from 'lucide-react';
import { BOOK_LANGUAGES, languageInfo, searchBooks, type BookLookupResult } from '../../services/bookLookup';
import type { BookLanguage } from '../../shared/bookCatalog';
import styles from './BookSearch.module.css';

export function BookSearch({ active, onSelect, onManual }: {
  active: boolean; onSelect: (book: BookLookupResult) => void; onManual: () => void;
}) {
  const [query, setQuery] = useState('');
  const [criteria, setCriteria] = useState({ query: '', language: 'ru' as BookLanguage, onlyReadable: true });
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [books, setBooks] = useState<BookLookupResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    setLoading(true); setError(''); setWarnings([]);
    if (page === 1) setBooks([]);
    void searchBooks({ ...criteria, page }, controller.signal).then(result => {
      if (controller.signal.aborted) return;
      setBooks(previous => page === 1 ? result.books : [...previous, ...result.books.filter(book => !previous.some(item => item.id === book.id))]);
      setHasMore(result.hasMore); setWarnings(result.warnings);
    }).catch(error => { if (!controller.signal.aborted) setError(error instanceof Error ? error.message : 'Не удалось найти книги.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [active, criteria, page, revision]);

  const submit = (value = query) => {
    const text = value.trim();
    if (text.length === 1) { setError('Введите хотя бы два символа названия или имени автора.'); return; }
    setQuery(text); setPage(1); setCriteria(previous => ({ ...previous, query: text })); setRevision(previous => previous + 1);
  };

  return <div className={styles.root}>
    <form className={styles.search} onSubmit={event => { event.preventDefault(); submit(); }}>
      <input aria-label="Название книги или автор" placeholder="Название книги или автор" value={query} onChange={event => setQuery(event.target.value)} autoFocus />
      <button type="submit"><Search size={18} aria-hidden="true" /><span>Найти</span></button>
    </form>
    <div className={styles.filters}>
      <label><span className="sr-only">Язык книги</span>
        <select value={criteria.language} onChange={event => { setPage(1); setCriteria(previous => ({ ...previous, language: event.target.value as BookLanguage })); }}>
          {BOOK_LANGUAGES.map(language => <option key={language.code} value={language.code}>{language.label}</option>)}
        </select>
      </label>
      <label className={styles.checkbox}><input type="checkbox" checked={criteria.onlyReadable} onChange={event => {
        setPage(1); setCriteria(previous => ({ ...previous, onlyReadable: event.target.checked }));
      }} />Только с текстом</label>
    </div>
    <div className={styles.authors} role="group" aria-label="Поиск по автору">
      {languageInfo(criteria.language)!.authors.map(author => <button key={author} onClick={() => submit(author)}>{author}</button>)}
    </div>
    <h4 className="sr-only">Результаты поиска</h4>
    {loading && <div className={styles.resultHeading} role="status"><Loader2 size={16} className={styles.spinner} />Ищем…</div>}
    {error && <div role="alert" className={styles.error}><p>{error}</p><button onClick={() => setRevision(previous => previous + 1)}>Повторить</button></div>}
    {warnings.map(warning => <p key={warning} className={styles.hint}>{warning}</p>)}
    {!loading && !error && !books.length && <div className={styles.empty}>
      <BookOpen size={36} /><h4>Ничего не нашлось</h4>
      <p>Попробуйте другое название или язык</p>
      <button onClick={onManual}>Загрузить файл</button>
    </div>}
    <div className={styles.results} aria-busy={loading}>
      {books.map(book => <button key={book.id} className={styles.card} onClick={() => onSelect(book)}>
        <span className={styles.cover}><BookOpen size={25} aria-hidden="true" />{book.coverUrl && <img src={book.coverUrl} alt="" loading="lazy" onError={event => { event.currentTarget.style.display = 'none'; }} />}</span>
        <span className={styles.book}>
          <strong>{book.title}</strong>{book.author && <span className={styles.author}>{book.author}</span>}
          <span className={styles.meta}>{languageInfo(book.language)?.label} · {book.provider === 'wikisource' ? 'Викитека' : 'Open Library'}{book.firstPublishYear ? ` · ${book.firstPublishYear}` : ''}</span>
          <span className={book.hasReadableText ? styles.readable : styles.metadataOnly}>{book.hasReadableText ? 'С текстом' : 'Без текста'}</span>
        </span>
      </button>)}
    </div>
    {hasMore && !error && <button className={styles.more} disabled={loading} onClick={() => setPage(previous => previous + 1)}><ChevronDown size={18} />{loading ? 'Загружаем…' : 'Показать ещё'}</button>}
  </div>;
}
