
import React, { useState, useRef, useMemo } from 'react';
import { Book, User, Activity } from '../types';
import { Plus, BookOpen, Upload, Trash2, Search, ChevronRight, Loader2, LayoutGrid, List, CheckCircle2, PlayCircle, Bookmark, PenTool, X, Star, Sparkles, Check, Tag, MessageSquare } from 'lucide-react';
import { Reader } from './Reader';
import { db } from '../services/db';
import { ConfirmDialog } from './ConfirmDialog';

const CHARS_PER_PAGE = 2500;

const PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest=',
];

const STAFF_PICKS = [
  { id: 1342, title: "Pride and Prejudice", author: "Jane Austen", cover: "https://www.gutenberg.org/cache/epub/1342/pg1342.cover.medium.jpg" },
  { id: 11, title: "Alice's Adventures in Wonderland", author: "Lewis Carroll", cover: "https://www.gutenberg.org/cache/epub/11/pg11.cover.medium.jpg" },
  { id: 1661, title: "The Adventures of Sherlock Holmes", author: "Arthur Conan Doyle", cover: "https://www.gutenberg.org/cache/epub/1661/pg1661.cover.medium.jpg" },
  { id: 2701, title: "Moby Dick; Or, The Whale", author: "Herman Melville", cover: "https://www.gutenberg.org/cache/epub/2701/pg2701.cover.medium.jpg" },
  { id: 1513, title: "Romeo and Juliet", author: "William Shakespeare", cover: "https://www.gutenberg.org/cache/epub/1513/pg1513.cover.medium.jpg" },
  { id: 84, title: "Frankenstein; Or, The Modern Prometheus", author: "Mary Wollstonecraft Shelley", cover: "https://www.gutenberg.org/cache/epub/84/pg84.cover.medium.jpg" },
  { id: 98, title: "A Tale of Two Cities", author: "Charles Dickens", cover: "https://www.gutenberg.org/cache/epub/98/pg98.cover.medium.jpg" },
  { id: 145, title: "Middlemarch", author: "George Eliot", cover: "https://www.gutenberg.org/cache/epub/145/pg145.cover.medium.jpg" }
];

interface LibraryProps {
  books: Book[];
  setBooks: React.Dispatch<React.SetStateAction<Book[]>>;
  user: User;
}

interface GutenbergBook {
  id: number;
  title: string;
  authors: { name: string }[];
  formats: { [key: string]: string };
}

