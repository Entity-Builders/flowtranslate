import type { LanguageCode } from '@eb-packages/flowtranslate-core';
import { TranslationActions } from './TranslationActions';

type TranslatorPanelProps = {
  language: LanguageCode;
  label: string;
  text: string;
  isSource: boolean;
  placeholder: string;
  copied: boolean;
  statusText?: string;
  onChange: (value: string) => void;
  onPaste: (value: string) => void;
  onCopy: () => void;
};

export const TranslatorPanel = ({
  label,
  text,
  isSource,
  placeholder,
  copied,
  statusText,
  onChange,
  onPaste,
  onCopy,
}: TranslatorPanelProps) => (
  <section className='flex min-h-[420px] flex-col border border-slate-200 bg-white'>
    <div className='flex min-h-16 items-center justify-between gap-3 border-b border-slate-100 px-4 py-3'>
      <div className='min-w-0'>
        <h2 className='text-base font-bold text-slate-950'>{label}</h2>
        <p className='mt-1 text-xs font-semibold uppercase tracking-normal text-slate-500'>
          {isSource ? 'Source' : 'Target'}
        </p>
      </div>
      <TranslationActions text={text} copied={copied} onCopy={onCopy} />
    </div>

    <textarea
      value={text}
      onChange={(event) => onChange(event.target.value)}
      onPaste={(event) => {
        const pastedText = event.clipboardData.getData('text');
        if (pastedText) {
          event.preventDefault();
          onPaste(`${text}${pastedText}`);
        }
      }}
      placeholder={placeholder}
      className='min-h-0 flex-1 resize-none bg-transparent p-5 text-xl leading-relaxed text-slate-900 outline-none placeholder:text-slate-300'
      spellCheck
    />

    <div className='min-h-12 border-t border-slate-100 px-4 py-3 text-sm text-slate-500'>
      {statusText || `${text.trim().length} characters`}
    </div>
  </section>
);
