import {
  type LanguageCode,
} from '@entity-builders/flowtranslate-core';
import { ArrowLeft, ArrowRight, Loader2 } from 'lucide-react';

type TranslateCommandProps = {
  sourceLanguage: LanguageCode;
  targetLanguage: LanguageCode;
  status: 'idle' | 'typing' | 'translating' | 'copied' | 'error' | 'offline' | 'quota' | 'auth';
  canTranslate: boolean;
  disabledReason: string;
  hasPendingChanges: boolean;
  onTranslate: () => void;
};

const languageLabels: Record<LanguageCode, string> = {
  es: 'Espanol',
  en: 'Ingles',
};

export const TranslateCommand = ({
  sourceLanguage,
  targetLanguage,
  status,
  canTranslate,
  disabledReason,
  hasPendingChanges,
  onTranslate,
}: TranslateCommandProps) => {
  const sourceLabel = languageLabels[sourceLanguage];
  const targetLabel = languageLabels[targetLanguage];
  const DirectionIcon = sourceLanguage === 'es' ? ArrowRight : ArrowLeft;
  const isTranslating = status === 'translating';
  const helperText = isTranslating
    ? 'Generando'
    : canTranslate
      ? hasPendingChanges
        ? 'Listo'
        : 'Actualizado'
      : disabledReason;

  return (
    <div className='sticky top-3 z-10 flex items-center justify-center bg-slate-50 py-1 lg:static lg:h-full lg:bg-transparent lg:py-0'>
      <div className='flex w-full max-w-[18rem] flex-col items-center gap-2 sm:max-w-xs lg:max-w-none'>
        <button
          type='button'
          onClick={onTranslate}
          disabled={!canTranslate}
          className={`inline-flex min-h-14 w-full items-center justify-center gap-2 rounded-md px-4 text-sm font-bold transition-colors lg:min-h-16 lg:flex-col lg:px-3 ${
            canTranslate
              ? 'bg-slate-950 text-white hover:bg-slate-800'
              : 'bg-slate-200 text-slate-500'
          }`}
          aria-label={`Generar de ${sourceLabel} a ${targetLabel}`}
          title={
            canTranslate
              ? `Generar de ${sourceLabel} a ${targetLabel}`
              : disabledReason
          }
        >
          {isTranslating ? (
            <Loader2 size={18} className='animate-spin' />
          ) : (
            <DirectionIcon size={18} />
          )}
          <span>{isTranslating ? 'Generando' : 'Generar'}</span>
          <span className='text-xs font-semibold opacity-80'>
            {sourceLanguage.toUpperCase()} a {targetLanguage.toUpperCase()}
          </span>
        </button>
        <p className='min-h-4 max-w-full truncate text-center text-xs font-semibold text-slate-500'>
          {helperText}
        </p>
      </div>
    </div>
  );
};
