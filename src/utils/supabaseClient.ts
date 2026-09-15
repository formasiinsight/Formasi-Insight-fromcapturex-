import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  'https://hkmtzbidbfbkykppfpvp.supabase.co';

const SUPABASE_ANON_KEY =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhrbXR6YmlkYmZia3lrcHBmcHZwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwNjU0NjksImV4cCI6MjEwMjY0MTQ2OX0.3UNqTucuqlK7OSqr0uSV8cC7XTFG3H5p3HY6wLdDT7U';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}

export const SUPABASE_PROJECT_CONFIG = {
  projectName: 'Formasi Insight',
  projectId: 'hkmtzbidbfbkykppfpvp',
  supabaseUrl: SUPABASE_URL,
};
