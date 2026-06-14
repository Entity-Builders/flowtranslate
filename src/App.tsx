import type {
  BreakdownChatMessage,
  LearningAttempt,
  LearningSession,
  LanguageCode,
  SavedPhrase,
  StudyArticle,
  TranslationRecord,
  TranslationPresetId,
  UsageSnapshot,
} from '@eb-packages/flowtranslate-core';
import {
  LEARNING_HISTORY_PERSONALIZATION_THRESHOLD,
  STARTER_LEARNING_SITUATIONS,
  getLearningSituationById,
} from '@eb-packages/flowtranslate-core';
import {
  BookOpen,
  Languages,
  Settings,
  ShieldCheck,
  UserRound,
  WifiOff,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import './App.css';
import { AccountAccessModal } from './components/AccountAccessModal';
import { CheckoutReturnStatus } from './components/CheckoutReturnStatus';
import { ExpressionWorkspace } from './components/ExpressionWorkspace';
import { STORAGE_KEYS } from './constants';
import { LearningView } from './components/LearningView';
import {
  ProUpgradePrompt,
  type ProUpgradeSurface,
} from './components/ProUpgradePrompt';
import { useBidirectionalTranslator } from './hooks/useBidirectionalTranslator';
import { useFlowtranslateAccount } from './hooks/useFlowtranslateAccount';
import {
  analytics,
  safeCommercialAnalyticsProperties,
} from './services/analytics';
import { copyText } from './services/clipboard';
import {
  FlowtranslateApiError,
  askBreakdownQuestion,
  generateLearningSession,
  generateStudyArticle,
  startFlowtranslateProCheckout,
  submitLearningAttempt,
} from './services/flowtranslate-api';
import {
  archiveSavedPhrase,
  completeLearningSession,
  listLearningSessions,
  listSavedPhrases,
  saveLearningPhrase,
  type SaveLearningPhraseInput,
} from './services/learning-progress';
import { isOnline, subscribeToOnlineState } from './services/pwa';
import {
  canUseSpeechRecognition,
  canUseSpeechSynthesis,
  type DictationSession,
  speakText,
  startDictation,
  stopSpeaking,
} from './services/speech';
import {
  clearTranslationHistory,
  deleteTranslationRecord,
  listTranslationHistory,
} from './services/translation-history';
import {
  readCheckoutReturnFromUrl,
  type CheckoutReturnState,
} from './services/checkout-return';

type AppView = 'translate' | 'learning';
type CopiedTarget = 'input' | 'result' | null;

const readInitialView = (): AppView => {
  const saved = localStorage.getItem(STORAGE_KEYS.activeView);
  return saved === 'learning' ? 'learning' : 'translate';
};

const readResponderPromiseSeen = () =>
  localStorage.getItem(STORAGE_KEYS.responderPromiseSeen) === 'true';

const appendRecognizedText = (currentText: string, transcript: string) => {
  const trimmedTranscript = transcript.trim();
  if (!trimmedTranscript) return currentText;
  if (!currentText.trim()) return trimmedTranscript;
  return `${currentText}${/\s$/.test(currentText) ? '' : ' '}${trimmedTranscript}`;
};

const guestLearningMessage =
  'Conecta una cuenta para desbloquear Learning personal y conservar tu progreso.';
const ACCOUNT_PROMPT_COPY_THRESHOLD = 2;
const FLOWTRANSLATE_PRO_ANALYTICS = {
  provider: 'mercado_pago',
  plan_id: 'flowtranslate_pro',
  currency: 'ARS',
  display_price: 'ARS 4.999/mes',
};
const CHECKOUT_RETURN_PAYMENT_EVENTS: Record<CheckoutReturnState, string> = {
  success: 'payment_succeeded',
  pending: 'payment_pending',
  failed: 'payment_failed',
  cancelled: 'payment_cancelled',
  unknown: 'payment_pending',
};
const FLOWTRANSLATE_COFFEE_URL =
  import.meta.env.VITE_FLOWTRANSLATE_COFFEE_URL?.trim() ||
  'https://www.buymeacoffee.com/juanobrach';

const isStarterLearningSession = (session: LearningSession) =>
  session.id.startsWith('starter-');

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

function App() {
  const account = useFlowtranslateAccount();
  const {
    authLoading,
    busy: accountBusy,
    isSupabaseConfigured,
    session,
    signInAsGuest,
  } = account;
  const [view, setView] = useState<AppView>(readInitialView);
  const [hasSeenResponderPromise, setHasSeenResponderPromise] = useState(
    readResponderPromiseSeen,
  );
  const [showAccount, setShowAccount] = useState(false);
  const [online, setOnline] = useState(isOnline);
  const [checkoutReturn, setCheckoutReturn] = useState(() =>
    readCheckoutReturnFromUrl(window.location)
  );
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [history, setHistory] = useState<TranslationRecord[]>([]);
  const [historyError, setHistoryError] = useState('');
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
  const [studyArticle, setStudyArticle] = useState<StudyArticle | null>(null);
  const [studyLoading, setStudyLoading] = useState(false);
  const [studyError, setStudyError] = useState('');
  const [selectedStudyRecordId, setSelectedStudyRecordId] =
    useState<string | null>(null);
  const [copiedTarget, setCopiedTarget] = useState<CopiedTarget>(null);
  const [speechAvailable, setSpeechAvailable] = useState(false);
  const [dictationAvailable, setDictationAvailable] = useState(false);
  const [speakingLanguage, setSpeakingLanguage] = useState<LanguageCode | null>(
    null,
  );
  const [dictatingLanguage, setDictatingLanguage] =
    useState<LanguageCode | null>(null);
  const [voiceMessage, setVoiceMessage] = useState('');
  const [resultCopyCount, setResultCopyCount] = useState(0);
  const [accountPromptDismissed, setAccountPromptDismissed] = useState(false);
  const [dismissedUpgradePrompts, setDismissedUpgradePrompts] = useState<
    ProUpgradeSurface[]
  >([]);
  const [profileContextDraft, setProfileContextDraft] = useState('');
  const [profileContextSaving, setProfileContextSaving] = useState(false);
  const [profileContextMessage, setProfileContextMessage] = useState('');
  const [checkoutStartingSurface, setCheckoutStartingSurface] =
    useState<ProUpgradeSurface | null>(null);
  const [checkoutError, setCheckoutError] = useState<{
    surface: ProUpgradeSurface;
    message: string;
  } | null>(null);
  const dictationRef = useRef<DictationSession | null>(null);
  const renderedStudyArticleRef = useRef<string | null>(null);
  const trackedViewRef = useRef<AppView | null>(null);
  const trackedAccountPromptRef = useRef(false);
  const trackedCheckoutReturnRef = useRef<string | null>(null);
  const trackedEntitlementStateRef = useRef<string | null>(null);
  const autoGuestStartedRef = useRef(false);

  useEffect(() => subscribeToOnlineState(setOnline), []);

  useEffect(() => {
    setSpeechAvailable(canUseSpeechSynthesis());
    setDictationAvailable(canUseSpeechRecognition());

    return () => {
      stopSpeaking();
      dictationRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!showAccount) return;
    setProfileContextDraft(account.globalContext);
    setProfileContextMessage('');
  }, [account.globalContext, showAccount]);

  const saveProfileContext = async () => {
    setProfileContextSaving(true);
    setProfileContextMessage('');
    try {
      const saved = await account.updateGlobalContext(profileContextDraft);
      setProfileContextMessage(saved ? 'Perfil guardado.' : '');
    } finally {
      setProfileContextSaving(false);
    }
  };

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.activeView, view);
  }, [view]);

  const markResponderPromiseSeen = useCallback(() => {
    setHasSeenResponderPromise(true);
    localStorage.setItem(STORAGE_KEYS.responderPromiseSeen, 'true');
  }, []);

  useEffect(() => {
    if (
      autoGuestStartedRef.current ||
      !isSupabaseConfigured ||
      authLoading ||
      accountBusy ||
      session
    ) {
      return;
    }

    autoGuestStartedRef.current = true;
    void signInAsGuest({ source: 'automatic' });
  }, [accountBusy, authLoading, isSupabaseConfigured, session, signInAsGuest]);

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

  const loadHistory = useCallback(async () => {
    if (!account.accessToken) {
      setHistory([]);
      return [];
    }

    try {
      setHistoryError('');
      const nextHistory = await listTranslationHistory();
      setHistory(nextHistory);
      return nextHistory;
    } catch (error) {
      setHistoryError(
        error instanceof Error ? error.message : 'No pudimos cargar tu historial.',
      );
      return [];
    }
  }, [account.accessToken]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

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
      setLearningProgressError(
        error instanceof Error
          ? error.message
          : 'No pudimos cargar tu progreso de Learning.',
      );
    } finally {
      setLearningProgressLoading(false);
    }
  }, [account.accessToken, account.isGuest]);

  useEffect(() => {
    if (view !== 'learning') return;
    void loadLearningProgress();
  }, [loadLearningProgress, view]);

  const handleUsage = useCallback((nextUsage: UsageSnapshot) => {
    setUsage(nextUsage);
  }, []);

  const handleSavedTranslation = useCallback((record: TranslationRecord) => {
    setHistory((current) => {
      const withoutDuplicate = current.filter((item) => item.id !== record.id);
      return [record, ...withoutDuplicate].slice(0, 80);
    });
  }, []);

  const translator = useBidirectionalTranslator({
    accessToken: account.accessToken,
    authPending: account.authLoading || (account.busy && !account.session),
    online,
    onUsage: handleUsage,
    onSavedTranslation: handleSavedTranslation,
    onRefreshSavedTranslations: loadHistory,
  });

  const shouldSuppressResponderPromise =
    hasSeenResponderPromise ||
    account.accountKind === 'permanent' ||
    account.billingState.hasProAccess;

  useEffect(() => {
    if (hasSeenResponderPromise) return;
    if (account.accountKind !== 'permanent' && !account.billingState.hasProAccess) {
      return;
    }

    markResponderPromiseSeen();
  }, [
    account.accountKind,
    account.billingState.hasProAccess,
    hasSeenResponderPromise,
    markResponderPromiseSeen,
  ]);

  useEffect(() => {
    if (hasSeenResponderPromise || !translator.resultText.trim()) return;
    markResponderPromiseSeen();
  }, [
    hasSeenResponderPromise,
    markResponderPromiseSeen,
    translator.resultText,
  ]);

  useEffect(() => {
    if (trackedViewRef.current === view) return;

    trackedViewRef.current = view;
    analytics.screen(view, {
      signed_in: Boolean(account.session),
      account_kind: account.accountKind,
      has_saved_history: history.length > 0,
      history_count: history.length,
      has_translation_result: Boolean(translator.resultText.trim()),
    });
    if (view === 'learning') {
      analytics.track('learning_opened', {
        account_kind: account.accountKind,
        history_count: history.length,
        has_saved_history: history.length > 0,
      });
    }
  }, [account.accountKind, account.session, history.length, translator.resultText, view]);

  const selectPreset = useCallback(
    (nextPresetId: TranslationPresetId) => {
      translator.selectPreset(nextPresetId);
      analytics.track('translation_preset_selected', {
        preset_id: nextPresetId,
      });
      analytics.track('conversation_tone_changed', {
        preset_id: nextPresetId,
        account_kind: account.accountKind,
        input_chars: translator.inputText.trim().length,
        has_result: Boolean(translator.resultText.trim()),
      });
    },
    [account.accountKind, translator],
  );

  useEffect(() => {
    if (
      translator.status === 'auth' &&
      !account.authLoading &&
      !account.busy
    ) {
      setShowAccount(true);
    }
  }, [account.authLoading, account.busy, translator.status]);

  useEffect(() => {
    if (!account.error || account.authLoading) return;
    setShowAccount(true);
  }, [account.authLoading, account.error]);

  const copyExpression = async (
    target: Exclude<CopiedTarget, null>,
    language: LanguageCode,
    text: string,
  ) => {
    const copied = await copyText(text);
    if (!copied) return;

    setCopiedTarget(target);
    analytics.track('translation_copied', {
      target,
      language,
      text_length: text.length,
    });
    if (target === 'result') {
      setResultCopyCount((current) => current + 1);
      analytics.track('conversation_reply_copied', {
        language,
        text_length: text.length,
        mode: translator.mode,
        preset_id: translator.presetId,
        account_kind: account.accountKind,
      });
    }
    window.setTimeout(() => setCopiedTarget(null), 1600);
  };

  const listenPanel = (language: LanguageCode, text: string) => {
    if (speakingLanguage === language) {
      stopSpeaking();
      setSpeakingLanguage(null);
      return;
    }

    const started = speakText({
      text,
      language,
      onEnd: () => {
        setSpeakingLanguage((current) => (current === language ? null : current));
      },
      onError: (nextMessage) => {
        setVoiceMessage(nextMessage);
        setSpeakingLanguage((current) => (current === language ? null : current));
      },
    });

    if (!started) {
      setVoiceMessage('La reproduccion de audio no esta disponible en este navegador.');
      return;
    }

    setVoiceMessage('');
    setSpeakingLanguage(language);
    analytics.track('translation_audio_started', {
      language,
      text_length: text.trim().length,
    });
  };

  const stopCurrentDictation = () => {
    dictationRef.current?.stop();
    dictationRef.current = null;
    setDictatingLanguage(null);
  };

  const dictateInput = () => {
    const language = translator.sourceLanguage;
    if (dictatingLanguage === language) {
      stopCurrentDictation();
      return;
    }

    if (!dictationAvailable) {
      setVoiceMessage('El dictado por microfono no esta disponible en este navegador.');
      return;
    }

    dictationRef.current?.abort();
    const baseText = translator.inputText;

    const session = startDictation({
      language,
      onResult: (transcript) => {
        const nextText = appendRecognizedText(baseText, transcript);
        translator.editInput(nextText);

        setVoiceMessage('Dictado agregado al mensaje.');
        analytics.track('translation_dictation_completed', {
          language,
          text_length: transcript.trim().length,
        });
      },
      onEnd: () => {
        dictationRef.current = null;
        setDictatingLanguage((current) => (current === language ? null : current));
      },
      onError: (nextMessage) => {
        setVoiceMessage(nextMessage);
        setDictatingLanguage((current) => (current === language ? null : current));
        analytics.track('translation_dictation_failed', { language });
      },
    });

    if (!session) {
      setVoiceMessage('El dictado por microfono no esta disponible en este navegador.');
      return;
    }

    dictationRef.current = session;
    setDictatingLanguage(language);
    setVoiceMessage('Escuchando con el servicio de microfono del navegador...');
    analytics.track('translation_dictation_started', { language });
  };

  const openStudyArticle = async (record: TranslationRecord) => {
    setStudyError('');
    setSelectedStudyRecordId(record.id);
    setStudyArticle(null);

    if (!online) {
      setStudyError('Estas offline. Los articulos de estudio necesitan conexion.');
      return;
    }

    if (!account.accessToken) {
      setShowAccount(true);
      setStudyError('Conecta tu cuenta para estudiar tus respuestas guardadas.');
      return;
    }

    if (account.isGuest) {
      setShowAccount(true);
      setStudyError(guestLearningMessage);
      analytics.track('account_connect_prompt_shown', {
        surface: 'study_article',
        reason: 'learning_guest',
        account_kind: account.accountKind,
        history_count: history.length,
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
      setUsage(result.usage);
      analytics.track('learning_study_article_succeeded', {
        article_version: result.article.articleVersion,
        cached: result.cached,
        generated_at: result.generatedAt || null,
        lesson_focus_count: result.article.lessonFocus?.length || 0,
        estimated_reading_minutes:
          result.article.estimatedReadingMinutes || null,
      });
    } catch (error) {
      if (error instanceof FlowtranslateApiError) {
        if (error.usage) setUsage(error.usage);
        setStudyError(error.message);
      } else {
        setStudyError(
          error instanceof Error ? error.message : 'No pudimos abrir el articulo.',
        );
      }
      analytics.track('learning_study_article_failed', { error_type: 'exception' });
    } finally {
      setStudyLoading(false);
    }
  };

  const closeStudyArticle = () => {
    setSelectedStudyRecordId(null);
    setStudyArticle(null);
    setStudyError('');
  };

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
        setShowAccount(true);
        throw new Error('Conecta tu cuenta para preguntarle a la IA.');
      }

      if (account.isGuest) {
        setShowAccount(true);
        analytics.track('account_connect_prompt_shown', {
          surface: 'breakdown_chat',
          reason: 'learning_guest',
          account_kind: account.accountKind,
          history_count: history.length,
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
        setUsage(result.usage);
        analytics.track('learning_breakdown_chat_succeeded', {
          mode: record.mode || null,
          answer_length: result.answer.length,
        });
        return result.answer;
      } catch (error) {
        if (error instanceof FlowtranslateApiError && error.usage) {
          setUsage(error.usage);
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
      history.length,
      online,
    ],
  );

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
          history_count: history.length,
          personalized: false,
          preview: true,
        });
        return;
      }

      if (!online) {
        setLearningSessionError('Estas offline. La practica personalizada necesita conexion.');
        return;
      }

      setLearningSessionLoading(true);
      analytics.track('learning_session_start_submitted', {
        situation_id: targetSituationId,
        history_count: history.length,
        account_kind: account.accountKind,
      });

      try {
        const result = await generateLearningSession(
          { situationId: targetSituationId },
          account.accessToken,
        );
        setUsage(result.usage);
        setActiveLearningSession(result.session);
        setLearningSessions((current) => upsertLearningSession(current, result.session));
        analytics.track('learning_session_started', {
          situation_id: result.session.situationId,
          account_kind: account.accountKind,
          history_count: history.length,
          personalized: result.generatedFrom !== 'starter',
          cached: result.cached,
          generated_from: result.generatedFrom || null,
          source_record_count: result.session.sourceRecordIds.length,
        });
      } catch (error) {
        if (error instanceof FlowtranslateApiError && error.usage) {
          setUsage(error.usage);
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
      history.length,
      learningSessions,
      online,
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
        setShowAccount(true);
        setLearningAttemptError(
          'Conecta una cuenta para recibir feedback personalizado y guardar intentos.',
        );
        analytics.track('account_connect_prompt_shown', {
          surface: 'learning_rewrite',
          reason: 'learning_guest',
          account_kind: account.accountKind,
          history_count: history.length,
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
        setUsage(result.usage);
        setLatestLearningAttempt(result.attempt);
        analytics.track('learning_rewrite_feedback_succeeded', {
          situation_id: activeLearningSession.situationId,
          generated_from: result.generatedFrom || null,
          naturalness: result.attempt.feedback.naturalness,
        });
      } catch (error) {
        if (error instanceof FlowtranslateApiError && error.usage) {
          setUsage(error.usage);
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
      history.length,
      online,
    ],
  );

  const savePhraseFromLearning = useCallback(
    async (input: SaveLearningPhraseInput) => {
      const trimmedText = input.text.trim();
      if (!trimmedText) return;

      if (!account.accessToken || account.isGuest) {
        setShowAccount(true);
        setLearningSessionError(guestLearningMessage);
        analytics.track('account_connect_prompt_shown', {
          surface: 'learning_phrase_save',
          reason: 'learning_guest',
          account_kind: account.accountKind,
          history_count: history.length,
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
        setLearningSessionError(
          error instanceof Error
            ? error.message
            : 'No pudimos guardar esa frase.',
        );
      }
    },
    [account.accessToken, account.accountKind, account.isGuest, history.length],
  );

  const archivePhraseFromLearning = useCallback(async (id: string) => {
    try {
      await archiveSavedPhrase(id);
      setSavedPhrases((current) => current.filter((phrase) => phrase.id !== id));
      analytics.track('learning_phrase_archived');
    } catch (error) {
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

  const useLearningPhraseInResponder = useCallback(
    (text: string) => {
      translator.editInput(text);
      setView('translate');
      analytics.track('learning_phrase_used_in_responder', {
        text_length: text.trim().length,
      });
    },
    [translator],
  );

  const deleteHistoryItem = async (id: string) => {
    try {
      await deleteTranslationRecord(id);
      setHistory((current) => current.filter((item) => item.id !== id));
      setLearningSessions((current) =>
        current.filter((session) => !session.sourceRecordIds.includes(id)),
      );
      if (selectedStudyRecordId === id) closeStudyArticle();
      analytics.track('translation_history_deleted', { count: 1 });
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : 'No pudimos borrar ese item.');
    }
  };

  const clearHistory = async () => {
    try {
      await clearTranslationHistory();
      setHistory([]);
      setLearningSessions([]);
      setActiveLearningSession(null);
      closeStudyArticle();
      analytics.track('translation_history_cleared');
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : 'No pudimos limpiar tu historial.');
    }
  };

  const shouldShowAccountPrompt =
    account.isGuest &&
    !accountPromptDismissed &&
    resultCopyCount >= ACCOUNT_PROMPT_COPY_THRESHOLD;
  const usagePressure =
    usage &&
    (usage.remainingThisMonth <= 0 ||
      (usage.monthlyQuota > 0 &&
        usage.remainingThisMonth / usage.monthlyQuota <= 0.2));
  const shouldShowUsageUpgradePrompt =
    Boolean(usagePressure) &&
    translator.status !== 'quota' &&
    !account.billingState.hasProAccess &&
    !account.billingState.shouldWaitForProvider &&
    !dismissedUpgradePrompts.includes('usage_limit');
  const shouldShowSavedHistoryUpgradePrompt =
    account.accountKind === 'permanent' &&
    resultCopyCount >= ACCOUNT_PROMPT_COPY_THRESHOLD &&
    !account.billingState.hasProAccess &&
    !account.billingState.shouldWaitForProvider &&
    !dismissedUpgradePrompts.includes('saved_history');
  const shouldShowLearningUpgradePrompt =
    view === 'learning' &&
    !account.billingState.hasProAccess &&
    !account.billingState.shouldWaitForProvider &&
    (history.length >= LEARNING_HISTORY_PERSONALIZATION_THRESHOLD ||
      learningSessions.length > 0 ||
      savedPhrases.some((phrase) => !phrase.archivedAt));

  const billingAnalyticsProperties = useCallback(
    (extra: Record<string, unknown> = {}) =>
      safeCommercialAnalyticsProperties({
        account_kind: account.accountKind,
        billing_state: account.billingState.id,
        entitlement_source: account.billingState.source,
        entitlement_reason: account.billingState.reason,
        has_pro_access: account.billingState.hasProAccess,
        can_retry_checkout: account.billingState.canRetryCheckout,
        should_wait_for_provider: account.billingState.shouldWaitForProvider,
        requires_support: account.billingState.requiresSupport,
        ...FLOWTRANSLATE_PRO_ANALYTICS,
        ...extra,
      }),
    [
      account.accountKind,
      account.billingState.canRetryCheckout,
      account.billingState.hasProAccess,
      account.billingState.id,
      account.billingState.reason,
      account.billingState.requiresSupport,
      account.billingState.shouldWaitForProvider,
      account.billingState.source,
    ],
  );

  const proUpgradeAnalytics = useCallback(
    (surface: ProUpgradeSurface) => billingAnalyticsProperties({ surface }),
    [billingAnalyticsProperties],
  );

  const dismissUpgradePrompt = useCallback((surface: ProUpgradeSurface) => {
    setDismissedUpgradePrompts((current) =>
      current.includes(surface) ? current : [...current, surface],
    );
    analytics.track('upgrade_prompt_dismissed', { surface });
  }, []);

  useEffect(() => {
    if (!shouldShowAccountPrompt) return;
    if (trackedAccountPromptRef.current) return;

    trackedAccountPromptRef.current = true;
    analytics.track('account_connect_prompt_shown', {
      surface: 'translate_soft_banner',
      reason: 'copied_replies',
      copy_count: resultCopyCount,
      account_kind: account.accountKind,
    });
  }, [account.accountKind, resultCopyCount, shouldShowAccountPrompt]);

  useEffect(() => {
    if (!checkoutReturn) return;

    const trackingKey = [
      checkoutReturn.state,
      checkoutReturn.rawStatus || 'missing',
      checkoutReturn.hasExternalReference ? 'external' : 'no_external',
      checkoutReturn.hasProviderReference ? 'provider' : 'no_provider',
    ].join(':');

    if (trackedCheckoutReturnRef.current === trackingKey) return;
    trackedCheckoutReturnRef.current = trackingKey;

    const properties = billingAnalyticsProperties({
      checkout_return_state: checkoutReturn.state,
      provider_status: checkoutReturn.rawStatus || 'missing',
      has_external_reference: checkoutReturn.hasExternalReference,
      has_provider_reference: checkoutReturn.hasProviderReference,
      entitlement_verified: account.billingState.hasProAccess,
      outcome_source: 'checkout_return',
    });

    analytics.track('checkout_returned', properties);
    analytics.track(CHECKOUT_RETURN_PAYMENT_EVENTS[checkoutReturn.state], properties);
  }, [account.billingState.hasProAccess, billingAnalyticsProperties, checkoutReturn]);

  useEffect(() => {
    if (authLoading || account.billingStateLoading) return;

    const state = account.billingState;
    const trackingKey = [
      account.session?.user?.id || 'no_user',
      state.id,
      state.source,
      state.reason,
      state.hasProAccess ? 'pro' : 'not_pro',
    ].join(':');

    if (trackedEntitlementStateRef.current === trackingKey) return;
    trackedEntitlementStateRef.current = trackingKey;

    const properties = billingAnalyticsProperties({
      entitlement_state: state.id,
      entitlement_verified: state.hasProAccess,
    });

    analytics.track('pro_entitlement_state_viewed', properties);
    if (state.hasProAccess) {
      analytics.track('pro_entitlement_granted', properties);
    }
  }, [
    account.billingState,
    account.billingStateLoading,
    account.session?.user?.id,
    authLoading,
    billingAnalyticsProperties,
  ]);

  const openAccountFromPrompt = (reason = 'copied_replies') => {
    analytics.track('account_connect_prompt_clicked', {
      surface: 'translate_soft_banner',
      reason,
      copy_count: resultCopyCount,
      account_kind: account.accountKind,
    });
    setShowAccount(true);
  };

  const connectAccountForPro = useCallback(
    (surface: ProUpgradeSurface) => {
      setCheckoutError(null);
      analytics.track('upgrade_intent_clicked', {
        ...proUpgradeAnalytics(surface),
        requires_account: true,
      });
      analytics.track('account_connect_prompt_clicked', {
        surface,
        reason: 'pro_upgrade_requires_account',
        account_kind: account.accountKind,
      });
      setShowAccount(true);
    },
    [account.accountKind, proUpgradeAnalytics],
  );

  const startProCheckout = useCallback(
    async (surface: ProUpgradeSurface) => {
      setCheckoutError(null);
      analytics.track('upgrade_intent_clicked', {
        ...proUpgradeAnalytics(surface),
        requires_account: !account.accessToken || account.isGuest,
      });

      if (!account.accessToken || account.isGuest) {
        analytics.track('account_connect_prompt_shown', {
          surface,
          reason: 'pro_checkout_requires_account',
          account_kind: account.accountKind,
        });
        setShowAccount(true);
        return;
      }

      setCheckoutStartingSurface(surface);
      try {
        const checkout = await startFlowtranslateProCheckout(account.accessToken);
        analytics.track('checkout_started', proUpgradeAnalytics(surface));
        window.location.assign(checkout.checkoutUrl);
      } catch (error) {
        analytics.track(
          'checkout_failed',
          billingAnalyticsProperties({
            surface,
            error_type:
              error instanceof FlowtranslateApiError
                ? 'flowtranslate_api_error'
                : error instanceof Error
                  ? error.name || 'checkout_error'
                  : 'checkout_error',
            http_status:
              error instanceof FlowtranslateApiError ? error.status : null,
          }),
        );
        setCheckoutError({
          surface,
          message:
            error instanceof Error
              ? error.message
              : 'No pudimos iniciar Mercado Pago. Proba de nuevo.',
        });
      } finally {
        setCheckoutStartingSurface(null);
      }
    },
    [
      account.accessToken,
      account.accountKind,
      account.isGuest,
      billingAnalyticsProperties,
      proUpgradeAnalytics,
    ],
  );

  const upgradePromptState = (surface: ProUpgradeSurface) => ({
    busy: checkoutStartingSurface === surface,
    error: checkoutError?.surface === surface ? checkoutError.message : '',
  });

  const openQuotaSupport = useCallback(() => {
    analytics.track('quota_support_clicked', {
      surface: 'usage_limit',
      account_kind: account.accountKind,
    });
    window.open(FLOWTRANSLATE_COFFEE_URL, '_blank', 'noopener,noreferrer');
  }, [account.accountKind]);

  const dismissCheckoutReturn = () => {
    setCheckoutReturn(null);
  };

  const returnToResponderFromCheckout = () => {
    setView('translate');
    setCheckoutReturn(null);
  };

  const accountButtonLabel = account.billingState.hasProAccess
    ? 'Pro'
    : account.isPermanent
      ? 'Perfil'
      : account.displayName;
  const accountButtonTitle = account.billingState.hasProAccess
    ? 'FlowTranslate Pro'
    : account.isPermanent
      ? 'Perfil'
      : 'Cuenta';
  const accountButtonIcon = account.isGuest ? (
    <UserRound size={17} />
  ) : account.session ? (
    <ShieldCheck size={17} />
  ) : (
    <Settings size={17} />
  );
  const expressionStatusText = translator.status === 'translating'
    ? 'Generando respuesta...'
    : translator.status === 'typing'
      ? 'Listo, espero una pausa'
    : translator.status === 'quota'
      ? 'Llegaste al limite mensual'
    : translator.hasPendingChanges
      ? 'Listo para responder'
      : translator.message || undefined;
  const dictationUnavailableReason =
    'El dictado por microfono no esta disponible en este navegador.';
  const shouldReserveMobileResultSheet =
    view === 'translate' &&
    (translator.status === 'translating' ||
      translator.status === 'quota' ||
      Boolean(translator.resultText.trim()));

  return (
    <div className='flex h-[100dvh] min-h-0 flex-col overflow-x-hidden bg-slate-50 text-slate-950'>
      <header className='grid min-h-16 shrink-0 grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-slate-200/70 bg-white px-3 sm:gap-3 sm:px-4'>
        <div className='flex min-w-0 items-center gap-3'>
          <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white'>
            <Languages size={19} />
          </div>
          <div className='min-w-0'>
            <h1 className='hidden truncate text-lg font-bold leading-none sm:block'>flowtranslate</h1>
            <p className='mt-1 hidden text-xs text-slate-500 sm:block'>
              Respuestas en ingles listas para mandar.
            </p>
          </div>
        </div>

        <nav className='flex min-w-0 justify-center gap-5'>
          <button
            type='button'
            onClick={() => setView('translate')}
            className={`inline-flex h-16 items-center gap-1.5 border-b-2 px-0 text-sm font-bold transition-colors sm:gap-2 ${
              view === 'translate'
                ? 'border-emerald-500 text-slate-950'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Languages size={16} />
            <span className='hidden min-[360px]:inline'>Responder</span>
          </button>
          <button
            type='button'
            onClick={() => setView('learning')}
            className={`inline-flex h-16 items-center gap-1.5 border-b-2 px-0 text-sm font-bold transition-colors sm:gap-2 ${
              view === 'learning'
                ? 'border-emerald-500 text-slate-950'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen size={16} />
            <span className='hidden min-[360px]:inline'>Aprender</span>
          </button>
        </nav>

        <div className='flex min-w-0 items-center gap-2'>
          <button
            type='button'
            onClick={() => setShowAccount(true)}
            className='inline-flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-md text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-slate-950 sm:w-auto sm:max-w-44 sm:px-3'
            title={accountButtonTitle}
          >
            {accountButtonIcon}
            <span className='hidden truncate sm:inline'>{accountButtonLabel}</span>
          </button>
        </div>
      </header>

      {!online ? (
        <div className='flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-700'>
          <WifiOff size={16} />
          Estas offline. Podes ver la app, pero las nuevas respuestas con IA quedan pausadas.
        </div>
      ) : null}

      {checkoutReturn ? (
        <CheckoutReturnStatus
          info={checkoutReturn}
          onDismiss={dismissCheckoutReturn}
          onReturnToResponder={returnToResponderFromCheckout}
        />
      ) : null}

      {view === 'translate' ? (
        <main
          className={`flex min-h-0 w-full max-w-full flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto p-3 sm:p-4 ${
            shouldReserveMobileResultSheet ? 'pb-28 sm:pb-32 lg:pb-4' : ''
          }`}
        >
          {voiceMessage ? (
            <div className='border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800'>
              {voiceMessage}
            </div>
          ) : null}

          <ExpressionWorkspace
            inputText={translator.inputText}
            resultText={translator.resultText}
            mode={translator.mode}
            modeDetection={translator.modeDetection}
            sourceLanguage={translator.sourceLanguage}
            targetLanguage={translator.targetLanguage}
            presetId={translator.presetId}
            breakdown={translator.breakdown}
            breakdownStatus={translator.breakdownStatus}
            grammarInsight={translator.grammarInsight}
            translationRecordId={translator.translationRecordId}
            status={translator.status}
            canTranslate={translator.canTranslate}
            translateDisabledReason={translator.translateDisabledReason}
            copiedInput={copiedTarget === 'input'}
            copiedResult={copiedTarget === 'result'}
            canListen={speechAvailable}
            speakingLanguage={speakingLanguage}
            canDictate={dictationAvailable}
            dictatingLanguage={dictatingLanguage}
            dictationUnavailableReason={dictationUnavailableReason}
            statusText={expressionStatusText}
            quotaUsage={usage}
            quotaUpgradeLabel={
              account.accountKind !== 'permanent'
                ? 'Conectar cuenta'
                : account.billingState.hasProAccess
                  ? 'Ver Pro'
                  : account.billingState.canRetryCheckout &&
                      account.billingState.id !== 'free'
                    ? 'Reintentar Pro'
                    : account.billingState.shouldWaitForProvider
                      ? 'Ver cuenta'
                      : 'Pasar a Pro'
            }
            quotaUpgradeBusy={checkoutStartingSurface === 'usage_limit'}
            hasSeenResponderPromise={shouldSuppressResponderPromise}
            onInputChange={(value) => translator.editInput(value)}
            onCopyInput={() =>
              void copyExpression(
                'input',
                translator.sourceLanguage,
                translator.inputText,
              )
            }
            onCopyResult={() =>
              void copyExpression(
                'result',
                translator.targetLanguage,
                translator.resultText,
              )
            }
            onListenInput={() =>
              listenPanel(translator.sourceLanguage, translator.inputText)
            }
            onListenResult={() =>
              listenPanel(translator.targetLanguage, translator.resultText)
            }
            onDictateInput={dictateInput}
            onTranslate={() => void translator.translate()}
            onSelectPreset={selectPreset}
            onRequestBreakdown={() => translator.requestBreakdown()}
            onRequestStudy={() => {
              if (translator.translationRecordId) {
                const record = history.find(r => r.id === translator.translationRecordId);
                if (record) void openStudyArticle(record);
              }
            }}
            onTranslateToSpanish={() => void translator.translateInputToSpanish()}
            onQuotaUpgrade={() => {
              if (
                account.accountKind === 'permanent' &&
                account.billingState.canRetryCheckout
              ) {
                void startProCheckout('usage_limit');
                return;
              }
              if (account.accountKind === 'permanent') {
                setShowAccount(true);
                return;
              }
              connectAccountForPro('usage_limit');
            }}
            onQuotaSupport={openQuotaSupport}
          />

          {shouldShowAccountPrompt ? (
            <div className='flex flex-col gap-3 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm sm:flex-row sm:items-center sm:justify-between'>
              <div className='min-w-0'>
                <p className='font-bold text-slate-950'>
                  Guarda tus respuestas y aprende con tus mensajes reales.
                </p>
                <p className='mt-1 leading-5 text-slate-600'>
                  Conecta una cuenta para conservar historial, reutilizar buenas
                  respuestas y desbloquear Learning personal.
                </p>
              </div>
              <div className='flex shrink-0 items-center gap-2'>
                <button
                  type='button'
                  onClick={() => openAccountFromPrompt('save_history')}
                  className='inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-bold text-white hover:bg-slate-800'
                >
                  Guardar historial
                </button>
                <button
                  type='button'
                  onClick={() => setAccountPromptDismissed(true)}
                  className='inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  title='Ocultar'
                  aria-label='Ocultar invitacion a cuenta'
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ) : null}

          {shouldShowSavedHistoryUpgradePrompt ? (
            <ProUpgradePrompt
              surface='saved_history'
              accountKind={account.accountKind}
              compact={shouldReserveMobileResultSheet}
              onDismiss={() => dismissUpgradePrompt('saved_history')}
              onStartCheckout={(surface) => void startProCheckout(surface)}
              onConnectAccount={connectAccountForPro}
              {...upgradePromptState('saved_history')}
            />
          ) : null}

          {shouldShowUsageUpgradePrompt ? (
            <ProUpgradePrompt
              surface='usage_limit'
              accountKind={account.accountKind}
              compact={shouldReserveMobileResultSheet}
              onDismiss={() => dismissUpgradePrompt('usage_limit')}
              onStartCheckout={(surface) => void startProCheckout(surface)}
              onConnectAccount={connectAccountForPro}
              {...upgradePromptState('usage_limit')}
            />
          ) : null}
          <p className='max-w-[calc(100vw-2rem)] break-words text-xs text-slate-500 sm:max-w-full'>
            Los servicios de voz del navegador pueden procesar audio durante el
            dictado; Flowtranslate guarda solo el texto que envias y tu historial.
          </p>
        </main>
      ) : (
        <>
          {historyError ? (
            <div className='border-b border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700'>
              {historyError}
            </div>
          ) : null}
          <LearningView
            history={history}
            accountKind={account.accountKind}
            starterSituations={STARTER_LEARNING_SITUATIONS}
            learningSessions={learningSessions}
            savedPhrases={savedPhrases}
            activeSession={activeLearningSession}
            progressLoading={learningProgressLoading}
            progressError={learningProgressError}
            sessionLoading={learningSessionLoading}
            sessionError={learningSessionError}
            selectedBestOptionId={selectedBestOptionId}
            attemptLoading={learningAttemptLoading}
            attemptError={learningAttemptError}
            latestAttempt={latestLearningAttempt}
            studyArticle={studyArticle}
            studyLoading={studyLoading}
            studyError={studyError}
            selectedStudyRecordId={selectedStudyRecordId}
            onStartSession={(situationId) => void startLearningSession(situationId)}
            onResumeSession={resumeLearningSession}
            onLeaveSession={leaveLearningSession}
            onSelectBestOption={chooseLearningBestOption}
            onSubmitAttempt={(attemptText) => void submitLearningRewrite(attemptText)}
            onSavePhrase={(input) => void savePhraseFromLearning(input)}
            onArchivePhrase={(id) => void archivePhraseFromLearning(id)}
            onCompleteSession={() => void completeActiveLearningSession()}
            onUsePhraseInResponder={useLearningPhraseInResponder}
            onOpenStudy={(record) => void openStudyArticle(record)}
            onCloseStudy={closeStudyArticle}
            onListenPhrase={(language, text) => listenPanel(language, text)}
            onAskBreakdownQuestion={askAboutBreakdown}
            onDelete={(id) => void deleteHistoryItem(id)}
            onClear={() => void clearHistory()}
            upgradePrompt={
              shouldShowLearningUpgradePrompt ? (
                <ProUpgradePrompt
                  surface='learning'
                  accountKind={account.accountKind}
                  compact
                  onStartCheckout={(surface) => void startProCheckout(surface)}
                  onConnectAccount={connectAccountForPro}
                  {...upgradePromptState('learning')}
                />
              ) : null
            }
          />
        </>
      )}

      {showAccount ? (
        <AccountAccessModal
          account={account}
          usage={usage}
          profileUpgradePrompt={
            <ProUpgradePrompt
              surface='profile_preferences'
              accountKind={account.accountKind}
              actionLabel={
                account.billingState.canRetryCheckout &&
                  account.billingState.id !== 'free'
                  ? 'Reintentar checkout'
                  : undefined
              }
              compact
              onStartCheckout={(surface) => void startProCheckout(surface)}
              onConnectAccount={connectAccountForPro}
              {...upgradePromptState('profile_preferences')}
            />
          }
          profileContextDraft={profileContextDraft}
          profileContextMessage={profileContextMessage}
          profileContextSaving={profileContextSaving}
          onProfileContextDraftChange={setProfileContextDraft}
          onProfileContextMessageClear={() => setProfileContextMessage('')}
          onSaveProfileContext={() => void saveProfileContext()}
          onClose={() => setShowAccount(false)}
        />
      ) : null}
    </div>
  );
}

export default App;
