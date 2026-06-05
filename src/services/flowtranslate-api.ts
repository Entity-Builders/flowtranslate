import type {
  LanguageCode,
  PracticeSet,
  PracticeType,
  StudyArticle,
  StudyArticleResponseMetadata,
  TranslationRecord,
  TranslationPresetId,
  UsageSnapshot,
} from '@eb-packages/flowtranslate-core';
import { getFlowtranslateFunctionUrl } from '../lib/supabase';

export type FlowtranslateUsage = UsageSnapshot;

export type TranslateResponse = {
  kind: 'translate';
  text: string;
  translationRecord: Pick<
    TranslationRecord,
    'id' | 'sourceLanguage' | 'targetLanguage' | 'createdAt'
  >;
  usage: FlowtranslateUsage;
};

export type PracticeResponse = {
  kind: 'practice';
  practice: PracticeSet;
  insufficientHistory?: boolean;
  usage: FlowtranslateUsage;
};

export type StudyArticleResponse = {
  kind: 'study_article';
  article: StudyArticle;
  usage: FlowtranslateUsage;
} & StudyArticleResponseMetadata;

type FlowtranslateRequest =
  | {
      kind: 'translate';
      sourceLanguage: LanguageCode;
      targetLanguage: LanguageCode;
      text: string;
      clientRequestId?: string;
      presetId?: TranslationPresetId;
    }
  | {
      kind: 'practice';
      practiceTypes?: PracticeType[];
    }
  | {
      kind: 'study_article';
      translationRecordId: string;
    };

type FlowtranslateResponse =
  | TranslateResponse
  | PracticeResponse
  | StudyArticleResponse
  | {
      error: string;
      usage?: FlowtranslateUsage;
    };

export class FlowtranslateApiError extends Error {
  status: number;
  usage?: FlowtranslateUsage;

  constructor(message: string, status: number, usage?: FlowtranslateUsage) {
    super(message);
    this.name = 'FlowtranslateApiError';
    this.status = status;
    this.usage = usage;
  }
}

const requestFlowtranslate = async <TResponse extends FlowtranslateResponse>(
  payload: FlowtranslateRequest,
  accessToken: string,
) => {
  const endpoint = getFlowtranslateFunctionUrl();
  if (!endpoint) {
    throw new FlowtranslateApiError(
      'Flowtranslate backend is not configured.',
      0,
    );
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as TResponse | null;

  if (!response.ok) {
    const message =
      data && 'error' in data ? data.error : 'Flowtranslate request failed.';
    throw new FlowtranslateApiError(message, response.status, data?.usage);
  }

  if (!data || 'error' in data) {
    throw new FlowtranslateApiError(
      'Flowtranslate returned an empty response.',
      response.status,
    );
  }

  return data;
};

export const generateTranslation = (
  params: {
    sourceLanguage: LanguageCode;
    targetLanguage: LanguageCode;
    text: string;
    clientRequestId?: string;
    presetId?: TranslationPresetId;
  },
  accessToken: string,
) =>
  requestFlowtranslate<TranslateResponse>(
    {
      kind: 'translate',
      sourceLanguage: params.sourceLanguage,
      targetLanguage: params.targetLanguage,
      text: params.text,
      clientRequestId: params.clientRequestId,
      presetId: params.presetId,
    },
    accessToken,
  );

export const generatePractice = (
  params: { practiceTypes?: PracticeType[] },
  accessToken: string,
) =>
  requestFlowtranslate<PracticeResponse>(
    {
      kind: 'practice',
      practiceTypes: params.practiceTypes,
    },
    accessToken,
  );

export const generateStudyArticle = (
  params: { translationRecordId: string },
  accessToken: string,
) =>
  requestFlowtranslate<StudyArticleResponse>(
    {
      kind: 'study_article',
      translationRecordId: params.translationRecordId,
    },
    accessToken,
  );
