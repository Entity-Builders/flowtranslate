import type {
  LearningSession,
  LearningSessionContent,
  SavedPhrase,
} from '@entity-builders/flowtranslate-core';
import { supabase } from '../lib/supabase';

type LearningSessionRow = {
  id: string;
  situation_id: string;
  catalog_version: string;
  status: 'active' | 'completed' | 'archived';
  content: LearningSessionContent;
  source_record_ids: string[] | null;
  history_snapshot_hash: string | null;
  created_at: string;
  completed_at: string | null;
};

type SavedPhraseRow = {
  id: string;
  phrase_text: string;
  note: string | null;
  situation_id: string | null;
  session_id: string | null;
  source_record_ids: string[] | null;
  created_at: string;
  archived_at: string | null;
};

export type SaveLearningPhraseInput = {
  text: string;
  note?: string;
  situationId?: string | null;
  catalogVersion?: string | null;
  sessionId?: string | null;
  sourceRecordIds?: string[];
};

const mapLearningSession = (row: LearningSessionRow): LearningSession => ({
  id: row.id,
  situationId: row.situation_id,
  catalogVersion: row.catalog_version,
  status: row.status,
  content: row.content,
  sourceRecordIds: row.source_record_ids || [],
  historySnapshotHash: row.history_snapshot_hash || undefined,
  createdAt: row.created_at,
  completedAt: row.completed_at,
});

const mapSavedPhrase = (row: SavedPhraseRow): SavedPhrase => ({
  id: row.id,
  text: row.phrase_text,
  note: row.note || undefined,
  situationId: row.situation_id,
  sessionId: row.session_id,
  sourceRecordIds: row.source_record_ids || [],
  createdAt: row.created_at,
  archivedAt: row.archived_at,
});

const getCurrentUserId = async () => {
  if (!supabase) return null;

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw new Error(error.message);
  return user?.id || null;
};

export const listLearningSessions = async () => {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('learning_sessions')
    .select(
      'id, situation_id, catalog_version, status, content, source_record_ids, history_snapshot_hash, created_at, completed_at',
    )
    .neq('status', 'archived')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) throw new Error(error.message);
  return ((data || []) as LearningSessionRow[]).map(mapLearningSession);
};

export const completeLearningSession = async (sessionId: string) => {
  if (!supabase) return;

  const { error } = await supabase
    .from('learning_sessions')
    .update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('id', sessionId);

  if (error) throw new Error(error.message);
};

export const listSavedPhrases = async () => {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('saved_phrases')
    .select(
      'id, phrase_text, note, situation_id, session_id, source_record_ids, created_at, archived_at',
    )
    .is('archived_at', null)
    .order('created_at', { ascending: false })
    .limit(80);

  if (error) throw new Error(error.message);
  return ((data || []) as SavedPhraseRow[]).map(mapSavedPhrase);
};

export const saveLearningPhrase = async (input: SaveLearningPhraseInput) => {
  if (!supabase) return null;

  const userId = await getCurrentUserId();
  if (!userId) throw new Error('Conecta tu cuenta para guardar frases.');

  const { data, error } = await supabase
    .from('saved_phrases')
    .insert({
      user_id: userId,
      phrase_text: input.text,
      note: input.note || null,
      situation_id: input.situationId || null,
      catalog_version: input.catalogVersion || null,
      session_id: input.sessionId || null,
      source_record_ids: input.sourceRecordIds || [],
    })
    .select(
      'id, phrase_text, note, situation_id, session_id, source_record_ids, created_at, archived_at',
    )
    .single();

  if (error) throw new Error(error.message);
  return mapSavedPhrase(data as SavedPhraseRow);
};

export const archiveSavedPhrase = async (id: string) => {
  if (!supabase) return;

  const { error } = await supabase
    .from('saved_phrases')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', id);

  if (error) throw new Error(error.message);
};
