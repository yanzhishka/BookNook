
import React, { useState } from 'react';
import { Book } from '../types';
import { Sparkles, Loader2, Info, Compass, Wand2, BookOpenText, Target, Hash, ChevronRight, RotateCcw, Zap, AlertCircle } from 'lucide-react';

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

  const toggleFlip = (index: number) => {
    setFlippedIndices(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const getRecommendations = async () => {
    if (!prompt.trim()) return;
    setLoading(true);
    setError(null);
    setRecommendations([]);
    setFlippedIndices([]);

    const myBooksContext = books.length > 0 
      ? `Пользователь уже читал или интересуется следующими книгами: ${books.slice(0, 10).map(b => `${b.title} (${b.author})`).join(', ')}. Не предлагай их снова.` 
      : '';

    const userMessage = `Подбери 6 уникальных книг для читателя с запросом: "${prompt}". ${myBooksContext}`;

    try {
      // Прямой вызов Groq API
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [
            { 
                role: "system", 
                content: `Ты — великий литературный оракул. Твоя задача — подбирать книги, которые изменят жизнь читателя. 
                Отвечай ТОЛЬКО в формате JSON. Массив объектов с полями: 
                "title" (название), 
                "author" (автор), 
                "description" (захватывающее описание 5-6 предложений на русском), 
                "vibe" (метафоричное описание атмосферы на русском), 
                "pages" (число страниц).` 
            },
            { role: "user", content: userMessage }
          ],
          response_format: { type: "json_object" },
          temperature: 0.8
        })
      });

      if (!response.ok) {
        if (response.status === 401) {
            throw new Error("Невалидный API ключ. Убедитесь, что ваш ключ Groq правильно настроен в окружении.");
        }
        throw new Error("Оракул временно недоступен. Попробуйте позже.");
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // Парсинг ответа Llama
      const parsed = JSON.parse(content);
      const finalData = Array.isArray(parsed) ? parsed : (parsed.recommendations || parsed.books || Object.values(parsed)[0]);
      
      if (Array.isArray(finalData)) {
        setRecommendations(finalData.slice(0, 6));
      } else {
        throw new Error("Неверный формат ответа от Оракула");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Ошибка связи с Оракулом.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto pb-20 px-4">
      <style>{`
        .perspective-1000 { perspective: 1000px; }
        .preserve-3d { transform-style: preserve-3d; }
        .backface-hidden { backface-visibility: hidden; }
        .rotate-y-180 { transform: rotateY(180deg); }
      `}</style>

      <div className="text-center mb-12 animate-fade-in-up">
        <div className="inline-block p-4 bg-amber-50 dark:bg-amber-900/10 rounded-3xl mb-4 shadow-inner border border-amber-100 dark:border-amber-800 relative group">
            <Compass size={44} className="text-amber-600 dark:text-amber-500 animate-pulse" />
            <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[8px] font-black px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                <Zap size={8} /> LLAMA-3 SPEED
            </div>
        </div>
        <h2 className="text-4xl md:text-5xl font-serif font-bold text-stone-800 dark:text-stone-100 mb-4 tracking-tight">
          Литературный <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-rose-500 to-orange-500">Оракул</span>
        </h2>
        <p className="text-stone-500 dark:text-stone-400 text-lg max-w-2xl mx-auto leading-relaxed">
          Раскройте свои желания. Нажмите на карточку, чтобы заглянуть внутрь каждой истории.
        </p>
      </div>

      <div className="relative mb-20 group animate-fade-in-up" style={{ animationDelay: '100ms' }}>
        <div className="absolute -inset-1 bg-gradient-to-r from-amber-500/30 to-rose-500/30 rounded-[2.5rem] blur opacity-25 group-hover:opacity-100 transition duration-1000"></div>
        <div className="relative bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-[2rem] p-3 flex flex-col md:flex-row items-center gap-3 shadow-2xl focus-within:ring-2 ring-amber-500/40 transition-all">
            <div className="pl-4 text-stone-400 hidden md:block">
                <Target size={24} />
            </div>
            <input 
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && getRecommendations()}
                placeholder="Что вы хотите почувствовать сегодня?.."
                className="flex-1 bg-transparent border-none outline-none px-4 py-4 text-stone-800 dark:text-stone-100 text-lg placeholder:text-stone-400"
            />
            <button 
                onClick={getRecommendations}
                disabled={loading || !prompt.trim()}
                className="w-full md:w-auto bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-10 py-4 rounded-2xl font-bold flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-95 transition-all shadow-lg disabled:opacity-50"
            >
                {loading ? <Loader2 size={22} className="animate-spin" /> : <Wand2 size={22} />}
                <span>Спросить</span>
            </button>
        </div>
      </div>

      {error && (
          <div className="text-center p-6 bg-red-50 dark:bg-red-900/10 text-red-500 rounded-3xl mb-12 animate-shake border border-red-100 dark:border-red-900/30 flex items-center justify-center gap-3">
              <AlertCircle size={20} />
              <span>{error}</span>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {loading && [1,2,3,4,5,6].map(i => (
            <div key={i} className="h-[450px] rounded-[2.5rem] bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 p-8 space-y-4 shadow-sm animate-pulse">
                <div className="w-20 h-6 bg-stone-100 dark:bg-stone-800 rounded-full" />
                <div className="w-3/4 h-8 bg-stone-100 dark:bg-stone-800 rounded-lg" />
                <div className="w-1/2 h-6 bg-stone-100 dark:bg-stone-800 rounded-lg" />
            </div>
        ))}
        
        {!loading && recommendations.map((rec, i) => {
            const isFlipped = flippedIndices.includes(i);
            return (
                <div 
                    key={i} 
                    className="perspective-1000 h-[450px] w-full cursor-pointer animate-scale-in"
                    style={{ animationDelay: `${i * 100}ms` }}
                    onClick={() => toggleFlip(i)}
                >
                    <div className={`relative w-full h-full transition-all duration-700 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                        <div className="absolute inset-0 backface-hidden bg-white dark:bg-stone-900 p-10 rounded-[2.5rem] border border-stone-100 dark:border-stone-800 shadow-xl flex flex-col justify-between group overflow-hidden">
                            <div className="absolute -top-24 -left-24 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-colors" />
                            
                            <div className="relative z-10">
                                <div className="mb-8 flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-4 py-1.5 rounded-full border border-amber-100 dark:border-amber-800/50">Прозрение {i+1}</span>
                                    <Sparkles size={18} className="text-amber-400 animate-pulse" />
                                </div>
                                
                                <h3 className="text-3xl font-serif font-bold text-stone-800 dark:text-stone-100 mb-3 group-hover:text-amber-600 dark:group-hover:text-amber-500 transition-colors leading-tight">
                                    {rec.title}
                                </h3>
                                <p className="text-xl text-stone-500 dark:text-stone-400 font-medium italic">от {rec.author}</p>
                            </div>

                            <div className="relative z-10 space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 bg-stone-50 dark:bg-stone-800 px-4 py-2 rounded-2xl border border-stone-100 dark:border-stone-700">
                                        <Hash size={14} className="text-stone-400" />
                                        <span className="text-sm font-bold text-stone-700 dark:text-stone-300">~{rec.pages} стр.</span>
                                    </div>
                                    <div className="flex-1 h-px bg-stone-100 dark:bg-stone-800" />
                                </div>
                                
                                <div className="flex items-start gap-3 text-stone-400 italic text-sm">
                                    <Compass size={18} className="shrink-0 text-amber-500 mt-0.5" />
                                    <p className="line-clamp-2">{rec.vibe}</p>
                                </div>

                                <div className="flex justify-center items-center gap-2 text-amber-600 dark:text-amber-400 font-bold text-xs uppercase tracking-widest pt-4 group-hover:translate-x-2 transition-transform">
                                    Узнать подробнее <ChevronRight size={14} />
                                </div>
                            </div>
                        </div>

                        <div className="absolute inset-0 backface-hidden rotate-y-180 bg-[#fdfaf6] dark:bg-stone-950 p-10 rounded-[2.5rem] border border-amber-100 dark:border-stone-800 shadow-2xl flex flex-col">
                            <div className="flex items-center justify-between mb-6 shrink-0">
                                <BookOpenText size={24} className="text-amber-600" />
                                <button className="p-2 hover:bg-amber-50 dark:hover:bg-stone-800 rounded-full transition-colors text-stone-400">
                                    <RotateCcw size={16} />
                                </button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                                <h4 className="font-serif font-bold text-xl text-stone-800 dark:text-stone-100 mb-4">{rec.title}</h4>
                                <p className="text-stone-700 dark:text-stone-300 leading-relaxed text-sm font-medium whitespace-pre-line">
                                    {rec.description}
                                </p>
                            </div>
                            
                            <div className="mt-8 pt-6 border-t border-amber-50 dark:border-stone-800/50 flex justify-center">
                                <div className="text-[10px] text-amber-600/60 dark:text-amber-400/40 uppercase tracking-[0.3em] font-black">
                                    Llama-3.3 Intelligence
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        })}

        {!loading && recommendations.length === 0 && (
            <div className="col-span-full py-24 text-center border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-[3.5rem] bg-stone-50/30 dark:bg-stone-900/10">
                <Info size={56} className="mx-auto mb-6 text-stone-200 dark:text-stone-800" />
                <h3 className="text-2xl font-serif font-bold text-stone-400 dark:text-stone-600 mb-2">Звезды еще не сошлись</h3>
                <p className="text-stone-400 dark:text-stone-600 max-w-sm mx-auto">Введите ваш запрос, чтобы получить шесть уникальных рекомендаций от Оракула.</p>
            </div>
        )}
      </div>
    </div>
  );
};
