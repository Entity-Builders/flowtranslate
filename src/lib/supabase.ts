import { createSupabaseAuthStorageKey } from '@eb-packages/auth';
import { createClient, type Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';
export const flowtranslateAuthStorageKey =
  createSupabaseAuthStorageKey('flowtranslate');

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      db: {
        schema: 'flowtranslate',
      },
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        storageKey: flowtranslateAuthStorageKey,
      },
    })
  : null;

export const getSupabaseFunctionUrl = (
  functionName: string,
  explicitUrl?: string,
) => {
  if (explicitUrl?.trim()) return explicitUrl.trim();
  if (!supabaseUrl) return '';
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/${functionName}`;
};

export const getFlowtranslateFunctionUrl = () => {
  const explicitUrl = import.meta.env.VITE_FLOWTRANSLATE_API_URL?.trim();
  return getSupabaseFunctionUrl('flowtranslate-generate', explicitUrl);
};

export const getFlowtranslateProCheckoutFunctionUrl = () => {
  const explicitUrl =
    import.meta.env.VITE_FLOWTRANSLATE_PRO_CHECKOUT_API_URL?.trim();
  return getSupabaseFunctionUrl('flowtranslate-pro-checkout', explicitUrl);
};

export const getFlowtranslateTopupCheckoutFunctionUrl = () => {
  const explicitUrl =
    import.meta.env.VITE_FLOWTRANSLATE_TOPUP_CHECKOUT_API_URL?.trim();
  return getSupabaseFunctionUrl('flowtranslate-topup-checkout', explicitUrl);
};

export type { Session };
