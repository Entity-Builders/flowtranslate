import { createClient, type Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      db: {
        schema: 'flowtranslate',
      },
      auth: {
        autoRefreshToken: true,
        persistSession: true,
      },
    })
  : null;

export const getFlowtranslateFunctionUrl = () => {
  const explicitUrl = import.meta.env.VITE_FLOWTRANSLATE_API_URL?.trim();
  if (explicitUrl) return explicitUrl;
  if (!supabaseUrl) return '';
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/flowtranslate-generate`;
};

export type { Session };