export const Library: React.FC<LibraryProps> = ({ books, setBooks, user }) => {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'catalog' | 'upload' | 'feed'>('feed');
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GutenbergBook[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const [reviewBook, setReviewBook] = useState<Book | null>(null);
  const [reviewText, setReviewText] = useState('');
  const [isPostingReview, setIsPostingReview] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredBooks = useMemo(() => {
    return books.filter(b => {
      return statusFilter === 'all' || b.status === statusFilter;
    });
  }, [books, statusFilter]);

  const handleStatusChange = async (book: Book, newStatus: Book['status']) => {
    const updatedBook: Book = { 
      ...book, 
      status: newStatus,
      progress: newStatus === 'completed' ? 100 : (newStatus === 'want_to_read' ? 0 : book.progress)
    };
    setBooks(prev => prev.map(b => b.id === book.id ? updatedBook : b));
    try {
      const synced = await db.updateBook(updatedBook, user.id);
      setBooks(prev => prev.map(b => b.id === synced.id ? synced : b));
    } catch (e) {
      console.error("Failed to update status in DB", e);
    }
  };

  const addFromCatalog = async (gBook: any) => {
    if (books.some(b => b.title === gBook.title)) return;
    setIsUploading(true);
    setErrorMessage(null);
    try {
      const formats: string[] = gBook.formats ? (Object.entries(gBook.formats)
        .filter(([key]) => key.toLowerCase().includes('text/plain'))
        .map(([_, url]) => url as string)) : [];
      
      const content = await tryFetchText(gBook.id, formats);
      const totalPages = Math.max(1, Math.ceil(content.length / CHARS_PER_PAGE));
      const author = gBook.authors ? gBook.authors.map((a: any) => a.name).join(', ') : gBook.author || 'Неизвестный автор';
      
      const bookData: Book = {
        id: '', 
        title: gBook.title,
        author: author,
        coverUrl: gBook.cover || gBook.formats?.['image/jpeg'] || `https://www.gutenberg.org/cache/epub/${gBook.id}/pg${gBook.id}.cover.medium.jpg`,
        progress: 0,
        status: 'want_to_read',
        content: content,
        currentPage: 1,
        totalPages: totalPages,
        myRating: 0,
        annotations: [],
        tags: []
      };
      const savedBook = await db.addBook(bookData, user.id);
      setBooks(prev => [...prev, savedBook]);
      setShowAddModal(false);
    } catch (e: any) {
      setErrorMessage(e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const tryFetchText = async (id: number, formatUrls: string[]): Promise<string> => {
    const urlsToTry = [
      ...formatUrls,
      `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`,
      `https://www.gutenberg.org/files/${id}/${id}-0.txt`,
      `https://www.gutenberg.org/files/${id}/${id}.txt`
    ];
    const uniqueUrls = Array.from(new Set(urlsToTry)).filter(u => u && u.includes('.txt'));
    for (const proxy of PROXIES) {
      for (const targetUrl of uniqueUrls) {
        try {
          const finalUrl = `${proxy}${encodeURIComponent(targetUrl)}`;
          const response = await fetch(finalUrl, { signal: AbortSignal.timeout(10000) });
          if (response.ok) {
            const text = await response.text();
            if (text.length > 1000 && !text.trim().startsWith('<!DOCTYPE') && !text.trim().startsWith('<html')) {
              return text.replace(/^\uFEFF/, '');
            }
          }
        } catch (err) { continue; }
      }
    }
    throw new Error("Не удалось загрузить текст.");
  };

  const searchClassics = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`https://gutendex.com/books/?search=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error("Сервер каталога временно недоступен");
      const data = await response.json();
      setSearchResults(data.results.slice(0, 10));
    } catch (e: any) {
      setErrorMessage(e.message || "Не удалось загрузить каталог.");
    } finally {
      setIsSearching(false);
    }
  };

  const handleDeleteBook = async () => {
      if (!bookToDelete) return;
      setIsDeleting(true);
      try {
          await db.deleteBook(bookToDelete.id);
          setBooks(prev => prev.filter(b => b.id !== bookToDelete.id));
          setBookToDelete(null);
      } finally { setIsDeleting(false); }
  };

  const handlePostReview = async () => {
    if (!reviewBook || !reviewText.trim()) return;
    setIsPostingReview(true);
    try {
        const activity: Activity = {
            id: '', user: user, book: reviewBook, type: 'review', content: reviewText,
            timestamp: 'Только что', likes: 0, likedBy: [], comments: []
        };
        await db.createActivity(activity);
        setReviewText('');
        setReviewBook(null);
        alert('Рецензия опубликована в сообществе!');
    } catch (e) { console.error(e); } finally { setIsPostingReview(false); }
  };

  if (isReading && selectedBook) {
      return (
        <Reader 
            book={selectedBook} 
            user={user}
            onClose={() => setIsReading(false)} 
            onUpdateBook={async (b) => {
                setSelectedBook(b);
                setBooks(prev => prev.map(old => old.id === b.id ? b : old));
                if (user.id !== 'guest') {
                  try {
                    const synced = await db.updateBook(b, user.id);
                    // Обновляем состояние читалки и библиотеки данными из БД (UUID)
                    setSelectedBook(synced);
                    setBooks(prev => prev.map(old => old.id === synced.id ? synced : old));
                  } catch (e) { console.error("Sync error:", e); }
                }
            }} 
        />
      );
  }

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <ConfirmDialog 
        isOpen={!!bookToDelete}
        title={isDeleting ? "Удаление..." : "Удалить книгу"}
        message={isDeleting ? "Пожалуйста, подождите..." : `Удалить "${bookToDelete?.title}"?`}
        onConfirm={handleDeleteBook}
        onCancel={() => !isDeleting && setBookToDelete(null)}
      />

      {reviewBook && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setReviewBook(null)} />
            <div className="bg-white dark:bg-stone-900 w-full max-w-xl p-8 rounded-[2.5rem] shadow-2xl relative z-10 animate-scale-in border border-stone-100 dark:border-stone-800">
                <div className="flex gap-6 mb-6">
                    <img src={reviewBook.coverUrl} className="w-16 h-24 object-cover rounded-xl shadow-lg" />
                    <div>
                        <h3 className="text-xl font-serif font-black dark:text-white">Написать о «{reviewBook.title}»</h3>
                        <p className="text-stone-400 text-sm font-medium">Ваши мысли будут видны сообществу.</p>
                    </div>
                </div>
                <textarea 
                    value={reviewText}
                    onChange={e => setReviewText(e.target.value)}
                    placeholder="Поделитесь своими впечатлениями..."
                    className="w-full h-40 p-4 bg-stone-50 dark:bg-stone-800 border-none outline-none rounded-2xl text-sm dark:text-white mb-6 resize-none"
                    autoFocus
                />
                <div className="flex gap-3">
                    <button onClick={() => setReviewBook(null)} className="flex-1 py-3 text-stone-500 font-bold hover:bg-stone-50 dark:hover:bg-stone-800 rounded-xl transition-colors">Отмена</button>
                    <button onClick={handlePostReview} disabled={isPostingReview || !reviewText.trim()} className="flex-1 py-3 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-xl font-black uppercase text-xs tracking-widest shadow-lg flex items-center justify-center gap-2">
                        {isPostingReview ? <Loader2 size={16} className="animate-spin" /> : <PenTool size={16} />}
                        Опубликовать
                    </button>
                </div>
            </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <div className="animate-fade-in-up">
            <h2 className="text-5xl font-serif font-black text-stone-900 dark:text-stone-100 tracking-tighter mb-2 leading-none">Библиотека</h2>
            <p className="text-stone-500 dark:text-stone-400 text-lg font-medium">Место, где ваши книги обретают голос.</p>
        </div>
        <button onClick={() => { setAddMode('feed'); setShowAddModal(true); }} className="w-full md:w-auto bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-8 py-4 rounded-2xl flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-xl font-black text-[10px] uppercase tracking-[0.3em] active:scale-95">
            <Plus size={20} /> <span>Добавить книгу</span>
        </button>
      </div>

      <div className="bg-white/50 dark:bg-stone-900/50 backdrop-blur-md p-4 rounded-[2rem] border border-stone-100 dark:border-stone-800 mb-10 flex flex-wrap items-center justify-between gap-4">
            <div className="flex bg-stone-100/50 dark:bg-stone-800/50 p-1 rounded-2xl">
                {[{ id: 'all', label: 'Все' }, { id: 'reading', label: 'Читаю' }, { id: 'want_to_read', label: 'В планах' }, { id: 'completed', label: 'Прочитано' }].map(tab => (
                    <button key={tab.id} onClick={() => setStatusFilter(tab.id)} className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${statusFilter === tab.id ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-md' : 'text-stone-400 hover:text-stone-600'}`}>{tab.label}</button>
                ))}
            </div>
            <div className="flex gap-2">
                <button onClick={() => setViewMode('grid')} className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-900' : 'text-stone-400 hover:bg-white/50 dark:hover:bg-stone-800/50'}`}><LayoutGrid size={20} /></button>
                <button onClick={() => setViewMode('list')} className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-900' : 'text-stone-400 hover:bg-white/50 dark:hover:bg-stone-800/50'}`}><List size={20} /></button>
            </div>
      </div>

      <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-10" : "space-y-4"}>
        {filteredBooks.map((book, idx) => (
            <div key={book.id} className={`group relative bg-white dark:bg-[#110f0e] border border-stone-100 dark:border-stone-800 overflow-hidden hover:shadow-2xl transition-all animate-scale-in hover-lift ${viewMode === 'grid' ? 'p-8 rounded-[3.5rem]' : 'p-4 rounded-[2rem] flex items-center justify-between'}`} style={{ animationDelay: `${idx * 50}ms` }}>
                <div className="absolute top-6 right-6 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button onClick={(e) => { e.stopPropagation(); setReviewBook(book); }} className="p-2.5 bg-white/90 dark:bg-stone-800/90 rounded-xl text-stone-500 hover:text-amber-600 transition-all backdrop-blur-md shadow-lg" title="Написать рецензию"><PenTool size={18} /></button>
                    <button onClick={(e) => { e.stopPropagation(); setBookToDelete(book); }} className="p-2.5 bg-white/90 dark:bg-stone-800/90 rounded-xl text-stone-500 hover:text-rose-600 transition-all backdrop-blur-md shadow-lg" title="Удалить"><Trash2 size={18} /></button>
                </div>
                <div className={`cursor-pointer ${viewMode === 'grid' ? 'flex flex-col gap-8' : 'flex items-center gap-6 flex-1'}`} onClick={() => { setSelectedBook(book); setIsReading(true); }}>
                    <div className="flex gap-6">
                        <div className={`${viewMode === 'grid' ? 'w-32 h-48' : 'w-16 h-24'} shrink-0 relative overflow-hidden rounded-[2rem] shadow-[0_20px_40px_-10px_rgba(0,0,0,0.3)]`}><img src={book.coverUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-1000 ease-out" alt="" /><div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div></div>
                        <div className="flex-1 flex flex-col justify-center min-w-0"><h3 className={`font-serif font-black leading-tight dark:text-stone-100 truncate group-hover:text-amber-500 transition-colors ${viewMode === 'grid' ? 'text-2xl mb-1' : 'text-lg'}`}>{book.title}</h3><p className="text-[10px] text-stone-400 font-black uppercase tracking-[0.2em]">{book.author}</p>
                            {viewMode === 'grid' && (
                                <div className="mt-6 flex items-center gap-4">
                                    <div className="text-[10px] font-black uppercase tracking-widest text-stone-300 dark:text-stone-600">Статус:</div>
                                    <div className="flex gap-1">{['reading', 'want_to_read', 'completed'].map((st) => (<button key={st} onClick={(e) => { e.stopPropagation(); handleStatusChange(book, st as any); }} className={`p-1.5 rounded-lg transition-all ${book.status === st ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-900 shadow-md' : 'text-stone-300 hover:text-stone-500 dark:hover:text-stone-400'}`}>{st === 'reading' ? <PlayCircle size={14} /> : st === 'want_to_read' ? <Bookmark size={14} /> : <CheckCircle2 size={14} />}</button>))}</div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <div className="flex justify-between items-end mb-1"><span className="text-[10px] font-black text-stone-400 uppercase tracking-widest">{book.progress}% завершено</span><span className="text-[8px] font-black text-stone-300 uppercase tracking-widest">{book.status === 'completed' ? 'Прочитано' : book.status === 'reading' ? 'В процессе' : 'В листе'}</span></div>
                        <div className="w-full bg-stone-100 dark:bg-stone-800 h-2 rounded-full overflow-hidden p-0.5 border border-stone-200/50 dark:border-white/5"><div className={`h-full rounded-full transition-all duration-1000 cubic-bezier(0.16, 1, 0.3, 1) ${book.status === 'completed' ? 'bg-gradient-to-r from-emerald-400 to-teal-500' : 'bg-gradient-to-r from-amber-400 to-orange-500'}`} style={{ width: `${book.progress}%` }} /></div>
                    </div>
                </div>
            </div>
        ))}
        {filteredBooks.length === 0 && (
            <div className="col-span-full py-32 flex flex-col items-center justify-center border-4 border-dashed border-stone-100 dark:border-stone-800 rounded-[4rem] text-stone-300 dark:text-stone-700 animate-fade-in"><BookOpen size={64} className="mb-6 opacity-20" /><p className="font-serif font-black text-2xl mb-2">Здесь пока тишина...</p><p className="text-sm font-bold uppercase tracking-widest opacity-40">Наполните свою полку новыми историями</p></div>
        )}
      </div>

      {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-xl transition-all duration-500" onClick={() => !isUploading && setShowAddModal(false)} />
              <div className="bg-white dark:bg-[#110f0e] rounded-[3.5rem] w-full max-w-2xl relative z-10 shadow-[0_50px_100px_-20px_rgba(0,0,0,0.5)] animate-scale-in border border-stone-100 dark:border-stone-800 overflow-hidden">
                  <div className="flex bg-stone-50 dark:bg-[#1c1917]/50 border-b border-stone-100 dark:border-stone-800">
                      <button onClick={() => setAddMode('feed')} className={`flex-1 py-8 font-black uppercase text-[10px] tracking-[0.3em] transition-all flex items-center justify-center gap-3 ${addMode === 'feed' ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white' : 'text-stone-400 hover:text-stone-600'}`}><Sparkles size={18} /> Топ-книг</button>
                      <button onClick={() => setAddMode('catalog')} className={`flex-1 py-8 font-black uppercase text-[10px] tracking-[0.3em] transition-all flex items-center justify-center gap-3 ${addMode === 'catalog' ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white' : 'text-stone-400 hover:text-stone-600'}`}><Search size={18} /> Каталог</button>
                      <button onClick={() => setAddMode('upload')} className={`flex-1 py-8 font-black uppercase text-[10px] tracking-[0.3em] transition-all flex items-center justify-center gap-3 ${addMode === 'upload' ? 'bg-white dark:bg-stone-900 text-stone-900 dark:text-white' : 'text-stone-400 hover:text-stone-600'}`}><Upload size={18} /> Загрузить</button>
                  </div>
                  <div className="p-12">
                      {addMode === 'feed' ? (
                          <div className="grid grid-cols-2 gap-6 max-h-[450px] overflow-y-auto custom-scrollbar pr-2">
                              {STAFF_PICKS.map(pick => (
                                  <div key={pick.id} onClick={() => !isUploading && addFromCatalog(pick)} className="p-5 bg-stone-50 dark:bg-stone-900 rounded-[2.5rem] border border-stone-100 dark:border-stone-800 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer transition-all flex gap-5 items-center group relative overflow-hidden">
                                      <div className="absolute top-0 right-0 p-2 opacity-0 group-hover:opacity-100 transition-opacity"><Plus size={16} className="text-amber-500" /></div>
                                      <img src={pick.cover} className="w-14 h-20 object-cover rounded-xl shadow-lg group-hover:scale-105 transition-transform" />
                                      <div className="min-w-0 flex-1"><h5 className="text-stone-900 dark:text-white font-serif font-black text-sm truncate mb-1">{pick.title}</h5><p className="text-[9px] font-black text-stone-400 uppercase truncate">от {pick.author}</p></div>
                                  </div>
                              ))}
                          </div>
                      ) : addMode === 'catalog' ? (
                          <div className="space-y-8">
                              <div className="relative group"><Search className="absolute left-6 top-1/2 -translate-y-1/2 text-stone-400 group-focus-within:text-amber-500 transition-colors" size={24} /><input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchClassics()} placeholder="Поиск по мировым шедеврам..." className="w-full pl-16 pr-6 py-6 bg-stone-50 dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-[2rem] outline-none focus:ring-4 ring-amber-500/10 text-stone-900 dark:text-white transition-all placeholder:text-stone-300 font-medium text-lg" /></div>
                              <div className="max-h-[350px] overflow-y-auto custom-scrollbar space-y-4 pr-2">{isSearching ? <div className="flex flex-col items-center py-16 gap-4"><Loader2 className="animate-spin text-amber-500" size={32} /><p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Ищем в архивах...</p></div> : searchResults.map(res => (<div key={res.id} onClick={() => !isUploading && addFromCatalog(res)} className="flex items-center gap-6 p-5 bg-stone-50 dark:bg-stone-900 rounded-[2.5rem] hover:bg-white dark:hover:bg-stone-800 border-2 border-transparent hover:border-amber-500/20 cursor-pointer transition-all group"><img src={res.formats['image/jpeg'] || `https://www.gutenberg.org/cache/epub/${res.id}/pg${res.id}.cover.small.jpg`} className="w-12 h-18 object-cover rounded-xl shadow-md" alt="" /><div className="flex-1 min-w-0"><h4 className="font-serif font-black text-stone-900 dark:text-stone-100 text-lg truncate group-hover:text-amber-500 transition-colors">{res.title}</h4><p className="text-[10px] font-black text-stone-400 uppercase mt-1">Добавить в дневник +</p></div></div>))}</div>
                          </div>
                      ) : (
                          <div className="space-y-6">
                              <div className="grid grid-cols-2 gap-4"><input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Название книги" className="p-5 bg-stone-50 dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-2xl outline-none text-stone-900 dark:text-white font-medium focus:ring-2 ring-amber-500/20" /><input value={newAuthor} onChange={e => setNewAuthor(e.target.value)} placeholder="Автор" className="p-5 bg-stone-50 dark:bg-stone-900 border border-stone-100 dark:border-stone-800 rounded-2xl outline-none text-stone-900 dark:text-white font-medium focus:ring-2 ring-amber-500/20" /></div>
                              <div onClick={() => fileInputRef.current?.click()} className="border-4 border-dashed rounded-[2.5rem] p-12 text-center cursor-pointer bg-stone-50 dark:bg-stone-900 border-stone-100 dark:border-stone-800 hover:border-amber-500/40 transition-all group"><input type="file" ref={fileInputRef} className="hidden" accept=".txt" onChange={res => { const f = res.target.files?.[0]; if(f) { const r = new FileReader(); r.onload = e => { setFileContent(e.target?.result as string); setFileName(f.name); }; r.readAsText(f); } }} />{fileName ? <div className="text-amber-500 font-black text-lg animate-fade-in truncate">{fileName}</div> : <div className="text-stone-400 font-black uppercase tracking-widest text-xs flex flex-col items-center gap-4"><Upload size={40} className="text-stone-200 group-hover:text-amber-500 transition-colors" /> Выбрать файл .txt</div>}</div>
                              <button onClick={async () => { if(!newTitle) return; setIsUploading(true); const newBook: Book = { id: '', title: newTitle, author: newAuthor, coverUrl: `https://picsum.photos/seed/${Date.now()}/400/600`, progress: 0, status: 'want_to_read', content: fileContent || undefined, currentPage: 1, totalPages: fileContent ? Math.ceil(fileContent.length/CHARS_PER_PAGE) : 1, myRating: 0, annotations: [], tags: [] }; try { const saved = await db.addBook(newBook, user.id); setBooks(prev => [...prev, saved]); setShowAddModal(false); } finally { setIsUploading(false); } }} className="w-full py-6 mt-6 bg-stone-900 dark:bg-white text-white dark:text-stone-900 rounded-[2rem] font-black uppercase text-sm tracking-[0.4em] shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50">{isUploading ? <Loader2 size={24} className="animate-spin mx-auto" /> : 'Внести в реестр'}</button>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
