import {
  EXPRESSION_MODE_LABELS,
  EXPRESSION_MODES,
  LANGUAGE_LABELS,
  type ExpressionBreakdown,
  type ExpressionMode,
  type IntentDetectionResult,
  type LanguageCode,
} from '@eb-packages/flowtranslate-core';
import {
  Loader2,
  MessageSquareText,
  Sparkles,
} from 'lucide-react';
import { ExpressionBreakdownDetails } from './ExpressionBreakdownDetails';
import { TranslationActions } from './TranslationActions';

type ExpressionWorkspaceStatus =
  | 'idle'
  | 'typing'
  | 'translating'
  | 'copied'
  | 'error'
  | 'offline'
  | 'quota'
  | 'auth';

type ExpressionWorkspaceProps = {
  inputText: string;
  resultText: string;
  mode: ExpressionMode;
  modeDetection: IntentDetectionResult;
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  breakdown: ExpressionBreakdown | null;
  status: ExpressionWorkspaceStatus;
  canTranslate: boolean;
  translateDisabledReason: string;
  copiedInput: boolean;
  copiedResult: boolean;
  canListen: boolean;
  speakingLanguage: LanguageCode | null;
  canDictate: boolean;
  dictatingLanguage: LanguageCode | null;
  dictationUnavailableReason: string;
  statusText?: string;
  onInputChange: (value: string) => void;
  onCopyInput: () => void;
  onCopyResult: () => void;
  onListenInput: () => void;
  onListenResult: () => void;
  onDictateInput: () => void;
  onTranslate: () => void;
  onSelectMode: (mode: ExpressionMode) => void;
  onTranslateToSpanish: () => void;
};

const modeDescriptions: Record<ExpressionMode, string> = {
  translate_to_english: 'Your Spanish idea as natural English',
  improve_english: 'Your English, cleaned up and more natural',
  translate_to_spanish: 'Incoming English explained in Spanish',
};

const confidenceLabel: Record<IntentDetectionResult['confidence'], string> = {
  high: 'high confidence',
  medium: 'medium confidence',
  low: 'needs confirmation',
};

const modeTone: Record<ExpressionMode, string> = {
  translate_to_english: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  improve_english: 'border-sky-200 bg-sky-50 text-sky-900',
  translate_to_spanish: 'border-amber-200 bg-amber-50 text-amber-900',
};

const resultPlaceholder = (mode: ExpressionMode) => {
  if (mode === 'translate_to_spanish') {
    return 'Paste incoming English and choose “Explain in Spanish” to understand it.';
  }

  if (mode === 'improve_english') {
    return 'Your improved English will appear here.';
  }

  return 'Your English expression will appear here.';
};

const detectionCopy = (
  mode: ExpressionMode,
  detection: IntentDetectionResult,
) => {
  const label = EXPRESSION_MODE_LABELS[mode];
  if (!detection.automatic) return `Mode: ${label}`;
  return `Detected ${label.toLowerCase()} with ${confidenceLabel[detection.confidence]}`;
};

