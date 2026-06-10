import {
  TRANSLATION_PRESETS,
  type TranslationPresetId,
} from '@eb-packages/flowtranslate-core';
import { SlidersHorizontal } from 'lucide-react';

type TranslationPresetControlProps = {
  value: TranslationPresetId;
  onChange: (value: TranslationPresetId) => void;
};

export const TranslationPresetControl = ({
  value,
  onChange,
}: TranslationPresetControlProps) => (
  <label className='inline-flex w-full min-w-0 max-w-full items-center gap-2 rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 sm:w-auto'>
    <SlidersHorizontal size={16} className='shrink-0 text-slate-400' />
    <span className='shrink-0 text-xs font-bold uppercase text-slate-400'>
      Tone
    </span>
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as TranslationPresetId)}
      className='min-w-0 flex-1 bg-transparent text-sm font-bold text-slate-800 outline-none sm:flex-none'
      aria-label='Translation tone'
    >
      {TRANSLATION_PRESETS.map((preset) => (
        <option key={preset.id} value={preset.id}>
          {preset.label}
        </option>
      ))}
    </select>
  </label>
);
