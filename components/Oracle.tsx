
import React, { useState, useEffect } from 'react';
import { Book } from '../types';
import { Loader2, Wand2, BookOpenText, Hash, ChevronRight, RotateCcw, Zap, AlertCircle, Cpu } from 'lucide-react';

interface OracleProps {
  books: Book[];
}

interface Recommendation {
  title: string;
  author: string;
  description: string;
  vibe: string;
  pages: number;
}

export const Oracle: React.FC<OracleProps> = ({ books }) => {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [flippedIndices, setFlippedIndices] = useState<number[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  // Ключ берется из переменных окружения Vercel/Vite
  const GROQ_KEY = process.env.GROQ_API_KEY || '';
  const [hasKey, setHasKey] = useState<boolean>(!!GROQ_KEY);

  useEffect(() => {
    setHasKey(!!GROQ_KEY);
  }, [GROQ_KEY]);

  const toggleFlip = (index: number) => {
    setFlippedIndices(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const getRecommendations = async () => {
    if (!prompt.trim()) return;
    
    if (!GROQ_KEY) {
      setError("GROQ_API_KEY не настроен в переменных окружения.");
      return;
    }

    setLoading(true);
    setError(null);
    setRecommendations([]);
    setFlippedIndices([]);

    const myBooksContext = books.length > 0 
      ? `Контекст пользователя (уже читал): ${books.slice(0, 10).map(b => b.title).join(', ')}.` 
      : '';

    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${GROQ_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            {
              role: "system",
              content: "Ты — литературный Оракул. Твоя цель — подбирать книги на основе глубокого понимания атмосферы. Отвечай СТРОГО в формате JSON. Текст должен быть на русском языке. Структура: { \"recommendations\": [{ \"title\": \"\", \"author\": \"\", \"description\": \"(5-6 предложений)\", \"vibe\": \"(атмосфера)\", \"pages\": 300 }] }"
            },
            {
              role: "user",
              content: `Рекомендуй 6 уникальных книг для: "${prompt}". ${myBooksContext}`
            }
          ],
          response_format: { type: "json_object" },
          temperature: 0.7
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.error?.message || "Ошибка API Groq");
      }

      const data = await response.json();
      const content = JSON.parse(data.choices[0].message.content);
      setRecommendations(content.recommendations || []);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ошибка связи с Оракулом.");
    } finally {
      setLoading(false);
    }
  };

  if (!hasKey) {
    return (
      <div className="max-w-2xl mx-auto py-32 px-6 text-center animate-fade-in-up">
        <div className="w-24 h-24 bg-rose-50 dark:bg-rose-900/20 rounded-3xl flex items-center justify-center mx-auto mb-8 shadow-xl border border-rose-100 dark:border-rose-800">
          <AlertCircle size={40} className="text-rose-500" />
        </div>
        <h2 className="text-3xl font-serif font-black text-stone-800 dark:text-stone-100 mb-4">Groq Key Missing</h2>
        <p className="text-stone-500 dark:text-stone-400 mb-10 leading-relaxed">
          Для работы Оракула через Groq необходимо добавить переменную <code>GROQ_API_KEY</code> в файл <code>.env</code> в корне проекта.
        </p>
        <div className="p-4 bg-stone-100 dark:bg-stone-800 rounded-2xl text-xs font-mono text-stone-500 text-left overflow-x-auto">
          .env &gt; GROQ_API_KEY=your_groq_api_key
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto pb-20 px-4">
      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>

      <div className="text-center mb-12 animate-fade-in-up">
        <div className="inline-block p-4 bg-orange-50 dark:bg-orange-900/10 rounded-3xl mb-4 border border-orange-100 dark:border-orange-800 relative group">
            <Cpu size={44} className="text-orange-600 dark:text-orange-500" />
            <div className="absolute -top-2 -right-2 bg-black text-white text-[8px] font-black px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                <Zap size={8} className="text-orange-400" /> LLAMA 3.3 ACTIVE
            </div>
        </div>
        <h2 className="text-4xl md:text-5xl font-serif font-black text-stone-800 dark:text-stone-100 mb-4 tracking-tighter">
          Литературный <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 via-rose-500 to-amber-500">Оракул</span>
        </h2>
        <p className="text-stone-500 dark:text-stone-400 text-lg max-w-2xl mx-auto leading-relaxed">
          Интеллект Llama 3 на службе вашего чтения. Введите запрос, чтобы получить мгновенное предсказание.
        </p>
      </div>

      <div className="relative mb-20 group animate-fade-in-up">
        <div className="absolute -inset-1 bg-gradient-to-r from-orange-500/30 to-rose-500/30 rounded-[2.5rem] blur opacity-25 group-hover:opacity-100 transition duration-1000"></div>
        <div className="relative bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-[2rem] p-3 flex flex-col md:flex-row items-center gap-3 shadow-2xl">
            <input 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && getRecommendations()}
                placeholder="Например: хочу что-то мрачное в стиле киберпанка..."
                className="flex-1 bg-transparent border-none outline-none px-6 py-4 text-stone-800 dark:text-stone-100 text-lg placeholder:text-stone-400 font-medium"
            />
            <button 
                onClick={getRecommendations}
                disabled={loading || !prompt.trim()}
                className="w-full md:w-auto bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-10 py-4 rounded-2xl font-black uppercase text-xs tracking-widest flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-95 transition-all shadow-lg disabled:opacity-50"
            >
                {loading ? <Loader2 size={20} className="animate-spin" /> : <Wand2 size={20} />}
                <span>Спросить</span>
            </button>
        </div>
      </div>

      {error && (
          <div className="text-center p-6 bg-red-50 dark:bg-red-900/10 text-red-500 rounded-3xl mb-12 animate-shake border border-red-100 dark:border-red-900/30">
              <span className="font-bold">{error}</span>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {loading && [1,2,3,4,5,6].map(i => (
            <div key={i} className="h-[450px] rounded-[3rem] bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 p-8 space-y-6 shadow-sm animate-pulse" />
        ))}
        
        {!loading && recommendations.map((rec, i) => (
            <div 
                key={i} 
                className="perspective-1000 h-[480px] w-full cursor-pointer animate-scale-in"
                onClick={() => toggleFlip(i)}
            >
                <div className={`relative w-full h-full transition-all duration-700 preserve-3d ${flippedIndices.includes(i) ? 'rotate-y-180' : ''}`}>
                    <div className="absolute inset-0 backface-hidden bg-white dark:bg-stone-900 p-10 rounded-[3rem] border border-stone-100 dark:border-stone-800 shadow-xl flex flex-col justify-between group overflow-hidden">
                        <div className="relative z-10">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-orange-600 bg-orange-50 dark:bg-orange-900/20 px-4 py-1.5 rounded-full border border-orange-100 dark:border-orange-800/50 mb-8 inline-block">Прозрение {i+1}</span>
                            <h3 className="text-3xl font-serif font-black text-stone-800 dark:text-stone-100 mb-3 leading-tight">{rec.title}</h3>
                            <p className="text-xl text-stone-500 dark:text-stone-400 font-bold italic">от {rec.author}</p>
                        </div>
                        <div className="relative z-10 space-y-6">
                            <div className="flex items-center gap-2 bg-stone-50 dark:bg-stone-800 px-4 py-2 rounded-2xl border border-stone-100 dark:border-stone-700 w-fit">
                                <Hash size={14} className="text-stone-400" />
                                <span className="text-sm font-black text-stone-700 dark:text-stone-300">~{rec.pages} стр.</span>
                            </div>
                            <p className="text-stone-400 italic line-clamp-2 leading-relaxed">{rec.vibe}</p>
                            <div className="text-orange-600 dark:text-orange-400 font-black text-[10px] uppercase tracking-widest pt-4 flex items-center gap-2">Подробнее <ChevronRight size={14} /></div>
                        </div>
                    </div>
                    <div className="absolute inset-0 backface-hidden rotate-y-180 bg-[#fdfaf6] dark:bg-stone-950 p-10 rounded-[3rem] border border-orange-100 dark:border-stone-800 shadow-2xl flex flex-col">
                        <div className="flex items-center justify-between mb-6 shrink-0"><BookOpenText size={24} className="text-orange-600" /><RotateCcw size={16} className="text-stone-400" /></div>
                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                            <h4 className="font-serif font-black text-2xl text-stone-800 dark:text-stone-100 mb-4">{rec.title}</h4>
                            <p className="text-stone-700 dark:text-stone-300 leading-relaxed text-base italic whitespace-pre-line">{rec.description}</p>
                        </div>
                    </div>
                </div>
            </div>
        ))}
      </div>
    </div>
  );
};