export const ExpressionWorkspace = ({
  inputText,
  resultText,
  mode,
  modeDetection,
  sourceLanguage,
  targetLanguage,
  breakdown,
  status,
  canTranslate,
  translateDisabledReason,
  copiedInput,
  copiedResult,
  canListen,
  speakingLanguage,
  canDictate,
  dictatingLanguage,
  dictationUnavailableReason,
  statusText,
  onInputChange,
  onCopyInput,
  onCopyResult,
  onListenInput,
  onListenResult,
  onDictateInput,
  onTranslate,
  onSelectMode,
  onTranslateToSpanish,
}: ExpressionWorkspaceProps) => {
  const isTranslating = status === 'translating';

  return (
    <section className='grid w-full min-w-0 max-w-full grid-cols-1 gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)] lg:gap-4'>
      <div className='flex min-h-[360px] min-w-0 max-w-full flex-col border border-slate-200 bg-white sm:min-h-[420px] lg:min-h-0 lg:overflow-y-auto'>
        <div className='border-b border-slate-100 px-3 py-3 sm:px-5'>
          <div className='flex flex-wrap items-center justify-between gap-3'>
            <div className='min-w-0'>
              <h2 className='text-base font-black text-slate-950'>Expression input</h2>
              <p className='mt-1 break-words text-xs font-semibold uppercase tracking-normal text-slate-500'>
                {LANGUAGE_LABELS[sourceLanguage]} source
              </p>
            </div>
            <TranslationActions
              text={inputText}
              copied={copiedInput}
              canListen={canListen}
              isSpeaking={speakingLanguage === sourceLanguage}
              canDictate={canDictate}
              isDictating={dictatingLanguage === sourceLanguage}
              dictationUnavailableReason={dictationUnavailableReason}
              onCopy={onCopyInput}
              onListen={onListenInput}
              onDictate={onDictateInput}
            />
          </div>

          <div className='mt-3 grid grid-cols-3 gap-1.5 sm:mt-4 sm:gap-2'>
            {EXPRESSION_MODES.map((item) => (
              <button
                key={item}
                type='button'
                onClick={() => onSelectMode(item)}
                aria-pressed={mode === item}
                className={`min-h-12 rounded-md border px-2 py-2 text-left transition-colors sm:min-h-16 sm:px-3 ${
                  mode === item
                    ? modeTone[item]
                    : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                <span className='block text-xs font-black leading-tight sm:text-sm'>
                  {EXPRESSION_MODE_LABELS[item]}
                </span>
                <span className='mt-1 hidden break-words text-xs font-semibold opacity-75 sm:block'>
                  {modeDescriptions[item]}
                </span>
              </button>
            ))}
          </div>
        </div>

        <textarea
          value={inputText}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') {
              event.preventDefault();
              if (canTranslate) onTranslate();
            }
          }}
          placeholder='Write Spanish to get English, or write English to improve it...'
          className='min-h-36 w-full min-w-0 flex-1 resize-none break-words bg-transparent p-4 text-lg leading-relaxed text-slate-900 outline-none [overflow-wrap:anywhere] placeholder:text-slate-300 sm:p-5 sm:text-xl'
          spellCheck
          aria-label='Expression input'
        />

        <div className='flex min-h-14 flex-col items-stretch justify-between gap-3 border-t border-slate-100 px-3 py-3 text-sm text-slate-500 sm:flex-row sm:items-center sm:px-4'>
          <span className='min-w-0 break-words font-semibold'>
            {statusText || detectionCopy(mode, modeDetection)}
          </span>
          <button
            type='button'
            onClick={onTranslate}
            disabled={!canTranslate}
            className={`inline-flex h-10 w-full items-center justify-center gap-2 rounded-md px-3 text-sm font-black transition-colors sm:w-auto ${
              canTranslate
                ? 'bg-slate-950 text-white hover:bg-slate-800'
                : 'bg-slate-100 text-slate-400'
            }`}
            title={canTranslate ? 'Generate expression' : translateDisabledReason}
          >
            {isTranslating ? (
              <Loader2 size={16} className='animate-spin' />
            ) : (
              <Sparkles size={16} />
            )}
            {isTranslating ? 'Generating' : 'Generate'}
          </button>
        </div>
      </div>

      <div className='flex min-h-[320px] min-w-0 max-w-full flex-col border border-slate-200 bg-white sm:min-h-[420px] lg:min-h-0 lg:overflow-y-auto'>
        <div className='flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-3 py-3 sm:px-5'>
          <div className='min-w-0'>
            <h2 className='text-base font-black text-slate-950'>Result</h2>
            <p className='mt-1 text-xs font-semibold uppercase tracking-normal text-slate-500'>
              {LANGUAGE_LABELS[targetLanguage]} output
            </p>
          </div>
          <div className='flex w-full min-w-0 flex-wrap items-center gap-2 sm:w-auto sm:justify-end'>
            <button
              type='button'
              onClick={onTranslateToSpanish}
              disabled={!inputText.trim() || isTranslating}
              className={`inline-flex h-10 items-center gap-2 rounded-md border px-3 text-sm font-bold transition-colors ${
                inputText.trim() && !isTranslating
                  ? 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100'
                  : 'border-slate-100 bg-slate-50 text-slate-300'
              }`}
              title='Explain incoming English in Spanish'
            >
              <MessageSquareText size={16} />
              Spanish
            </button>
            <TranslationActions
              text={resultText}
              copied={copiedResult}
              canListen={canListen}
              isSpeaking={speakingLanguage === targetLanguage}
              canDictate={false}
              showDictate={false}
              isDictating={false}
              dictationUnavailableReason={dictationUnavailableReason}
              onCopy={onCopyResult}
              onListen={onListenResult}
              onDictate={() => undefined}
            />
          </div>
        </div>

        <div className='min-h-40 min-w-0 max-w-full flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 lg:min-h-[14rem]'>
          {resultText.trim() ? (
            <p className='max-w-full break-words text-xl font-black leading-[1.16] text-slate-950 [overflow-wrap:anywhere] sm:text-3xl xl:text-[2.125rem]'>
              {resultText}
            </p>
          ) : (
            <div className='flex h-full min-h-36 items-center rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-semibold leading-6 text-slate-500'>
              {resultPlaceholder(mode)}
            </div>
          )}
        </div>

        <ExpressionBreakdownDetails breakdown={breakdown} />
      </div>
    </section>
  );
};
