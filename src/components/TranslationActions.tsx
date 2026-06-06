import { Check, Copy, Mic, MicOff, Square, Volume2 } from 'lucide-react';

type TranslationActionsProps = {
  text: string;
  copied: boolean;
  onCopy: () => void;
  canListen: boolean;
  isSpeaking: boolean;
  onListen: () => void;
  showDictate?: boolean;
  canDictate: boolean;
  isDictating: boolean;
  dictationUnavailableReason: string;
  onDictate: () => void;
};

export const TranslationActions = ({
  text,
  copied,
  onCopy,
  canListen,
  isSpeaking,
  onListen,
  showDictate = true,
  canDictate,
  isDictating,
  dictationUnavailableReason,
  onDictate,
}: TranslationActionsProps) => (
  <div className='flex w-full min-w-0 shrink-0 flex-wrap items-center justify-start gap-2 sm:w-auto sm:justify-end'>
    {canListen ? (
      <button
        type='button'
        onClick={onListen}
        disabled={!text.trim()}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
          text.trim()
            ? 'border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-950'
            : 'border border-slate-100 text-slate-300'
        }`}
        aria-label={isSpeaking ? 'Stop audio playback' : 'Listen to panel text'}
        title={isSpeaking ? 'Stop audio playback' : 'Listen to panel text'}
      >
        {isSpeaking ? <Square size={16} /> : <Volume2 size={17} />}
      </button>
    ) : null}

    {showDictate ? (
      <button
        type='button'
        onClick={onDictate}
        disabled={!canDictate}
        className={`inline-flex h-10 w-10 items-center justify-center rounded-md transition-colors ${
          canDictate
            ? isDictating
              ? 'bg-rose-600 text-white hover:bg-rose-500'
              : 'border border-slate-200 text-slate-600 hover:border-slate-300 hover:text-slate-950'
            : 'border border-slate-100 text-slate-300'
        }`}
        aria-label={
          canDictate
            ? isDictating
              ? 'Stop microphone dictation'
              : 'Start microphone dictation'
            : 'Microphone dictation unavailable'
        }
        title={canDictate ? 'Microphone dictation' : dictationUnavailableReason}
      >
        {canDictate ? <Mic size={17} /> : <MicOff size={17} />}
      </button>
    ) : null}

    <button
      type='button'
      onClick={onCopy}
      disabled={!text.trim()}
      className={`inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors ${
        text.trim()
          ? 'bg-slate-950 text-white hover:bg-slate-800'
          : 'bg-slate-100 text-slate-400'
      }`}
      aria-label={copied ? 'Copy panel text copied' : 'Copy panel text'}
      title='Copy panel text'
    >
      {copied ? <Check size={16} /> : <Copy size={16} />}
      <span className='hidden sm:inline'>{copied ? 'Copied' : 'Copy'}</span>
    </button>
  </div>
);
