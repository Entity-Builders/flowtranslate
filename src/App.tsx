import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import './App.css';
import {
  BookOpen,
  Check,
  Copy,
  Download,
  Languages,
  LogOut,
  Mic,
  MicOff,
  RefreshCw,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import Markdown from 'react-markdown';
import {
  DEFAULT_TARGET_LANGUAGE,
  STORAGE_KEYS,
  TARGET_LANGUAGES,
} from './constants';
import {
  FlowtranslateApiError,
  type FlowtranslateUsage,
  generateLearningArticle,
  generateTranslation,
} from './services/flowtranslate-api';
import { analytics } from './services/analytics';
import {
  isSupabaseConfigured,
  supabase,
  type Session,
} from './lib/supabase';

type AppView = 'translate' | 'learning';

type TranslationRecord = {
  id: string;
  sourceText: string;
  translatedText: string;
  targetLanguage: string;
  createdAt: string;
  article?: string;
};

type SpeechRecognitionResultLike = {
  isFinal: boolean;
  0: { transcript: string };
};

type SpeechRecognitionEventLike = Event & {
  results: {
    length: number;
    item(index: number): SpeechRecognitionResultLike;
    [index: number]: SpeechRecognitionResultLike;
  };
};

type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onend: (() => void) | null;
  onerror: ((event: Event) => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  }
}

