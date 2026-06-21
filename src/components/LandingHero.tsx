import { useState } from 'react';
import { ArrowRight, Check, Copy } from 'lucide-react';

export type LandingExample = {
  id: string;
  label: string;
  channel: string;
  context: string;
  rawInput: string;
  output: string;
};

type LandingHeroProps = {
  examples: LandingExample[];
};

const heroExampleFallback: LandingExample = {
  id: 'hero-default',
  label: 'Reagendar call',
  channel: 'Slack',
  context: 'Reunión de trabajo',
  rawInput:
    'No puedo llegar a la call de mañana, algo surgió. Can we move it to Thursday?',
  output:
    "Hi — something came up and I won't be able to make tomorrow's call. Would Thursday work for you? Happy to find whatever time fits.",
};

export const LandingHero = ({
  examples,
}: LandingHeroProps) => {
  const [selectedExample, setSelectedExample] = useState(
    examples[0] ?? heroExampleFallback,
  );
  const [inputText, setInputText] = useState(selectedExample.rawInput);
  const [outputVisible, setOutputVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const loadExample = (example: LandingExample) => {
    setSelectedExample(example);
    setInputText(example.rawInput);
    setOutputVisible(false);
    setCopied(false);
  };

  const handleInputChange = (value: string) => {
    setInputText(value);
    setOutputVisible(false);
    setCopied(false);
  };

  const handleConvert = () => {
    if (!inputText.trim()) return;
    setOutputVisible(true);
    setCopied(false);
  };

  const handleCopy = () => {
    void navigator.clipboard?.writeText(selectedExample.output);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <section className='mx-auto max-w-5xl px-5 pb-10 pt-12'>
        <div className='mb-8 max-w-2xl'>
          <p className='mb-3 text-xs font-semibold uppercase tracking-widest text-emerald-600'>
            Para profesionales que trabajan en inglés
          </p>
          <h1 className='mb-4 text-3xl font-bold leading-tight tracking-normal text-slate-950 sm:text-4xl'>
            Tu idea en español.
            <br />
            La respuesta en inglés profesional.
          </h1>
          <p className='text-base font-medium leading-7 text-slate-600'>
            Escribí como te salga — en español, en spanglish, o en inglés
            inseguro. FlowTranslate lo convierte en un mensaje listo para
            enviar.
          </p>
        </div>

        <div className='rounded-lg border border-slate-200 bg-white p-5 shadow-sm sm:p-6'>
          <div className='space-y-3'>
            <div className='flex flex-wrap gap-1.5'>
              {examples.slice(0, 5).map((example) => (
                <button
                  key={example.id}
                  type='button'
                  onClick={() => loadExample(example)}
                  className={`rounded border px-3 py-1.5 text-xs font-medium transition-colors ${
                    example.id === selectedExample.id
                      ? 'border-slate-950 bg-slate-950 text-white'
                      : 'border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-950'
                  }`}
                >
                  {example.label}
                </button>
              ))}
            </div>

            <textarea
              aria-label='Mensaje del demo'
              value={inputText}
              onChange={(event) => handleInputChange(event.target.value)}
              placeholder='Escribí tu idea como te salga — en español, en spanglish, o en inglés inseguro...'
              rows={4}
              className='w-full resize-none rounded border border-slate-200 bg-white px-4 py-3 text-sm font-medium leading-6 text-slate-800 transition-shadow placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-950/15'
            />

            <button
              type='button'
              onClick={handleConvert}
              disabled={!inputText.trim()}
              className='inline-flex items-center justify-center gap-2 rounded bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-40'
            >
              Convertir a inglés profesional
              <ArrowRight size={14} />
            </button>

            {outputVisible && (
              <div className='overflow-hidden rounded border border-slate-200 bg-white'>
                <div className='flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-2.5'>
                  <span className='text-[11px] font-semibold uppercase tracking-widest text-slate-500'>
                    Inglés profesional
                  </span>
                  <button
                    type='button'
                    onClick={handleCopy}
                    className='flex items-center gap-1.5 text-xs font-medium text-slate-500 transition-colors hover:text-slate-950'
                  >
                    {copied ? (
                      <Check size={13} className='text-emerald-600' />
                    ) : (
                      <Copy size={13} />
                    )}
                    {copied ? 'Copiado' : 'Copiar'}
                  </button>
                </div>
                <p className='px-4 py-3.5 text-sm font-medium leading-6 text-slate-950'>
                  {selectedExample.output}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      <div className='mx-auto max-w-5xl px-5 pb-10'>
        <p className='text-xs font-medium leading-5 text-slate-500'>
          No traduce palabra por palabra.{' '}
          <span className='font-semibold text-slate-950'>
            Escribe el mensaje que vos mandarías si el inglés fuera tu idioma.
          </span>
        </p>
      </div>
    </>
  );
};
