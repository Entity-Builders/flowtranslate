import type {
  ExpressionBreakdown,
  ExpressionMode,
  BreakdownChatMessage,
  GrammarInsight,
  LanguageCode,
  LearningInsight,
  LearningInsightResponseMetadata,
  LearningAttempt,
  LearningSession,
  PracticeSet,
  PracticeType,
  StudyArticle,
  StudyArticleResponseMetadata,
  TranslationRecord,
  TranslationPresetId,
  UsageSnapshot,
} from '@eb-packages/flowtranslate-core';
import {
  getFlowtranslateFunctionUrl,
  getFlowtranslateProCheckoutFunctionUrl,
} from '../lib/supabase';
import { FLOWTRANSLATE_GUEST_DEVICE_HEADER } from '../constants';
import { getOrCreateGuestDeviceId } from './guest-identity';

export type FlowtranslateUsage = UsageSnapshot;

export type TranslateResponse = {
  kind: 'translate';
  text: string;
  mode: ExpressionMode;
  breakdown?: ExpressionBreakdown | null;
  grammarInsight?: GrammarInsight | null;
  translationRecord: Pick<
    TranslationRecord,
    | 'id'
    | 'sourceLanguage'
    | 'targetLanguage'
    | 'mode'
    | 'breakdown'
    | 'grammarInsight'
    | 'createdAt'
  > & {
    saved?: boolean;
    pending?: boolean;
  };
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

export type LearningInsightResponse = {
  kind: 'learning_insight';
  insight: LearningInsight;
  usage: FlowtranslateUsage;
} & LearningInsightResponseMetadata;

export type LearningSessionResponse = {
  kind: 'learning_session';
  session: LearningSession;
  cached: boolean;
  generatedFrom?: 'gemini' | 'fallback' | 'starter';
  usage: FlowtranslateUsage;
};

export type LearningAttemptFeedbackResponse = {
  kind: 'learning_attempt_feedback';
  attempt: LearningAttempt;
  generatedFrom?: 'gemini' | 'fallback';
  usage: FlowtranslateUsage;
};

export type BreakdownChatResponse = {
  kind: 'breakdown_chat';
  answer: string;
  usage: FlowtranslateUsage;
};

export type BreakdownEnrichmentResponse = {
  kind: 'breakdown_enrichment';
  breakdown: ExpressionBreakdown;
  translationRecord: Pick<
    TranslationRecord,
    | 'id'
    | 'sourceLanguage'
    | 'targetLanguage'
    | 'mode'
    | 'breakdown'
    | 'grammarInsight'
    | 'createdAt'
  >;
  cached?: boolean;
  generatedFrom?: 'gemini' | 'fallback';
  usage: FlowtranslateUsage;
};

export type GuestAccountSyncResponse = {
  kind: 'guest_account_sync';
  guestUserId: string;
  targetUserId: string;
  translationRecordsMoved: number;
  duplicateTranslationRecordsArchived: number;
  usageEventsMoved: number;
  guestIdentitiesMoved: number;
};

export type FlowtranslateProCheckoutResponse = {
  checkoutUrl: string;
  subscriptionId: string;
  externalReference: string;
  provider: 'mercado_pago';
  planId: string;
  status: 'pending';
  currency: string;
  displayAmount: number;
};

type FlowtranslateRequest =
  | {
      kind: 'translate';
      mode?: ExpressionMode;
      sourceLanguage?: LanguageCode;
      targetLanguage?: LanguageCode;
      text: string;
      context?: string;
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
    }
  | {
      kind: 'learning_insight';
      forceRefresh?: boolean;
    }
  | {
      kind: 'learning_session';
      situationId?: string;
    }
  | {
      kind: 'learning_attempt_feedback';
      sessionId: string;
      attemptText: string;
    }
  | {
      kind: 'breakdown_chat';
      translationRecordId: string;
      question: string;
      history?: BreakdownChatMessage[];
    }
  | {
      kind: 'breakdown_enrichment';
      translationRecordId: string;
    }
  | {
      kind: 'sync_guest_account';
      guestUserId: string;
    };

type FlowtranslateResponse =
  | TranslateResponse
  | PracticeResponse
  | StudyArticleResponse
  | LearningInsightResponse
  | LearningSessionResponse
  | LearningAttemptFeedbackResponse
  | BreakdownChatResponse
  | BreakdownEnrichmentResponse
  | GuestAccountSyncResponse;

type FlowtranslateErrorResponse = {
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
      [FLOWTRANSLATE_GUEST_DEVICE_HEADER]: getOrCreateGuestDeviceId(),
    },
    body: JSON.stringify(payload),
  });

  const data = (await response.json().catch(() => null)) as
    | FlowtranslateErrorResponse
    | TResponse
    | null;

  if (!response.ok) {
    const message =
      data && 'error' in data ? data.error : 'Flowtranslate request failed.';
    throw new FlowtranslateApiError(
      message,
      response.status,
      data && 'error' in data ? data.usage : undefined,
    );
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
    mode?: ExpressionMode;
    sourceLanguage?: LanguageCode;
    targetLanguage?: LanguageCode;
    text: string;
    context?: string;
    clientRequestId?: string;
    presetId?: TranslationPresetId;
  },
  accessToken: string,
) =>
  requestFlowtranslate<TranslateResponse>(
    {
      kind: 'translate',
      mode: params.mode,
      sourceLanguage: params.sourceLanguage,
      targetLanguage: params.targetLanguage,
      text: params.text,
      context: params.context,
      clientRequestId: params.clientRequestId,
      presetId: params.presetId,
    },
    accessToken,
  );

