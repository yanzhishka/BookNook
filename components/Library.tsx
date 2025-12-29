
import React, { useState, useRef, useMemo } from 'react';
import { Book, User } from '../types';
import { Plus, BookOpen, Upload, Trash2, Search, Library as LibraryIcon, ChevronRight, Loader2, AlertCircle, Info, Filter, LayoutGrid, List, CheckCircle2, PlayCircle, Bookmark } from 'lucide-react';
import { Reader } from './Reader';
import { db } from '../services/db';
import { ConfirmDialog } from './ConfirmDialog';

const CHARS_PER_PAGE = 2500;

const PROXIES = [
  'https://corsproxy.io/?',
  'https://api.allorigins.win/raw?url=',
  'https://api.codetabs.com/v1/proxy?quest=',
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
  const [addMode, setAddMode] = useState<'catalog' | 'upload'>('catalog');
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GutenbergBook[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredBooks = useMemo(() => {
    if (statusFilter === 'all') return books;
    return books.filter(b => b.status === statusFilter);
  }, [books, statusFilter]);

  const handleStatusChange = async (book: Book, newStatus: Book['status']) => {
    const updatedBook: Book = { 
      ...book, 
      status: newStatus,
      // Автоматически корректируем прогресс для удобства
      progress: newStatus === 'completed' ? 100 : (newStatus === 'want_to_read' ? 0 : book.progress)
    };
    
    // Обновляем локально для мгновенной реакции UI
    setBooks(prev => prev.map(b => b.id === book.id ? updatedBook : b));
    
    try {
      await db.updateBook(updatedBook);
    } catch (e) {
      console.error("Failed to update status in DB", e);
      // В случае ошибки возвращаем как было
      setBooks(prev => prev.map(b => b.id === book.id ? book : b));
    }
  };

  const searchClassics = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`https://gutendex.com/books/?search=${encodeURIComponent(searchQuery)}`);
      if (!response.ok) throw new Error("Сервер каталога временно недоступен");
      const data = await response.json();
      setSearchResults(data.results.slice(0, 10));
    } catch (e: any) {
      setErrorMessage(e.message || "Не удалось загрузить каталог. Проверьте соединение.");
    } finally {
      setIsSearching(false);
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
        } catch (err) {
          continue;
        }
      }
    }
    throw new Error("Не удалось загрузить текст.");
  };

  const addFromCatalog = async (gBook: GutenbergBook) => {
    setIsUploading(true);
    setErrorMessage(null);
    try {
      const formats = Object.entries(gBook.formats)
        .filter(([key]) => key.toLowerCase().includes('text/plain'))
        .map(([_, url]) => url);
      const content = await tryFetchText(gBook.id, formats);
      const totalPages = Math.max(1, Math.ceil(content.length / CHARS_PER_PAGE));
      const author = gBook.authors.map(a => a.name).join(', ') || 'Неизвестный автор';
      const bookData: Book = {
        id: '', 
        title: gBook.title,
        author: author,
        coverUrl: gBook.formats['image/jpeg'] || `https://www.gutenberg.org/cache/epub/${gBook.id}/pg${gBook.id}.cover.medium.jpg`,
        progress: 0,
        status: 'want_to_read',
        content: content,
        currentPage: 1,
        totalPages: totalPages,
        myRating: 0,
        annotations: []
      };
      const savedBook = await db.addBook(bookData, user.id);
      setBooks(prev => [...prev, savedBook]);
      setShowAddModal(false);
      resetSearch();
    } catch (e: any) {
      setErrorMessage(e.message);
    } finally {
      setIsUploading(false);
    }
  };

  const resetSearch = () => {
    setSearchQuery('');
    setSearchResults([]);
    setHasSearched(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && (file.type === 'text/plain' || file.name.endsWith('.txt'))) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setFileContent(event.target?.result as string);
        setFileName(file.name);
      };
      reader.readAsText(file);
    }
  };

  const handleAddManual = async () => {
    if (!newTitle || !newAuthor) return;
    setIsUploading(true);
    const totalPages = fileContent ? Math.max(1, Math.ceil(fileContent.length / CHARS_PER_PAGE)) : 1;
    const newBook: Book = {
      id: '',
      title: newTitle,
      author: newAuthor,
      coverUrl: `https://picsum.photos/seed/${Date.now()}/200/300`,
      progress: 0,
      status: 'want_to_read',
      content: fileContent || undefined,
      currentPage: 1,
      totalPages: totalPages,
      myRating: 0,
      annotations: []
    };
    try {
        const savedBook = await db.addBook(newBook, user.id);
        setBooks(prev => [...prev, savedBook]);
        setShowAddModal(false);
        setNewTitle(''); setNewAuthor(''); setFileContent(null); setFileName(null);
    } catch (e: any) {
        setErrorMessage("Не удалось добавить книгу.");
    } finally {
        setIsUploading(false);
    }
  };

  const handleDeleteBook = async () => {
      if (!bookToDelete) return;
      setIsDeleting(true);
      try {
          await db.deleteBook(bookToDelete.id);
          setBooks(prev => prev.filter(b => b.id !== bookToDelete.id));
          setBookToDelete(null);
      } finally {
          setIsDeleting(false);
      }
  };

  const StatusSelector = ({ book }: { book: Book }) => (
    <div className="flex bg-stone-50 dark:bg-stone-800/50 p-1 rounded-xl border border-stone-200 dark:border-stone-700/50">
      <button 
        onClick={(e) => { e.stopPropagation(); handleStatusChange(book, 'reading'); }}
        title="Читаю"
        className={`p-1.5 rounded-lg transition-all ${book.status === 'reading' ? 'bg-amber-500 text-white shadow-sm' : 'text-stone-400 hover:text-amber-500'}`}
      >
        <PlayCircle size={16} />
      </button>
      <button 
        onClick={(e) => { e.stopPropagation(); handleStatusChange(book, 'want_to_read'); }}
        title="Хочу прочесть"
        className={`p-1.5 rounded-lg transition-all ${book.status === 'want_to_read' ? 'bg-blue-500 text-white shadow-sm' : 'text-stone-400 hover:text-blue-500'}`}
      >
        <Bookmark size={16} />
      </button>
      <button 
        onClick={(e) => { e.stopPropagation(); handleStatusChange(book, 'completed'); }}
        title="Прочитано"
        className={`p-1.5 rounded-lg transition-all ${book.status === 'completed' ? 'bg-emerald-500 text-white shadow-sm' : 'text-stone-400 hover:text-emerald-500'}`}
      >
        <CheckCircle2 size={16} />
      </button>
    </div>
  );

  if (isReading && selectedBook) {
      return (
        <Reader 
            book={selectedBook} 
            user={user}
            onClose={() => setIsReading(false)} 
            onUpdateBook={(b) => {
                setSelectedBook(b);
                setBooks(prev => prev.map(old => old.id === b.id ? b : old));
                db.updateBook(b).catch(err => console.error("Sync error:", err));
            }} 
        />
      );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <ConfirmDialog 
        isOpen={!!bookToDelete}
        title={isDeleting ? "Удаление..." : "Удалить книгу"}
        message={isDeleting ? "Пожалуйста, подождите..." : `Удалить "${bookToDelete?.title}"? Это действие нельзя отменить.`}
        onConfirm={handleDeleteBook}
        onCancel={() => !isDeleting && setBookToDelete(null)}
      />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-12 gap-6">
        <div className="animate-fade-in-up">
            <h2 className="text-4xl font-serif font-black text-stone-800 dark:text-stone-100 tracking-tight mb-2">Библиотека</h2>
            <p className="text-stone-500 dark:text-stone-400">Управляйте своей коллекцией и продолжайте чтение.</p>
        </div>
        <button 
            onClick={() => setShowAddModal(true)} 
            className="w-full md:w-auto bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-8 py-4 rounded-2xl flex items-center justify-center gap-3 hover:scale-105 transition-all shadow-xl font-black text-xs uppercase tracking-widest"
        >
            <Plus size={20} /> <span>Добавить книгу</span>
        </button>
      </div>

      <div className="bg-white dark:bg-stone-900 p-4 rounded-[2rem] border border-stone-100 dark:border-stone-800 mb-10 flex flex-wrap items-center justify-between gap-4">
        <div className="flex bg-stone-50 dark:bg-stone-800 p-1.5 rounded-2xl">
            {[
                { id: 'all', label: 'Все' },
                { id: 'reading', label: 'Читаю' },
                { id: 'want_to_read', label: 'Хочу' },
                { id: 'completed', label: 'Прочитано' }
            ].map(tab => (
                <button 
                    key={tab.id}
                    onClick={() => setStatusFilter(tab.id)}
                    className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${statusFilter === tab.id ? 'bg-white dark:bg-stone-700 text-stone-900 dark:text-white shadow-sm' : 'text-stone-400 hover:text-stone-600'}`}
                >
                    {tab.label}
                </button>
            ))}
        </div>

        <div className="flex gap-2">
            <button 
                onClick={() => setViewMode('grid')}
                className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-900' : 'text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800'}`}
            >
                <LayoutGrid size={20} />
            </button>
            <button 
                onClick={() => setViewMode('list')}
                className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-stone-900 dark:bg-white text-white dark:text-stone-900' : 'text-stone-400 hover:bg-stone-50 dark:hover:bg-stone-800'}`}
            >
                <List size={20} />
            </button>
        </div>
      </div>

      <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8" : "space-y-4"}>
        {filteredBooks.map((book, idx) => (
            <div 
                key={book.id} 
                className={`bg-white dark:bg-[#110f0e] border border-stone-100 dark:border-stone-800 group relative overflow-hidden hover:shadow-2xl transition-all animate-scale-in ${viewMode === 'grid' ? 'p-5 rounded-[2.5rem]' : 'p-4 rounded-3xl flex items-center justify-between'}`}
                style={{ animationDelay: `${idx * 50}ms` }}
            >
                <div className="absolute top-4 right-4 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setBookToDelete(book);
                        }}
                        className="p-2 bg-white/80 dark:bg-stone-800/80 rounded-xl text-stone-400 hover:text-red-500 transition-colors backdrop-blur-sm shadow-sm"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>

                <div 
                    className={`cursor-pointer ${viewMode === 'grid' ? 'flex flex-col sm:flex-row gap-5' : 'flex items-center gap-6 flex-1'}`}
                    onClick={() => { setSelectedBook(book); setIsReading(true); }} 
                >
                    <div className={`${viewMode === 'grid' ? 'w-full sm:w-28 h-40' : 'w-12 h-16'} shrink-0 relative overflow-hidden rounded-2xl shadow-lg`}>
                        <img src={book.coverUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
                        <div className="mb-2">
                            <h3 className={`font-serif font-black leading-snug dark:text-stone-100 truncate group-hover:text-amber-500 transition-colors ${viewMode === 'grid' ? 'text-lg' : 'text-sm'}`}>{book.title}</h3>
                            <p className="text-[10px] text-stone-400 font-black uppercase tracking-widest mt-1 truncate">{book.author}</p>
                        </div>
                        
                        <div className="flex items-center justify-between gap-4 mt-auto">
                           {viewMode === 'grid' && (
                               <div className="flex-1">
                                   <div className="flex justify-between text-[8px] font-black text-stone-400 uppercase tracking-widest mb-1.5">
                                       <span>{book.progress}%</span>
                                   </div>
                                   <div className="w-full bg-stone-100 dark:bg-stone-800 h-1 rounded-full overflow-hidden">
                                       <div 
                                           className={`h-full transition-all duration-1000 ${book.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-600'}`}
                                           style={{ width: `${book.progress}%` }} 
                                       />
                                   </div>
                               </div>
                           )}
                           <StatusSelector book={book} />
                        </div>
                    </div>
                    {viewMode === 'list' && (
                        <div className="hidden sm:flex items-center gap-10 pr-10">
                             <div className="text-right">
                                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest">Прогресс</p>
                                <p className="text-sm font-black text-stone-800 dark:text-white">{book.progress}%</p>
                             </div>
                             <ChevronRight className="text-stone-300" />
                        </div>
                    )}
                </div>
            </div>
        ))}
        {filteredBooks.length === 0 && (
            <div className="col-span-full py-24 text-center border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-[3rem] bg-stone-50/50 dark:bg-stone-900/10">
                <BookOpen size={64} className="mx-auto mb-6 text-stone-200 dark:text-stone-800" />
                <p className="text-stone-500 dark:text-stone-400 font-bold uppercase tracking-widest text-sm mb-4">В этой категории пока пусто.</p>
                <button onClick={() => setShowAddModal(true)} className="text-stone-800 dark:text-stone-100 underline font-black uppercase text-xs tracking-widest">Добавить первую книгу</button>
            </div>
        )}
      </div>

      {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-md" onClick={() => !isUploading && setShowAddModal(false)} />
              <div className="bg-[#110f0e] rounded-[3rem] w-full max-w-xl relative z-10 shadow-2xl animate-scale-in border border-stone-800 overflow-hidden">
                  <div className="flex bg-[#1c1917]/50 border-b border-stone-800">
                      <button onClick={() => setAddMode('catalog')} className={`flex-1 py-6 font-black uppercase text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${addMode === 'catalog' ? 'bg-white text-black' : 'text-stone-400 hover:text-stone-200'}`}><LibraryIcon size={16} /> Поиск</button>
                      <button onClick={() => setAddMode('upload')} className={`flex-1 py-6 font-black uppercase text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${addMode === 'upload' ? 'bg-white text-black' : 'text-stone-400 hover:text-stone-200'}`}><Upload size={16} /> Загрузка</button>
                  </div>
                  <div className="p-10">
                      {addMode === 'catalog' ? (
                          <div className="space-y-6">
                              <div className="relative"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-500" size={20} /><input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchClassics()} placeholder="Название или автор..." className="w-full pl-12 pr-4 py-4 bg-[#1c1917] border border-[#292524] rounded-2xl outline-none focus:ring-2 ring-blue-500/40 text-white transition-all placeholder:text-stone-600" /></div>
                              <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-3">{isSearching ? <div className="flex flex-col items-center py-10 gap-3"><Loader2 className="animate-spin text-amber-500" /><p className="text-[10px] font-black uppercase tracking-widest text-stone-500">Ищем...</p></div> : searchResults.map(res => (<div key={res.id} onClick={() => !isUploading && addFromCatalog(res)} className="flex items-center gap-4 p-4 bg-[#1c1917]/50 rounded-[1.5rem] hover:bg-[#1c1917] border border-transparent hover:border-amber-500/50 cursor-pointer transition-all group"><img src={res.formats['image/jpeg'] || `https://www.gutenberg.org/cache/epub/${res.id}/pg${res.id}.cover.small.jpg`} className="w-10 h-14 object-cover rounded-md" alt="" /><div className="flex-1 min-w-0"><h4 className="font-serif font-bold text-stone-100 text-sm truncate">{res.title}</h4><p className="text-[9px] font-black text-stone-500 uppercase tracking-widest truncate">{res.authors.map(a => a.name).join(', ')}</p></div><ChevronRight size={16} className="text-stone-700" /></div>))}</div>
                          </div>
                      ) : (
                          <div className="space-y-4">
                              <input value={newTitle} onChange={e => setNewTitle(e.target.value)} placeholder="Название" className="w-full p-4 bg-[#1c1917] border border-[#292524] rounded-2xl outline-none text-white" />
                              <input value={newAuthor} onChange={e => setNewAuthor(e.target.value)} placeholder="Автор" className="w-full p-4 bg-[#1c1917] border border-[#292524] rounded-2xl outline-none text-white" />
                              <div onClick={() => fileInputRef.current?.click()} className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer ${fileName ? 'bg-amber-500/5 border-amber-500/50' : 'bg-[#1c1917] border-stone-800'}`}><input type="file" ref={fileInputRef} className="hidden" accept=".txt" onChange={handleFileChange} />{fileName ? <div className="text-amber-500 font-black text-[10px] uppercase truncate">{fileName}</div> : <div className="text-stone-500 text-[10px] font-black uppercase flex items-center justify-center gap-2"><Upload size={16} /> Выбрать .txt</div>}</div>
                              <button onClick={handleAddManual} disabled={!newTitle || isUploading} className="w-full py-5 mt-4 bg-white text-black rounded-2xl font-black uppercase text-xs tracking-widest disabled:opacity-50">{isUploading ? <Loader2 size={20} className="animate-spin" /> : 'Добавить'}</button>
                          </div>
                      )}
                      {errorMessage && <div className="mt-6 p-4 bg-red-500/10 text-red-500 rounded-2xl text-[10px] font-black uppercase">{errorMessage}</div>}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