const parseTranslations = (): TranslationRecord[] => {
  const saved = localStorage.getItem(STORAGE_KEYS.translations);
  if (!saved) return [];
  try {
    const parsed = JSON.parse(saved);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('es', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [accountEmail, setAccountEmail] = useState('');
  const [accountCode, setAccountCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountMessage, setAccountMessage] = useState('');
  const [accountError, setAccountError] = useState('');
  const [usage, setUsage] = useState<FlowtranslateUsage | null>(null);
  const [appVersion, setAppVersion] = useState('');
  const [view, setView] = useState<AppView>('translate');
  const [inputText, setInputText] = useState('');
  const [targetLanguage, setTargetLanguage] = useState(
    DEFAULT_TARGET_LANGUAGE,
  );
  const [translatedText, setTranslatedText] = useState('');
  const [translations, setTranslations] =
    useState<TranslationRecord[]>(parseTranslations);
  const [selectedTranslationId, setSelectedTranslationId] = useState(
    localStorage.getItem(STORAGE_KEYS.selectedTranslation) || '',
  );
  const [loadingTranslation, setLoadingTranslation] = useState(false);
  const [loadingArticle, setLoadingArticle] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [recordingMessage, setRecordingMessage] = useState('');
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [updateStatus, setUpdateStatus] = useState<
    'none' | 'checking' | 'available' | 'downloaded' | 'not-available' | 'error'
  >('none');
  const [updateDismissed, setUpdateDismissed] = useState(false);
  const [downloadedVersion, setDownloadedVersion] = useState('');

  const selectedTranslation = useMemo(() => {
    return (
      translations.find((item) => item.id === selectedTranslationId) ||
      translations[0]
    );
  }, [selectedTranslationId, translations]);

  useEffect(() => {
    window.ipcRenderer.invoke<string>('app:get-version').then((version) => {
      setAppVersion(version);
      analytics.setGlobalProperties({ app_version: version });
    });
  }, []);

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      return;
    }

    let isMounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!isMounted) return;
      setSession(data.session);
      setAccountEmail(data.session?.user.email || '');
      setAuthLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAccountEmail(nextSession?.user.email || '');
      setAuthLoading(false);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.translations, JSON.stringify(translations));
  }, [translations]);

  useEffect(() => {
    if (!selectedTranslation?.id) return;
    localStorage.setItem(STORAGE_KEYS.selectedTranslation, selectedTranslation.id);
  }, [selectedTranslation?.id]);

  useEffect(() => {
    const dismissedVersion = localStorage.getItem(
      STORAGE_KEYS.dismissedUpdateVersion,
    );

    const handleUpdateAvailable = () => setUpdateStatus('available');
    const handleUpdateDownloaded = (
      _event: unknown,
      info: { version?: string },
    ) => {
      const nextVersion = info?.version;
      setUpdateDismissed(Boolean(nextVersion && nextVersion === dismissedVersion));
      setUpdateStatus('downloaded');
      if (nextVersion) setDownloadedVersion(nextVersion);
    };
    const handleUpdateNotAvailable = () => setUpdateStatus('not-available');
    const handleUpdateError = () => setUpdateStatus('error');

    window.ipcRenderer.on('update-available', handleUpdateAvailable);
    window.ipcRenderer.on('update-downloaded', handleUpdateDownloaded);
    window.ipcRenderer.on('update-not-available', handleUpdateNotAvailable);
    window.ipcRenderer.on('update-error', handleUpdateError);

    return () => {
      window.ipcRenderer.off('update-available', handleUpdateAvailable);
      window.ipcRenderer.off('update-downloaded', handleUpdateDownloaded);
      window.ipcRenderer.off('update-not-available', handleUpdateNotAvailable);
      window.ipcRenderer.off('update-error', handleUpdateError);
    };
  }, []);

  const requireAccessToken = () => {
    if (!isSupabaseConfigured || !supabase) {
      setErrorMessage('Configura Supabase para usar el backend de flowtranslate.');
      setShowSettings(true);
      return null;
    }

    if (!session?.access_token) {
      setErrorMessage('Inicia sesion para traducir con flowtranslate.');
      setShowSettings(true);
      return null;
    }

    return session.access_token;
  };

  const handleApiError = (error: unknown, fallbackMessage: string) => {
    if (error instanceof FlowtranslateApiError) {
      if (error.usage) setUsage(error.usage);
      return error.message;
    }

    return error instanceof Error ? error.message : fallbackMessage;
  };

  const requestSignInCode = async () => {
    setAccountError('');
    setAccountMessage('');

    if (!supabase) {
      setAccountError('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
      return;
    }

    const email = accountEmail.trim();
    if (!email) {
      setAccountError('Escribi un email para iniciar sesion.');
      return;
    }

    setAccountBusy(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: window.location.origin,
      },
    });
    setAccountBusy(false);

    if (error) {
      setAccountError(error.message);
      return;
    }

    setCodeSent(true);
    setAccountCode('');
    setAccountMessage('Te mande un codigo. Pegalo aca para entrar.');
  };

  const handleSignIn = async (event: FormEvent) => {
    event.preventDefault();

    if (!codeSent && !accountCode.trim()) {
      await requestSignInCode();
      return;
    }

    setAccountError('');
    setAccountMessage('');

    if (!supabase) {
      setAccountError('Faltan VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.');
      return;
    }

    const email = accountEmail.trim();
    const token = accountCode.trim().replace(/\s/g, '');

    if (!email || !token) {
      setAccountError('Escribi el email y el codigo que recibiste.');
      return;
    }

    setAccountBusy(true);
    const { error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'email',
    });
    setAccountBusy(false);

    if (error) {
      setAccountError(error.message);
      return;
    }

    setAccountMessage('Sesion iniciada.');
    setShowSettings(false);
  };

  const handleSignOut = async () => {
    await supabase?.auth.signOut();
    setUsage(null);
    setCodeSent(false);
    setAccountCode('');
    setAccountMessage('');
    setAccountError('');
  };

  const handleTranslate = async () => {
    const text = inputText.trim();
    if (!text || loadingTranslation) return;

    const accessToken = requireAccessToken();
    if (!accessToken) return;

    setLoadingTranslation(true);
    setErrorMessage('');
    setTranslatedText('');

    const startedAt = Date.now();
    analytics.track('translation_submitted', {
      target_language: targetLanguage,
      input_length: text.length,
      billing_mode: 'flowtranslate_proxy',
    });

    try {
      const result = await generateTranslation(
        { text, targetLanguage },
        accessToken,
      );

      const newRecord: TranslationRecord = {
        id: String(Date.now()),
        sourceText: text,
        translatedText: result.text.trim(),
        targetLanguage,
        createdAt: new Date().toISOString(),
      };

      setTranslatedText(newRecord.translatedText);
      setTranslations((current) => [newRecord, ...current].slice(0, 80));
      setSelectedTranslationId(newRecord.id);
      if (result.usage) setUsage(result.usage);
      analytics.track('translation_succeeded', {
        duration_ms: Date.now() - startedAt,
        output_length: result.text.length,
      });
    } catch (error) {
      const message = handleApiError(error, 'Translation failed.');
      setErrorMessage(message);
      analytics.track('translation_failed', { error_type: 'exception' });
    } finally {
      setLoadingTranslation(false);
    }
  };

  const handleCopy = async (text: string) => {
    if (!text.trim()) return;
    await window.ipcRenderer.invoke('clipboard:write', text);
    setIsCopied(true);
    analytics.track('translation_copied', { text_length: text.length });
    window.setTimeout(() => setIsCopied(false), 1600);
  };

  const handleToggleRecording = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const Recognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setRecordingMessage('Dictado no disponible en este entorno.');
      return;
    }

    const recognition = new Recognition();
    recognition.lang = targetLanguage === 'Spanish' ? 'es-ES' : 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.onresult = (event) => {
      const transcript = Array.from({ length: event.results.length }, (_, index) => {
        const result = event.results[index] || event.results.item(index);
        return result.isFinal ? result[0].transcript : '';
      })
        .join(' ')
        .trim();

      if (transcript) {
        setInputText((current) => `${current}${current ? ' ' : ''}${transcript}`);
      }
    };
    recognition.onerror = () => {
      setRecordingMessage('No pude tomar audio. Proba de nuevo.');
      setIsListening(false);
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;
    setRecordingMessage('');
    setIsListening(true);
    recognition.start();
  };

  const handleGenerateArticle = async (record: TranslationRecord) => {
    const accessToken = requireAccessToken();
    if (!accessToken) return;

    setLoadingArticle(true);
    setErrorMessage('');
    analytics.track('learning_article_submitted', {
      translation_id: record.id,
      target_language: record.targetLanguage,
    });

    try {
      const result = await generateLearningArticle(
        {
          sourceText: record.sourceText,
          translatedText: record.translatedText,
          targetLanguage: record.targetLanguage,
        },
        accessToken,
      );

      setTranslations((current) =>
        current.map((item) =>
          item.id === record.id ? { ...item, article: result.text } : item,
        ),
      );
      if (result.usage) setUsage(result.usage);
      analytics.track('learning_article_succeeded', {
        article_length: result.text.length,
      });
    } catch (error) {
      const message = handleApiError(error, 'Learning article failed.');
      setErrorMessage(message);
      analytics.track('learning_article_failed', { error_type: 'exception' });
    } finally {
      setLoadingArticle(false);
    }
  };

  const handleCheckForUpdates = async () => {
    setUpdateStatus('checking');
    await window.ipcRenderer.invoke('app:check-for-updates');
  };

  const handleRestart = () => {
    window.ipcRenderer.send('restart-app');
  };

  const userEmail = session?.user.email || '';
  const quotaLabel = usage
    ? `${usage.remainingThisMonth.toLocaleString()} / ${usage.monthlyQuota.toLocaleString()} tokens left`
    : 'Usage appears after your next request.';
  const translateButtonLabel = authLoading
    ? 'Loading account...'
    : loadingTranslation
      ? 'Translating...'
      : 'Translate';

  return (
    <div className='flex h-screen flex-col bg-[#f6f7f9] text-slate-900'>
      <header className='flex h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6'>
        <div className='flex items-center gap-3'>
          <div className='flex h-9 w-9 items-center justify-center rounded-lg bg-slate-950 text-white'>
            <Languages size={19} />
          </div>
          <div>
            <h1 className='text-lg font-bold leading-none'>flowtranslate</h1>
            <p className='mt-1 text-xs text-slate-500'>Translate first. Learn later.</p>
          </div>
        </div>

        <nav className='flex rounded-lg bg-slate-100 p-1'>
          <button
            onClick={() => setView('translate')}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
              view === 'translate'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <Languages size={16} />
            Translate
          </button>
          <button
            onClick={() => setView('learning')}
            className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors ${
              view === 'learning'
                ? 'bg-white text-slate-950 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            <BookOpen size={16} />
            Learning
          </button>
        </nav>

        <button
          onClick={() => setShowSettings(true)}
          className='flex min-w-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-500 transition-colors hover:text-slate-900'
          title='Account'
        >
          {session ? <ShieldCheck size={18} /> : <Settings size={18} />}
          {session ? <span className='hidden max-w-36 truncate sm:block'>{userEmail}</span> : null}
        </button>
      </header>

      {view === 'translate' ? (
        <main className='grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-4 p-4'>
          <section className='flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white'>
            <div className='flex items-center justify-between border-b border-slate-100 px-5 py-4'>
              <div>
                <h2 className='text-base font-bold'>Original</h2>
                <p className='text-sm text-slate-500'>Type or dictate what you need.</p>
              </div>
              <div className='flex items-center gap-2'>
                <select
                  value={targetLanguage}
                  onChange={(event) => setTargetLanguage(event.target.value)}
                  className='h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700 outline-none focus:border-slate-400'
                >
                  {TARGET_LANGUAGES.map((language) => (
                    <option key={language} value={language}>
                      {language}
                    </option>
                  ))}
                </select>
                <button
                  onClick={handleToggleRecording}
                  className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-colors ${
                    isListening
                      ? 'border-red-200 bg-red-50 text-red-600'
                      : 'border-slate-200 bg-white text-slate-500 hover:text-slate-900'
                  }`}
                  title={isListening ? 'Stop recording' : 'Record'}
                >
                  {isListening ? <MicOff size={18} /> : <Mic size={18} />}
                </button>
              </div>
            </div>

            <textarea
              value={inputText}
              onChange={(event) => setInputText(event.target.value)}
              placeholder='Write or record a sentence...'
              className='min-h-0 flex-1 resize-none bg-transparent p-5 text-xl leading-relaxed text-slate-800 outline-none placeholder:text-slate-300'
            />

            <div className='flex items-center justify-between border-t border-slate-100 px-5 py-4'>
              <div className='text-sm text-slate-500'>
                {recordingMessage || `${inputText.trim().length} characters`}
              </div>
              <button
                onClick={handleTranslate}
                disabled={!inputText.trim() || loadingTranslation || authLoading}
                className={`flex items-center gap-2 rounded-lg px-5 py-3 text-sm font-bold text-white transition-colors ${
                  !inputText.trim() || loadingTranslation || authLoading
                    ? 'bg-slate-300'
                    : 'bg-slate-950 hover:bg-slate-800'
                }`}
              >
                {translateButtonLabel}
                <Send size={16} />
              </button>
            </div>
          </section>

          <section className='flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white'>
            <div className='flex items-center justify-between border-b border-slate-100 px-5 py-4'>
              <div>
                <h2 className='text-base font-bold'>Translation</h2>
                <p className='text-sm text-slate-500'>Clean output, ready to copy.</p>
              </div>
              <button
                onClick={() => handleCopy(translatedText)}
                disabled={!translatedText.trim()}
                className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition-colors ${
                  translatedText.trim()
                    ? 'bg-slate-950 text-white hover:bg-slate-800'
                    : 'bg-slate-100 text-slate-400'
                }`}
              >
                {isCopied ? <Check size={16} /> : <Copy size={16} />}
                {isCopied ? 'Copied' : 'Copy'}
              </button>
            </div>

            <div className='min-h-0 flex-1 overflow-y-auto p-5'>
              {errorMessage ? (
                <div className='rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700'>
                  {errorMessage}
                </div>
              ) : translatedText ? (
                <div className='whitespace-pre-wrap text-2xl font-semibold leading-relaxed text-slate-950'>
                  {translatedText}
                </div>
              ) : (
                <div className='flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 text-center text-slate-400'>
                  Your translation will appear here.
                </div>
              )}
            </div>
          </section>
        </main>
      ) : (
        <main className='grid min-h-0 flex-1 grid-cols-[340px_minmax(0,1fr)] gap-4 p-4'>
          <aside className='flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white'>
            <div className='border-b border-slate-100 px-5 py-4'>
              <h2 className='text-base font-bold'>Translations</h2>
              <p className='text-sm text-slate-500'>
                {translations.length ? `${translations.length} saved` : 'No translations yet'}
              </p>
            </div>

            <div className='min-h-0 flex-1 overflow-y-auto p-2'>
              {translations.length === 0 ? (
                <div className='p-4 text-sm text-slate-500'>
                  Translate something first, then come back here to learn from it.
                </div>
              ) : (
                translations.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setSelectedTranslationId(item.id)}
                    className={`w-full rounded-lg p-3 text-left transition-colors ${
                      selectedTranslation?.id === item.id
                        ? 'bg-slate-950 text-white'
                        : 'hover:bg-slate-100'
                    }`}
                  >
                    <div className='line-clamp-2 text-sm font-semibold'>
                      {item.sourceText}
                    </div>
                    <div
                      className={`mt-2 text-xs ${
                        selectedTranslation?.id === item.id
                          ? 'text-slate-300'
                          : 'text-slate-500'
                      }`}
                    >
                      {item.targetLanguage} - {formatDate(item.createdAt)}
                    </div>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className='flex min-h-0 flex-col rounded-lg border border-slate-200 bg-white'>
            {selectedTranslation ? (
              <>
                <div className='flex items-start justify-between gap-4 border-b border-slate-100 px-6 py-5'>
                  <div className='min-w-0'>
                    <h2 className='text-xl font-bold'>Learning article</h2>
                    <p className='mt-1 text-sm text-slate-500'>
                      Built from one translation, not mixed into translate mode.
                    </p>
                  </div>
                  <button
                    onClick={() => handleGenerateArticle(selectedTranslation)}
                    disabled={loadingArticle}
                    className={`flex shrink-0 items-center gap-2 rounded-lg px-4 py-2 text-sm font-bold text-white transition-colors ${
                      loadingArticle
                        ? 'bg-slate-300'
                        : 'bg-slate-950 hover:bg-slate-800'
                    }`}
                  >
                    <Sparkles size={16} />
                    {selectedTranslation.article ? 'Refresh article' : 'Create article'}
                  </button>
                </div>

                <div className='grid grid-cols-2 gap-4 border-b border-slate-100 p-6'>
                  <div className='rounded-lg bg-slate-50 p-4'>
                    <div className='mb-2 text-xs font-bold uppercase text-slate-400'>
                      Original
                    </div>
                    <div className='whitespace-pre-wrap text-sm text-slate-700'>
                      {selectedTranslation.sourceText}
                    </div>
                  </div>
                  <div className='rounded-lg bg-slate-50 p-4'>
                    <div className='mb-2 text-xs font-bold uppercase text-slate-400'>
                      Translation
                    </div>
                    <div className='whitespace-pre-wrap text-sm font-semibold text-slate-900'>
                      {selectedTranslation.translatedText}
                    </div>
                  </div>
                </div>

                <div className='min-h-0 flex-1 overflow-y-auto p-6'>
                  {errorMessage ? (
                    <div className='mb-4 rounded-lg border border-red-100 bg-red-50 p-4 text-sm text-red-700'>
                      {errorMessage}
                    </div>
                  ) : null}
                  {selectedTranslation.article ? (
                    <div className='prose prose-slate max-w-none prose-headings:font-bold'>
                      <Markdown>{selectedTranslation.article}</Markdown>
                    </div>
                  ) : (
                    <div className='flex h-full items-center justify-center rounded-lg border border-dashed border-slate-200 p-8 text-center text-slate-500'>
                      Create a short article with shortcuts, repetition, and a mini challenge.
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className='flex h-full items-center justify-center text-slate-500'>
                Your learning articles will appear here.
              </div>
            )}
          </section>
        </main>
      )}

      {showSettings && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'>
          <div className='w-[420px] rounded-lg bg-white p-6 shadow-xl'>
            <div className='mb-6 flex items-center justify-between'>
              <h3 className='flex items-center gap-2 text-xl font-bold'>
                <ShieldCheck size={20} /> Account
              </h3>
              <button
                onClick={() => setShowSettings(false)}
                className='rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700'
              >
                <X size={18} />
              </button>
            </div>

            {!isSupabaseConfigured ? (
              <div className='rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800'>
                Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to use
                flowtranslate accounts.
              </div>
            ) : session ? (
              <div className='space-y-4'>
                <div className='rounded-lg border border-slate-200 p-4'>
                  <p className='text-xs font-bold uppercase text-slate-400'>
                    Signed in
                  </p>
                  <p className='mt-1 truncate text-sm font-bold text-slate-900'>
                    {userEmail}
                  </p>
                </div>

                <div className='rounded-lg bg-slate-50 p-4'>
                  <p className='text-sm font-bold text-slate-900'>Monthly usage</p>
                  <p className='mt-1 text-sm text-slate-500'>{quotaLabel}</p>
                </div>

                <button
                  onClick={handleSignOut}
                  className='flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50'
                >
                  <LogOut size={16} />
                  Sign out
                </button>
              </div>
            ) : (
              <form onSubmit={handleSignIn} className='space-y-4'>
                <div>
                  <label className='mb-2 block text-sm font-bold text-slate-700'>
                    Email
                  </label>
                  <input
                    type='email'
                    value={accountEmail}
                    onChange={(event) => setAccountEmail(event.target.value)}
                    disabled={accountBusy}
                    className='w-full rounded-lg border border-slate-200 px-4 py-3 outline-none focus:border-slate-400'
                    placeholder='you@example.com'
                  />
                </div>

                <div>
                  <label className='mb-2 block text-sm font-bold text-slate-700'>
                    Code
                  </label>
                  <input
                    inputMode='numeric'
                    value={accountCode}
                    onChange={(event) => setAccountCode(event.target.value)}
                    disabled={accountBusy}
                    className='w-full rounded-lg border border-slate-200 px-4 py-3 text-lg font-bold tracking-[0.2em] outline-none focus:border-slate-400'
                    placeholder='000000'
                  />
                </div>

                {accountError ? (
                  <div className='rounded-lg border border-red-100 bg-red-50 p-3 text-sm text-red-700'>
                    {accountError}
                  </div>
                ) : null}

                {accountMessage ? (
                  <div className='rounded-lg border border-emerald-100 bg-emerald-50 p-3 text-sm text-emerald-700'>
                    {accountMessage}
                  </div>
                ) : null}

                <button
                  type='submit'
                  disabled={accountBusy}
                  className='w-full rounded-lg bg-slate-950 px-4 py-3 text-sm font-bold text-white hover:bg-slate-800'
                >
                  {accountBusy
                    ? 'Checking...'
                    : accountCode.trim()
                      ? 'Verify code'
                      : 'Send code'}
                </button>

                {codeSent ? (
                  <button
                    type='button'
                    onClick={requestSignInCode}
                    disabled={accountBusy}
                    className='w-full rounded-lg border border-slate-200 px-4 py-3 text-sm font-bold text-slate-700 hover:bg-slate-50'
                  >
                    Send a new code
                  </button>
                ) : null}
              </form>
            )}

            <div className='my-5 border-t border-slate-100' />

            <div className='rounded-lg bg-slate-50 p-4'>
              <div className='flex items-center justify-between'>
                <div>
                  <p className='text-sm font-bold'>Version</p>
                  <p className='text-xs text-slate-500'>v{appVersion || '...'}</p>
                </div>
                <div className='text-xs text-slate-500'>
                  {updateStatus === 'checking' && 'Checking...'}
                  {updateStatus === 'available' && 'Downloading...'}
                  {updateStatus === 'downloaded' && 'Ready'}
                  {updateStatus === 'not-available' && 'Up to date'}
                  {updateStatus === 'error' && 'Check failed'}
                </div>
              </div>
              <button
                onClick={
                  updateStatus === 'downloaded'
                    ? handleRestart
                    : handleCheckForUpdates
                }
                className='mt-4 flex w-full items-center justify-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-100'
              >
                {updateStatus === 'downloaded' ? (
                  <Download size={15} />
                ) : (
                  <RefreshCw
                    size={15}
                    className={updateStatus === 'checking' ? 'animate-spin' : ''}
                  />
                )}
                {updateStatus === 'downloaded' ? 'Restart & update' : 'Check updates'}
              </button>
            </div>
          </div>
        </div>
      )}

      {updateStatus !== 'none' &&
        !updateDismissed &&
        updateStatus !== 'not-available' &&
        updateStatus !== 'error' &&
        updateStatus !== 'checking' && (
          <div className='fixed bottom-4 right-4 z-50 max-w-sm rounded-lg border border-slate-200 bg-white p-4 shadow-xl'>
            <div className='flex items-start gap-3'>
              <Download size={22} className='mt-1 text-slate-700' />
              <div className='flex-1'>
                <h4 className='font-bold'>
                  {updateStatus === 'available' ? 'Update available' : 'Update ready'}
                </h4>
                <p className='mt-1 text-sm text-slate-500'>
                  {updateStatus === 'available'
                    ? 'A new version is downloading.'
                    : 'Restart to install the new version.'}
                </p>
                {updateStatus === 'downloaded' && (
                  <button
                    onClick={handleRestart}
                    className='mt-3 w-full rounded-lg bg-slate-950 px-4 py-2 text-sm font-bold text-white'
                  >
                    Restart & update
                  </button>
                )}
              </div>
              <button
                onClick={() => {
                  setUpdateDismissed(true);
                  const version = downloadedVersion || appVersion;
                  localStorage.setItem(STORAGE_KEYS.dismissedUpdateVersion, version);
                }}
                className='text-slate-400 hover:text-slate-700'
              >
                <X size={16} />
              </button>
            </div>
          </div>
        )}
    </div>
  );
}

export default App;
