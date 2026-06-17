import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Не валим приложение, но громко предупреждаем — без ключей Supabase ничего не заработает.
  console.error(
    'Supabase не настроен: добавь VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в файл .env',
  );
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '', {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