export const generateLearningInsight = (
  params: { forceRefresh?: boolean },
  accessToken: string,
) =>
  requestFlowtranslate<LearningInsightResponse>(
    {
      kind: 'learning_insight',
      forceRefresh: params.forceRefresh,
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

export const generateLearningSession = (
  params: { situationId?: string },
  accessToken: string,
) =>
  requestFlowtranslate<LearningSessionResponse>(
    {
      kind: 'learning_session',
      situationId: params.situationId,
    },
    accessToken,
  );

export const submitLearningAttempt = (
  params: { sessionId: string; attemptText: string },
  accessToken: string,
) =>
  requestFlowtranslate<LearningAttemptFeedbackResponse>(
    {
      kind: 'learning_attempt_feedback',
      sessionId: params.sessionId,
      attemptText: params.attemptText,
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

export const askBreakdownQuestion = (
  params: {
    translationRecordId: string;
    question: string;
    history?: BreakdownChatMessage[];
  },
  accessToken: string,
) =>
  requestFlowtranslate<BreakdownChatResponse>(
    {
      kind: 'breakdown_chat',
      translationRecordId: params.translationRecordId,
      question: params.question,
      history: params.history,
    },
    accessToken,
  );

export const enrichBreakdown = (
  params: {
    translationRecordId: string;
  },
  accessToken: string,
) =>
  requestFlowtranslate<BreakdownEnrichmentResponse>(
    {
      kind: 'breakdown_enrichment',
      translationRecordId: params.translationRecordId,
    },
    accessToken,
  );

export const syncGuestAccount = (
  params: { guestUserId: string },
  accessToken: string,
) =>
  requestFlowtranslate<GuestAccountSyncResponse>(
    {
      kind: 'sync_guest_account',
      guestUserId: params.guestUserId,
    },
    accessToken,
  );

export const startFlowtranslateProCheckout = async (accessToken: string) => {
  const endpoint = getFlowtranslateProCheckoutFunctionUrl();
  if (!endpoint) {
    throw new FlowtranslateApiError(
      'Flowtranslate Pro checkout is not configured.',
      0,
    );
  }

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({}),
  });

  const data = (await response.json().catch(() => null)) as
    | FlowtranslateProCheckoutResponse
    | { error: string }
    | null;

  if (!response.ok) {
    const message =
      data && 'error' in data ? data.error : 'Flowtranslate checkout failed.';
    throw new FlowtranslateApiError(message, response.status);
  }

  if (!data || 'error' in data) {
    throw new FlowtranslateApiError(
      'Flowtranslate checkout returned an empty response.',
      response.status,
    );
  }

  return data;
};
