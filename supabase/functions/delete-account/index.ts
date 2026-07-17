import { createClient } from "npm:@supabase/supabase-js@2.108.2";

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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const authorization = req.headers.get("authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = Deno.env.get("SUPABASE_ANON_KEY");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!authorization || !supabaseUrl || !publishableKey || !serviceRoleKey) {
    return json(401, { error: "Требуется авторизация" });
  }

  const body = await req.json().catch(() => ({}));
  if (body.confirmation !== "DELETE_MY_ACCOUNT") {
    return json(400, { error: "Подтвердите удаление аккаунта" });
  }

  const userClient = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) return json(401, { error: "Недействительная сессия" });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { error: repliesError } = await admin
    .from("thread_replies")
    .delete()
    .eq("author_id", user.id);
  if (repliesError) return json(500, { error: "Не удалось удалить ответы пользователя" });

  const { error: threadsError } = await admin
    .from("threads")
    .delete()
    .eq("author_id", user.id);
  if (threadsError) return json(500, { error: "Не удалось удалить темы пользователя" });

  const { error: deleteError } = await admin.auth.admin.deleteUser(user.id);
  if (deleteError) return json(500, { error: "Не удалось удалить аккаунт" });

  return json(200, { deleted: true });
});
