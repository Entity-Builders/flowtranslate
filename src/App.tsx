import type {
  BreakdownChatMessage,
  LearningInsight,
  LanguageCode,
  StudyArticle,
  TranslationRecord,
  TranslationPresetId,
  UsageSnapshot,
} from '@eb-packages/flowtranslate-core';
import {
  BookOpen,
  Chrome,
  Languages,
  LogOut,
  Mail,
  Settings,
  ShieldCheck,
  UserRound,
  WifiOff,
  X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import { ExpressionWorkspace } from './components/ExpressionWorkspace';
import { STORAGE_KEYS } from './constants';
import { LearningView } from './components/LearningView';
import { QuotaStatus } from './components/QuotaStatus';
import { TranslationPresetControl } from './components/TranslationPresetControl';
import { useBidirectionalTranslator } from './hooks/useBidirectionalTranslator';
import { useFlowtranslateAccount } from './hooks/useFlowtranslateAccount';
import { analytics } from './services/analytics';
import { copyText } from './services/clipboard';
import {
  FlowtranslateApiError,
  askBreakdownQuestion,
  generateLearningInsight,
  generateStudyArticle,
} from './services/flowtranslate-api';
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

type AppView = 'translate' | 'learning';
type CopiedTarget = 'input' | 'result' | null;

const readInitialView = (): AppView => {
  const saved = localStorage.getItem(STORAGE_KEYS.activeView);
  return saved === 'learning' ? 'learning' : 'translate';
};

const appendRecognizedText = (currentText: string, transcript: string) => {
  const trimmedTranscript = transcript.trim();
  if (!trimmedTranscript) return currentText;
  if (!currentText.trim()) return trimmedTranscript;
  return `${currentText}${/\s$/.test(currentText) ? '' : ' '}${trimmedTranscript}`;
};

const guestLearningMessage =
  'Conecta una cuenta gratis para desbloquear Learning personal y conservar tu progreso.';
const ACCOUNT_PROMPT_COPY_THRESHOLD = 2;

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
  const [showAccount, setShowAccount] = useState(false);
  const [showEmailSignIn, setShowEmailSignIn] = useState(false);
  const [online, setOnline] = useState(isOnline);
  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [history, setHistory] = useState<TranslationRecord[]>([]);
  const [historyError, setHistoryError] = useState('');
  const [learningInsight, setLearningInsight] =
    useState<LearningInsight | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState('');
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
  const dictationRef = useRef<DictationSession | null>(null);
  const renderedStudyArticleRef = useRef<string | null>(null);
  const trackedViewRef = useRef<AppView | null>(null);
  const trackedAccountPromptRef = useRef(false);
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
    localStorage.setItem(STORAGE_KEYS.activeView, view);
  }, [view]);

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
      return;
    }

    try {
      setHistoryError('');
      setHistory(await listTranslationHistory());
    } catch (error) {
      setHistoryError(
        error instanceof Error ? error.message : 'No pudimos cargar tu historial.',
      );
    }
  }, [account.accessToken]);

  useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

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
  });

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

  const loadLearningInsight = useCallback(
    async (forceRefresh = false, silent = false) => {
      setInsightError('');

      if (!online) {
        if (!silent) setInsightError('Estas offline. Learning necesita conexion.');
        return;
      }

      if (!account.accessToken) {
        if (!silent) {
          setShowAccount(true);
          setInsightError('Conecta tu cuenta para generar Learning desde tu historial.');
        }
        return;
      }

      if (account.isGuest) {
        if (!silent) {
          setShowAccount(true);
          setInsightError(guestLearningMessage);
          analytics.track('account_connect_prompt_shown', {
            surface: 'learning',
            reason: 'learning_guest',
            account_kind: account.accountKind,
            history_count: history.length,
          });
          analytics.track('learning_guest_blocked', {
            surface: 'insight',
          });
        }
        return;
      }

      setInsightLoading(true);
      analytics.track('learning_insight_submitted', {
        history_count: history.length,
        force_refresh: forceRefresh,
      });

      try {
        const result = await generateLearningInsight(
          { forceRefresh },
          account.accessToken,
        );
        setLearningInsight(result.insight);
        setUsage(result.usage);
        analytics.track('learning_insight_succeeded', {
          cached: result.cached,
          writing_count: result.insight.writingItems.length,
          conversation_count: result.insight.conversationItems.length,
        });
      } catch (error) {
        if (error instanceof FlowtranslateApiError) {
          if (error.usage) setUsage(error.usage);
          setInsightError(error.message);
        } else {
          setInsightError(
            error instanceof Error ? error.message : 'No pudimos generar Learning.',
          );
        }
        analytics.track('learning_insight_failed', { error_type: 'exception' });
      } finally {
        setInsightLoading(false);
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

  useEffect(() => {
    if (view !== 'learning' || !account.accessToken || account.isGuest || !online) {
      return;
    }
    void loadLearningInsight(false, true);
  }, [account.accessToken, account.isGuest, loadLearningInsight, online, view]);

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

  const deleteHistoryItem = async (id: string) => {
    try {
      await deleteTranslationRecord(id);
      setHistory((current) => current.filter((item) => item.id !== id));
      setLearningInsight(null);
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
      setLearningInsight(null);
      closeStudyArticle();
      analytics.track('translation_history_cleared');
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : 'No pudimos limpiar tu historial.');
    }
  };

  const statusTone = useMemo(() => {
    if (translator.status === 'quota') return 'border-amber-200 bg-amber-50 text-amber-800';
    if (translator.status === 'error' || translator.status === 'auth') {
      return 'border-rose-200 bg-rose-50 text-rose-700';
    }
    if (translator.status === 'offline') return 'border-slate-200 bg-slate-100 text-slate-700';
    return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  }, [translator.status]);

  const shouldShowAccountPrompt =
    account.isGuest &&
    !accountPromptDismissed &&
    resultCopyCount >= ACCOUNT_PROMPT_COPY_THRESHOLD;

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

  const openAccountFromPrompt = () => {
    analytics.track('account_connect_prompt_clicked', {
      surface: 'translate_soft_banner',
      reason: 'copied_replies',
      copy_count: resultCopyCount,
      account_kind: account.accountKind,
    });
    setShowAccount(true);
  };

  const accountButtonLabel = account.displayName;
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
    : translator.hasPendingChanges
      ? 'Listo para responder'
      : translator.message || undefined;
  const dictationUnavailableReason =
    'El dictado por microfono no esta disponible en este navegador.';

  return (
    <div className='flex h-[100dvh] min-h-0 flex-col overflow-x-hidden bg-slate-50 text-slate-950'>
      <header className='flex min-h-16 shrink-0 items-center justify-between gap-2 border-b border-slate-200 bg-white px-3 sm:gap-3 sm:px-4'>
        <div className='flex min-w-0 items-center gap-3'>
          <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white'>
            <Languages size={19} />
          </div>
          <div className='min-w-0'>
            <h1 className='hidden truncate text-lg font-bold leading-none sm:block'>flowtranslate</h1>
            <p className='mt-1 hidden text-xs text-slate-500 sm:block'>
              Responde mejor en ingles, mas rapido.
            </p>
          </div>
        </div>

        <nav className='flex min-w-0 shrink rounded-md bg-slate-100 p-1'>
          <button
            type='button'
            onClick={() => setView('translate')}
            className={`inline-flex h-10 items-center gap-1.5 rounded-md px-2 text-sm font-semibold transition-colors sm:gap-2 sm:px-3 ${
              view === 'translate'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Languages size={16} />
            <span className='hidden min-[360px]:inline'>Responder</span>
          </button>
          <button
            type='button'
            onClick={() => setView('learning')}
            className={`inline-flex h-10 items-center gap-1.5 rounded-md px-2 text-sm font-semibold transition-colors sm:gap-2 sm:px-3 ${
              view === 'learning'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
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
            className='inline-flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:text-slate-950 sm:w-auto sm:max-w-44 sm:px-3'
            title='Cuenta'
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

      {view === 'translate' ? (
        <main className='flex min-h-0 w-full max-w-full flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto p-3 sm:p-4 lg:overflow-hidden'>
          {translator.message ? (
            <div className={`border px-3 py-2 text-sm ${statusTone}`}>
              {translator.message}
            </div>
          ) : null}

          {voiceMessage ? (
            <div className='border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800'>
              {voiceMessage}
            </div>
          ) : null}

          {shouldShowAccountPrompt ? (
            <div className='flex flex-col gap-3 border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 sm:flex-row sm:items-center sm:justify-between'>
              <div className='min-w-0'>
                <p className='font-bold text-slate-950'>
                  Guarda tu tono para responder mas rapido.
                </p>
                <p className='mt-1 leading-5 text-slate-600'>
                  Conecta una cuenta gratis cuando quieras conservar historial,
                  preferencias y Learning personal.
                </p>
              </div>
              <div className='flex shrink-0 items-center gap-2'>
                <button
                  type='button'
                  onClick={openAccountFromPrompt}
                  className='inline-flex h-10 items-center justify-center rounded-md bg-slate-950 px-3 text-sm font-bold text-white hover:bg-slate-800'
                >
                  Guardar mi tono
                </button>
                <button
                  type='button'
                  onClick={() => setAccountPromptDismissed(true)}
                  className='inline-flex h-10 w-10 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-800'
                  title='Ocultar'
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          ) : null}

          <div className='flex flex-wrap items-center justify-between gap-3'>
            <TranslationPresetControl
              value={translator.presetId}
              onChange={selectPreset}
            />
            <div className='text-xs font-semibold text-slate-500'>
              {translator.status === 'typing'
                ? 'La IA espera una pausa corta'
                : translator.hasPendingChanges
                  ? 'Tambien podes generar manualmente'
                  : ' '}
            </div>
          </div>

          <ExpressionWorkspace
            inputText={translator.inputText}
            resultText={translator.resultText}
            mode={translator.mode}
            modeDetection={translator.modeDetection}
            sourceLanguage={translator.sourceLanguage}
            targetLanguage={translator.targetLanguage}
            breakdown={translator.breakdown}
            breakdownStatus={translator.breakdownStatus}
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
            onSelectMode={(nextMode) => translator.selectMode(nextMode)}
            onTranslateToSpanish={() => void translator.translate('translate_to_spanish')}
          />
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
            learningInsight={learningInsight}
            insightLoading={insightLoading}
            insightError={insightError}
            studyArticle={studyArticle}
            studyLoading={studyLoading}
            studyError={studyError}
            selectedStudyRecordId={selectedStudyRecordId}
            onRefreshInsight={() => void loadLearningInsight(true)}
            onOpenStudy={(record) => void openStudyArticle(record)}
            onCloseStudy={closeStudyArticle}
            onListenPhrase={(language, text) => listenPanel(language, text)}
            onAskBreakdownQuestion={askAboutBreakdown}
            onDelete={(id) => void deleteHistoryItem(id)}
            onClear={() => void clearHistory()}
          />
        </>
      )}

      {showAccount ? (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4'>
          <div className='w-full max-w-md bg-white p-5 shadow-xl'>
            <div className='mb-5 flex items-center justify-between gap-4'>
              <h2 className='flex items-center gap-2 text-lg font-bold'>
                <ShieldCheck size={19} />
                Cuenta
              </h2>
              <button
                type='button'
                onClick={() => setShowAccount(false)}
                className='rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                title='Cerrar'
              >
                <X size={18} />
              </button>
            </div>

            {!account.isSupabaseConfigured ? (
              <div className='border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800'>
                Faltan variables de Supabase para cuentas y respuestas con IA.
              </div>
            ) : account.authLoading ? (
              <div className='border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600'>
                Revisando cuenta...
              </div>
            ) : account.session ? (
              <div className='space-y-5'>
                <div className='space-y-2'>
                  <div className='flex items-center gap-2 text-xs font-bold uppercase text-slate-400'>
                    {account.isGuest ? <UserRound size={14} /> : <ShieldCheck size={14} />}
                    {account.isGuest ? 'Prueba gratis' : 'Cuenta conectada'}
                  </div>
                  <div className='truncate text-base font-bold text-slate-950'>
                    {account.displayName}
                  </div>
                  <p className='text-sm leading-6 text-slate-600'>
                    {account.isGuest
                      ? 'Responde ahora sin friccion. Conecta Google para conservar tono, historial y Learning personal.'
                      : 'Tu cuenta gratis de Flowtranslate esta conectada.'}
                  </p>
                </div>

                <QuotaStatus usage={usage} accountKind={account.accountKind} />

                {account.error ? (
                  <div className='border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700'>
                    {account.error}
                  </div>
                ) : null}

                {account.message ? (
                  <div className='border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700'>
                    {account.message}
                  </div>
                ) : null}

                {account.isGuest ? (
                  <button
                    type='button'
                    onClick={() => void account.signInWithGoogle()}
                    disabled={account.busy}
                    className='inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-300'
                  >
                    <Chrome size={16} />
                    Conectar con Google
                  </button>
                ) : null}

                <button
                  type='button'
                  onClick={() => void account.signOut()}
                  disabled={account.busy}
                  className='inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:text-slate-300'
                >
                  <LogOut size={16} />
                  Cerrar sesion
                </button>
              </div>
            ) : (
              <div className='space-y-4'>
                <div className='space-y-3'>
                  <button
                    type='button'
                    onClick={() => void account.signInWithGoogle()}
                    disabled={account.busy}
                    className='inline-flex h-11 w-full items-center justify-center gap-2 rounded-md bg-slate-950 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-300'
                  >
                    <Chrome size={16} />
                    Continuar con Google
                  </button>
                  <button
                    type='button'
                    onClick={() => void account.signInAsGuest()}
                    disabled={account.busy}
                    className='inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:text-slate-300'
                  >
                    <UserRound size={16} />
                    Iniciar prueba gratis
                  </button>
                </div>

                {account.error ? (
                  <div className='border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700'>
                    {account.error}
                  </div>
                ) : null}

                {account.message ? (
                  <div className='border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-700'>
                    {account.message}
                  </div>
                ) : null}

                <button
                  type='button'
                  onClick={() => setShowEmailSignIn((current) => !current)}
                  disabled={account.busy}
                  className='inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-200 text-sm font-bold text-slate-600 hover:bg-slate-50 disabled:text-slate-300'
                >
                  <Mail size={16} />
                  {showEmailSignIn ? 'Ocultar codigo por email' : 'Usar codigo por email'}
                </button>

                {showEmailSignIn ? (
                  <form onSubmit={account.submit} className='space-y-4 border-t border-slate-200 pt-4'>
                    <label className='block'>
                      <span className='mb-2 block text-sm font-bold text-slate-700'>
                        Email
                      </span>
                      <input
                        type='email'
                        value={account.email}
                        onChange={(event) => account.setEmail(event.target.value)}
                        disabled={account.busy}
                        className='h-11 w-full rounded-md border border-slate-200 px-3 outline-none focus:border-slate-500'
                        placeholder='you@example.com'
                      />
                    </label>

                    {account.codeSent ? (
                      <label className='block'>
                        <span className='mb-2 block text-sm font-bold text-slate-700'>
                          Codigo
                        </span>
                        <input
                          inputMode='numeric'
                          value={account.code}
                          onChange={(event) => account.setCode(event.target.value)}
                          disabled={account.busy}
                          className='h-11 w-full rounded-md border border-slate-200 px-3 text-lg font-bold tracking-normal outline-none focus:border-slate-500'
                          placeholder='000000'
                        />
                      </label>
                    ) : null}

                    <button
                      type='submit'
                      disabled={account.busy}
                      className='h-11 w-full rounded-md bg-slate-950 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-300'
                    >
                      {account.busy
                        ? 'Revisando'
                        : account.codeSent
                          ? 'Verificar codigo'
                          : 'Enviar codigo'}
                    </button>

                    {account.codeSent ? (
                      <button
                        type='button'
                        onClick={() => void account.requestCode()}
                        disabled={account.busy}
                        className='h-11 w-full rounded-md border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:text-slate-300'
                      >
                        Enviar nuevo codigo
                      </button>
                    ) : null}
                  </form>
                ) : null}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
