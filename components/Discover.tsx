
import React, { useState } from 'react';
import { MoodCategory, Book, User } from '../types';
import { Compass, Sparkles, Check, Plus } from 'lucide-react';
import { db } from '../services/db';

interface DiscoverProps {
  books: Book[];
  setBooks: React.Dispatch<React.SetStateAction<Book[]>>;
  user: User;
}

const MOODS: MoodCategory[] = [
  { id: 'cozy', label: 'Cozy', emoji: '☕', color: 'from-amber-100 to-orange-100 text-amber-900 dark:from-amber-900/40 dark:to-orange-900/20 dark:text-amber-100', description: 'Warm blankets, hot drinks, and gentle stories.' },
  { id: 'dark', label: 'Dark', emoji: '🌑', color: 'from-slate-200 to-gray-300 text-slate-900 dark:from-slate-900 dark:to-black dark:text-slate-100', description: 'Mysterious, gothic, and intense atmospheres.' },
  { id: 'thrill', label: 'Thrilling', emoji: '⚡', color: 'from-purple-100 to-fuchsia-100 text-purple-900 dark:from-purple-900/40 dark:to-fuchsia-900/20 dark:text-purple-100', description: 'Fast-paced, heart-pounding, and unpredictable.' },
  { id: 'smart', label: 'Smart', emoji: '🧠', color: 'from-blue-100 to-cyan-100 text-blue-900 dark:from-blue-900/40 dark:to-cyan-900/20 dark:text-blue-100', description: 'Expand your mind, philosophy, and hard sci-fi.' },
  { id: 'sad', label: 'Melancholy', emoji: '🌧️', color: 'from-sky-100 to-indigo-100 text-sky-900 dark:from-sky-900/40 dark:to-indigo-900/20 dark:text-sky-100', description: 'Beautifully sad stories that touch the soul.' },
  { id: 'hope', label: 'Hopeful', emoji: '☀️', color: 'from-yellow-100 to-lime-100 text-yellow-900 dark:from-yellow-900/40 dark:to-lime-900/20 dark:text-yellow-100', description: 'Uplifting tales of triumph and joy.' },
];

const RECOMMENDATIONS: Record<string, Partial<Book>[]> = {
    cozy: [
        { title: "The House in the Cerulean Sea", author: "TJ Klune", coverUrl: "https://picsum.photos/seed/cerulean/300/450" },
        { title: "Legends & Lattes", author: "Travis Baldree", coverUrl: "https://picsum.photos/seed/latte/300/450" },
        { title: "Before the Coffee Gets Cold", author: "Toshikazu Kawaguchi", coverUrl: "https://picsum.photos/seed/coffee/300/450" }
    ],
    dark: [
        { title: "Mexican Gothic", author: "Silvia Moreno-Garcia", coverUrl: "https://picsum.photos/seed/gothic/300/450" },
        { title: "Ninth House", author: "Leigh Bardugo", coverUrl: "https://picsum.photos/seed/ninth/300/450" },
        { title: "If We Were Villains", author: "M.L. Rio", coverUrl: "https://picsum.photos/seed/villains/300/450" }
    ],
    thrill: [
        { title: "Dark Matter", author: "Blake Crouch", coverUrl: "https://picsum.photos/seed/darkmatter/300/450" },
        { title: "The Silent Patient", author: "Alex Michaelides", coverUrl: "https://picsum.photos/seed/silent/300/450" },
        { title: "Gone Girl", author: "Gillian Flynn", coverUrl: "https://picsum.photos/seed/gone/300/450" }
    ],
    smart: [
        { title: "Thinking, Fast and Slow", author: "Daniel Kahneman", coverUrl: "https://picsum.photos/seed/thinking/300/450" },
        { title: "Sapiens", author: "Yuval Noah Harari", coverUrl: "https://picsum.photos/seed/sapiens/300/450" },
        { title: "Exhalation", author: "Ted Chiang", coverUrl: "https://picsum.photos/seed/exhalation/300/450" }
    ],
    sad: [
        { title: "A Little Life", author: "Hanya Yanagihara", coverUrl: "https://picsum.photos/seed/littlelife/300/450" },
        { title: "The Song of Achilles", author: "Madeline Miller", coverUrl: "https://picsum.photos/seed/achilles/300/450" },
        { title: "Never Let Me Go", author: "Kazuo Ishiguro", coverUrl: "https://picsum.photos/seed/neverlet/300/450" }
    ],
    hope: [
        { title: "The Alchemist", author: "Paulo Coelho", coverUrl: "https://picsum.photos/seed/alchemist/300/450" },
        { title: "Project Hail Mary", author: "Andy Weir", coverUrl: "https://picsum.photos/seed/hailmary/300/450" },
        { title: "Humans", author: "Brandon Stanton", coverUrl: "https://picsum.photos/seed/humans/300/450" }
    ]
};

