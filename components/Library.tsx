
import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Annotation, Book, BookSummary, User } from '../types';
import { Plus, Trash2, LayoutGrid, List, CheckCircle2, PlayCircle, Bookmark, BookOpen, FileUp } from 'lucide-react';
import { Reader } from './Reader';
import { db } from '../services/db';
import { bookSummary } from '../services/books';
import { ConfirmDialog } from './ConfirmDialog';
import { AddBookModal } from './books/AddBookModal';
import { ErrorNotice } from './ErrorNotice';
import { findTextRange, paginateDocument, pageForOffset } from '../services/epub/document';

interface LibraryProps {
  books: BookSummary[];
  setBooks: React.Dispatch<React.SetStateAction<BookSummary[]>>;
  user: User;
  onUpdateUser?: (user: User) => void;
  pendingBookId?: string | null;
  onConsumePendingBook?: () => void;
}

export const Library: React.FC<LibraryProps> = ({ books, setBooks, user, onUpdateUser, pendingBookId, onConsumePendingBook }) => {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [loadingBookId, setLoadingBookId] = useState<string | null>(null);
  const [failedBook, setFailedBook] = useState<BookSummary | null>(null);
  const openVersion = useRef(0);
  const shelfRef = useRef(books);
  shelfRef.current = books;
  const [showAddModal, setShowAddModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [bookToDelete, setBookToDelete] = useState<BookSummary | null>(null);
  const [savingBookId, setSavingBookId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);
  const replaceInput = useRef<HTMLInputElement>(null);
  const replaceTarget = useRef<BookSummary | null>(null);
  const [importProgress, setImportProgress] = useState('');

  useEffect(() => () => { openVersion.current++; }, []);

  const replaceEpub = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const book = replaceTarget.current;
    event.target.value = '';
    if (!file || !book || savingRef.current) return;
    savingRef.current = true;
    setSavingBookId(book.id);
    setError(null);
    setFailedBook(null);
    try {
      const { importEpub } = await import('../services/epub/import');
      const [imported, previous] = await Promise.all([
        importEpub(await file.arrayBuffer(), setImportProgress),
        book.hasContent ? db.getBookContent(book.id, user.id) : Promise.resolve({ content: undefined, document: undefined }),
      ]);
      const pages = paginateDocument(imported.document);
      const previousPages = previous.document ? paginateDocument(previous.document) : [];
      const previousOffset = book.readingOffset ?? previousPages[(book.currentPage || 1) - 1]?.start ?? ((book.currentPage || 1) - 1) * 2500;
      const anchor = previous.content?.slice(previousOffset, previousOffset + 160).trim();
      const match = anchor && findTextRange(imported.content, anchor);
      const page = book.status === 'completed' ? pages.length : match ? pageForOffset(pages, match.start) + 1
        : Math.min(pages.length, Math.max(1, Math.round(((book.currentPage || 1) - 1) / (book.totalPages || 1) * pages.length) + 1));
      const saved = await db.replaceBookContent({ ...book, ...imported, coverUrl: imported.coverUrl || book.coverUrl,
        currentPage: page, totalPages: pages.length, progress: book.progress === 0 && page === 1 ? 0 : Math.floor(page / pages.length * 100),
        readingOffset: match ? match.start : pages[page - 1].start,
      }, user.id);
      setBooks(previous => previous.map(item => item.id === saved.id ? bookSummary(saved) : item));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Не удалось заменить EPUB.');
    } finally {
      savingRef.current = false;
      setSavingBookId(null);
      setImportProgress('');
    }
  };

  const chooseReplacement = useCallback((book: BookSummary) => { replaceTarget.current = book; replaceInput.current?.click(); }, []);
  const openBook = useCallback(async (book: BookSummary) => {
    const version = ++openVersion.current;
    setLoadingBookId(null);
    setError(null);
    setFailedBook(null);
    if (!book.hasContent) { chooseReplacement(book); return; }
    setLoadingBookId(book.id);
    try {
      const [content, annotations] = await Promise.all([
        db.getBookContent(book.id, user.id), db.getBookAnnotations(book.id, user.id),
      ]);
      if (openVersion.current !== version) return;
      if (!content.content?.trim()) { chooseReplacement(book); return; }
      const latest = shelfRef.current.find(item => item.id === book.id);
      if (!latest) return;
      setSelectedBook({ ...latest, ...content, annotations, annotationCount: annotations.length });
      setBooks(previous => previous.map(item => item.id === book.id ? { ...item, annotationCount: annotations.length } : item));
    } catch {
      if (openVersion.current !== version) return;
      setFailedBook(book);
      setError('Не удалось открыть книгу. Проверьте соединение и повторите загрузку.');
    } finally {
      if (openVersion.current === version) setLoadingBookId(null);
    }
  }, [user.id, chooseReplacement, setBooks]);

  const refreshProfile = async () => {
    try {
      const profile = await db.getPublicProfile(user.id);
      onUpdateUser?.({ ...user, ...profile, email: user.email });
    } catch (error) { console.error('Failed to refresh profile', error); }
  };

  const saveBook = async (book: Book) => {
    if (savingRef.current) throw new Error('Сохранение уже выполняется');
    savingRef.current = true;
    setSavingBookId(book.id);
    try {
      const savedBook = await db.updateBook(book, user.id);
      const summary = bookSummary(savedBook);
      setBooks(previous => previous.map(item => item.id === savedBook.id ? summary : item));
      setSelectedBook(current => current?.id === savedBook.id ? { ...current, ...summary } : current);
      const previousBook = books.find(item => item.id === book.id);
      if (previousBook?.status !== savedBook.status) void refreshProfile();
    } finally { savingRef.current = false; setSavingBookId(null); }
  };

  const updateAnnotations = (bookId: string, annotations: Annotation[]) => {
    setSelectedBook(current => current?.id === bookId ? { ...current, annotations, annotationCount: annotations.length } : current);
    setBooks(previous => previous.map(book => book.id === bookId ? { ...book, annotationCount: annotations.length } : book));
  };
  const saveAnnotation = async (annotation: Annotation) => {
    if (!selectedBook) return;
    const saved = await db.saveAnnotation(selectedBook.id, user.id, selectedBook.title, annotation);
    updateAnnotations(selectedBook.id, [...(selectedBook.annotations || []).filter(item => item.id !== saved.id), saved]);
  };
  const deleteAnnotation = async (id: string) => {
    if (!selectedBook) return;
    await db.deleteAnnotation(id, selectedBook.id, user.id);
    updateAnnotations(selectedBook.id, (selectedBook.annotations || []).filter(item => item.id !== id));
  };

  const deleteBook = async () => {
    if (!bookToDelete || savingRef.current) return;
    savingRef.current = true;
    setSavingBookId(bookToDelete.id);
    setError(null); setFailedBook(null);
    try {
      await db.deleteBook(bookToDelete.id, user.id);
      setBooks(previous => previous.filter(book => book.id !== bookToDelete.id));
      setBookToDelete(null);
      void refreshProfile();
    } catch {
      setBookToDelete(null);
      setError('Не удалось удалить книгу. Проверьте соединение и попробуйте ещё раз.');
    } finally { savingRef.current = false; setSavingBookId(null); }
  };

  const filteredBooks = useMemo(() => {
    return books.filter(b => statusFilter === 'all' || b.status === statusFilter);
  }, [books, statusFilter]);

  // Открытие книги в читалке по запросу извне (например, кнопка "Продолжить чтение" на главной)
  useEffect(() => {
    if (!pendingBookId) return;
    const target = books.find(b => b.id === pendingBookId);
    if (target) void openBook(target);
    onConsumePendingBook?.();
  }, [pendingBookId, books, onConsumePendingBook, openBook]);

  const handleStatusChange = async (book: Book, newStatus: Book['status']) => {
    if (savingRef.current || book.status === newStatus) return;
    setError(null);
    const updatedBook: Book = { 
      ...book, 
      status: newStatus,
      currentPage: newStatus === 'completed' ? book.totalPages : newStatus === 'want_to_read' ? 1 : book.currentPage,
      readingOffset: newStatus === 'completed' ? undefined : newStatus === 'want_to_read' ? 0 : book.readingOffset,
      progress: newStatus === 'completed' ? 100 : (newStatus === 'want_to_read' ? 0 : book.progress)
    };
    try {
      await saveBook(updatedBook);
    } catch {
      setError('Не удалось сохранить статус книги. Изменения не применены. Попробуйте ещё раз.');
    }
  };

  if (selectedBook) {
      return createPortal(
        <Reader
            key={selectedBook.id}
            book={selectedBook}
            user={user}
            onClose={() => setSelectedBook(null)}
            onUpdateBook={saveBook}
            onSaveAnnotation={saveAnnotation}
            onDeleteAnnotation={deleteAnnotation}
            onActivitySaved={refreshProfile}
        />,
        document.body
      );
  }

  return (
    <div className="max-w-7xl min-w-0 mx-auto pb-12 space-y-6 md:space-y-8">
      <ConfirmDialog isOpen={!!bookToDelete} title="Удалить книгу?" message={`Вы собираетесь навсегда удалить "${bookToDelete?.title}" из вашей истории.`} onConfirm={deleteBook} onCancel={() => setBookToDelete(null)} isConfirming={!!savingBookId} />
      {error && <ErrorNotice message={error} onRetry={failedBook ? () => { void openBook(failedBook); } : undefined} />}
      {loadingBookId && <div className="flex items-center justify-between gap-4 text-sm text-stone-500" role="status">
        <span>Открываем книгу…</span><button type="button" onClick={() => { openVersion.current++; setLoadingBookId(null); }}>Отмена</button>
      </div>}
      <input ref={replaceInput} type="file" accept=".epub,application/epub+zip" className="hidden" aria-label="Заменить EPUB" onChange={replaceEpub} />
      {importProgress && <p role="status">{importProgress}</p>}

      <div className="flex flex-col gap-4">
        <div className="bg-white/40 dark:bg-stone-900/80 backdrop-blur-xl p-2 md:p-3 rounded-[2rem] border border-stone-100 dark:border-stone-800 flex flex-wrap items-center gap-2">
          <h2 className="sr-only">Библиотека</h2>
          <div className="min-w-0 flex-1 flex flex-wrap gap-1">
            {[
              { id: 'all', label: 'Все' }, 
              { id: 'reading', label: 'Читаю' }, 
              { id: 'want_to_read', label: 'В планах' }, 
              { id: 'completed', label: 'Прочитано' }
            ].map(tab => (
                <button 
                  key={tab.id} 
                  onClick={() => setStatusFilter(tab.id)} 
                  className={`
                    whitespace-nowrap min-h-[44px] px-2 sm:px-4 py-2 md:py-3 rounded-xl text-xs font-medium transition-colors duration-200
                    ${statusFilter === tab.id 
                      ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 shadow-xl' 
                      : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-300'}
                  `}
                >
                  {tab.label}
                </button>
            ))}
          </div>

          <div className="hidden md:flex bg-stone-100 dark:bg-stone-800 p-1 rounded-xl border border-stone-200/50 dark:border-stone-700">
              <button aria-label="Сетка" onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-md' : 'text-stone-400'}`}><LayoutGrid size={18} /></button>
              <button aria-label="Список" onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-md' : 'text-stone-400'}`}><List size={18} /></button>
          </div>
          <button aria-label="Добавить книгу" title="Добавить книгу" onClick={() => setShowAddModal(true)} className="min-h-[44px] min-w-[44px] px-3 sm:px-4 py-3 bg-amber-500 text-white rounded-xl flex items-center justify-center gap-2 text-xs font-semibold active:scale-95 transition-colors"><Plus size={18} aria-hidden="true" /><span className="hidden sm:inline">Добавить</span></button>
        </div>
      </div>

      <div className={viewMode === 'grid' ? "grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-6" : "space-y-3"}>
          {filteredBooks.length === 0 ? (
            <div className="col-span-full py-24 text-center border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-[3rem]">
                <BookOpen size={48} className="mx-auto mb-4 text-stone-300" />
                <p className="text-stone-500 font-bold uppercase tracking-widest text-sm">Здесь пока пусто</p>
            </div>
          ) : (
            filteredBooks.map((book, idx) => (
              viewMode === 'grid' ? (
                <div key={book.id} className={`group relative bg-white dark:bg-stone-900 rounded-[2.5rem] md:rounded-[3rem] border border-stone-100 dark:border-stone-800 overflow-hidden hover-lift transition-all animate-scale-in`} style={{ animationDelay: `${idx * 50}ms` }}>
                    <div className="p-6 md:p-8">
                        <div role="button" tabIndex={0} aria-label={`${book.hasContent ? 'Читать' : 'Загрузить EPUB'} «${book.title}»`} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openBook(book); } }} className="relative mb-6 md:mb-8 aspect-[2/3] overflow-hidden rounded-[2rem] md:rounded-[2.5rem] shadow-2xl transition-transform duration-700 group-hover:-rotate-2 cursor-pointer" onClick={() => { openBook(book); }}>
                            <img src={book.coverUrl} className="w-full h-full object-cover" alt="" />
                            <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="px-6 py-3 bg-white text-stone-900 rounded-2xl font-black uppercase text-[10px] tracking-widest translate-y-4 group-hover:translate-y-0 transition-all duration-500">{book.hasContent ? 'Читать сейчас' : 'Загрузить EPUB'}</span>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="min-h-[50px] md:min-h-[60px]">
                                <h3 className="font-serif font-black text-lg md:text-xl text-stone-900 dark:text-stone-100 leading-tight line-clamp-2">{book.title}</h3>
                                <p className="text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest mt-1">{book.author}{!book.hasContent && ' · Без текста'}</p>
                            </div>
                            
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest">
                                    <span>{book.progress}%</span>
                                    <span>{book.status === 'completed' ? 'Завершено' : book.status === 'reading' ? 'Читаю' : 'В планах'}</span>
                                </div>
                                <div className="h-1 w-full bg-stone-100 dark:bg-stone-950 rounded-full overflow-hidden">
                                    <div className={`h-full transition-all duration-1000 ${book.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${book.progress}%` }}></div>
                                </div>
                            </div>

                            <div className="pt-4 flex items-center justify-between border-t border-stone-50 dark:border-stone-800">
                                <div className="flex gap-1.5 md:gap-2">
                                    {['reading', 'want_to_read', 'completed'].map(st => (
                                        <button key={st} disabled={!!savingBookId} aria-label={st === 'reading' ? 'Читаю' : st === 'want_to_read' ? 'В планы' : 'Прочитано'} onClick={() => handleStatusChange(book, st as any)} className={`p-2 rounded-xl transition-all ${book.status === st ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-stone-300 hover:text-stone-500 dark:hover:text-stone-400'}`}>
                                            {st === 'reading' ? <PlayCircle size={16} /> : st === 'want_to_read' ? <Bookmark size={16} /> : <CheckCircle2 size={16} />}
                                        </button>
                                    ))}
                                </div>
                                <button aria-label={`Заменить EPUB «${book.title}»`} title="Загрузить EPUB заново с сохранением заметок" disabled={!!savingBookId} onClick={() => chooseReplacement(book)} className="p-2 text-stone-400 hover:text-amber-500"><FileUp size={16} /></button>
                                <button aria-label={`Удалить книгу «${book.title}»`} disabled={!!savingBookId} onClick={() => setBookToDelete(book)} className="p-2 text-stone-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    </div>
                </div>
              ) : (
                <div key={book.id} className="group relative bg-white/60 dark:bg-stone-900 hover:bg-white dark:hover:bg-stone-800 rounded-3xl p-3 md:p-4 border border-stone-100 dark:border-stone-800 flex items-center gap-4 md:gap-8 transition-all hover:shadow-xl hover:-translate-y-1 animate-fade-in-up" style={{ animationDelay: `${idx * 30}ms` }}>
                  <button type="button" aria-label={`${book.hasContent ? 'Читать' : 'Загрузить EPUB'} «${book.title}»`} className="w-16 h-24 md:w-20 md:h-28 shrink-0 relative cursor-pointer rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-amber-500" onClick={() => { openBook(book); }}>
                    <img src={book.coverUrl} className="w-full h-full object-cover rounded-xl shadow-lg group-hover:scale-105 transition-transform" alt="" />
                  </button>
                  
                  <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-2 md:gap-8">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif font-black text-sm md:text-xl text-stone-900 dark:text-stone-100 truncate">{book.title}</h3>
                      <p className="text-[9px] md:text-[10px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest mt-0.5">{book.author}{!book.hasContent && ' · Без текста'}</p>
                    </div>

                    <div className="w-full md:w-48 lg:w-64 space-y-1.5">
                      <div className="flex justify-between items-center text-[9px] font-black text-stone-400 dark:text-stone-500 uppercase tracking-widest">
                        <span>{book.progress}%</span>
                        <span className={book.status === 'completed' ? 'text-emerald-500' : 'text-amber-500'}>{book.status === 'completed' ? 'Завершено' : book.status === 'reading' ? 'Читаю' : 'В планах'}</span>
                      </div>
                      <div className="h-1.5 w-full bg-stone-100 dark:bg-stone-950 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ${book.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${book.progress}%` }}></div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 md:gap-3 shrink-0">
                    <div className="hidden sm:flex items-center gap-1">
                      {['reading', 'want_to_read', 'completed'].map(st => (
                        <button 
                          key={st}
                          disabled={!!savingBookId}
                          onClick={() => handleStatusChange(book, st as any)} 
                          title={st === 'reading' ? 'Читаю' : st === 'want_to_read' ? 'В планы' : 'Прочитано'}
                          className={`p-2 rounded-xl transition-all ${book.status === st ? 'bg-amber-500 text-white shadow-md' : 'text-stone-300 hover:text-stone-500 dark:hover:text-stone-400 hover:bg-stone-50 dark:hover:bg-white/5'}`}
                        >
                          {st === 'reading' ? <PlayCircle size={18} /> : st === 'want_to_read' ? <Bookmark size={18} /> : <CheckCircle2 size={18} />}
                        </button>
                      ))}
                    </div>
                    <button aria-label={`Заменить EPUB «${book.title}»`} title="Загрузить EPUB заново с сохранением заметок" disabled={!!savingBookId} onClick={() => chooseReplacement(book)} className="p-2 text-stone-400 hover:text-amber-500"><FileUp size={16} /></button>
                                <button aria-label={`Удалить книгу «${book.title}»`} disabled={!!savingBookId} onClick={() => setBookToDelete(book)} className="p-2 md:p-3 text-stone-300 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={18} /></button>
                  </div>
                </div>
              )
            ))
          )}
      </div>

      <AddBookModal
        isOpen={showAddModal}
        userId={user.id}
        onClose={() => setShowAddModal(false)}
        onBookSaved={(savedBook) => {
          setBooks(prev => [bookSummary(savedBook), ...prev]);
          void refreshProfile();
        }}
      />
      
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.1); border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); }
      `}</style>
    </div>
  );
};
