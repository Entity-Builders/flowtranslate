import type {
  BreakdownChatMessage,
  StudyArticle,
  TranslationRecord,
  UsageSnapshot,
} from '@entity-builders/flowtranslate-core';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { useFlowtranslateAccount } from '../../hooks/useFlowtranslateAccount';
import {
  analytics,
  safeCommercialAnalyticsProperties,
} from '../../services/analytics';
import {
  FlowtranslateApiError,
  askBreakdownQuestion,
  generateStudyArticle,
} from '../../services/flowtranslate-api';

type FlowtranslateAccount = ReturnType<typeof useFlowtranslateAccount>;

type UseLearningStudyToolsParams = {
  account: FlowtranslateAccount;
  historyCount: number;
  online: boolean;
  onOpenAccount: () => void;
  onUsage: (usage: UsageSnapshot) => void;
};

const guestLearningMessage =
  'Conecta una cuenta para desbloquear Learning personal y conservar tu progreso.';

const captureFlowtranslateError = (
  error: unknown,
  context: Record<string, unknown>,
) => {
  analytics.captureError(error, safeCommercialAnalyticsProperties(context));
};

export const useLearningStudyTools = ({
  account,
  historyCount,
  online,
  onOpenAccount,
  onUsage,
}: UseLearningStudyToolsParams) => {
  const [studyArticle, setStudyArticle] = useState<StudyArticle | null>(null);
  const [studyLoading, setStudyLoading] = useState(false);
  const [studyError, setStudyError] = useState('');
  const [selectedStudyRecordId, setSelectedStudyRecordId] =
    useState<string | null>(null);
  const renderedStudyArticleRef = useRef<string | null>(null);

  useEffect(() => {
    if (!studyArticle) {
      renderedStudyArticleRef.current = null;
      return;
    }

    const renderKey = `${studyArticle.translationRecordId}:${studyArticle.articleVersion}`;
    if (renderedStudyArticleRef.current === renderKey) return;

    renderedStudyArticleRef.current = renderKey;
    analytics.track('learning_study_article_rendered', {
      article_version: studyArticle.articleVersion,
      lesson_focus_count: studyArticle.lessonFocus?.length || 0,
      estimated_reading_minutes: studyArticle.estimatedReadingMinutes || null,
    });
  }, [studyArticle]);

  const closeStudyArticle = useCallback(() => {
    setSelectedStudyRecordId(null);
    setStudyArticle(null);
    setStudyError('');
  }, []);

  const closeStudyArticleForRecord = useCallback(
    (recordId: string) => {
      if (selectedStudyRecordId !== recordId) return;
      setSelectedStudyRecordId(null);
      setStudyArticle(null);
      setStudyError('');
    },
    [selectedStudyRecordId],
  );

  const openStudyArticle = useCallback(
    async (record: TranslationRecord) => {
      setStudyError('');
      setSelectedStudyRecordId(record.id);
      setStudyArticle(null);

      if (!online) {
        setStudyError('Estas offline. Los articulos de estudio necesitan conexion.');
        return;
      }

      if (!account.accessToken) {
        onOpenAccount();
        setStudyError('Conecta tu cuenta para estudiar tus respuestas guardadas.');
        return;
      }

      if (account.isGuest) {
        onOpenAccount();
        setStudyError(guestLearningMessage);
        analytics.track('account_connect_prompt_shown', {
          surface: 'study_article',
          reason: 'learning_guest',
          account_kind: account.accountKind,
          history_count: historyCount,
        });
        analytics.track('learning_guest_blocked', {
          surface: 'study_article',
        });
        return;
      }

      setStudyLoading(true);
      analytics.track('learning_study_article_submitted', {
        direction: `${record.sourceLanguage}_${record.targetLanguage}`,
      });

      try {
        const result = await generateStudyArticle(
          { translationRecordId: record.id },
          account.accessToken,
        );
        setStudyArticle(result.article);
        onUsage(result.usage);
        analytics.track('learning_study_article_succeeded', {
          article_version: result.article.articleVersion,
          cached: result.cached,
          generated_at: result.generatedAt || null,
          lesson_focus_count: result.article.lessonFocus?.length || 0,
          estimated_reading_minutes:
            result.article.estimatedReadingMinutes || null,
        });
      } catch (error) {
        captureFlowtranslateError(error, {
          screen: 'learning',
          action: 'generate_study_article',
          account_kind: account.accountKind,
        });
        if (error instanceof FlowtranslateApiError) {
          if (error.usage) onUsage(error.usage);
          setStudyError(error.message);
        } else {
          setStudyError(
            error instanceof Error ? error.message : 'No pudimos abrir el articulo.',
          );
        }
        analytics.track('learning_study_article_failed', {
          error_type: 'exception',
        });
      } finally {
        setStudyLoading(false);
      }
    },
    [
      account.accessToken,
      account.accountKind,
      account.isGuest,
      historyCount,
      online,
      onOpenAccount,
      onUsage,
    ],
  );

  const askAboutBreakdown = useCallback(
    async (
      record: TranslationRecord,
      question: string,
      chatHistory: BreakdownChatMessage[],
    ) => {
      const trimmedQuestion = question.trim();

      if (!online) {
        throw new Error('Estas offline. Las preguntas necesitan conexion.');
      }

      if (!account.accessToken) {
        onOpenAccount();
        throw new Error('Conecta tu cuenta para preguntarle a la IA.');
      }

      if (account.isGuest) {
        onOpenAccount();
        analytics.track('account_connect_prompt_shown', {
          surface: 'breakdown_chat',
          reason: 'learning_guest',
          account_kind: account.accountKind,
          history_count: historyCount,
        });
        analytics.track('learning_guest_blocked', {
          surface: 'breakdown_chat',
        });
        throw new Error(guestLearningMessage);
      }

      analytics.track('learning_breakdown_chat_submitted', {
        mode: record.mode || null,
        question_length: trimmedQuestion.length,
        history_turns: chatHistory.length,
      });

      try {
        const result = await askBreakdownQuestion(
          {
            translationRecordId: record.id,
            question: trimmedQuestion,
            history: chatHistory,
          },
          account.accessToken,
        );
        onUsage(result.usage);
        analytics.track('learning_breakdown_chat_succeeded', {
          mode: record.mode || null,
          answer_length: result.answer.length,
        });
        return result.answer;
      } catch (error) {
        captureFlowtranslateError(error, {
          screen: 'learning',
          action: 'ask_breakdown_question',
          account_kind: account.accountKind,
          mode: record.mode || null,
        });
        if (error instanceof FlowtranslateApiError && error.usage) {
          onUsage(error.usage);
        }
        analytics.track('learning_breakdown_chat_failed', {
          error_type: 'exception',
        });
        throw error;
      }
    },
    [
      account.accessToken,
      account.accountKind,
      account.isGuest,
      historyCount,
      online,
      onOpenAccount,
      onUsage,
    ],
  );

  return {
    askAboutBreakdown,
    closeStudyArticle,
    closeStudyArticleForRecord,
    openStudyArticle,
    selectedStudyRecordId,
    studyArticle,
    studyError,
    studyLoading,
  };
};
