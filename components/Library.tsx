
import React, { useState, useMemo } from 'react';
import { Book, User } from '../types';
import { Plus, Trash2, LayoutGrid, List, CheckCircle2, PlayCircle, Bookmark, FolderPlus, X, Loader2, Image as ImageIcon, BookOpen, Search, Globe, FileText, Sparkles, Download, Upload, FileType, File as FileIcon } from 'lucide-react';
import { Reader } from './Reader';
import { db } from '../services/db';
import { ConfirmDialog } from './ConfirmDialog';

interface LibraryProps {
  books: Book[];
  setBooks: React.Dispatch<React.SetStateAction<Book[]>>;
  user: User;
}

interface GoogleBookItem {
  id: string;
  volumeInfo: {
    title: string;
    authors?: string[];
    description?: string;
    imageLinks?: {
      thumbnail?: string;
    };
    pageCount?: number;
    industryIdentifiers?: { type: string; identifier: string }[];
  };
}

export const Library: React.FC<LibraryProps> = ({ books, setBooks, user }) => {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);

  // Search and Manual form state
  const [addMode, setAddMode] = useState<'search' | 'manual'>('search');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GoogleBookItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [isFetchingText, setIsFetchingText] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<string>('');

  // Add Book Form State
  const [isSaving, setIsSaving] = useState(false);
  const [newBook, setNewBook] = useState({
    title: '',
    author: '',
    coverUrl: '',
    content: ''
  });

  const filteredBooks = useMemo(() => {
    return books.filter(b => statusFilter === 'all' || b.status === statusFilter);
  }, [books, statusFilter]);

  // --- File Parsing Logic ---

  const parsePdf = async (file: File): Promise<string> => {
    setUploadProgress('Загрузка движка PDF...');
    // Динамический импорт pdfjs-dist через CDN
    const pdfjsLib = await import('https://esm.sh/pdfjs-dist@3.11.174');
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@3.11.174/build/pdf.worker.min.js';

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    const totalPages = pdf.numPages;

    for (let i = 1; i <= totalPages; i++) {
        setUploadProgress(`Обработка страницы ${i} из ${totalPages}...`);
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n\n';
    }
    return fullText;
  };

  const parseEpub = async (file: File): Promise<string> => {
    setUploadProgress('Распаковка EPUB...');
    // Динамический импорт JSZip
    const { default: JSZip } = await import('https://esm.sh/jszip@3.10.1');
    const zip = await JSZip.loadAsync(file);
    
    let text = '';
    
    // Попытка найти основные файлы контента.
    // Упрощенный подход: ищем все .html или .xhtml файлы и извлекаем текст.
    // Для более точного порядка нужно парсить content.opf, но это сложно для embedded решения.
    const contentFiles = Object.keys(zip.files).filter(filename => 
        filename.endsWith('.html') || filename.endsWith('.xhtml') || filename.endsWith('.htm')
    );

    // Сортируем файлы, чтобы главы шли по порядку (часто файлы именуются part001, part002...)
    contentFiles.sort();

    const parser = new DOMParser();

    for (let i = 0; i < contentFiles.length; i++) {
        setUploadProgress(`Чтение главы ${i + 1} из ${contentFiles.length}...`);
        const filename = contentFiles[i];
        const fileData = await zip.files[filename].async('string');
        const doc = parser.parseFromString(fileData, 'text/html');
        // Извлекаем только текст из body, игнорируя скрипты и стили
        const bodyText = doc.body.innerText || doc.body.textContent || '';
        text += bodyText + '\n\n';
    }

    if (!text.trim()) {
        throw new Error("Не удалось извлечь текст из EPUB. Возможно, файл защищен (DRM) или имеет нестандартную структуру.");
    }

    return text;
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsFetchingText(true);
    setUploadProgress('Начинаем обработку...');

    try {
        let extractedText = '';

        if (file.type === 'application/pdf') {
            extractedText = await parsePdf(file);
        } else if (file.type === 'application/epub+zip' || file.name.endsWith('.epub')) {
            extractedText = await parseEpub(file);
        } else if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
            extractedText = await file.text();
        } else {
            throw new Error("Неподдерживаемый формат. Используйте PDF, EPUB или TXT.");
        }

        if (extractedText.length < 50) {
            throw new Error("Текст не найден или файл пуст (возможно, это скан-изображение в PDF).");
        }

        // Автозаполнение названия из имени файла, если поле пустое
        const fileNameTitle = file.name.replace(/\.[^/.]+$/, "").replace(/_/g, " ");
        
        setNewBook(prev => ({
            ...prev,
            content: extractedText,
            title: prev.title || fileNameTitle
        }));

        setUploadProgress('');
    } catch (err: any) {
        console.error("File parse error:", err);
        alert(`Ошибка чтения файла: ${err.message}`);
        setUploadProgress('');
    } finally {
        setIsFetchingText(false);
    }
  };

  // --- End Parsing Logic ---

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setIsSearching(true);
    setSearchError(null);
    try {
      const response = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(searchQuery)}&maxResults=15&printType=books`);
      if (!response.ok) throw new Error('Ошибка API');
      const data = await response.json();
      setSearchResults(data.items || []);
    } catch (error) {
      setSearchError("Не удалось подключиться к базе книг. Проверьте интернет.");
    } finally {
      setIsSearching(false);
    }
  };

  const tryFetchFullText = async (title: string, author: string): Promise<string | null> => {
    try {
      const olSearch = await fetch(`https://openlibrary.org/search.json?title=${encodeURIComponent(title)}&author=${encodeURIComponent(author)}&limit=1`);
      if (!olSearch.ok) return null;
      const olData = await olSearch.json();
      
      if (olData.docs && olData.docs.length > 0) {
        const doc = olData.docs[0];
        if (doc.id_project_gutenberg && doc.id_project_gutenberg.length > 0) {
          const pgId = doc.id_project_gutenberg[0];
          
          const proxy = "https://corsproxy.io/?";
          const variations = [
            `https://www.gutenberg.org/files/${pgId}/${pgId}-0.txt`,
            `https://www.gutenberg.org/cache/epub/${pgId}/pg${pgId}.txt`,
            `https://www.gutenberg.org/files/${pgId}/${pgId}.txt`
          ];

          for (const url of variations) {
            try {
              const res = await fetch(proxy + encodeURIComponent(url));
              if (res.ok) {
                const text = await res.text();
                if (text.length > 1000) return text;
              }
            } catch (e) {
              continue; 
            }
          }
        }
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  const handleSelectBookFromSearch = async (item: GoogleBookItem) => {
    const info = item.volumeInfo;
    const coverUrl = info.imageLinks?.thumbnail?.replace('http:', 'https:') || 
      `https://ui-avatars.com/api/?name=${encodeURIComponent(info.title)}&background=random&size=512`;
    
    setAddMode('manual');
    setIsFetchingText(true);
    
    setNewBook({
      title: info.title,
      author: info.authors?.[0] || 'Неизвестный автор',
      coverUrl: coverUrl,
      content: info.description ? `Описание:\n${info.description}\n\n` : ''
    });

    const fullText = await tryFetchFullText(info.title, info.authors?.[0] || '');
    if (fullText) {
      setNewBook(prev => ({ ...prev, content: fullText }));
    } else {
      setNewBook(prev => ({ 
        ...prev, 
        content: prev.content + "[Полный текст не найден автоматически. Вы можете загрузить файл EPUB/PDF/TXT вручную]" 
      }));
    }
    setIsFetchingText(false);
  };

  const handleStatusChange = async (book: Book, newStatus: Book['status']) => {
    const updatedBook: Book = { 
      ...book, 
      status: newStatus,
      progress: newStatus === 'completed' ? 100 : (newStatus === 'want_to_read' ? 0 : book.progress)
    };
    setBooks(prev => prev.map(b => b.id === book.id ? updatedBook : b));
    await db.updateBook(updatedBook, user.id);
  };

  const handleAddBook = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!newBook.title || !newBook.author) return;

    setIsSaving(true);
    try {
      const bookToSave: Book = {
        id: '', 
        title: newBook.title,
        author: newBook.author,
        coverUrl: newBook.coverUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(newBook.title)}&background=random&size=512`,
        content: newBook.content || 'Текст книги пока не добавлен...',
        progress: 0,
        status: 'want_to_read',
        totalPages: Math.ceil((newBook.content?.length || 1000) / 2500)
      };

      const savedBook = await db.addBook(bookToSave, user.id);
      setBooks(prev => [savedBook, ...prev]);
      setShowAddModal(false);
      setNewBook({ title: '', author: '', coverUrl: '', content: '' });
      setSearchResults([]);
      setSearchQuery('');
      setAddMode('search');
    } catch (error) {
      console.error("Save error:", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isReading && selectedBook) {
      return (
        <Reader 
            book={selectedBook} 
            user={user}
            onClose={() => setIsReading(false)} 
            onUpdateBook={(b) => {
                setSelectedBook(b);
                setBooks(prev => prev.map(old => old.id === b.id ? b : old));
                db.updateBook(b, user.id);
            }} 
        />
      );
  }

  return (
    <div className="max-w-7xl mx-auto pb-32 px-4 space-y-8 md:space-y-12">
      <ConfirmDialog isOpen={!!bookToDelete} title="Удалить книгу?" message={`Вы собираетесь навсегда удалить "${bookToDelete?.title}" из вашей истории.`} onConfirm={async () => { if(bookToDelete) { await db.deleteBook(bookToDelete.id); setBooks(prev => prev.filter(b => b.id !== bookToDelete.id)); setBookToDelete(null); } }} onCancel={() => setBookToDelete(null)} />

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
          <div className="space-y-3">
            <h2 className="text-4xl md:text-6xl font-serif font-black text-stone-900 dark:text-stone-50 tracking-tighter leading-none">Библиотека</h2>
            <p className="text-stone-500 dark:text-stone-400 text-base md:text-lg font-medium">Ваше убежище, страница за страницей.</p>
          </div>
          <div className="flex gap-3 w-full md:w-auto">
              <button className="flex-1 md:flex-none px-4 md:px-6 py-3 md:py-4 bg-stone-100 dark:bg-stone-900 text-stone-600 dark:text-stone-300 rounded-2xl flex items-center justify-center gap-2 md:gap-3 font-bold text-[10px] md:text-xs uppercase tracking-widest transition-all hover:bg-stone-200 dark:hover:bg-stone-800"><FolderPlus size={16} /> <span className="hidden sm:inline">Коллекция</span></button>
              <button onClick={() => { setShowAddModal(true); setAddMode('search'); }} className="flex-1 md:flex-none px-6 md:px-8 py-3 md:py-4 bg-amber-500 text-white rounded-2xl flex items-center justify-center gap-2 md:gap-3 font-black text-[10px] uppercase tracking-widest shadow-xl shadow-amber-500/20 active:scale-95 hover:scale-105 transition-all"><Plus size={18} /> Добавить</button>
          </div>
      </div>

      <div className="flex flex-col gap-4">
        <div className="bg-white/40 dark:bg-stone-950/40 backdrop-blur-xl p-2 md:p-3 rounded-[2rem] border border-stone-100 dark:border-stone-800/50 flex items-center gap-4 overflow-hidden">
          <div className="flex-1 flex overflow-x-auto no-scrollbar gap-1">
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
                    whitespace-nowrap px-6 md:px-8 py-2.5 md:py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.15em] transition-all duration-300
                    ${statusFilter === tab.id 
                      ? 'bg-stone-900 dark:bg-white/10 text-white dark:text-stone-100 shadow-xl' 
                      : 'text-stone-400 hover:text-stone-600 dark:hover:text-stone-200'}
                  `}
                >
                  {tab.label}
                </button>
            ))}
          </div>

          <div className="hidden md:flex bg-stone-100 dark:bg-white/5 p-1 rounded-xl border border-stone-200/50 dark:border-white/5">
              <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-white/10 text-stone-900 dark:text-white shadow-md' : 'text-stone-400'}`}><LayoutGrid size={18} /></button>
              <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-white/10 text-stone-900 dark:text-white shadow-md' : 'text-stone-400'}`}><List size={18} /></button>
          </div>
        </div>
      </div>

      <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8" : "space-y-3"}>
          {filteredBooks.length === 0 ? (
            <div className="col-span-full py-24 text-center border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-[3rem]">
                <BookOpen size={48} className="mx-auto mb-4 text-stone-300" />
                <p className="text-stone-500 font-bold uppercase tracking-widest text-sm">Здесь пока пусто</p>
            </div>
          ) : (
            filteredBooks.map((book, idx) => (
              viewMode === 'grid' ? (
                <div key={book.id} className={`group relative bg-white dark:bg-stone-900/60 rounded-[2.5rem] md:rounded-[3rem] border border-stone-100 dark:border-stone-800 overflow-hidden hover-lift transition-all animate-scale-in`} style={{ animationDelay: `${idx * 50}ms` }}>
                    <div className="p-6 md:p-8">
                        <div className="relative mb-6 md:mb-8 aspect-[2/3] overflow-hidden rounded-[2rem] md:rounded-[2.5rem] shadow-2xl transition-transform duration-700 group-hover:-rotate-2 cursor-pointer" onClick={() => { setSelectedBook(book); setIsReading(true); }}>
                            <img src={book.coverUrl} className="w-full h-full object-cover" alt="" />
                            <div className="absolute inset-0 bg-gradient-to-t from-stone-900/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <span className="px-6 py-3 bg-white text-stone-900 rounded-2xl font-black uppercase text-[10px] tracking-widest translate-y-4 group-hover:translate-y-0 transition-all duration-500">Читать сейчас</span>
                            </div>
                        </div>
                        
                        <div className="space-y-4">
                            <div className="min-h-[50px] md:min-h-[60px]">
                                <h3 className="font-serif font-black text-lg md:text-xl text-stone-900 dark:text-stone-50 leading-tight line-clamp-2">{book.title}</h3>
                                <p className="text-[10px] font-black text-stone-400 uppercase tracking-widest mt-1">{book.author}</p>
                            </div>
                            
                            <div className="space-y-2">
                                <div className="flex justify-between items-center text-[10px] font-black text-stone-400 uppercase tracking-widest">
                                    <span>{book.progress}%</span>
                                    <span>{book.status === 'completed' ? 'Завершено' : book.status === 'reading' ? 'Читаю' : 'В планах'}</span>
                                </div>
                                <div className="h-1 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                                    <div className={`h-full transition-all duration-1000 ${book.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${book.progress}%` }}></div>
                                </div>
                            </div>

                            <div className="pt-4 flex items-center justify-between border-t border-stone-50 dark:border-stone-800">
                                <div className="flex gap-1.5 md:gap-2">
                                    {['reading', 'want_to_read', 'completed'].map(st => (
                                        <button key={st} onClick={() => handleStatusChange(book, st as any)} className={`p-2 rounded-xl transition-all ${book.status === st ? 'bg-amber-500 text-white shadow-lg shadow-amber-500/20' : 'text-stone-300 hover:text-stone-500 dark:hover:text-stone-400'}`}>
                                            {st === 'reading' ? <PlayCircle size={16} /> : st === 'want_to_read' ? <Bookmark size={16} /> : <CheckCircle2 size={16} />}
                                        </button>
                                    ))}
                                </div>
                                <button onClick={() => setBookToDelete(book)} className="p-2 text-stone-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                            </div>
                        </div>
                    </div>
                </div>
              ) : (
                <div key={book.id} className="group relative bg-white/60 dark:bg-stone-900/40 hover:bg-white dark:hover:bg-stone-900 rounded-3xl p-3 md:p-4 border border-stone-100 dark:border-stone-800 flex items-center gap-4 md:gap-8 transition-all hover:shadow-xl hover:-translate-y-1 animate-fade-in-up" style={{ animationDelay: `${idx * 30}ms` }}>
                  <div className="w-16 h-24 md:w-20 md:h-28 shrink-0 relative cursor-pointer" onClick={() => { setSelectedBook(book); setIsReading(true); }}>
                    <img src={book.coverUrl} className="w-full h-full object-cover rounded-xl shadow-lg group-hover:scale-105 transition-transform" alt="" />
                  </div>
                  
                  <div className="flex-1 min-w-0 flex flex-col md:flex-row md:items-center gap-2 md:gap-8">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif font-black text-sm md:text-xl text-stone-900 dark:text-stone-50 truncate">{book.title}</h3>
                      <p className="text-[9px] md:text-[10px] font-black text-stone-400 uppercase tracking-widest mt-0.5">{book.author}</p>
                    </div>

                    <div className="w-full md:w-48 lg:w-64 space-y-1.5">
                      <div className="flex justify-between items-center text-[9px] font-black text-stone-400 uppercase tracking-widest">
                        <span>{book.progress}%</span>
                        <span className={book.status === 'completed' ? 'text-emerald-500' : 'text-amber-500'}>{book.status === 'completed' ? 'Завершено' : 'Читаю'}</span>
                      </div>
                      <div className="h-1.5 w-full bg-stone-100 dark:bg-stone-800 rounded-full overflow-hidden">
                        <div className={`h-full transition-all duration-1000 ${book.status === 'completed' ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${book.progress}%` }}></div>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 md:gap-3 shrink-0">
                    <div className="hidden sm:flex items-center gap-1">
                      {['reading', 'want_to_read', 'completed'].map(st => (
                        <button 
                          key={st} 
                          onClick={() => handleStatusChange(book, st as any)} 
                          title={st === 'reading' ? 'Читаю' : st === 'want_to_read' ? 'В планы' : 'Прочитано'}
                          className={`p-2 rounded-xl transition-all ${book.status === st ? 'bg-amber-500 text-white shadow-md' : 'text-stone-300 hover:text-stone-500 dark:hover:text-stone-400 hover:bg-stone-50 dark:hover:bg-white/5'}`}
                        >
                          {st === 'reading' ? <PlayCircle size={18} /> : st === 'want_to_read' ? <Bookmark size={18} /> : <CheckCircle2 size={18} />}
                        </button>
                      ))}
                    </div>
                    <button onClick={() => setBookToDelete(book)} className="p-2 md:p-3 text-stone-300 hover:text-red-500 transition-colors rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 size={18} /></button>
                  </div>
                </div>
              )
            ))
          )}
      </div>

      {/* Add Book Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-md animate-fade-in" onClick={() => !isSaving && !isFetchingText && setShowAddModal(false)}></div>
          <div className="bg-white dark:bg-stone-900 w-full max-w-5xl p-8 md:p-12 rounded-[3.5rem] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] relative z-10 animate-scale-in max-h-[90vh] overflow-y-auto custom-scrollbar flex flex-col">
            <div className="flex justify-between items-center mb-8 shrink-0">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-amber-500 rounded-2xl text-white shadow-lg">
                  <Search size={24} />
                </div>
                <h3 className="text-3xl font-serif font-black text-stone-900 dark:text-stone-100">Добавить книгу</h3>
              </div>
              <button onClick={() => setShowAddModal(false)} className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-100 transition-colors"><X size={32} /></button>
            </div>

            <div className="flex gap-2 p-1 bg-stone-100 dark:bg-stone-850 rounded-2xl mb-8 w-fit shrink-0">
              <button onClick={() => setAddMode('search')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${addMode === 'search' ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-md' : 'text-stone-400'}`}>Глобальный поиск</button>
              <button onClick={() => setAddMode('manual')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${addMode === 'manual' ? 'bg-white dark:bg-stone-800 text-stone-900 dark:text-white shadow-md' : 'text-stone-400'}`}>Вручную / Файл</button>
            </div>

            {addMode === 'search' ? (
              <div className="space-y-8 animate-fade-in flex flex-col flex-1 overflow-hidden">
                <div className="flex gap-4 p-2 bg-stone-50 dark:bg-stone-850 border border-stone-100 dark:border-stone-800 rounded-[2rem] shrink-0">
                  <div className="relative flex-1">
                    <input 
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                      className="w-full bg-transparent border-none outline-none px-6 py-4 text-stone-900 dark:text-white font-medium text-lg placeholder:text-stone-300" 
                      placeholder="Название книги, автор или классика..."
                      autoFocus
                    />
                  </div>
                  <button 
                    onClick={handleSearch}
                    disabled={isSearching || !searchQuery.trim()}
                    className="px-10 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-[1.5rem] font-black uppercase text-xs tracking-widest flex items-center gap-3 hover:scale-105 active:scale-95 transition-all disabled:opacity-30"
                  >
                    {isSearching ? <Loader2 className="animate-spin" size={18} /> : <Globe size={18} />}
                    Искать
                  </button>
                </div>

                {searchError && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-2xl text-sm font-medium border border-red-100 dark:border-red-900/30">
                    {searchError}
                  </div>
                )}

                <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar min-h-[300px]">
                  {isSearching ? (
                    <div className="h-full flex flex-col items-center justify-center text-stone-400 space-y-4">
                      <Loader2 size={48} className="animate-spin text-amber-500" />
                      <p className="font-black text-[10px] uppercase tracking-widest">Просматриваем мировую базу...</p>
                    </div>
                  ) : searchResults.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-stone-400 opacity-30 py-20">
                      <BookOpen size={64} className="mb-4" />
                      <p className="font-bold">Введите запрос для начала поиска</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pb-8">
                      {searchResults.map((item) => (
                        <div 
                          key={item.id} 
                          onClick={() => handleSelectBookFromSearch(item)}
                          className="p-4 bg-white dark:bg-stone-850 border border-stone-100 dark:border-stone-800 rounded-3xl flex gap-5 cursor-pointer hover:bg-amber-50 dark:hover:bg-stone-800 hover:shadow-xl transition-all group relative"
                        >
                          <div className="w-16 h-24 bg-stone-200 dark:bg-stone-800 rounded-xl shrink-0 overflow-hidden shadow-md">
                            <img src={item.volumeInfo.imageLinks?.thumbnail || `https://ui-avatars.com/api/?name=${encodeURIComponent(item.volumeInfo.title)}&size=128`} className="w-full h-full object-cover group-hover:scale-110 transition-transform" alt="" />
                          </div>
                          <div className="min-w-0 flex-1 flex flex-col justify-center">
                            <h4 className="font-serif font-black text-stone-900 dark:text-stone-100 line-clamp-2 leading-tight group-hover:text-amber-600 transition-colors">{item.volumeInfo.title}</h4>
                            <p className="text-xs font-bold text-stone-400 mt-1 truncate">{item.volumeInfo.authors?.join(', ') || 'Автор не указан'}</p>
                            <div className="flex items-center gap-2 mt-2">
                                <span className="text-[9px] px-2 py-0.5 bg-stone-100 dark:bg-stone-800 rounded font-black text-stone-400 uppercase tracking-widest">
                                    {item.volumeInfo.pageCount || '?'} стр.
                                </span>
                                <FileText size={12} className="text-emerald-500 opacity-80" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <form onSubmit={handleAddBook} className="space-y-8 animate-fade-in">
                {isFetchingText && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 p-4 rounded-2xl flex items-center gap-3 border border-amber-100 dark:border-amber-800/50 animate-pulse">
                    <Download className="animate-bounce text-amber-500" size={18} />
                    <div className="flex flex-col">
                        <p className="text-xs font-black text-amber-600 uppercase tracking-widest">Обработка файла...</p>
                        {uploadProgress && <p className="text-[10px] text-amber-600/70">{uploadProgress}</p>}
                    </div>
                  </div>
                )}
                
                {/* File Upload Section */}
                <div className="border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-[2rem] p-6 hover:border-amber-400 transition-colors cursor-pointer relative bg-stone-50 dark:bg-stone-800/30">
                    <input 
                        type="file" 
                        accept=".txt,.pdf,.epub"
                        onChange={handleFileUpload}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <div className="flex flex-col items-center justify-center text-center gap-3">
                        <div className="w-12 h-12 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center shadow-md">
                            <Upload className="text-stone-400" size={24} />
                        </div>
                        <div>
                            <p className="font-bold text-stone-600 dark:text-stone-300">Загрузите файл книги</p>
                            <p className="text-xs text-stone-400 mt-1 uppercase tracking-widest font-black">Поддерживаем EPUB, PDF, TXT</p>
                        </div>
                        <div className="flex gap-2 mt-2">
                             <div className="px-2 py-1 bg-white dark:bg-stone-900 rounded border border-stone-100 dark:border-stone-700 text-[10px] font-mono text-stone-500">.epub</div>
                             <div className="px-2 py-1 bg-white dark:bg-stone-900 rounded border border-stone-100 dark:border-stone-700 text-[10px] font-mono text-stone-500">.pdf</div>
                             <div className="px-2 py-1 bg-white dark:bg-stone-900 rounded border border-stone-100 dark:border-stone-700 text-[10px] font-mono text-stone-500">.txt</div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2 block">Название книги</label>
                      <input 
                        required
                        value={newBook.title}
                        onChange={e => setNewBook(prev => ({...prev, title: e.target.value}))}
                        className="w-full bg-stone-50 dark:bg-stone-850 border border-stone-100 dark:border-stone-800 rounded-2xl p-4 outline-none focus:ring-4 ring-amber-500/10 text-stone-900 dark:text-white font-medium" 
                        placeholder="Напр. Гордость и предубеждение"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2 block">Автор</label>
                      <input 
                        required
                        value={newBook.author}
                        onChange={e => setNewBook(prev => ({...prev, author: e.target.value}))}
                        className="w-full bg-stone-50 dark:bg-stone-850 border border-stone-100 dark:border-stone-800 rounded-2xl p-4 outline-none focus:ring-4 ring-amber-500/10 text-stone-900 dark:text-white font-medium" 
                        placeholder="Джейн Остин"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2 block">Ссылка на обложку (URL)</label>
                      <div className="relative">
                        <input 
                          value={newBook.coverUrl}
                          onChange={e => setNewBook(prev => ({...prev, coverUrl: e.target.value}))}
                          className="w-full bg-stone-50 dark:bg-stone-850 border border-stone-100 dark:border-stone-800 rounded-2xl p-4 pl-12 outline-none focus:ring-4 ring-amber-500/10 text-stone-900 dark:text-white font-medium" 
                          placeholder="https://example.com/cover.jpg"
                        />
                        <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-300" size={18} />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <label className="text-[10px] font-black uppercase tracking-widest text-stone-400 mb-2 block flex items-center gap-2">
                        Текст книги
                        {isFetchingText && <Sparkles size={12} className="text-amber-500 animate-bounce" />}
                    </label>
                    <textarea 
                      value={newBook.content}
                      onChange={e => setNewBook(prev => ({...prev, content: e.target.value}))}
                      className="flex-1 min-h-[250px] w-full bg-stone-50 dark:bg-stone-850 border border-stone-100 dark:border-stone-800 rounded-3xl p-6 outline-none focus:ring-4 ring-amber-500/10 text-stone-900 dark:text-white font-serif italic text-sm resize-none custom-scrollbar" 
                      placeholder="Здесь появится текст книги после загрузки файла..."
                    />
                  </div>
                </div>

                <div className="flex gap-4 pt-4 shrink-0">
                  <button type="button" onClick={() => setAddMode('search')} className="flex-1 py-4 text-stone-400 font-bold uppercase text-xs tracking-widest hover:text-stone-900 transition-colors">Назад к поиску</button>
                  <button 
                    type="submit" 
                    disabled={isSaving || !newBook.title}
                    className="flex-[2] py-4 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-[1.5rem] font-black uppercase text-xs tracking-widest shadow-2xl flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all disabled:opacity-50"
                  >
                    {isSaving ? <Loader2 className="animate-spin" size={18} /> : <Plus size={18} />}
                    Сохранить в библиотеку
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
      
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
