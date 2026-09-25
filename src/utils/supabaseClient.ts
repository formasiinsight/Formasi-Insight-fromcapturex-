import { createClient, SupabaseClient } from '@supabase/supabase-js';

const SUPABASE_URL =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL) ||
  'https://tecsyuwdfmfidkxctvny.supabase.co';

const SUPABASE_ANON_KEY =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY) ||
  'sb_publishable_DFuF0jkzJ_MPBCZMzvPfyw_dUjsGvyE';

let client: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
  return client;
}

export const SUPABASE_PROJECT_CONFIG = {
  projectName: 'Formasi Insight',
  projectId: 'tecsyuwdfmfidkxctvny',
  supabaseUrl: SUPABASE_URL,
};
