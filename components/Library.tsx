
import React, { useState, useRef } from 'react';
import { Book, Quote, User } from '../types';
import { Plus, BookOpen, FileText, Upload, Check, Loader2, AlertCircle, Trash2 } from 'lucide-react';
import { Reader } from './Reader';
import { db } from '../services/db';
import { ConfirmDialog } from './ConfirmDialog';

const CHARS_PER_PAGE = 2500;

interface LibraryProps {
  books: Book[];
  setBooks: React.Dispatch<React.SetStateAction<Book[]>>;
  quotes: Quote[];
  setQuotes: React.Dispatch<React.SetStateAction<Quote[]>>;
  user: User;
}

export const Library: React.FC<LibraryProps> = ({ books, setBooks, quotes, setQuotes, user }) => {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState('');
  const [fileContent, setFileContent] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const handleAddBook = async () => {
    if (!newTitle || !newAuthor) return;
    setIsUploading(true);
    setErrorMessage(null);
    
    const totalPages = fileContent ? Math.max(1, Math.ceil(fileContent.length / CHARS_PER_PAGE)) : 1;
    
    const newBook: Book = {
      id: Date.now().toString(),
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
        console.error("Failed to add book", e);
        setErrorMessage(e.message || "Failed to add book to the database.");
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
      } catch (e) {
          console.error("Failed to delete book", e);
          alert("Не удалось удалить книгу из базы данных. Проверьте соединение или права доступа.");
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
        message={isDeleting ? "Пожалуйста, подождите, пока мы удаляем данные книги..." : `Вы уверены, что хотите удалить книгу "${bookToDelete?.title}"? Все ваши заметки и прогресс будут утеряны.`}
        onConfirm={handleDeleteBook}
        onCancel={() => !isDeleting && setBookToDelete(null)}
      />

      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
        <div>
            <h2 className="text-3xl font-bold text-stone-800 dark:text-stone-100 serif tracking-tight">Библиотека</h2>
            <p className="text-stone-500 dark:text-stone-400">Управляйте своей коллекцией и продолжайте чтение.</p>
        </div>
        <button 
            onClick={() => {
                setShowAddModal(true);
                setErrorMessage(null);
            }} 
            className="bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-6 py-2.5 rounded-xl flex items-center gap-2 hover:scale-105 transition-transform shadow-lg active:scale-95"
        >
            <Plus size={20} /> <span>Добавить книгу</span>
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {books.map(book => (
            <div 
                key={book.id} 
                className="bg-white dark:bg-stone-900 p-4 rounded-2xl border border-stone-100 dark:border-stone-800 flex gap-4 group relative overflow-hidden hover:shadow-xl transition-all"
            >
                <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setBookToDelete(book);
                        }}
                        className="p-1.5 bg-white/80 dark:bg-stone-800/80 rounded-lg text-stone-400 hover:text-red-500 transition-colors backdrop-blur-sm shadow-sm"
                        title="Удалить книгу"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>

                <div 
                    className="flex flex-1 gap-4 cursor-pointer"
                    onClick={() => { setSelectedBook(book); setIsReading(true); }} 
                >
                    <img src={book.coverUrl} className="w-24 h-36 object-cover rounded-lg shadow-md group-hover:scale-105 transition-transform duration-500" />
                    <div className="flex-1 flex flex-col justify-between py-1">
                        <div>
                            <h3 className="font-serif font-bold text-lg leading-snug dark:text-stone-100 group-hover:text-stone-600 dark:group-hover:text-stone-300 transition-colors">{book.title}</h3>
                            <p className="text-sm text-stone-500 dark:text-stone-400">{book.author}</p>
                        </div>
                        <div className="mt-4">
                            <div className="flex justify-between text-[10px] font-bold text-stone-400 uppercase tracking-widest mb-1.5">
                                <span>{book.progress}% ПРОГРЕСС</span>
                                <span>{book.currentPage} / {book.totalPages} СТР.</span>
                            </div>
                            <div className="w-full bg-stone-100 dark:bg-stone-800 h-1.5 rounded-full overflow-hidden">
                                <div 
                                    className="bg-stone-800 dark:bg-stone-200 h-full transition-all duration-1000" 
                                    style={{ width: `${book.progress}%` }} 
                                />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        ))}
        {books.length === 0 && (
            <div className="col-span-full py-20 text-center border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-3xl">
                <FileText size={48} className="mx-auto mb-4 text-stone-300 dark:text-stone-700" />
                <p className="text-stone-500 dark:text-stone-400 font-medium">Ваша библиотека пуста.</p>
                <button onClick={() => setShowAddModal(true)} className="mt-4 text-stone-800 dark:text-stone-200 underline font-bold">Добавьте первую книгу</button>
            </div>
        )}
      </div>

      {showAddModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => !isUploading && setShowAddModal(false)} />
              <div className="bg-white dark:bg-stone-900 p-8 rounded-3xl w-full max-w-md relative z-10 shadow-2xl animate-scale-in border border-stone-100 dark:border-stone-800">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-2xl font-serif font-bold text-stone-800 dark:text-stone-100">Новая книга</h3>
                      {errorMessage && <AlertCircle className="text-red-500" size={20} />}
                  </div>
                  
                  {errorMessage && (
                      <div className="mb-6 p-3 bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-xs font-medium">
                          {errorMessage}
                      </div>
                  )}

                  <div className="space-y-4 mb-8">
                      <div>
                          <label className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1.5 block">Название</label>
                          <input 
                            value={newTitle} 
                            onChange={e => setNewTitle(e.target.value)} 
                            placeholder="Война и мир" 
                            className="w-full p-3 bg-stone-50 dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-xl outline-none focus:ring-2 focus:ring-stone-500 transition-all dark:text-white" 
                          />
                      </div>
                      <div>
                          <label className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1.5 block">Автор</label>
                          <input 
                            value={newAuthor} 
                            onChange={e => setNewAuthor(e.target.value)} 
                            placeholder="Лев Толстой" 
                            className="w-full p-3 bg-stone-50 dark:bg-stone-800 border border-stone-100 dark:border-stone-700 rounded-xl outline-none focus:ring-2 focus:ring-stone-500 transition-all dark:text-white" 
                          />
                      </div>
                      
                      <div>
                          <label className="text-xs font-bold text-stone-400 uppercase tracking-widest mb-1.5 block">Файл книги (.txt)</label>
                          <div 
                            onClick={() => fileInputRef.current?.click()}
                            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all ${
                                fileName ? 'bg-emerald-50 dark:bg-emerald-900/20 border-emerald-400' : 'bg-stone-50 dark:bg-stone-800 border-stone-200 dark:border-stone-700 hover:border-stone-400'
                            }`}
                          >
                              <input 
                                type="file" 
                                ref={fileInputRef} 
                                className="hidden" 
                                accept=".txt" 
                                onChange={handleFileChange} 
                              />
                              {fileName ? (
                                  <div className="flex flex-col items-center gap-1 text-emerald-600 dark:text-emerald-400">
                                      <Check size={24} />
                                      <span className="text-sm font-bold truncate max-w-[200px]">{fileName}</span>
                                  </div>
                              ) : (
                                  <div className="flex flex-col items-center gap-1 text-stone-400">
                                      <Upload size={24} />
                                      <span className="text-xs font-medium">Нажмите, чтобы загрузить</span>
                                  </div>
                              )}
                          </div>
                      </div>
                  </div>

                  <button 
                    onClick={handleAddBook} 
                    disabled={!newTitle || !newAuthor || isUploading}
                    className="w-full py-3.5 bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                      {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Plus size={20} />}
                      Добавить в дневник
                  </button>
              </div>
          </div>
      )}
    </div>
  );
};
