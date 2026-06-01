import { Check, Copy } from 'lucide-react';

type TranslationActionsProps = {
  text: string;
  copied: boolean;
  onCopy: () => void;
};

export const TranslationActions = ({
  text,
  copied,
  onCopy,
}: TranslationActionsProps) => (
  <button
    type='button'
    onClick={onCopy}
    disabled={!text.trim()}
    className={`inline-flex h-10 items-center gap-2 rounded-md px-3 text-sm font-semibold transition-colors ${
      text.trim()
        ? 'bg-slate-950 text-white hover:bg-slate-800'
        : 'bg-slate-100 text-slate-400'
    }`}
    title='Copy panel text'
  >
    {copied ? <Check size={16} /> : <Copy size={16} />}
    {copied ? 'Copied' : 'Copy'}
  </button>
);
