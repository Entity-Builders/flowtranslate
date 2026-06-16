import {
  STARTER_LEARNING_SITUATIONS,
  getLearningSituationById,
  type LearningAttempt,
  type LearningSession,
  type SavedPhrase,
  type UsageSnapshot,
} from '@eb-packages/flowtranslate-core';
import { useCallback, useEffect, useState } from 'react';
import type { useFlowtranslateAccount } from '../../hooks/useFlowtranslateAccount';
import {
  analytics,
  safeCommercialAnalyticsProperties,
} from '../../services/analytics';
import {
  FlowtranslateApiError,
  generateLearningSession,
  submitLearningAttempt,
} from '../../services/flowtranslate-api';
import {
  archiveSavedPhrase,
  completeLearningSession,
  listLearningSessions,
  listSavedPhrases,
  saveLearningPhrase,
  type SaveLearningPhraseInput,
} from '../../services/learning-progress';

type FlowtranslateAccount = ReturnType<typeof useFlowtranslateAccount>;

type UseFlowtranslateLearningParams = {
  account: FlowtranslateAccount;
  historyCount: number;
  isLearningView: boolean;
  online: boolean;
  onOpenAccount: () => void;
  onUsage: (usage: UsageSnapshot) => void;
};

const guestLearningMessage =
  'Conecta una cuenta para desbloquear Learning personal y conservar tu progreso.';

const isStarterLearningSession = (session: LearningSession) =>
  session.id.startsWith('starter-');

const captureFlowtranslateError = (
  error: unknown,
  context: Record<string, unknown>,
) => {
  analytics.captureError(error, safeCommercialAnalyticsProperties(context));
};

const buildStarterLearningSession = (situationId?: string): LearningSession => {
  const situation =
    (situationId ? getLearningSituationById(situationId) : null) ||
    STARTER_LEARNING_SITUATIONS[0];
  const anchorPhrase =
    situation.samplePhrases[0] || 'Thanks for the update.';
  const softerAlternative =
    situation.samplePhrases[1] || 'I appreciate the context.';

  return {
    id: `starter-${situation.id}`,
    situationId: situation.id,
    catalogVersion: situation.catalogVersion,
    status: 'active',
    content: {
      situationTitle: situation.title,
      anchorPhrase,
      whyItWorks: situation.description,
      grammarNotes: [
        {
          label: 'Situacion',
          text: situation.outcome,
          note: 'Aprendelo como una escena de trabajo, no como una regla suelta.',
        },
        {
          label: 'Chunk reusable',
          text: anchorPhrase,
          note: 'Esta parte se puede copiar y adaptar en mensajes parecidos.',
        },
      ],
      bestOption: {
        prompt: 'Cual version suena mas natural para este contexto?',
        choices: [
          {
            id: 'preferred',
            text: anchorPhrase,
            preferred: true,
            feedback:
              'Esta opcion mantiene claridad, tono profesional y proximo paso.',
          },
          {
            id: 'flat',
            text: softerAlternative,
            preferred: false,
            feedback:
              'Puede servir, pero todavia necesita el contexto y la accion concreta.',
          },
        ],
      },
      rewritePrompt: `Escribi una respuesta corta para: ${situation.outcome}`,
      suggestedPhrases: situation.samplePhrases,
    },
    sourceRecordIds: [],
    createdAt: new Date().toISOString(),
  };
};

const upsertLearningSession = (
  sessions: LearningSession[],
  session: LearningSession,
) => [session, ...sessions.filter((item) => item.id !== session.id)].slice(0, 20);

const findReusableLearningSession = (
  sessions: LearningSession[],
  situationId: string,
) => {
  const matchingSessions = sessions
    .filter(
      (session) =>
        session.situationId === situationId && session.status !== 'archived',
    )
    .sort((first, second) => {
      const firstTimestamp = Date.parse(first.completedAt || first.createdAt);
      const secondTimestamp = Date.parse(second.completedAt || second.createdAt);
      return (
        (Number.isNaN(secondTimestamp) ? 0 : secondTimestamp) -
        (Number.isNaN(firstTimestamp) ? 0 : firstTimestamp)
      );
    });

  return matchingSessions[0] || null;
};