export const Discover: React.FC<DiscoverProps> = ({ books, setBooks, user }) => {
  const [selectedMood, setSelectedMood] = useState<string | null>(null);

  const handleAddBook = async (bookData: Partial<Book>) => {
    if (books.some(b => b.title === bookData.title)) return;

    const tempId = Date.now().toString();
    const newBook: Book = {
        id: tempId,
        title: bookData.title || 'Unknown',
        author: bookData.author || 'Unknown',
        coverUrl: bookData.coverUrl || 'https://picsum.photos/200/300',
        progress: 0,
        status: 'want_to_read',
        myRating: 0
    };

    setBooks(prev => [...prev, newBook]);

    try {
        const savedBook = await db.addBook(newBook, user.id);
        setBooks(prev => prev.map(b => b.id === tempId ? savedBook : b));
    } catch (e) {
        console.error("Error adding recommended book", e);
        setBooks(prev => prev.filter(b => b.id !== tempId));
    }
  };

  const isBookOwned = (title: string) => {
      return books.some(b => b.title === title);
  };

  return (
    <div className="max-w-6xl mx-auto pb-20">
      <div className="text-center mb-12 animate-fade-in-up">
        <h2 className="text-4xl sm:text-5xl font-bold text-stone-800 dark:text-stone-100 serif mb-4 tracking-tight">
            Find your next <span className="text-transparent bg-clip-text bg-gradient-to-r from-purple-500 to-pink-500">obsession</span>
        </h2>
        <p className="text-stone-500 dark:text-stone-400 text-lg max-w-2xl mx-auto">
            Select a mood to unlock AI-curated recommendations that perfectly match your current vibe.
        </p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-16 animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        {MOODS.map((mood) => (
          <button
            key={mood.id}
            onClick={() => setSelectedMood(mood.id)}
            className={`relative group p-4 rounded-2xl transition-all duration-500 flex flex-col items-center gap-3 h-40 justify-center overflow-hidden ${
              selectedMood === mood.id
                ? 'ring-2 ring-stone-900 dark:ring-stone-100 scale-105 shadow-[0_0_30px_rgba(0,0,0,0.1)] dark:shadow-[0_0_30px_rgba(255,255,255,0.1)]'
                : 'hover:-translate-y-1 hover:shadow-xl'
            }`}
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${mood.color} opacity-80 dark:opacity-40 transition-opacity duration-300`} />
            <div className="relative z-10 flex flex-col items-center">
                <span className="text-4xl mb-2 filter drop-shadow-md transform group-hover:scale-125 transition-transform duration-300">{mood.emoji}</span>
                <span className="font-bold text-lg tracking-wide">{mood.label}</span>
            </div>
            <div className="absolute inset-0 opacity-0 group-hover:opacity-20 bg-gradient-to-r from-transparent via-white to-transparent -translate-x-full group-hover:translate-x-full transition-all duration-1000 ease-in-out" />
          </button>
        ))}
      </div>

      <div className="min-h-[400px] transition-all duration-500">
        {selectedMood ? (
           <div className="animate-fade-in-up">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 bg-stone-100 dark:bg-stone-900 p-6 rounded-2xl border border-stone-200 dark:border-stone-800">
                   <div className="flex items-center gap-4">
                       <div className="w-12 h-12 bg-white dark:bg-stone-800 rounded-full flex items-center justify-center text-2xl shadow-sm">
                            {MOODS.find(m => m.id === selectedMood)?.emoji}
                       </div>
                       <div>
                            <h3 className="text-xl font-bold text-stone-800 dark:text-stone-100">
                                {MOODS.find(m => m.id === selectedMood)?.label} Vibes
                            </h3>
                            <p className="text-stone-500 dark:text-stone-400 text-sm">
                                {MOODS.find(m => m.id === selectedMood)?.description}
                            </p>
                       </div>
                   </div>
                   <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-stone-400 bg-white dark:bg-stone-800 px-3 py-1 rounded-lg">
                       <Sparkles size={14} className="text-yellow-500" />
                       Curated For You
                   </div>
               </div>

               <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-8">
                   {RECOMMENDATIONS[selectedMood]?.map((book, i) => {
                       const owned = isBookOwned(book.title!);
                       return (
                       <div key={i} className="bg-white dark:bg-stone-900 p-5 rounded-2xl border border-stone-100 dark:border-stone-800 shadow-lg hover:shadow-2xl transition-all duration-300 group hover:-translate-y-2">
                           <div className="aspect-[2/3] bg-stone-200 dark:bg-stone-800 rounded-xl mb-5 overflow-hidden relative shadow-inner">
                               <img 
                                  src={book.coverUrl}
                                  alt={book.title} 
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                               />
                               <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-md px-2 py-1 rounded-md text-xs font-bold text-white shadow-lg border border-white/10">
                                   9{8 - i}% Match
                               </div>
                           </div>
                           
                           <div className="space-y-1 mb-4">
                                <h4 className="font-bold text-lg text-stone-800 dark:text-stone-100 font-serif leading-tight group-hover:text-purple-600 dark:group-hover:text-purple-400 transition-colors">
                                    {book.title}
                                </h4>
                                <p className="text-sm text-stone-500 dark:text-stone-400 font-medium">
                                    by {book.author}
                                </p>
                           </div>

                           <button 
                               onClick={() => handleAddBook(book)}
                               disabled={owned}
                               className={`w-full py-3 rounded-xl font-medium text-sm flex items-center justify-center gap-2 transition-all duration-300 ${
                                   owned 
                                   ? 'bg-stone-100 dark:bg-stone-800 text-stone-400 cursor-default'
                                   : 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 hover:bg-stone-800 dark:hover:bg-white/90 shadow-md hover:shadow-lg active:scale-95'
                               }`}
                           >
                               {owned ? (
                                   <>
                                    <Check size={16} />
                                    In Library
                                   </>
                               ) : (
                                   <>
                                    <Plus size={16} />
                                    Add to Diary
                                   </>
                               )}
                           </button>
                       </div>
                   )})}
               </div>
           </div>
        ) : (
            <div className="flex flex-col items-center justify-center h-64 text-center border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-3xl bg-stone-50/50 dark:bg-stone-900/30 animate-fade-in-up" style={{ animationDelay: '200ms' }}>
                <div className="w-16 h-16 bg-stone-100 dark:bg-stone-800 rounded-full flex items-center justify-center mb-4 shadow-sm">
                    <Compass size={32} className="text-stone-400 dark:text-stone-500" />
                </div>
                <h3 className="text-xl font-bold text-stone-400 dark:text-stone-500">Awaiting Input</h3>
                <p className="text-stone-400/60 dark:text-stone-600">Select a mood above to initialize the engine.</p>
            </div>
        )}
      </div>
    </div>
  );
};
