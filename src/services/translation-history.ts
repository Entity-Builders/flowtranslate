import type {
  ExpressionBreakdown,
  ExpressionMode,
  TranslationRecord,
} from '@eb-packages/flowtranslate-core';
import { supabase } from '../lib/supabase';

type TranslationRow = {
  id: string;
  source_language: 'es' | 'en';
  target_language: 'es' | 'en';
  source_text: string;
  translated_text: string;
  mode: ExpressionMode | null;
  breakdown: ExpressionBreakdown | null;
  request_hash: string;
  pair_hash: string;
  created_at: string;
  deleted_at: string | null;
};

const mapRow = (row: TranslationRow): TranslationRecord => ({
  id: row.id,
  sourceLanguage: row.source_language,
  targetLanguage: row.target_language,
  sourceText: row.source_text,
  translatedText: row.translated_text,
  mode: row.mode || undefined,
  breakdown: row.breakdown || null,
  requestHash: row.request_hash,
  pairHash: row.pair_hash,
  createdAt: row.created_at,
  deletedAt: row.deleted_at,
});

export const listTranslationHistory = async () => {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('translation_records')
    .select(
      'id, source_language, target_language, source_text, translated_text, mode, breakdown, request_hash, pair_hash, created_at, deleted_at',
    )
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(80);

  if (error) throw new Error(error.message);
  return ((data || []) as TranslationRow[]).map(mapRow);
};

export const deleteTranslationRecord = async (id: string) => {
  if (!supabase) return;

  const { error } = await supabase
    .from('translation_records')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);
};

export const clearTranslationHistory = async () => {
  if (!supabase) return;

  const { error } = await supabase
    .from('translation_records')
    .update({ deleted_at: new Date().toISOString() })
    .is('deleted_at', null);

  if (error) throw new Error(error.message);
};
