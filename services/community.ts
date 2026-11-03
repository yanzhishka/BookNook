import { supabase } from "./supabase";
import type {
  CommunityKind,
  CommunitySource,
  CommunityTopic,
  ThreadReply,
} from "../types";
import type { Database } from "./database.types";

type TopicRow = Database["public"]["Views"]["community_topics"]["Row"];
export type TopicIdentity = { source: CommunitySource; id: string };
export type TopicSort = "new" | "active" | "popular";
export type TopicScope = "all" | "mine" | "unanswered";
export interface TopicQuery {
  query: string;
  kind: CommunityKind | "all";
  scope: TopicScope;
  sort: TopicSort;
  offset?: number;
  pageSize?: number;
}
export const TOPIC_KINDS: { value: CommunityKind; label: string }[] = [
  { value: "discussion", label: "Обсуждения" },
  { value: "quote", label: "Цитаты" },
  { value: "review", label: "Отзывы" },
];
export const topicKey = (topic: TopicIdentity) => `${topic.source}:${topic.id}`;
const dateTime = new Intl.DateTimeFormat("ru", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});
const formatDate = (value: string) =>
  Number.isNaN(Date.parse(value))
    ? "Дата не указана"
    : dateTime.format(new Date(value));

export function mapCommunityTopic(row: TopicRow): CommunityTopic {
  if (!row.id || !["thread", "post"].includes(row.source || ""))
    throw new Error("Некорректная запись сообщества");
  const snapshot =
    row.book_snapshot &&
    typeof row.book_snapshot === "object" &&
    !Array.isArray(row.book_snapshot)
      ? row.book_snapshot
      : null;
  const book =
    snapshot && typeof snapshot.title === "string"
      ? {
          title: snapshot.title,
          author: typeof snapshot.author === "string" ? snapshot.author : "",
          coverUrl:
            typeof snapshot.coverUrl === "string" ? snapshot.coverUrl : "",
        }
      : null;
  return {
    id: row.id,
    source: row.source as CommunitySource,
    kind: TOPIC_KINDS.some((k) => k.value === row.kind)
      ? (row.kind as CommunityKind)
      : "discussion",
    title: row.title || "Обсуждение",
    content: row.content || "",
    imageUrl: row.image_url || undefined,
    authorId: row.author_id || "",
    authorName: row.author_name || "Читатель",
    authorAvatar: row.author_avatar || undefined,
    createdAt: row.created_at || "",
    lastActivityAt: row.last_activity_at || row.created_at || "",
    timestamp: formatDate(row.created_at || ""),
    repliesCount: Number(row.replies_count || 0),
    likesCount: Number(row.likes_count || 0),
    likedByMe: row.liked_by_me === true,
    book,
  };
}
function checkAbort(signal?: AbortSignal) {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
}
function assertData<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error("Источник не вернул данные");
  return data;
}
const replyPageSize = 30;

