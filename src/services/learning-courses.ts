import { supabase } from '../lib/supabase';

export type LearningCourseHistoryEntry = {
  translationRecordId: string;
  markdown: string;
  createdAt: string;
};

type LearningCourseRow = {
  translation_record_id: string;
  markdown: string;
  created_at: string;
};

export const listLearningCourses = async (): Promise<
  LearningCourseHistoryEntry[]
> => {
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('learning_courses')
    .select('translation_record_id, markdown, created_at')
    .order('created_at', { ascending: false })
    .limit(80);

  if (error) throw new Error(error.message);
  return ((data || []) as LearningCourseRow[]).map((row) => ({
    translationRecordId: row.translation_record_id,
    markdown: row.markdown,
    createdAt: row.created_at,
  }));
};
