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
  Languages,
  LogOut,
  Settings,
  ShieldCheck,
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

function App() {
  const account = useFlowtranslateAccount();
  const [view, setView] = useState<AppView>(readInitialView);
  const [showAccount, setShowAccount] = useState(false);
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
  const dictationRef = useRef<DictationSession | null>(null);
  const renderedStudyArticleRef = useRef<string | null>(null);

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
        error instanceof Error ? error.message : 'Could not load history.',
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
    online,
    onUsage: handleUsage,
    onSavedTranslation: handleSavedTranslation,
  });

  const selectPreset = useCallback(
    (nextPresetId: TranslationPresetId) => {
      translator.selectPreset(nextPresetId);
      analytics.track('translation_preset_selected', {
        preset_id: nextPresetId,
      });
    },
    [translator],
  );

  useEffect(() => {
    if (translator.status === 'auth') setShowAccount(true);
  }, [translator.status]);

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
      setVoiceMessage('Audio playback is unavailable in this browser.');
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
      setVoiceMessage('Microphone dictation is unavailable in this browser.');
      return;
    }

    dictationRef.current?.abort();
    const baseText = translator.inputText;

    const session = startDictation({
      language,
      onResult: (transcript) => {
        const nextText = appendRecognizedText(baseText, transcript);
        translator.editInput(nextText);

        setVoiceMessage('Dictation added to the expression input.');
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
      setVoiceMessage('Microphone dictation is unavailable in this browser.');
      return;
    }

    dictationRef.current = session;
    setDictatingLanguage(language);
    setVoiceMessage('Listening through the browser microphone service...');
    analytics.track('translation_dictation_started', { language });
  };

  const loadLearningInsight = useCallback(
    async (forceRefresh = false, silent = false) => {
      setInsightError('');

      if (!online) {
        if (!silent) setInsightError('Offline. Learning insights need a connection.');
        return;
      }

      if (!account.accessToken) {
        if (!silent) {
          setShowAccount(true);
          setInsightError('Sign in to generate learning insights from history.');
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
            error instanceof Error ? error.message : 'Learning insight failed.',
          );
        }
        analytics.track('learning_insight_failed', { error_type: 'exception' });
      } finally {
        setInsightLoading(false);
      }
    },
    [account.accessToken, history.length, online],
  );

  useEffect(() => {
    if (view !== 'learning' || !account.accessToken || !online) return;
    void loadLearningInsight(false, true);
  }, [account.accessToken, loadLearningInsight, online, view]);

  const openStudyArticle = async (record: TranslationRecord) => {
    setStudyError('');
    setSelectedStudyRecordId(record.id);
    setStudyArticle(null);

    if (!online) {
      setStudyError('Offline. Study articles need a connection.');
      return;
    }

    if (!account.accessToken) {
      setShowAccount(true);
      setStudyError('Sign in to study saved translations.');
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
          error instanceof Error ? error.message : 'Study article failed.',
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
        throw new Error('Offline. Breakdown questions need a connection.');
      }

      if (!account.accessToken) {
        setShowAccount(true);
        throw new Error('Sign in to ask AI about this breakdown.');
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
    [account.accessToken, online],
  );

  const deleteHistoryItem = async (id: string) => {
    try {
      await deleteTranslationRecord(id);
      setHistory((current) => current.filter((item) => item.id !== id));
      setLearningInsight(null);
      if (selectedStudyRecordId === id) closeStudyArticle();
      analytics.track('translation_history_deleted', { count: 1 });
    } catch (error) {
      setHistoryError(error instanceof Error ? error.message : 'Delete failed.');
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
      setHistoryError(error instanceof Error ? error.message : 'Clear failed.');
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

  const accountButtonLabel = account.userEmail || 'Account';
  const expressionStatusText = translator.status === 'translating'
    ? 'Generating...'
    : translator.status === 'typing'
      ? 'Auto-generating soon'
    : translator.hasPendingChanges
      ? 'Ready to generate'
      : translator.message || undefined;
  const dictationUnavailableReason =
    'Microphone dictation is unavailable in this browser.';

  return (
    <div className='flex h-screen flex-col overflow-x-hidden bg-slate-50 text-slate-950'>
      <header className='flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-3 sm:px-4'>
        <div className='flex min-w-0 items-center gap-3'>
          <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white'>
            <Languages size={19} />
          </div>
          <div className='min-w-0'>
            <h1 className='hidden truncate text-lg font-bold leading-none sm:block'>flowtranslate</h1>
            <p className='mt-1 hidden text-xs text-slate-500 sm:block'>
              Translate first. Learn separately.
            </p>
          </div>
        </div>

        <nav className='flex shrink-0 rounded-md bg-slate-100 p-1'>
          <button
            type='button'
            onClick={() => setView('translate')}
            className={`inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors ${
              view === 'translate'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Languages size={16} />
            Translate
          </button>
          <button
            type='button'
            onClick={() => setView('learning')}
            className={`inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors ${
              view === 'learning'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen size={16} />
            Learning
          </button>
        </nav>

        <div className='flex min-w-0 items-center gap-2'>
          <div className='hidden lg:block'>
            <QuotaStatus usage={usage} compact />
          </div>
          <button
            type='button'
            onClick={() => setShowAccount(true)}
            className='inline-flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-md border border-slate-200 bg-white text-sm font-semibold text-slate-600 hover:text-slate-950 sm:w-auto sm:max-w-44 sm:px-3'
            title='Account'
          >
            {account.session ? <ShieldCheck size={17} /> : <Settings size={17} />}
            <span className='hidden truncate sm:inline'>{accountButtonLabel}</span>
          </button>
        </div>
      </header>

      {!online ? (
        <div className='flex items-center gap-2 border-b border-slate-200 bg-slate-100 px-4 py-2 text-sm text-slate-700'>
          <WifiOff size={16} />
          Offline shell is available. New AI actions are paused.
        </div>
      ) : null}

      {view === 'translate' ? (
        <main className='flex min-h-0 w-full max-w-full flex-1 flex-col gap-3 overflow-x-hidden overflow-y-auto p-4 lg:overflow-hidden'>
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

          <div className='flex flex-wrap items-center justify-between gap-3'>
            <TranslationPresetControl
              value={translator.presetId}
              onChange={selectPreset}
            />
            <div className='text-xs font-semibold text-slate-500'>
              {translator.status === 'typing'
                ? 'Auto-translate is waiting for pause'
                : translator.hasPendingChanges
                  ? 'Manual translate is still available'
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
            Browser voice services may process audio during dictation; Flowtranslate
            saves only submitted translation text and history.
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
                Account
              </h2>
              <button
                type='button'
                onClick={() => setShowAccount(false)}
                className='rounded-md p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700'
                title='Close'
              >
                <X size={18} />
              </button>
            </div>

            {!account.isSupabaseConfigured ? (
              <div className='border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800'>
                Supabase environment variables are required for accounts and AI work.
              </div>
            ) : account.session ? (
              <div className='space-y-4'>
                <div className='border border-slate-200 p-3'>
                  <div className='text-xs font-bold uppercase text-slate-400'>
                    Signed in
                  </div>
                  <div className='mt-1 truncate text-sm font-bold text-slate-950'>
                    {account.userEmail}
                  </div>
                </div>
                <QuotaStatus usage={usage} />
                <button
                  type='button'
                  onClick={() => void account.signOut()}
                  className='inline-flex h-11 w-full items-center justify-center gap-2 rounded-md border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50'
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            ) : (
              <form onSubmit={account.submit} className='space-y-4'>
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

                <label className='block'>
                  <span className='mb-2 block text-sm font-bold text-slate-700'>
                    Code
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
                  type='submit'
                  disabled={account.busy}
                  className='h-11 w-full rounded-md bg-slate-950 text-sm font-bold text-white hover:bg-slate-800 disabled:bg-slate-300'
                >
                  {account.busy
                    ? 'Checking'
                    : account.code.trim()
                      ? 'Verify code'
                      : 'Send code'}
                </button>

                {account.codeSent ? (
                  <button
                    type='button'
                    onClick={() => void account.requestCode()}
                    disabled={account.busy}
                    className='h-11 w-full rounded-md border border-slate-200 text-sm font-bold text-slate-700 hover:bg-slate-50'
                  >
                    Send a new code
                  </button>
                ) : null}
              </form>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default App;
