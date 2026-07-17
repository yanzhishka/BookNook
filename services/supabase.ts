import { createClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import type { Database } from './database.types';

export const MOBILE_AUTH_CALLBACK = 'io.github.yanzhishka.booknook://auth/callback';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabasePublishableKey = (
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
  || import.meta.env.VITE_SUPABASE_ANON_KEY
)?.trim();

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error(
    'Supabase не настроен: добавьте VITE_SUPABASE_URL и '
      + 'VITE_SUPABASE_PUBLISHABLE_KEY (или VITE_SUPABASE_ANON_KEY).',
  );
}

try {
  new URL(supabaseUrl);
} catch {
  throw new Error('VITE_SUPABASE_URL должен быть корректным HTTPS URL проекта Supabase.');
}

export const supabase = createClient<Database>(supabaseUrl, supabasePublishableKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: !Capacitor.isNativePlatform(),
  },
});

const readAuthParameter = (url: URL, name: string) => {
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  return url.searchParams.get(name) || hash.get(name);
};

export const establishSessionFromAuthUrl = async (authUrl: string): Promise<boolean> => {
  if (!authUrl.startsWith(MOBILE_AUTH_CALLBACK)) return false;

  const url = new URL(authUrl);
  const authError = readAuthParameter(url, 'error_description')
    || readAuthParameter(url, 'error');
  if (authError) throw new Error(authError);

  const code = readAuthParameter(url, 'code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw new Error(error.message);
    return true;
  }

  const accessToken = readAuthParameter(url, 'access_token');
  const refreshToken = readAuthParameter(url, 'refresh_token');
  if (!accessToken || !refreshToken) {
    throw new Error('Ссылка подтверждения не содержит данные сессии. Запросите новое письмо.');
  }

  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  });
  if (error) throw new Error(error.message);
  return true;
};
