import { createClient } from '@supabase/supabase-js';

// Use import.meta.env for Vite compatibility.
// VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY must be in your .env file.
const supabaseUrl = "https://qsnsmmtudoiybxsrzllc.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFzbnNtbXR1ZG9peWJ4c3J6bGxjIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM1NjIwMDEsImV4cCI6MjA3OTEzODAwMX0.L5fVzXIjcOsFKFFDiGGGN_PLGUSbH3U9_83BxVnZuO4";

if (!supabaseUrl || !supabaseAnonKey || supabaseUrl.includes('YOUR_PROJECT_ID')) {
  console.error('🔴 Supabase keys missing! Check .env file. Variables must start with VITE_');
} else {
  console.log('🟢 Supabase Client Initialized');
}

export const supabase = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseAnonKey || 'placeholder'
);