import { getFlowtranslateFunctionUrl } from '../lib/supabase';

export type FlowtranslateUsage = {
  estimatedTokens: number;
  monthlyQuota: number;
  usedThisMonth: number;
  remainingThisMonth: number;
};

type FlowtranslateRequest =
  | {
      kind: 'translate';
      targetLanguage: string;
      text: string;
    }
  | {
      kind: 'article';
      targetLanguage: string;
      sourceText: string;
      translatedText: string;
    };

type FlowtranslateResponse =
  | {
      text: string;
      usage?: FlowtranslateUsage;
    }
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

const requestFlowtranslate = async (
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

  const data = (await response.json().catch(() => null)) as
    | FlowtranslateResponse
    | null;

  if (!response.ok) {
    const message =
      data && 'error' in data ? data.error : 'Flowtranslate request failed.';
    throw new FlowtranslateApiError(message, response.status, data?.usage);
  }

  if (!data || !('text' in data)) {
    throw new FlowtranslateApiError(
      'Flowtranslate returned an empty response.',
      response.status,
    );
  }

  return data;
};

export const generateTranslation = (
  params: { text: string; targetLanguage: string },
  accessToken: string,
) =>
  requestFlowtranslate(
    {
      kind: 'translate',
      text: params.text,
      targetLanguage: params.targetLanguage,
    },
    accessToken,
  );

export const generateLearningArticle = (
  params: {
    sourceText: string;
    translatedText: string;
    targetLanguage: string;
  },
  accessToken: string,
) =>
  requestFlowtranslate(
    {
      kind: 'article',
      sourceText: params.sourceText,
      translatedText: params.translatedText,
      targetLanguage: params.targetLanguage,
    },
    accessToken,
  );
