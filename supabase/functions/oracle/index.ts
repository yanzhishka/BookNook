// Supabase Edge Function: oracle
// Книжные рекомендации через Groq (Llama). Ключ GROQ_API_KEY хранится
// в секретах Supabase (supabase secrets set GROQ_API_KEY=...), в клиент не попадает.
//
// Вызов с фронтенда: supabase.functions.invoke('oracle', { body: { prompt, myBooks } })
//   body = { prompt: string, myBooks?: string[] }
// Ответ: { recommendations: [{ title, author, description, vibe, pages }] }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json; charset=utf-8" },
  });

const SYSTEM_PROMPT =
  'Ты — литературный Оракул. Твоя цель — подбирать книги на основе глубокого понимания атмосферы. Отвечай СТРОГО в формате JSON. Текст должен быть на русском языке. Структура: { "recommendations": [{ "title": "", "author": "", "description": "(5-6 предложений)", "vibe": "(атмосфера)", "pages": 300 }] }';

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const groqKey = Deno.env.get("GROQ_API_KEY");
  if (!groqKey) {
    return json(500, { error: "Оракул не настроен на сервере (нет GROQ_API_KEY)" });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const prompt = String(body.prompt || "").trim().slice(0, 500);
    if (!prompt) return json(400, { error: "Пустой запрос" });

    const myBooks: string[] = Array.isArray(body.myBooks)
      ? body.myBooks.slice(0, 10).map((t: unknown) => String(t).slice(0, 120))
      : [];
    const context = myBooks.length
      ? `Контекст пользователя (уже читал): ${myBooks.join(", ")}.`
      : "";

    const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${groqKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Рекомендуй 6 уникальных книг для: "${prompt}". ${context}` },
        ],
        response_format: { type: "json_object" },
        temperature: 0.7,
      }),
    });

    if (!groqRes.ok) {
      const errData = await groqRes.json().catch(() => null);
      return json(502, { error: errData?.error?.message || "Ошибка API Groq" });
    }

    const data = await groqRes.json();
    const content = JSON.parse(data.choices[0].message.content);
    return json(200, { recommendations: content.recommendations || [] });
  } catch (err) {
    return json(500, { error: (err as Error).message || "Ошибка Оракула" });
  }
});
