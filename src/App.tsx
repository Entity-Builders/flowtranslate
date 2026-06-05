import type {
  LanguageCode,
  PracticeSet as PracticeSetType,
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
import { STORAGE_KEYS } from './constants';
import { LearningView } from './components/LearningView';
import { QuotaStatus } from './components/QuotaStatus';
import { TranslateCommand } from './components/TranslateCommand';
import { TranslationPresetControl } from './components/TranslationPresetControl';
import { TranslatorPanel } from './components/TranslatorPanel';
import { useBidirectionalTranslator } from './hooks/useBidirectionalTranslator';
import { useFlowtranslateAccount } from './hooks/useFlowtranslateAccount';
import { analytics } from './services/analytics';
import { copyText } from './services/clipboard';
import {
  FlowtranslateApiError,
  generatePractice,
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
type CopiedPanel = LanguageCode | null;

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
  const [practice, setPractice] = useState<PracticeSetType | null>(null);
  const [practiceLoading, setPracticeLoading] = useState(false);
  const [practiceError, setPracticeError] = useState('');
  const [insufficientHistory, setInsufficientHistory] = useState(false);
  const [studyArticle, setStudyArticle] = useState<StudyArticle | null>(null);
  const [studyLoading, setStudyLoading] = useState(false);
  const [studyError, setStudyError] = useState('');
  const [selectedStudyRecordId, setSelectedStudyRecordId] =
    useState<string | null>(null);
  const [copiedPanel, setCopiedPanel] = useState<CopiedPanel>(null);
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

  const copyPanel = async (language: LanguageCode, text: string) => {
    const copied = await copyText(text);
    if (!copied) return;

    setCopiedPanel(language);
    analytics.track('translation_copied', {
      language,
      text_length: text.length,
    });
    window.setTimeout(() => setCopiedPanel(null), 1600);
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

  const dictatePanel = (language: LanguageCode) => {
    if (dictatingLanguage === language) {
      stopCurrentDictation();
      return;
    }

    if (!dictationAvailable) {
      setVoiceMessage('Microphone dictation is unavailable in this browser.');
      return;
    }

    dictationRef.current?.abort();
    const baseText =
      language === 'es' ? translator.spanishText : translator.englishText;

    const session = startDictation({
      language,
      onResult: (transcript) => {
        const nextText = appendRecognizedText(baseText, transcript);
        if (language === 'es') translator.editSpanish(nextText);
        else translator.editEnglish(nextText);

        setVoiceMessage('Dictation added to the active panel.');
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

  const generateLearningPractice = async () => {
    setPracticeError('');

    if (!online) {
      setPracticeError('Offline. Practice generation needs a connection.');
      return;
    }

    if (!account.accessToken) {
      setShowAccount(true);
      setPracticeError('Sign in to generate practice from saved translations.');
      return;
    }

    setPracticeLoading(true);
    analytics.track('learning_practice_submitted', {
      history_count: history.length,
    });

    try {
      const result = await generatePractice({}, account.accessToken);
      setPractice(result.practice);
      setInsufficientHistory(Boolean(result.insufficientHistory));
      setUsage(result.usage);
      analytics.track('learning_practice_succeeded', {
        item_count: result.practice.items.length,
        source_count: result.practice.sourceTranslationIds.length,
      });
    } catch (error) {
      if (error instanceof FlowtranslateApiError) {
        if (error.usage) setUsage(error.usage);
        setPracticeError(error.message);
      } else {
        setPracticeError(
          error instanceof Error ? error.message : 'Practice generation failed.',
        );
      }
      analytics.track('learning_practice_failed', { error_type: 'exception' });
    } finally {
      setPracticeLoading(false);
    }
  };

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

  const deleteHistoryItem = async (id: string) => {
    try {
      await deleteTranslationRecord(id);
      setHistory((current) => current.filter((item) => item.id !== id));
      setPractice(null);
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
      setPractice(null);
      closeStudyArticle();
      setInsufficientHistory(false);
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
  const sourceStatusText = translator.status === 'translating'
    ? 'Translating...'
    : translator.status === 'typing'
      ? 'Auto-translating soon'
    : translator.hasPendingChanges
      ? 'Ready to translate'
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

          <div className='grid w-full min-w-0 max-w-full flex-1 grid-cols-1 gap-4 overflow-x-hidden lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_8rem_minmax(0,1fr)]'>
            <TranslatorPanel
              language='es'
              label='Spanish'
              text={translator.spanishText}
              isSource={translator.sourceLanguage === 'es'}
              placeholder='Escribe o pega texto en español...'
              copied={copiedPanel === 'es'}
              statusText={
                translator.sourceLanguage === 'es'
                  ? sourceStatusText
                  : undefined
              }
              onChange={(value) => translator.editSpanish(value)}
              onPaste={(value) => translator.editSpanish(value)}
              onCopy={() => void copyPanel('es', translator.spanishText)}
              canListen={speechAvailable}
              isSpeaking={speakingLanguage === 'es'}
              onListen={() => listenPanel('es', translator.spanishText)}
              canDictate={dictationAvailable}
              isDictating={dictatingLanguage === 'es'}
              dictationUnavailableReason={dictationUnavailableReason}
              onDictate={() => dictatePanel('es')}
              onSubmit={() => void translator.translate()}
              submitDisabled={!translator.canTranslate}
            />

            <TranslateCommand
              sourceLanguage={translator.sourceLanguage}
              targetLanguage={translator.targetLanguage}
              status={translator.status}
              canTranslate={translator.canTranslate}
              disabledReason={translator.translateDisabledReason}
              hasPendingChanges={translator.hasPendingChanges}
              onTranslate={() => void translator.translate()}
            />

            <TranslatorPanel
              language='en'
              label='English'
              text={translator.englishText}
              isSource={translator.sourceLanguage === 'en'}
              placeholder='Type or paste English text...'
              copied={copiedPanel === 'en'}
              statusText={
                translator.sourceLanguage === 'en'
                  ? sourceStatusText
                  : undefined
              }
              onChange={(value) => translator.editEnglish(value)}
              onPaste={(value) => translator.editEnglish(value)}
              onCopy={() => void copyPanel('en', translator.englishText)}
              canListen={speechAvailable}
              isSpeaking={speakingLanguage === 'en'}
              onListen={() => listenPanel('en', translator.englishText)}
              canDictate={dictationAvailable}
              isDictating={dictatingLanguage === 'en'}
              dictationUnavailableReason={dictationUnavailableReason}
              onDictate={() => dictatePanel('en')}
              onSubmit={() => void translator.translate()}
              submitDisabled={!translator.canTranslate}
            />
          </div>
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
            practice={practice}
            loading={practiceLoading}
            insufficientHistory={insufficientHistory}
            error={practiceError}
            studyArticle={studyArticle}
            studyLoading={studyLoading}
            studyError={studyError}
            selectedStudyRecordId={selectedStudyRecordId}
            onGenerate={() => void generateLearningPractice()}
            onOpenStudy={(record) => void openStudyArticle(record)}
            onCloseStudy={closeStudyArticle}
            onListenPhrase={(language, text) => listenPanel(language, text)}
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
