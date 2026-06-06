import {
  selectRecentUniqueActiveTranslations,
  type LanguageCode,
  type TranslationRecord,
} from '@eb-packages/flowtranslate-core';
import { MAX_LEARNING_HISTORY } from '../constants';

type CountedValue = {
  value: string;
  count: number;
};

type DirectionSignal = {
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  count: number;
  percentage: number;
};

export type LearningDashboardMetrics = {
  totalRecords: number;
  uniqueContextCount: number;
  reusedWordTotal: number;
  repeatedPhraseTotal: number;
  reusedWords: CountedValue[];
  repeatedPhrases: CountedValue[];
  directionMix: DirectionSignal[];
  recentContexts: TranslationRecord[];
};

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'for',
  'from',
  'have',
  'i',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'this',
  'to',
  'we',
  'with',
  'you',
  'your',
]);

const tokenize = (value: string) =>
  (value.toLocaleLowerCase().match(/[a-záéíóúüñ]+(?:'[a-z]+)?/gi) || [])
    .map((word) => word.trim())
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));

const countValues = (values: string[]) => {
  const counts = new Map<string, number>();
  values.forEach((value) => {
    counts.set(value, (counts.get(value) || 0) + 1);
  });

  return [...counts.entries()]
    .map(([value, count]) => ({ value, count }))
    .filter((item) => item.count > 1)
    .sort((a, b) => b.count - a.count || a.value.localeCompare(b.value));
};

const englishLearningText = (record: TranslationRecord) =>
  record.targetLanguage === 'en' ? record.translatedText : record.sourceText;

const directionKey = (record: TranslationRecord) =>
  `${record.sourceLanguage}:${record.targetLanguage}` as const;

const buildPhraseCandidates = (words: string[]) => {
  const phrases: string[] = [];
  for (let index = 0; index < words.length - 1; index += 1) {
    phrases.push(`${words[index]} ${words[index + 1]}`);
  }
  return phrases;
};

const buildDirectionMix = (records: TranslationRecord[]): DirectionSignal[] => {
  const counts = new Map<string, number>();
  records.forEach((record) => {
    counts.set(directionKey(record), (counts.get(directionKey(record)) || 0) + 1);
  });

  return [...counts.entries()]
    .map(([key, count]) => {
      const [sourceLanguage, targetLanguage] = key.split(':') as [
        LanguageCode,
        LanguageCode,
      ];

      return {
        sourceLanguage,
        targetLanguage,
        count,
        percentage: records.length ? Math.round((count / records.length) * 100) : 0,
      };
    })
    .sort((a, b) => b.count - a.count);
};

export const buildLearningDashboard = (
  history: TranslationRecord[],
): LearningDashboardMetrics => {
  const recentContexts = selectRecentUniqueActiveTranslations(
    history,
    MAX_LEARNING_HISTORY,
  );
  const wordTokens = recentContexts.flatMap((record) =>
    tokenize(englishLearningText(record)),
  );
  const phraseTokens = recentContexts.flatMap((record) =>
    buildPhraseCandidates(tokenize(englishLearningText(record))),
  );
  const reusedWords = countValues(wordTokens).slice(0, 6);
  const repeatedPhrases = countValues(phraseTokens).slice(0, 5);

  return {
    totalRecords: history.length,
    uniqueContextCount: recentContexts.length,
    reusedWordTotal: reusedWords.reduce((total, item) => total + item.count, 0),
    repeatedPhraseTotal: repeatedPhrases.reduce(
      (total, item) => total + item.count,
      0,
    ),
    reusedWords,
    repeatedPhrases,
    directionMix: buildDirectionMix(recentContexts),
    recentContexts: recentContexts.slice(0, 4),
  };
};
