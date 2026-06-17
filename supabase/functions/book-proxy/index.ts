// Supabase Edge Function: book-proxy
// Прокси к Open Library (поиск) и Internet Archive (текст книги).
// Деплой:  supabase functions deploy book-proxy
//
// Вызывается с фронтенда через supabase.functions.invoke('book-proxy', { body })
//   body = { action: 'search', query: '...' }
//   body = { action: 'text',   iaIds: ['...'] }

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

const toArray = <T>(value: T | T[] | undefined | null): T[] => {
  if (Array.isArray(value)) return value;
  if (value === undefined || value === null) return [];
  return [value];
};

const getCoverUrl = (coverId: number | undefined, title: string) =>
  coverId
    ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg`
    : `https://ui-avatars.com/api/?name=${encodeURIComponent(title || "Book")}&background=random&size=512`;

const mapDoc = (doc: any) => {
  const firstSentence = toArray<string>(doc.first_sentence)[0];
  const iaIds = toArray<string>(doc.ia).filter(Boolean);
  return {
    id: doc.key || crypto.randomUUID(),
    title: doc.title || "Без названия",
    author: toArray<string>(doc.author_name).join(", ") || "Автор не указан",
    coverUrl: getCoverUrl(doc.cover_i, doc.title),
    firstPublishYear: doc.first_publish_year,
    pageCount: doc.number_of_pages_median,
    editionCount: doc.edition_count,
    iaIds,
    hasReadableText: Boolean(doc.public_scan_b && iaIds.length > 0),
    description: firstSentence ? `Первое предложение: ${firstSentence}` : "",
  };
};

const encodeArchivePath = (name: string) =>
  name.split("/").map(encodeURIComponent).join("/");

const findTextFile = (files: any[] = []) => {
  const f = files.filter((x) => typeof x.name === "string");
  return (
    f.find((x) => x.format === "DjVuTXT") ||
    f.find((x) => x.name.endsWith("_djvu.txt")) ||
    f.find((x) => x.name.endsWith(".txt") && !x.name.includes("_meta"))
  );
};

const search = async (query: string) => {
  if (!query || query.trim().length < 2) return [];
  const fields = [
    "key", "title", "author_name", "cover_i", "first_publish_year",
    "edition_count", "ia", "public_scan_b", "ebook_access", "has_fulltext",
    "first_sentence", "number_of_pages_median",
  ].join(",");

  const url = new URL("https://openlibrary.org/search.json");
  url.searchParams.set("q", query.trim());
  url.searchParams.set("fields", fields);
  url.searchParams.set("limit", "12");

  const res = await fetch(url);
  if (!res.ok) throw new Error("Open Library search is unavailable");
  const data = await res.json();
  return (data.docs || []).map(mapDoc);
};

const fetchText = async (iaId: string) => {
  const meta = await fetch(`https://archive.org/metadata/${encodeURIComponent(iaId)}`);
  if (!meta.ok) throw new Error("Internet Archive metadata is unavailable");
  const metadata = await meta.json();
  const textFile = findTextFile(metadata.files);
  if (!textFile) throw new Error("No readable text file");

  const textUrl = `https://archive.org/download/${encodeURIComponent(iaId)}/${encodeArchivePath(textFile.name)}`;
  const res = await fetch(textUrl);
  if (!res.ok) throw new Error("Text file could not be downloaded");
  const content = await res.text();
  if (content.trim().length < 1000) throw new Error("Text too short");
  return { content, source: textUrl };
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = body.action;

    if (action === "search") {
      return json(200, await search(String(body.query || "")));
    }

    if (action === "text") {
      const iaIds: string[] = toArray<string>(body.iaIds).slice(0, 3);
      for (const iaId of iaIds) {
        try {
          return json(200, await fetchText(iaId));
        } catch (_) { /* пробуем следующий id */ }
      }
      return json(404, { error: "Readable text not found", content: null });
    }

    return json(400, { error: "Unknown action" });
  } catch (err) {
    return json(500, { error: (err as Error).message });
  }
});
