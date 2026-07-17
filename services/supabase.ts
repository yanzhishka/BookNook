import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

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
    detectSessionInUrl: true,
  },
});
