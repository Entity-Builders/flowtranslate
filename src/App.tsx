import type {
  LanguageCode,
  PracticeSet as PracticeSetType,
  TranslationRecord,
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
import { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import { STORAGE_KEYS } from './constants';
import { LearningView } from './components/LearningView';
import { QuotaStatus } from './components/QuotaStatus';
import { TranslatorPanel } from './components/TranslatorPanel';
import { useBidirectionalTranslator } from './hooks/useBidirectionalTranslator';
import { useFlowtranslateAccount } from './hooks/useFlowtranslateAccount';
import { analytics } from './services/analytics';
import { copyText } from './services/clipboard';
import { FlowtranslateApiError, generatePractice } from './services/flowtranslate-api';
import { isOnline, subscribeToOnlineState } from './services/pwa';
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
  const [copiedPanel, setCopiedPanel] = useState<CopiedPanel>(null);

  useEffect(() => subscribeToOnlineState(setOnline), []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.activeView, view);
  }, [view]);

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

  const deleteHistoryItem = async (id: string) => {
    try {
      await deleteTranslationRecord(id);
      setHistory((current) => current.filter((item) => item.id !== id));
      setPractice(null);
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

  return (
    <div className='flex h-screen flex-col bg-slate-50 text-slate-950'>
      <header className='flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-white px-4'>
        <div className='flex min-w-0 items-center gap-3'>
          <div className='flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-slate-950 text-white'>
            <Languages size={19} />
          </div>
          <div className='min-w-0'>
            <h1 className='truncate text-lg font-bold leading-none'>flowtranslate</h1>
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
            className='inline-flex h-10 max-w-44 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-600 hover:text-slate-950'
            title='Account'
          >
            {account.session ? <ShieldCheck size={17} /> : <Settings size={17} />}
            <span className='truncate'>{accountButtonLabel}</span>
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
        <main className='flex min-h-0 flex-1 flex-col gap-3 p-4'>
          {translator.message ? (
            <div className={`border px-3 py-2 text-sm ${statusTone}`}>
              {translator.message}
            </div>
          ) : null}

          <div className='grid min-h-0 flex-1 grid-cols-2 gap-4 max-lg:grid-cols-1'>
            <TranslatorPanel
              language='es'
              label='Spanish'
              text={translator.spanishText}
              isSource={translator.sourceLanguage === 'es'}
              placeholder='Escribe o pega texto en español...'
              copied={copiedPanel === 'es'}
              statusText={
                translator.sourceLanguage === 'es'
                  ? translator.message
                  : undefined
              }
              onChange={(value) => translator.editSpanish(value)}
              onPaste={(value) => translator.editSpanish(value, true)}
              onCopy={() => void copyPanel('es', translator.spanishText)}
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
                  ? translator.message
                  : undefined
              }
              onChange={(value) => translator.editEnglish(value)}
              onPaste={(value) => translator.editEnglish(value, true)}
              onCopy={() => void copyPanel('en', translator.englishText)}
            />
          </div>
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
            onGenerate={() => void generateLearningPractice()}
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
