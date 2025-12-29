
import React, { useState, useEffect, useCallback } from 'react';
import { Book } from '../types';
import { GoogleGenAI, Type } from "@google/genai";
import { Sparkles, Loader2, Info, Compass, Wand2, BookOpenText, Target, Hash, ChevronRight, RotateCcw, Zap, AlertCircle, Lock, RefreshCcw } from 'lucide-react';

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
  
  const [hasKey, setHasKey] = useState<boolean>(!!process.env.API_KEY);
  const [checkingKey, setCheckingKey] = useState<boolean>(true);

  // Реактивная проверка ключа
  useEffect(() => {
    const checkKey = async () => {
      let selected = false;
      if (window.aistudio) {
        try {
          selected = await window.aistudio.hasSelectedApiKey();
        } catch (e) {
          console.error("Selection check failed", e);
        }
      }
      // Если системный чек не сработал, проверяем переменную окружения напрямую
      setHasKey(selected || !!process.env.API_KEY);
      setCheckingKey(false);
    };
    
    checkKey();
    // Проверяем каждые 2 секунды, не появился ли ключ (на случай если пользователь выбрал его в другом окне)
    const interval = setInterval(checkKey, 2000);
    return () => clearInterval(interval);
  }, []);

  const handleConnectKey = useCallback(async () => {
    if (window.aistudio && typeof window.aistudio.openSelectKey === 'function') {
      try {
        await window.aistudio.openSelectKey();
        // Согласно правилам, сразу считаем, что ключ выбран, чтобы избежать race condition
        setHasKey(true);
        setError(null);
      } catch (e) {
        setError("Не удалось открыть окно выбора ключа. Попробуйте обновить страницу.");
      }
    } else {
      setError("Системный модуль выбора ключа недоступен. Убедитесь, что вы используете приложение в среде AI Studio.");
    }
  }, []);

  const toggleFlip = (index: number) => {
    setFlippedIndices(prev => 
      prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const getRecommendations = async () => {
    if (!prompt.trim()) return;
    
    // Последняя проверка перед запросом
    if (!process.env.API_KEY) {
        setError("API ключ не обнаружен. Пожалуйста, нажмите кнопку подключения.");
        return; 
    }

    setLoading(true);
    setError(null);
    setRecommendations([]);
    setFlippedIndices([]);

    const myBooksContext = books.length > 0 
      ? `Пользователь уже читал: ${books.slice(0, 10).map(b => `${b.title} (${b.author})`).join(', ')}.` 
      : '';

    try {
      // Создаем экземпляр непосредственно перед вызовом
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: `Подбери 6 книг на русском языке по запросу: "${prompt}". ${myBooksContext}`,
        config: {
          systemInstruction: "Ты — великий литературный оракул. Твоя задача — подбирать книги, которые изменят жизнь читателя. Отвечай СТРОГО в формате JSON. Весь текст (названия, описания) должен быть на русском языке.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              recommendations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    author: { type: Type.STRING },
                    description: { type: Type.STRING },
                    vibe: { type: Type.STRING },
                    pages: { type: Type.NUMBER }
                  },
                  required: ["title", "author", "description", "vibe", "pages"]
                }
              }
            }
          }
        }
      });

      const text = response.text;
      if (!text) throw new Error("Оракул промолчал. Попробуйте другой запрос.");
      
      const data = JSON.parse(text);
      if (data.recommendations && Array.isArray(data.recommendations)) {
        setRecommendations(data.recommendations.slice(0, 6));
      } else {
        throw new Error("Формат ответа Оракула не распознан.");
      }
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes('401') || err.message?.includes('key')) {
          setHasKey(false);
          setError("Ваш API ключ недействителен или не выбран. Пожалуйста, подключите его заново.");
      } else {
          setError(err.message || "Ошибка связи с Оракулом.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingKey) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="animate-spin text-amber-500 mb-4" size={48} />
        <p className="text-stone-400 font-black uppercase tracking-[0.2em] text-[10px]">Пробуждение Оракула...</p>
      </div>
    );
  }

  if (!hasKey) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-6 text-center animate-fade-in-up">
        <div className="w-24 h-24 bg-amber-50 dark:bg-amber-900/20 text-amber-600 rounded-[2rem] flex items-center justify-center mx-auto mb-8 shadow-2xl border border-amber-100 dark:border-amber-800/50">
          <Lock size={40} className="animate-pulse" />
        </div>
        <h2 className="text-4xl font-serif font-black text-stone-800 dark:text-stone-100 mb-4 tracking-tight">Оракул ждет ключа</h2>
        <p className="text-stone-500 dark:text-stone-400 mb-10 leading-relaxed text-lg">
          Для работы предсказаний необходимо выбрать API ключ в системном окне. 
          Если кнопка не срабатывает, попробуйте обновить страницу.
        </p>
        
        <div className="space-y-4">
            <button 
              onClick={handleConnectKey}
              className="group bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 px-12 py-5 rounded-2xl font-black uppercase text-xs tracking-[0.3em] hover:scale-105 active:scale-95 transition-all shadow-[0_20px_50px_rgba(0,0,0,0.2)] flex items-center gap-4 mx-auto"
            >
              <Zap size={20} className="group-hover:text-amber-500 transition-colors" /> 
              <span>Подключить ключ</span>
            </button>
            
            <button 
                onClick={() => window.location.reload()}
                className="text-stone-400 hover:text-stone-600 dark:hover:text-stone-200 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 mx-auto pt-4 transition-colors"
            >
                <RefreshCcw size={12} /> Обновить страницу
            </button>
        </div>

        {error && (
            <div className="mt-10 p-4 bg-red-50 dark:bg-red-900/10 text-red-500 rounded-2xl border border-red-100 dark:border-red-900/20 text-sm font-medium flex items-center justify-center gap-2">
                <AlertCircle size={16} /> {error}
            </div>
        )}
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
        <div className="inline-block p-4 bg-amber-50 dark:bg-amber-900/10 rounded-3xl mb-4 shadow-inner border border-amber-100 dark:border-amber-800 relative group">
            <Compass size={44} className="text-amber-600 dark:text-amber-500 animate-pulse" />
            <div className="absolute -top-2 -right-2 bg-emerald-500 text-white text-[8px] font-black px-2 py-1 rounded-full flex items-center gap-1 shadow-lg">
                <Zap size={8} /> GEMINI AI ACTIVE
            </div>
        </div>
        <h2 className="text-4xl md:text-5xl font-serif font-black text-stone-800 dark:text-stone-100 mb-4 tracking-tighter">
          Литературный <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-500 via-rose-500 to-orange-500">Оракул</span>
        </h2>
        <p className="text-stone-500 dark:text-stone-400 text-lg max-w-2xl mx-auto leading-relaxed font-medium">
          Ваш ключ подключен. Расскажите о своих желаниях, и Оракул укажет путь сквозь страницы.
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
                className="flex-1 bg-transparent border-none outline-none px-4 py-4 text-stone-800 dark:text-stone-100 text-lg placeholder:text-stone-400 font-medium"
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
          <div className="text-center p-6 bg-red-50 dark:bg-red-900/10 text-red-500 rounded-3xl mb-12 animate-shake border border-red-100 dark:border-red-900/30 flex items-center justify-center gap-3">
              <AlertCircle size={20} />
              <span className="font-bold">{error}</span>
              <button onClick={handleConnectKey} className="ml-4 underline font-black uppercase text-[10px] tracking-widest">Переподключить</button>
          </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-10">
        {loading && [1,2,3,4,5,6].map(i => (
            <div key={i} className="h-[450px] rounded-[3rem] bg-white dark:bg-stone-900 border border-stone-100 dark:border-stone-800 p-8 space-y-6 shadow-sm animate-pulse">
                <div className="w-24 h-6 bg-stone-100 dark:bg-stone-800 rounded-full" />
                <div className="space-y-3">
                    <div className="w-full h-8 bg-stone-100 dark:bg-stone-800 rounded-lg" />
                    <div className="w-2/3 h-8 bg-stone-100 dark:bg-stone-800 rounded-lg" />
                </div>
                <div className="w-1/2 h-6 bg-stone-100 dark:bg-stone-800 rounded-lg" />
            </div>
        ))}
        
        {!loading && recommendations.map((rec, i) => {
            const isFlipped = flippedIndices.includes(i);
            return (
                <div 
                    key={i} 
                    className="perspective-1000 h-[480px] w-full cursor-pointer animate-scale-in"
                    style={{ animationDelay: `${i * 100}ms` }}
                    onClick={() => toggleFlip(i)}
                >
                    <div className={`relative w-full h-full transition-all duration-700 preserve-3d ${isFlipped ? 'rotate-y-180' : ''}`}>
                        <div className="absolute inset-0 backface-hidden bg-white dark:bg-stone-900 p-10 rounded-[3rem] border border-stone-100 dark:border-stone-800 shadow-xl flex flex-col justify-between group overflow-hidden">
                            <div className="absolute -top-24 -left-24 w-64 h-64 bg-amber-500/5 rounded-full blur-3xl group-hover:bg-amber-500/10 transition-colors" />
                            
                            <div className="relative z-10">
                                <div className="mb-8 flex items-center justify-between">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-4 py-1.5 rounded-full border border-amber-100 dark:border-amber-800/50">Прозрение {i+1}</span>
                                    <Sparkles size={18} className="text-amber-400 animate-pulse" />
                                </div>
                                
                                <h3 className="text-3xl font-serif font-black text-stone-800 dark:text-stone-100 mb-3 group-hover:text-amber-600 dark:group-hover:text-amber-500 transition-colors leading-tight">
                                    {rec.title}
                                </h3>
                                <p className="text-xl text-stone-500 dark:text-stone-400 font-bold italic">от {rec.author}</p>
                            </div>

                            <div className="relative z-10 space-y-6">
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 bg-stone-50 dark:bg-stone-800 px-4 py-2 rounded-2xl border border-stone-100 dark:border-stone-700">
                                        <Hash size={14} className="text-stone-400" />
                                        <span className="text-sm font-black text-stone-700 dark:text-stone-300">~{rec.pages} стр.</span>
                                    </div>
                                    <div className="flex-1 h-px bg-stone-100 dark:bg-stone-800" />
                                </div>
                                
                                <div className="flex items-start gap-3 text-stone-400 italic font-medium">
                                    <Compass size={18} className="shrink-0 text-amber-500 mt-0.5" />
                                    <p className="line-clamp-2 leading-relaxed">{rec.vibe}</p>
                                </div>

                                <div className="flex justify-center items-center gap-2 text-amber-600 dark:text-amber-400 font-black text-[10px] uppercase tracking-widest pt-4 group-hover:translate-x-2 transition-transform">
                                    Узнать подробнее <ChevronRight size={14} />
                                </div>
                            </div>
                        </div>

                        <div className="absolute inset-0 backface-hidden rotate-y-180 bg-[#fdfaf6] dark:bg-stone-950 p-10 rounded-[3rem] border border-amber-100 dark:border-stone-800 shadow-2xl flex flex-col">
                            <div className="flex items-center justify-between mb-6 shrink-0">
                                <BookOpenText size={24} className="text-amber-600" />
                                <button className="p-2 hover:bg-amber-50 dark:hover:bg-stone-800 rounded-full transition-colors text-stone-400">
                                    <RotateCcw size={16} />
                                </button>
                            </div>
                            
                            <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                                <h4 className="font-serif font-black text-2xl text-stone-800 dark:text-stone-100 mb-4 tracking-tight leading-tight">{rec.title}</h4>
                                <p className="text-stone-700 dark:text-stone-300 leading-relaxed text-base font-medium whitespace-pre-line italic">
                                    {rec.description}
                                </p>
                            </div>
                            
                            <div className="mt-8 pt-6 border-t border-amber-50 dark:border-stone-800/50 flex justify-center">
                                <div className="text-[10px] text-amber-600/60 dark:text-amber-400/40 uppercase tracking-[0.3em] font-black">
                                    Gemini Intelligence
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            );
        })}

        {!loading && recommendations.length === 0 && (
            <div className="col-span-full py-24 text-center border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-[3.5rem] bg-stone-50/30 dark:bg-stone-900/10">
                <Info size={56} className="mx-auto mb-6 text-stone-200 dark:text-stone-800 opacity-20" />
                <h3 className="text-2xl font-serif font-black text-stone-400 dark:text-stone-600 mb-2">Звезды еще не сошлись</h3>
                <p className="text-stone-400 dark:text-stone-600 max-w-sm mx-auto font-medium">Введите ваш запрос в строку поиска выше, чтобы получить предсказание Оракула.</p>
            </div>
        )}
      </div>
    </div>
  );
};
