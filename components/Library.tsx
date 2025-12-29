
import React, { useState, useRef } from 'react';
import { Book, User } from '../types';
import { Plus, BookOpen, Upload, Trash2, Search, Library as LibraryIcon, ChevronRight, Loader2, AlertCircle, Info } from 'lucide-react';
import { Reader } from './Reader';
import { db } from '../services/db';
import { ConfirmDialog } from './ConfirmDialog';

const CHARS_PER_PAGE = 2500;
const CORS_PROXY = 'https://api.allorigins.win/raw?url=';

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
  
  // Search State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GutenbergBook[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  // Manual Upload State
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const searchClassics = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setHasSearched(true);
    setErrorMessage(null);
    try {
      const response = await fetch(`https://gutendex.com/books/?search=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();
      setSearchResults(data.results.slice(0, 10));
    } catch (e) {
      setErrorMessage("Не удалось загрузить каталог. Проверьте соединение.");
    } finally {
      setIsSearching(false);
    }
  };

  const addFromCatalog = async (gBook: GutenbergBook) => {
    setIsUploading(true);
    setErrorMessage(null);
    try {
      let textUrl = Object.entries(gBook.formats).find(([key]) => key.toLowerCase().includes('text/plain'))?.[1];

      if (!textUrl) {
        textUrl = `https://www.gutenberg.org/files/${gBook.id}/${gBook.id}-0.txt`;
      }

      const finalUrl = `${CORS_PROXY}${encodeURIComponent(textUrl)}`;
      const response = await fetch(finalUrl);
      
      let content = '';
      if (!response.ok) {
        const fallbackUrl = `${CORS_PROXY}${encodeURIComponent(`https://www.gutenberg.org/cache/epub/${gBook.id}/pg${gBook.id}.txt`)}`;
        const fallbackResponse = await fetch(fallbackUrl);
        if (!fallbackResponse.ok) throw new Error("Текст книги недоступен. Попробуйте другой вариант.");
        content = await fallbackResponse.text();
      } else {
        content = await response.text();
      }
      
      content = content.replace(/^\uFEFF/, '');
      
      if (content.length < 500) {
          throw new Error("Загруженный текст слишком мал. Скорее всего, сервер Gutenberg отклонил запрос. Попробуйте позже.");
      }

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
      setErrorMessage(e.message === 'Failed to fetch' ? 'Ошибка сети: сервер блокирует доступ. Попробуйте другой прокси или подождите.' : e.message);
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
    if (file && file.type === 'text/plain') {
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
        setNewTitle('');
        setNewAuthor('');
        setFileContent(null);
        setFileName(null);
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

  if (isReading && selectedBook) {
      return (
        <Reader 
            book={selectedBook} 
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

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-12 gap-4">
        <div className="animate-fade-in-up">
            <h2 className="text-4xl font-bold text-stone-800 dark:text-stone-100 serif tracking-tight">Библиотека</h2>
            <p className="text-stone-500 dark:text-stone-400 mt-2">Управляйте своей коллекцией и продолжайте чтение.</p>
        </div>
        <button 
            onClick={() => {
                setShowAddModal(true);
                setErrorMessage(null);
            }} 
            className="bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-8 py-3 rounded-2xl flex items-center gap-3 hover:scale-105 transition-all shadow-xl font-bold text-sm"
        >
            <Plus size={20} /> <span>Добавить книгу</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
        {books.map((book, idx) => (
            <div 
                key={book.id} 
                className="bg-white dark:bg-[#110f0e] p-5 rounded-[2.5rem] border border-stone-100 dark:border-stone-800 flex gap-5 group relative overflow-hidden hover:shadow-2xl transition-all animate-scale-in"
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
                    className="flex flex-1 gap-5 cursor-pointer"
                    onClick={() => { setSelectedBook(book); setIsReading(true); }} 
                >
                    <div className="w-24 h-36 shrink-0 relative overflow-hidden rounded-xl shadow-lg">
                        <img src={book.coverUrl} className="w-full h-full object-cover" alt="" />
                    </div>
                    <div className="flex-1 flex flex-col justify-between py-1 min-w-0">
                        <div>
                            <h3 className="font-serif font-bold text-lg leading-snug dark:text-stone-100 truncate group-hover:text-amber-500 transition-colors">{book.title}</h3>
                            <p className="text-xs text-stone-500 dark:text-stone-400 font-bold uppercase tracking-wider mt-1 truncate">{book.author}</p>
                        </div>
                        <div className="mt-4">
                            <div className="flex justify-between text-[9px] font-black text-stone-400 uppercase tracking-widest mb-2">
                                <span>{book.progress}% ПРОГРЕСС</span>
                            </div>
                            <div className="w-full bg-stone-100 dark:bg-stone-800 h-1 rounded-full overflow-hidden">
                                <div 
                                    className="bg-amber-600 h-full transition-all duration-1000" 
                                    style={{ width: `${book.progress}%` }} 
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        ))}
        {books.length === 0 && (
            <div className="col-span-full py-24 text-center border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-[3rem] bg-stone-50/50 dark:bg-stone-900/10">
                <BookOpen size={64} className="mx-auto mb-6 text-stone-200 dark:text-stone-800" />
                <p className="text-stone-500 dark:text-stone-400 font-bold uppercase tracking-widest text-sm mb-4">Ваша библиотека пуста.</p>
                <button onClick={() => setShowAddModal(true)} className="text-stone-800 dark:text-stone-100 underline font-black uppercase text-xs tracking-widest">Добавить первую книгу</button>
            </div>
        )}
      </div>

      {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => !isUploading && setShowAddModal(false)} />
              <div className="bg-[#110f0e] rounded-[2.5rem] w-full max-w-xl relative z-10 shadow-2xl animate-scale-in border border-stone-800 overflow-hidden">
                  <div className="flex bg-[#1c1917]/50 border-b border-stone-800">
                      <button 
                        onClick={() => setAddMode('catalog')}
                        className={`flex-1 py-5 font-black uppercase text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${addMode === 'catalog' ? 'bg-white text-black' : 'text-stone-400 hover:text-stone-200'}`}
                      >
                         <LibraryIcon size={16} /> Поиск в каталоге
                      </button>
                      <button 
                        onClick={() => setAddMode('upload')}
                        className={`flex-1 py-5 font-black uppercase text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-3 ${addMode === 'upload' ? 'bg-white text-black' : 'text-stone-400 hover:text-stone-200'}`}
                      >
                         <Upload size={16} /> Загрузить файл
                      </button>
                  </div>

                  <div className="p-10">
                      {addMode === 'catalog' ? (
                          <div className="space-y-6">
                              <div className="relative group">
                                  <Search className={`absolute left-4 top-1/2 -translate-y-1/2 transition-colors ${searchQuery ? 'text-amber-500' : 'text-stone-500'}`} size={20} />
                                  <input 
                                    value={searchQuery}
                                    onChange={e => setSearchQuery(e.target.value)}
                                    onKeyDown={e => e.key === 'Enter' && searchClassics()}
                                    placeholder="Название или автор (лучше на англ.)..."
                                    className="w-full pl-12 pr-4 py-4 bg-[#1c1917] border border-[#292524] rounded-2xl outline-none focus:ring-2 ring-blue-500/40 text-white transition-all placeholder:text-stone-600"
                                  />
                              </div>

                              <div className="max-h-[300px] overflow-y-auto custom-scrollbar space-y-3">
                                  {isSearching ? (
                                      <div className="flex flex-col items-center justify-center py-10 gap-3">
                                          <Loader2 className="animate-spin text-amber-500" />
                                          <p className="text-[10px] font-black uppercase tracking-widest text-stone-500">Оракул ищет в архивах...</p>
                                      </div>
                                  ) : searchResults.length > 0 ? (
                                      searchResults.map(res => (
                                          <div key={res.id} onClick={() => !isUploading && addFromCatalog(res)} className="flex items-center gap-4 p-3 bg-[#1c1917]/50 rounded-2xl hover:bg-[#1c1917] border border-transparent hover:border-amber-500/50 cursor-pointer transition-all group">
                                              <img src={res.formats['image/jpeg'] || `https://www.gutenberg.org/cache/epub/${res.id}/pg${res.id}.cover.small.jpg`} className="w-10 h-14 object-cover rounded-md shadow-lg" alt="" />
                                              <div className="flex-1 min-w-0">
                                                  <h4 className="font-serif font-bold text-stone-100 text-sm truncate">{res.title}</h4>
                                                  <p className="text-[9px] font-black text-stone-500 uppercase tracking-widest truncate">{res.authors.map(a => a.name).join(', ')}</p>
                                              </div>
                                              <ChevronRight size={16} className="text-stone-700 group-hover:text-amber-500 group-hover:translate-x-1 transition-all" />
                                          </div>
                                      ))
                                  ) : hasSearched ? (
                                      <div className="text-center py-16">
                                          <p className="text-stone-500 text-sm mb-4">Ничего не найдено</p>
                                          <div className="bg-amber-500/5 border border-amber-500/20 p-4 rounded-2xl inline-flex items-start gap-3 text-left max-w-xs">
                                              <Info size={16} className="text-amber-500 shrink-0 mt-0.5" />
                                              <p className="text-[10px] text-amber-500/80 leading-relaxed font-bold uppercase tracking-wider">
                                                  Каталог классики Project Gutenberg лучше всего работает с названиями на английском (например, "Pride and Prejudice").
                                              </p>
                                          </div>
                                      </div>
                                  ) : (
                                      <div className="text-center py-16 text-stone-700 text-[10px] font-black uppercase tracking-[0.2em]">
                                          Введите запрос для поиска
                                      </div>
                                  )}
                              </div>
                          </div>
                      ) : (
                          <div className="space-y-4">
                              <input 
                                value={newTitle} 
                                onChange={e => setNewTitle(e.target.value)} 
                                placeholder="Название книги" 
                                className="w-full p-4 bg-[#1c1917] border border-[#292524] rounded-2xl outline-none focus:ring-2 ring-blue-500/40 text-white transition-all" 
                              />
                              <input 
                                value={newAuthor} 
                                onChange={e => setNewAuthor(e.target.value)} 
                                placeholder="Автор" 
                                className="w-full p-4 bg-[#1c1917] border border-[#292524] rounded-2xl outline-none focus:ring-2 ring-blue-500/40 text-white transition-all" 
                              />
                              <div 
                                onClick={() => fileInputRef.current?.click()}
                                className={`border-2 border-dashed rounded-2xl p-8 text-center cursor-pointer transition-all ${
                                    fileName ? 'bg-amber-500/5 border-amber-500/50' : 'bg-[#1c1917] border-stone-800 hover:border-stone-600'
                                }`}
                              >
                                  <input type="file" ref={fileInputRef} className="hidden" accept=".txt" onChange={handleFileChange} />
                                  {fileName ? (
                                      <div className="text-amber-500 font-black text-[10px] uppercase tracking-widest truncate">{fileName}</div>
                                  ) : (
                                      <div className="text-stone-500 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"><Upload size={16} /> Выбрать .txt файл</div>
                                  )}
                              </div>
                              <button 
                                onClick={handleAddManual} 
                                disabled={!newTitle || isUploading}
                                className="w-full py-4 mt-4 bg-white text-black rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-2 hover:bg-stone-200 transition-all disabled:opacity-50 shadow-xl"
                              >
                                  {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                                  Добавить в дневник
                              </button>
                          </div>
                      )}

                      {errorMessage && (
                          <div className="mt-6 p-4 bg-red-500/10 text-red-500 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center gap-3 animate-shake border border-red-500/20">
                              <AlertCircle size={14} /> {errorMessage}
                          </div>
                      )}
                      
                      {isUploading && (
                          <div className="mt-6 flex flex-col items-center gap-2 animate-pulse">
                              <Loader2 className="animate-spin text-amber-500" size={24} />
                              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-stone-500">Загружаем текст из архивов...</span>
                          </div>
                      )}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};