export const community = {
  async list(options: TopicQuery, signal?: AbortSignal) {
    checkAbort(signal);
    const size = Math.max(1, Math.min(50, options.pageSize || 20));
    let request = supabase.rpc("search_community_topics", {
      p_query: options.query.trim().slice(0, 200),
      p_kind: options.kind,
      p_scope: options.scope,
      p_sort: options.sort,
      p_offset: options.offset || 0,
      p_limit: size + 1,
    });
    if (signal) request = request.abortSignal(signal);
    const { data, error } = await request;
    checkAbort(signal);
    const rows = assertData(data, error);
    return {
      topics: rows.slice(0, size).map(mapCommunityTopic),
      hasMore: rows.length > size,
    };
  },
  async get(
    identity: TopicIdentity,
    signal?: AbortSignal,
  ): Promise<CommunityTopic> {
    checkAbort(signal);
    let request = supabase
      .from("community_topics")
      .select("*")
      .eq("source", identity.source)
      .eq("id", identity.id);
    if (signal) request = request.abortSignal(signal);
    const { data, error } = await request.single();
    checkAbort(signal);
    return mapCommunityTopic(assertData(data, error));
  },
  async create(
    input: {
      id: string;
      title: string;
      content: string;
      kind: CommunityKind;
      bookId: string | null;
      imageUrl: string | null;
    },
    userId: string,
  ) {
    const title = input.title.trim(),
      content = input.content.trim();
    if (!title || title.length > 160 || !content || content.length > 20000)
      throw new Error("Заполните название и текст темы");
    const { error } = await supabase
      .from("threads")
      .insert({
        id: input.id,
        title,
        content,
        kind: input.kind,
        book_id: input.bookId,
        image_url: input.imageUrl,
        author_id: userId,
        author_name: "",
      });
    if (error && error.code !== "23505") throw new Error(error.message);
    const topic = await this.get({ source: "thread", id: input.id });
    if (topic.authorId !== userId) throw new Error("Не удалось создать тему");
    return topic;
  },
  async like(topic: TopicIdentity, userId: string, liked: boolean) {
    const query =
      topic.source === "thread"
        ? liked
          ? supabase
              .from("thread_likes")
              .upsert(
                { thread_id: topic.id, user_id: userId },
                { onConflict: "thread_id,user_id", ignoreDuplicates: true },
              )
          : supabase
              .from("thread_likes")
              .delete()
              .eq("thread_id", topic.id)
              .eq("user_id", userId)
        : liked
          ? supabase
              .from("activity_likes")
              .upsert(
                { activity_id: topic.id, user_id: userId },
                { onConflict: "activity_id,user_id", ignoreDuplicates: true },
              )
          : supabase
              .from("activity_likes")
              .delete()
              .eq("activity_id", topic.id)
              .eq("user_id", userId);
    const { error } = await query;
    if (error) throw new Error(error.message);
    return this.get(topic);
  },
  async replies(topic: TopicIdentity, offset = 0, signal?: AbortSignal) {
    checkAbort(signal);
    const request =
      topic.source === "thread"
        ? supabase
            .from("thread_replies")
            .select(
              "id,thread_id,author_id,author_name,content,image_url,created_at",
            )
            .eq("thread_id", topic.id)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(offset, offset + replyPageSize)
        : supabase
            .from("activity_comments")
            .select(
              "id,user_id,content,created_at,profile:profiles!activity_comments_user_id_fkey(name)",
            )
            .eq("activity_id", topic.id)
            .order("created_at", { ascending: false })
            .order("id", { ascending: false })
            .range(offset, offset + replyPageSize);
    if (signal) request.abortSignal(signal);
    const { data, error } = await request;
    checkAbort(signal);
    const rows = assertData(data, error) as unknown as {
      id: string;
      author_id?: string | null;
      user_id?: string;
      author_name?: string;
      profile?: { name: string } | null;
      content: string;
      image_url?: string | null;
      created_at: string;
    }[];
    const replies: ThreadReply[] = rows
      .slice(0, replyPageSize)
      .map((row) => ({
        id: row.id,
        threadId: topic.id,
        authorId: row.author_id || row.user_id || "",
        authorName: row.author_name || row.profile?.name || "Читатель",
        content: row.content,
        imageUrl: row.image_url || undefined,
        timestamp: formatDate(row.created_at),
      }))
      .reverse();
    return { replies, hasMore: rows.length > replyPageSize };
  },
  async reply(
    topic: TopicIdentity,
    input: { id: string; content: string; imageUrl: string | null },
    userId: string,
  ): Promise<ThreadReply> {
    const limit = topic.source === "post" ? 2000 : 20000;
    if (!input.content.trim() || input.content.trim().length > limit)
      throw new Error(`Ответ должен содержать от 1 до ${limit} символов`);
    if (topic.source === "post" && input.imageUrl)
      throw new Error("К этой публикации можно добавить текстовый ответ");
    if (topic.source === "thread") {
      const { data, error } = await supabase
        .from("thread_replies")
        .insert({
          id: input.id,
          thread_id: topic.id,
          author_id: userId,
          author_name: "",
          content: input.content.trim(),
          image_url: input.imageUrl,
        })
        .select("*")
        .single();
      if (error?.code === "23505") {
        const retry = await supabase
          .from("thread_replies")
          .select("*")
          .eq("id", input.id)
          .eq("author_id", userId)
          .eq("thread_id", topic.id)
          .single();
        const row = assertData(retry.data, retry.error);
        return {
          id: row.id,
          threadId: topic.id,
          authorId: row.author_id || "",
          authorName: row.author_name,
          content: row.content,
          imageUrl: row.image_url || undefined,
          timestamp: formatDate(row.created_at),
        };
      }
      const row = assertData(data, error);
      return {
        id: row.id,
        threadId: topic.id,
        authorId: row.author_id || "",
        authorName: row.author_name,
        content: row.content,
        imageUrl: row.image_url || undefined,
        timestamp: formatDate(row.created_at),
      };
    }
    const { data, error } = await supabase
      .from("activity_comments")
      .insert({
        id: input.id,
        activity_id: topic.id,
        user_id: userId,
        content: input.content.trim(),
      })
      .select("*,profile:profiles!activity_comments_user_id_fkey(name)")
      .single();
    if (error?.code === "23505") {
      const retry = await supabase
        .from("activity_comments")
        .select("*,profile:profiles!activity_comments_user_id_fkey(name)")
        .eq("id", input.id)
        .eq("user_id", userId)
        .eq("activity_id", topic.id)
        .single();
      const row = assertData(retry.data, retry.error);
      return {
        id: row.id,
        threadId: topic.id,
        authorId: row.user_id,
        authorName: row.profile?.name || "Читатель",
        content: row.content,
        timestamp: formatDate(row.created_at),
      };
    }
    const row = assertData(data, error);
    return {
      id: row.id,
      threadId: topic.id,
      authorId: row.user_id,
      authorName: row.profile?.name || "Читатель",
      content: row.content,
      timestamp: formatDate(row.created_at),
    };
  },
  async remove(topic: TopicIdentity) {
    const { data, error } =
      topic.source === "thread"
        ? await supabase
            .from("threads")
            .delete()
            .eq("id", topic.id)
            .select("id")
        : await supabase
            .from("activities")
            .delete()
            .eq("id", topic.id)
            .select("id");
    if (error) throw new Error(error.message);
    if (!data?.length)
      throw new Error("Тема уже удалена или у вас нет права её удалить");
  },
  async removeReply(topic: TopicIdentity, id: string) {
    const { data, error } =
      topic.source === "thread"
        ? await supabase
            .from("thread_replies")
            .delete()
            .eq("id", id)
            .eq("thread_id", topic.id)
            .select("id")
        : await supabase
            .from("activity_comments")
            .delete()
            .eq("id", id)
            .eq("activity_id", topic.id)
            .select("id");
    if (error) throw new Error(error.message);
    if (!data?.length)
      throw new Error("Ответ уже удалён или у вас нет права его удалить");
  },
};