export const useFlowtranslateLearning = ({
  account,
  historyCount,
  isLearningView,
  online,
  onOpenAccount,
  onUsage,
}: UseFlowtranslateLearningParams) => {
  const [learningSessions, setLearningSessions] = useState<LearningSession[]>([]);
  const [savedPhrases, setSavedPhrases] = useState<SavedPhrase[]>([]);
  const [activeLearningSession, setActiveLearningSession] =
    useState<LearningSession | null>(null);
  const [learningProgressLoading, setLearningProgressLoading] = useState(false);
  const [learningProgressError, setLearningProgressError] = useState('');
  const [learningSessionLoading, setLearningSessionLoading] = useState(false);
  const [learningSessionError, setLearningSessionError] = useState('');
  const [learningAttemptLoading, setLearningAttemptLoading] = useState(false);
  const [learningAttemptError, setLearningAttemptError] = useState('');
  const [latestLearningAttempt, setLatestLearningAttempt] =
    useState<LearningAttempt | null>(null);
  const [selectedBestOptionId, setSelectedBestOptionId] = useState('');

  const loadLearningProgress = useCallback(async () => {
    if (!account.accessToken || account.isGuest) {
      setLearningSessions([]);
      setSavedPhrases([]);
      setLearningProgressLoading(false);
      return;
    }

    try {
      setLearningProgressLoading(true);
      setLearningProgressError('');
      const [nextSessions, nextPhrases] = await Promise.all([
        listLearningSessions(),
        listSavedPhrases(),
      ]);

      setLearningSessions(nextSessions);
      setSavedPhrases(nextPhrases);
      setActiveLearningSession((current) => {
        if (!current) return current;
        return nextSessions.find((session) => session.id === current.id) || current;
      });
    } catch (error) {
      captureFlowtranslateError(error, {
        screen: 'learning',
        action: 'load_learning_progress',
        account_kind: account.accountKind,
      });
      setLearningProgressError(
        error instanceof Error
          ? error.message
          : 'No pudimos cargar tu progreso de Learning.',
      );
    } finally {
      setLearningProgressLoading(false);
    }
  }, [account.accessToken, account.accountKind, account.isGuest]);

  useEffect(() => {
    if (!isLearningView) return;
    void loadLearningProgress();
  }, [isLearningView, loadLearningProgress]);

  const startLearningSession = useCallback(
    async (situationId?: string) => {
      const targetSituationId = situationId || STARTER_LEARNING_SITUATIONS[0].id;

      setLearningSessionError('');
      setLearningAttemptError('');
      setLatestLearningAttempt(null);
      setSelectedBestOptionId('');

      const reusableSession = findReusableLearningSession(
        learningSessions,
        targetSituationId,
      );

      if (reusableSession) {
        setActiveLearningSession(reusableSession);
        analytics.track('learning_session_reused', {
          situation_id: reusableSession.situationId,
          session_id: reusableSession.id,
          status: reusableSession.status,
          account_kind: account.accountKind,
          source: 'client_state',
        });
        return;
      }

      if (!account.accessToken || account.isGuest) {
        const starterSession = buildStarterLearningSession(targetSituationId);
        setActiveLearningSession(starterSession);
        setLearningSessions((current) =>
          upsertLearningSession(current, starterSession),
        );
        analytics.track('learning_session_started', {
          situation_id: starterSession.situationId,
          account_kind: account.accountKind,
          history_count: historyCount,
          personalized: false,
          preview: true,
        });
        return;
      }

      if (!online) {
        setLearningSessionError(
          'Estas offline. La practica personalizada necesita conexion.',
        );
        return;
      }

      setLearningSessionLoading(true);
      analytics.track('learning_session_start_submitted', {
        situation_id: targetSituationId,
        history_count: historyCount,
        account_kind: account.accountKind,
      });

      try {
        const result = await generateLearningSession(
          { situationId: targetSituationId },
          account.accessToken,
        );
        onUsage(result.usage);
        setActiveLearningSession(result.session);
        setLearningSessions((current) =>
          upsertLearningSession(current, result.session),
        );
        analytics.track('learning_session_started', {
          situation_id: result.session.situationId,
          account_kind: account.accountKind,
          history_count: historyCount,
          personalized: result.generatedFrom !== 'starter',
          cached: result.cached,
          generated_from: result.generatedFrom || null,
          source_record_count: result.session.sourceRecordIds.length,
        });
      } catch (error) {
        captureFlowtranslateError(error, {
          screen: 'learning',
          action: 'start_learning_session',
          account_kind: account.accountKind,
          situation_id: targetSituationId,
        });
        if (error instanceof FlowtranslateApiError && error.usage) {
          onUsage(error.usage);
        }
        setLearningSessionError(
          error instanceof Error
            ? error.message
            : 'No pudimos crear la practica.',
        );
        analytics.track('learning_session_start_failed', {
          error_type: 'exception',
        });
      } finally {
        setLearningSessionLoading(false);
      }
    },
    [
      account.accessToken,
      account.accountKind,
      account.isGuest,
      historyCount,
      learningSessions,
      online,
      onUsage,
    ],
  );

  const resumeLearningSession = useCallback((session: LearningSession) => {
    setActiveLearningSession(session);
    setLearningSessionError('');
    setLearningAttemptError('');
    setLatestLearningAttempt(null);
    setSelectedBestOptionId('');
    analytics.track('learning_session_resumed', {
      situation_id: session.situationId,
      status: session.status,
    });
  }, []);

  const leaveLearningSession = useCallback(() => {
    setActiveLearningSession(null);
    setLearningAttemptError('');
    setLatestLearningAttempt(null);
    setSelectedBestOptionId('');
  }, []);

  const chooseLearningBestOption = useCallback(
    (choiceId: string) => {
      if (!activeLearningSession) return;

      const choice = activeLearningSession.content.bestOption.choices.find(
        (item) => item.id === choiceId,
      );
      setSelectedBestOptionId(choiceId);
      analytics.track('learning_best_option_answered', {
        situation_id: activeLearningSession.situationId,
        choice_id: choiceId,
        preferred: choice?.preferred ?? null,
      });
    },
    [activeLearningSession],
  );

  const submitLearningRewrite = useCallback(
    async (attemptText: string) => {
      const trimmedAttempt = attemptText.trim();
      if (!trimmedAttempt || !activeLearningSession) return;

      setLearningAttemptError('');

      if (
        !account.accessToken ||
        account.isGuest ||
        isStarterLearningSession(activeLearningSession)
      ) {
        onOpenAccount();
        setLearningAttemptError(
          'Conecta una cuenta para recibir feedback personalizado y guardar intentos.',
        );
        analytics.track('account_connect_prompt_shown', {
          surface: 'learning_rewrite',
          reason: 'learning_guest',
          account_kind: account.accountKind,
          history_count: historyCount,
        });
        analytics.track('learning_guest_blocked', {
          surface: 'rewrite_feedback',
        });
        return;
      }

      if (!online) {
        setLearningAttemptError('Estas offline. El feedback necesita conexion.');
        return;
      }

      setLearningAttemptLoading(true);
      analytics.track('learning_rewrite_feedback_submitted', {
        situation_id: activeLearningSession.situationId,
        attempt_length: trimmedAttempt.length,
      });

      try {
        const result = await submitLearningAttempt(
          {
            sessionId: activeLearningSession.id,
            attemptText: trimmedAttempt,
          },
          account.accessToken,
        );
        onUsage(result.usage);
        setLatestLearningAttempt(result.attempt);
        analytics.track('learning_rewrite_feedback_succeeded', {
          situation_id: activeLearningSession.situationId,
          generated_from: result.generatedFrom || null,
          naturalness: result.attempt.feedback.naturalness,
        });
      } catch (error) {
        captureFlowtranslateError(error, {
          screen: 'learning',
          action: 'submit_learning_rewrite',
          account_kind: account.accountKind,
          situation_id: activeLearningSession.situationId,
        });
        if (error instanceof FlowtranslateApiError && error.usage) {
          onUsage(error.usage);
        }
        setLearningAttemptError(
          error instanceof Error
            ? error.message
            : 'No pudimos revisar tu intento.',
        );
        analytics.track('learning_rewrite_feedback_failed', {
          error_type: 'exception',
        });
      } finally {
        setLearningAttemptLoading(false);
      }
    },
    [
      account.accessToken,
      account.accountKind,
      account.isGuest,
      activeLearningSession,
      historyCount,
      online,
      onOpenAccount,
      onUsage,
    ],
  );

  const savePhraseFromLearning = useCallback(
    async (input: SaveLearningPhraseInput) => {
      const trimmedText = input.text.trim();
      if (!trimmedText) return;

      if (!account.accessToken || account.isGuest) {
        onOpenAccount();
        setLearningSessionError(guestLearningMessage);
        analytics.track('account_connect_prompt_shown', {
          surface: 'learning_phrase_save',
          reason: 'learning_guest',
          account_kind: account.accountKind,
          history_count: historyCount,
        });
        analytics.track('learning_guest_blocked', {
          surface: 'phrase_save',
        });
        return;
      }

      try {
        setLearningSessionError('');
        const saved = await saveLearningPhrase({
          ...input,
          text: trimmedText,
        });
        if (saved) {
          setSavedPhrases((current) => [
            saved,
            ...current.filter((phrase) => phrase.id !== saved.id),
          ]);
        }
        analytics.track('learning_phrase_saved', {
          situation_id: input.situationId || null,
          session_id: input.sessionId || null,
          phrase_length: trimmedText.length,
        });
      } catch (error) {
        captureFlowtranslateError(error, {
          screen: 'learning',
          action: 'save_learning_phrase',
          account_kind: account.accountKind,
          situation_id: input.situationId || null,
        });
        setLearningSessionError(
          error instanceof Error
            ? error.message
            : 'No pudimos guardar esa frase.',
        );
      }
    },
    [
      account.accessToken,
      account.accountKind,
      account.isGuest,
      historyCount,
      onOpenAccount,
    ],
  );

  const archivePhraseFromLearning = useCallback(async (id: string) => {
    try {
      await archiveSavedPhrase(id);
      setSavedPhrases((current) => current.filter((phrase) => phrase.id !== id));
      analytics.track('learning_phrase_archived');
    } catch (error) {
      captureFlowtranslateError(error, {
        screen: 'learning',
        action: 'archive_learning_phrase',
      });
      setLearningProgressError(
        error instanceof Error
          ? error.message
          : 'No pudimos archivar esa frase.',
      );
    }
  }, []);

  const completeActiveLearningSession = useCallback(async () => {
    if (!activeLearningSession) return;

    const completedSession: LearningSession = {
      ...activeLearningSession,
      status: 'completed',
      completedAt: new Date().toISOString(),
    };

    try {
      if (
        account.accessToken &&
        !account.isGuest &&
        !isStarterLearningSession(activeLearningSession)
      ) {
        await completeLearningSession(activeLearningSession.id);
      }

      setActiveLearningSession(completedSession);
      setLearningSessions((current) =>
        upsertLearningSession(current, completedSession),
      );
      analytics.track('learning_session_completed', {
        situation_id: completedSession.situationId,
        session_id: completedSession.id,
        account_kind: account.accountKind,
        saved_phrase_count: savedPhrases.length,
        had_rewrite_feedback: Boolean(latestLearningAttempt),
      });
    } catch (error) {
      captureFlowtranslateError(error, {
        screen: 'learning',
        action: 'complete_learning_session',
        account_kind: account.accountKind,
        situation_id: activeLearningSession.situationId,
      });
      setLearningSessionError(
        error instanceof Error
          ? error.message
          : 'No pudimos marcar la practica como completa.',
      );
    }
  }, [
    account.accessToken,
    account.accountKind,
    account.isGuest,
    activeLearningSession,
    latestLearningAttempt,
    savedPhrases.length,
  ]);

  const removeDeletedHistoryRecord = useCallback((id: string) => {
    setLearningSessions((current) =>
      current.filter((session) => !session.sourceRecordIds.includes(id)),
    );
  }, []);

  const clearLearningState = useCallback(() => {
    setLearningSessions([]);
    setActiveLearningSession(null);
  }, []);

  return {
    activeLearningSession,
    archivePhraseFromLearning,
    chooseLearningBestOption,
    clearLearningState,
    completeActiveLearningSession,
    latestLearningAttempt,
    learningAttemptError,
    learningAttemptLoading,
    learningProgressError,
    learningProgressLoading,
    learningSessionError,
    learningSessionLoading,
    learningSessions,
    leaveLearningSession,
    removeDeletedHistoryRecord,
    resumeLearningSession,
    savedPhrases,
    savePhraseFromLearning,
    selectedBestOptionId,
    startLearningSession,
    submitLearningRewrite,
  };
};
