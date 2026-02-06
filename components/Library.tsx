
import React, { useState, useMemo } from 'react';
import { Book, User } from '../types';
import { Plus, Trash2, LayoutGrid, List, CheckCircle2, PlayCircle, Bookmark, FolderPlus } from 'lucide-react';
import { Reader } from './Reader';
import { db } from '../services/db';
import { ConfirmDialog } from './ConfirmDialog';

interface LibraryProps {
  books: Book[];
  setBooks: React.Dispatch<React.SetStateAction<Book[]>>;
  user: User;
}

export const Library: React.FC<LibraryProps> = ({ books, setBooks, user }) => {
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [, setShowAddModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [bookToDelete, setBookToDelete] = useState<Book | null>(null);

  const filteredBooks = useMemo(() => {
    return books.filter(b => statusFilter === 'all' || b.status === statusFilter);
  }, [books, statusFilter]);

  const handleStatusChange = async (book: Book, newStatus: Book['status']) => {
    const updatedBook: Book = { 
      ...book, 
      status: newStatus,
      progress: newStatus === 'completed' ? 100 : (newStatus === 'want_to_read' ? 0 : book.progress)
    };
    setBooks(prev => prev.map(b => b.id === book.id ? updatedBook : b));
    await db.updateBook(updatedBook, user.id);
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
              <button className="flex-1 md:flex-none px-4 md:px-6 py-3 md:py-4 bg-stone-100 dark:bg-stone-900 text-stone-600 dark:text-stone-300 rounded-2xl flex items-center justify-center gap-2 md:gap-3 font-bold text-[10px] md:text-xs uppercase tracking-widest"><FolderPlus size={16} /> <span className="hidden sm:inline">Коллекция</span></button>
              <button onClick={() => setShowAddModal(true)} className="flex-1 md:flex-none px-6 md:px-8 py-3 md:py-4 bg-amber-500 text-white rounded-2xl flex items-center justify-center gap-2 md:gap-3 font-black text-[10px] uppercase tracking-widest shadow-xl shadow-amber-500/20 active:scale-95 transition-all"><Plus size={18} /> Добавить</button>
          </div>
      </div>

      {/* Optimized Filter Bar for Mobile */}
      <div className="flex flex-col gap-4">
        <div className="bg-white/40 dark:bg-stone-950/40 backdrop-blur-xl p-2 md:p-3 rounded-[2rem] border border-stone-100 dark:border-stone-800/50 flex items-center gap-4 overflow-hidden">
          {/* Scrollable Status Filters */}
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

          {/* Desktop View Toggle */}
          <div className="hidden md:flex bg-stone-100 dark:bg-white/5 p-1 rounded-xl border border-stone-200/50 dark:border-white/5">
              <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-white dark:bg-white/10 text-stone-900 dark:text-white shadow-md' : 'text-stone-400'}`}><LayoutGrid size={18} /></button>
              <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-all ${viewMode === 'list' ? 'bg-white dark:bg-white/10 text-stone-900 dark:text-white shadow-md' : 'text-stone-400'}`}><List size={18} /></button>
          </div>
        </div>

        {/* Mobile View Toggle (Separate row for better touch targets) */}
        <div className="md:hidden flex justify-start">
          <div className="bg-white/40 dark:bg-stone-950/40 backdrop-blur-xl p-1 rounded-2xl border border-stone-100 dark:border-stone-800/50 flex">
              <button onClick={() => setViewMode('grid')} className={`p-3 rounded-xl transition-all ${viewMode === 'grid' ? 'bg-stone-900 dark:bg-white/10 text-white dark:text-white shadow-lg' : 'text-stone-400'}`}><LayoutGrid size={20} /></button>
              <button onClick={() => setViewMode('list')} className={`p-3 rounded-xl transition-all ${viewMode === 'list' ? 'bg-stone-900 dark:bg-white/10 text-white dark:text-white shadow-lg' : 'text-stone-400'}`}><List size={20} /></button>
          </div>
        </div>
      </div>

      <div className={viewMode === 'grid' ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8" : "space-y-4"}>
          {filteredBooks.map((book, idx) => (
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
          ))}
      </div>
      
      {/* Custom Styles for hiding scrollbar */}
      <style>{`
        .no-scrollbar::-webkit-scrollbar {
          display: none;
        }
        .no-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
      `}</style>
    </div>
  );
};
