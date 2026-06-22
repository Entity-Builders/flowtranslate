import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import type { StudyArticle, TranslationRecord } from '@eb-packages/flowtranslate-core';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import App from '../App';
import { ExpressionBreakdownDetails } from '../components/ExpressionBreakdownDetails';
import { ExpressionWorkspace } from '../components/ExpressionWorkspace';
import { LearningView } from '../components/LearningView';
import { StudyArticleView } from '../components/StudyArticleView';

const renderLearningView = (
  props: Partial<ComponentProps<typeof LearningView>> = {},
) => {
  const defaultProps: ComponentProps<typeof LearningView> = {
    history: [],
    accountKind: 'permanent',
  };

  return render(<LearningView {...defaultProps} {...props} />);
};

const historyWithBreakdown: TranslationRecord[] = [
  {
    id: 'record-1',
    sourceLanguage: 'es',
    targetLanguage: 'en',
    sourceText: 'Ellos van a comer en el restaurante',
    translatedText: 'They are going to eat at the restaurant.',
    mode: 'translate_to_english',
    createdAt: '2026-06-05T12:00:00.000Z',
    breakdown: {
      changed: true,
      confidence: 'high',
      feedback: ['La version usa una estructura natural de plan futuro.'],
      tense: 'Near future',
      structure: [
        {
          text: 'They',
          role: 'subject',
          note: 'Quien hace la accion.',
        },
        {
          text: 'are going to eat',
          role: 'verb',
          note: 'Plan futuro cercano.',
        },
        {
          text: 'at the restaurant',
          role: 'complement',
          note: 'Lugar donde pasa la accion.',
        },
      ],
      whyThisWorks:
        'Going to funciona bien para planes concretos que ya estan decididos.',
    },
  },
  {
    id: 'record-2',
    sourceLanguage: 'es',
    targetLanguage: 'en',
    sourceText: 'Necesito revisar esto antes de mandarlo',
    translatedText: 'I need to review this before sending it.',
    mode: 'translate_to_english',
    createdAt: '2026-06-05T13:00:00.000Z',
    breakdown: null,
  },
  {
    id: 'record-3',
    sourceLanguage: 'en',
    targetLanguage: 'en',
    sourceText: 'I need review this before send it.',
    translatedText: 'I need to review this before sending it.',
    mode: 'improve_english',
    createdAt: '2026-06-05T14:00:00.000Z',
    breakdown: {
      changed: true,
      confidence: 'high',
      feedback: ["Después de 'need' va 'to + verb': 'need to review'."],
      whatWentWell:
        "La intención es clara y elegiste bien 'need' para expresar necesidad.",
      commonMistake:
        "Después de 'need' va 'to + verb': 'need to review'.",
      whyThisWorks:
        'En inglés, algunos verbos necesitan una forma fija después.',
      reusablePattern: 'I need to + verb + before + -ing.',
    },
  },
];

describe('learning UI', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
  });

  it('keeps Learning in a separate view with empty history state', () => {
    render(<App />);

    const mainNav = screen.getByRole('navigation', {
      name: /flowtranslate/i,
    });
    expect(
      within(mainNav).getByRole('button', { name: /responder/i }),
    ).toBeInTheDocument();
    expect(screen.getByTitle('Cuenta')).toBeInTheDocument();

    fireEvent.click(within(mainNav).getByRole('button', { name: /historial/i }));

    expect(window.location.pathname).toBe('/aprender');
    expect(screen.getByText('Historial de traducciones')).toBeInTheDocument();
    expect(
      screen.getByText(/va a aparecer acá con el texto original/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Panel de Learning' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Recommended exercises' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Practice' }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Empezar practica')).not.toBeInTheDocument();

    fireEvent.click(within(mainNav).getByRole('button', { name: /responder/i }));

    expect(window.location.pathname).toBe('/');
    expect(screen.getByLabelText('Mensaje o idea')).toBeInTheDocument();
  });

  it('opens Aprender from the canonical route', () => {
    window.history.replaceState({}, '', '/aprender');

    render(<App />);

    expect(window.location.pathname).toBe('/aprender');
    expect(screen.getByText('Historial de traducciones')).toBeInTheDocument();
  });

  it('normalizes the English Learning alias to Aprender', async () => {
    window.history.replaceState({}, '', '/learning');

    render(<App />);

    expect(screen.getByText('Historial de traducciones')).toBeInTheDocument();
    await waitFor(() => expect(window.location.pathname).toBe('/aprender'));
  });

  it('renders saved translation history with source text visible', () => {
    renderLearningView({ history: historyWithBreakdown });

    expect(screen.getByText('Historial de traducciones')).toBeInTheDocument();
    expect(
      screen.getByText('Ellos van a comer en el restaurante'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('They are going to eat at the restaurant.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Traducciones')).toBeInTheDocument();
    expect(screen.queryByText('Tus practicas')).not.toBeInTheDocument();
    expect(screen.queryByText('Frases guardadas')).not.toBeInTheDocument();
    expect(screen.queryByText('Empezar practica')).not.toBeInTheDocument();
  });

  it('toggles grammar labels and shows tense information for saved breakdowns', () => {
    renderLearningView({ history: historyWithBreakdown });

    expect(screen.queryByText('Tiempo: Near future')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: /ver análisis gramatical de traducción record-1/i,
      }),
    );

    expect(screen.getByText('Tiempo: Near future')).toBeInTheDocument();
    fireEvent.mouseEnter(screen.getByText('They'));

    expect(screen.getByRole('tooltip')).toHaveTextContent('Sujeto');
    expect(screen.getByRole('tooltip')).toHaveTextContent(
      'Quien hace la accion.',
    );

    fireEvent.click(
      screen.getByRole('button', {
        name: /ocultar análisis gramatical de traducción record-1/i,
      }),
    );

    expect(screen.queryByText('Tiempo: Near future')).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole('button', {
        name: /ver análisis gramatical de traducción record-1/i,
      }),
    );

    expect(screen.getByText('Tiempo: Near future')).toBeInTheDocument();
  });

  it('omits the grammar control when a saved translation has no breakdown', () => {
    renderLearningView({ history: historyWithBreakdown });

    expect(
      screen.queryByRole('button', {
        name: /ver análisis gramatical de traducción record-2/i,
      }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByText('I need to review this before sending it.'),
    ).toBeInTheDocument();
  });

  it('renders English attempts with diff and focused feedback', () => {
    renderLearningView({ history: historyWithBreakdown });

    expect(screen.getByText('Inglés corregido')).toBeInTheDocument();
    expect(screen.getByText('Tu intento')).toBeInTheDocument();
    expect(
      screen.getByText('I need review this before send it.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Versión más natural')).toBeInTheDocument();
    expect(screen.getByText('to')).toHaveClass('text-emerald-700');
    expect(screen.getByText('send')).toHaveClass('line-through');
    expect(screen.getByText('sending')).toHaveClass('text-emerald-700');

    fireEvent.click(
      screen.getByRole('button', { name: /aprende de este intento/i }),
    );

    expect(screen.getByText('Qué hiciste bien')).toBeInTheDocument();
    expect(
      screen.getByText(/La intención es clara y elegiste bien 'need'/i),
    ).toBeInTheDocument();
    expect(screen.getByText('Ajuste clave')).toBeInTheDocument();
    expect(
      screen.getByText("Después de 'need' va 'to + verb': 'need to review'."),
    ).toBeInTheDocument();
    expect(screen.getByText('Por qué importa')).toBeInTheDocument();
    expect(screen.getByText('Patrón para reutilizar')).toBeInTheDocument();
    expect(
      screen.getByText('I need to + verb + before + -ing.'),
    ).toBeInTheDocument();
  });

  it('keeps corrective feedback out of what went well', () => {
    renderLearningView({
      history: [
        {
          id: 'record-correction-only',
          sourceLanguage: 'en',
          targetLanguage: 'en',
          sourceText: 'Poor messi, He loss a penalty.',
          translatedText: 'Poor Messi, he missed a penalty.',
          mode: 'improve_english',
          createdAt: '2026-06-05T15:00:00.000Z',
          breakdown: {
            changed: true,
            confidence: 'high',
            feedback: [
              "El uso de 'loss' como verbo es incorrecto; se usó correctamente 'missed'.",
            ],
            whyThisWorks:
              "El verbo correcto para fallar una oportunidad es 'to miss'.",
            reusablePattern: 'Subject + missed + object',
          },
        },
      ],
    });

    fireEvent.click(
      screen.getByRole('button', { name: /aprende de este intento/i }),
    );

    const wellDoneSection = screen
      .getByText('Qué hiciste bien')
      .closest('div');
    const issueSection = screen.getByText('Ajuste clave').closest('div');

    expect(wellDoneSection).toHaveTextContent(
      'La intención se entiende y ya estás construyendo la idea en inglés.',
    );
    expect(wellDoneSection).not.toHaveTextContent(
      "El uso de 'loss' como verbo es incorrecto",
    );
    expect(issueSection).toHaveTextContent(
      "El uso de 'loss' como verbo es incorrecto",
    );
  });

  it('uses Spanglish-specific fallback feedback', () => {
    renderLearningView({
      history: [
        {
          id: 'record-spanglish',
          sourceLanguage: 'en',
          targetLanguage: 'en',
          sourceText:
            'Sorry, hoy no llego a la call. Can we move it to tomorrow same time?',
          translatedText:
            "Sorry, I can't make it to the call today. Can we move it to tomorrow at the same time?",
          mode: 'improve_english',
          createdAt: '2026-06-05T16:00:00.000Z',
          breakdown: {
            changed: true,
            confidence: 'high',
            feedback: [],
            reusablePattern: "I can't make it to + event + today.",
          },
        },
      ],
    });

    fireEvent.click(
      screen.getByRole('button', { name: /aprende de este intento/i }),
    );

    expect(
      screen.getByText(/Ya combinaste una disculpa y una propuesta concreta/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Convertí los fragmentos en español/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/En Spanglish la idea ya está clara/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText("I can't make it to + event + today."),
    ).toBeInTheDocument();
  });

  it('lets users copy history records without responder or delete actions', () => {
    renderLearningView({ history: historyWithBreakdown });

    fireEvent.click(screen.getAllByRole('button', { name: 'Copiar' })[0]);

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      'They are going to eat at the restaurant.',
    );
    expect(
      screen.queryByRole('button', { name: /usar en responder/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /borrar/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /limpiar/i }),
    ).not.toBeInTheDocument();
  });

  it('renders multiple tense notes when a phrase mixes clauses', () => {
    render(
      <ExpressionBreakdownDetails
        defaultOpen
        breakdown={{
          changed: true,
          confidence: 'high',
          feedback: ['Se separan el estado pasado y la peticion actual.'],
          tense: 'Past continuous + modal request',
          tenses: [
            {
              label: 'Past continuous',
              text: 'was freezing',
              note: 'Describe una situacion en progreso durante la noche anterior.',
            },
            {
              label: 'Modal request',
              text: 'can we turn up',
              note: 'Usa can para pedir permiso o proponer una accion para esta noche.',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('Tiempos')).toBeInTheDocument();
    expect(screen.getByText('Past continuous')).toBeInTheDocument();
    expect(screen.getByText('was freezing')).toBeInTheDocument();
    expect(screen.getByText('Modal request')).toBeInTheDocument();
    expect(screen.getByText('can we turn up')).toBeInTheDocument();
  });

  it('shows an empty on-demand breakdown state before enrichment', () => {
    render(
      <ExpressionBreakdownDetails
        defaultOpen
        breakdown={null}
        emptyDescription='Abrilo para preparar un desglose completo.'
      />,
    );

    expect(screen.getByText('Desglose')).toBeInTheDocument();
    expect(
      screen.getByText('Abrilo para preparar un desglose completo.'),
    ).toBeInTheDocument();
  });

  it('shows the on-demand breakdown loading state', () => {
    render(
      <ExpressionBreakdownDetails defaultOpen breakdown={null} isEnriching />,
    );

    expect(screen.getByText('Preparando desglose...')).toBeInTheDocument();
  });

  it('requests on-demand breakdown when the panel opens', () => {
    const requestBreakdown = vi.fn();

    render(
      <ExpressionBreakdownDetails breakdown={null} onOpen={requestBreakdown} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Desglose' }));

    expect(requestBreakdown).toHaveBeenCalledTimes(1);
  });

  it('keeps Desglose open while enrichment state changes', () => {
    const richBreakdown = {
      changed: true,
      confidence: 'high' as const,
      feedback: ['Listo.'],
      tenses: [
        {
          label: 'Simple present',
          text: 'need',
          note: 'Describe una necesidad actual.',
        },
      ],
      structure: [
        {
          text: 'I need help',
          role: 'other' as const,
          note: 'Frase completa.',
        },
      ],
    };
    const requestBreakdown = vi.fn();
    const { rerender } = render(
      <ExpressionBreakdownDetails breakdown={null} onOpen={requestBreakdown} />,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Desglose' }));

    expect(requestBreakdown).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Desglose' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    rerender(
      <ExpressionBreakdownDetails
        breakdown={null}
        isEnriching
        onOpen={requestBreakdown}
      />,
    );
    expect(screen.getByRole('button', { name: 'Desglose' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('Preparando desglose...')).toBeInTheDocument();

    rerender(
      <ExpressionBreakdownDetails
        breakdown={richBreakdown}
        onOpen={requestBreakdown}
      />,
    );
    expect(screen.getByRole('button', { name: /desglose/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('Simple present')).toBeInTheDocument();
  });

  it('requests Desglose after the translation record arrives if it was already open', async () => {
    const requestBreakdown = vi.fn();
    const noop = () => undefined;
    const baseProps = {
      inputText: 'Creo que necesito ayuda',
      resultText: '',
      mode: 'translate_to_english' as const,
      modeDetection: {
        mode: 'translate_to_english' as const,
        confidence: 'high' as const,
        reason: 'spanish' as const,
        automatic: true,
      },
      sourceLanguage: 'es' as const,
      targetLanguage: 'en' as const,
      presetId: 'natural' as const,
      breakdown: null,
      breakdownStatus: 'idle' as const,
      translationRecordId: '',
      status: 'translating' as const,
      canTranslate: false,
      translateDisabledReason: 'Generando',
      copiedInput: false,
      copiedResult: false,
      canListen: false,
      speakingLanguage: null,
      canDictate: false,
      dictatingLanguage: null,
      dictationUnavailableReason: 'No disponible',
      onInputChange: noop,
      onCopyInput: noop,
      onCopyResult: noop,
      onListenInput: noop,
      onListenResult: noop,
      onDictateInput: noop,
      onTranslate: noop,
      onSelectPreset: noop,
      onRequestBreakdown: requestBreakdown,
      onTranslateToSpanish: noop,
      hasSeenResponderPromise: false,
    };

    const { rerender } = render(<ExpressionWorkspace {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Desglose' }));

    expect(requestBreakdown).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Desglose' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );

    rerender(
      <ExpressionWorkspace
        {...baseProps}
        resultText='I think I need help.'
        translationRecordId='record-1'
        status='idle'
        canTranslate
        translateDisabledReason=''
      />,
    );

    await waitFor(() => expect(requestBreakdown).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: 'Desglose' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('does not repeat the mobile result text when the result sheet is open or collapsed', async () => {
    const noop = () => undefined;
    const resultText =
      'Thanks for reaching out. Your proposal sounds really interesting.';

    render(
      <ExpressionWorkspace
        inputText='Gracias por escribir, me interesa la propuesta.'
        resultText={resultText}
        mode='translate_to_english'
        modeDetection={{
          mode: 'translate_to_english',
          confidence: 'high',
          reason: 'spanish',
          automatic: true,
        }}
        sourceLanguage='es'
        targetLanguage='en'
        presetId='natural'
        breakdown={null}
        breakdownStatus='idle'
        translationRecordId='record-1'
        status='idle'
        canTranslate
        translateDisabledReason=''
        copiedInput={false}
        copiedResult={false}
        canListen={false}
        speakingLanguage={null}
        canDictate={false}
        dictatingLanguage={null}
        dictationUnavailableReason='No disponible'
        onInputChange={noop}
        onCopyInput={noop}
        onCopyResult={noop}
        onListenInput={noop}
        onListenResult={noop}
        onDictateInput={noop}
        onTranslate={noop}
        onSelectPreset={noop}
        onRequestBreakdown={noop}
        onTranslateToSpanish={noop}
        hasSeenResponderPromise={false}
      />,
    );

    const mobileSheet = document.querySelector('[aria-live="polite"]');
    expect(mobileSheet).toBeTruthy();

    await waitFor(() =>
      expect(
        within(mobileSheet as HTMLElement).getByText('Listo para mandar'),
      ).toBeInTheDocument(),
    );
    expect(
      within(mobileSheet as HTMLElement).queryByText('Respuesta en ingles'),
    ).not.toBeInTheDocument();
    expect(
      within(mobileSheet as HTMLElement).getAllByText(resultText),
    ).toHaveLength(1);
    expect(
      within(mobileSheet as HTMLElement).getByRole('button', {
        name: /ver respuesta completa/i,
      }),
    ).toBeInTheDocument();
    expect(
      within(mobileSheet as HTMLElement).getByRole('button', {
        name: 'Copiar',
      }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Desglose' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );

    fireEvent.click(
      within(mobileSheet as HTMLElement).getByRole('button', {
        name: /ver respuesta completa/i,
      }),
    );

    expect(
      within(mobileSheet as HTMLElement).getAllByText(resultText),
    ).toHaveLength(1);
    expect(
      within(mobileSheet as HTMLElement).getByRole('button', {
        name: /abrir desglose movil/i,
      }),
    ).toBeInTheDocument();
    expect(
      within(mobileSheet as HTMLElement).getByRole('button', {
        name: /estudiar/i,
      }),
    ).toBeInTheDocument();
    expect(
      within(mobileSheet as HTMLElement).queryByRole('button', {
        name: /^ES$/i,
      }),
    ).not.toBeInTheDocument();
  });

  it('shows active loading copy and skeletons while translating', () => {
    const noop = () => undefined;

    render(
      <ExpressionWorkspace
        inputText='Decile que necesito revisar esto.'
        resultText=''
        mode='translate_to_english'
        modeDetection={{
          mode: 'translate_to_english',
          confidence: 'high',
          reason: 'spanish',
          automatic: true,
        }}
        sourceLanguage='es'
        targetLanguage='en'
        presetId='natural'
        breakdown={null}
        breakdownStatus='idle'
        translationRecordId=''
        status='translating'
        canTranslate={false}
        translateDisabledReason='Generacion en curso.'
        copiedInput={false}
        copiedResult={false}
        canListen={false}
        speakingLanguage={null}
        canDictate={false}
        dictatingLanguage={null}
        dictationUnavailableReason='No disponible'
        onInputChange={noop}
        onCopyInput={noop}
        onCopyResult={noop}
        onListenInput={noop}
        onListenResult={noop}
        onDictateInput={noop}
        onTranslate={noop}
        onSelectPreset={noop}
        onRequestBreakdown={noop}
        onTranslateToSpanish={noop}
        hasSeenResponderPromise={false}
      />,
    );

    expect(
      screen.getAllByLabelText('Preparando respuesta').length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Analizando contexto').length).toBeGreaterThan(
      0,
    );
  });

  it('does not show redundant Spanish shortcuts when the response is already in Spanish', async () => {
    const noop = () => undefined;

    render(
      <ExpressionWorkspace
        inputText='Thanks for reaching out. Your proposal sounds interesting.'
        resultText='Gracias por ponerte en contacto. Tu propuesta suena interesante.'
        mode='translate_to_spanish'
        modeDetection={{
          mode: 'translate_to_spanish',
          confidence: 'high',
          reason: 'english',
          automatic: false,
        }}
        sourceLanguage='en'
        targetLanguage='es'
        presetId='natural'
        breakdown={null}
        breakdownStatus='idle'
        translationRecordId='record-1'
        status='idle'
        canTranslate
        translateDisabledReason=''
        copiedInput={false}
        copiedResult={false}
        canListen={false}
        speakingLanguage={null}
        canDictate={false}
        dictatingLanguage={null}
        dictationUnavailableReason='No disponible'
        onInputChange={noop}
        onCopyInput={noop}
        onCopyResult={noop}
        onListenInput={noop}
        onListenResult={noop}
        onDictateInput={noop}
        onTranslate={noop}
        onSelectPreset={noop}
        onRequestBreakdown={noop}
        onTranslateToSpanish={noop}
        hasSeenResponderPromise={false}
      />,
    );

    await waitFor(() =>
      expect(
        screen.getAllByText('Versión en español').length,
      ).toBeGreaterThan(0),
    );
    expect(
      screen.queryByRole('button', { name: /^Espanol$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^ES$/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /pasar a espanol/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Traducir' }),
    ).toBeInTheDocument();
  });

  it('shows usage pips and a post-copy continuation nudge', async () => {
    const noop = () => undefined;
    const onOpenAccount = vi.fn();
    const onOpenLearning = vi.fn();

    render(
      <ExpressionWorkspace
        inputText='Gracias por escribir, me interesa la propuesta.'
        resultText='Thanks for reaching out. Your proposal sounds really interesting.'
        mode='translate_to_english'
        modeDetection={{
          mode: 'translate_to_english',
          confidence: 'high',
          reason: 'spanish',
          automatic: true,
        }}
        sourceLanguage='es'
        targetLanguage='en'
        presetId='natural'
        breakdown={null}
        breakdownStatus='idle'
        translationRecordId='record-1'
        status='idle'
        canTranslate
        translateDisabledReason=''
        copiedInput={false}
        copiedResult
        canListen={false}
        speakingLanguage={null}
        canDictate={false}
        dictatingLanguage={null}
        dictationUnavailableReason='No disponible'
        quotaUsage={{
          estimatedTokens: 4,
          monthlyQuota: 100,
          usedThisMonth: 4,
          remainingThisMonth: 96,
          charged: true,
          resetAt: '2026-07-01T00:00:00.000Z',
        }}
        onInputChange={noop}
        onCopyInput={noop}
        onCopyResult={noop}
        onListenInput={noop}
        onListenResult={noop}
        onDictateInput={noop}
        onTranslate={noop}
        onSelectPreset={noop}
        onRequestBreakdown={noop}
        onTranslateToSpanish={noop}
        onOpenAccount={onOpenAccount}
        onOpenLearning={onOpenLearning}
        postCopyAccountLabel='Crear cuenta gratis'
        hasSeenResponderPromise={false}
      />,
    );

    expect(
      screen.getByLabelText(/Modo amigo gratis: Modo amigo gratis/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/96 de 100 creditos/i)).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/96 de 100 creditos/i),
    ).not.toBeInTheDocument();

    expect(await screen.findAllByText('Respuesta copiada.')).not.toHaveLength(0);

    fireEvent.click(
      screen.getAllByRole('button', { name: /guardar en aprender/i })[0],
    );
    fireEvent.click(
      screen.getAllByRole('button', { name: /crear cuenta gratis/i })[0],
    );

    expect(onOpenLearning).toHaveBeenCalledTimes(1);
    expect(onOpenAccount).toHaveBeenCalledTimes(1);

    fireEvent.click(
      screen.getAllByRole('button', {
        name: /cerrar sugerencia post-copy/i,
      })[0],
    );

    expect(screen.queryByText('Respuesta copiada.')).not.toBeInTheDocument();
  });

  it('keeps the workspace Desglose open when enriched content arrives', () => {
    const richBreakdown = {
      changed: true,
      confidence: 'high' as const,
      feedback: ['Listo.'],
      tenses: [
        {
          label: 'Simple present',
          text: 'need',
          note: 'Describe una necesidad actual.',
        },
      ],
      structure: [
        {
          text: 'I need help',
          role: 'other' as const,
          note: 'Frase completa.',
        },
      ],
    };
    const requestBreakdown = vi.fn();
    const noop = () => undefined;
    const baseProps = {
      inputText: 'Creo que necesito ayuda',
      resultText: 'I think I need help.',
      mode: 'translate_to_english' as const,
      modeDetection: {
        mode: 'translate_to_english' as const,
        confidence: 'high' as const,
        reason: 'spanish' as const,
        automatic: true,
      },
      sourceLanguage: 'es' as const,
      targetLanguage: 'en' as const,
      presetId: 'natural' as const,
      breakdown: null,
      breakdownStatus: 'idle' as const,
      translationRecordId: 'record-1',
      status: 'idle' as const,
      canTranslate: true,
      translateDisabledReason: '',
      copiedInput: false,
      copiedResult: false,
      canListen: false,
      speakingLanguage: null,
      canDictate: false,
      dictatingLanguage: null,
      dictationUnavailableReason: 'No disponible',
      onInputChange: noop,
      onCopyInput: noop,
      onCopyResult: noop,
      onListenInput: noop,
      onListenResult: noop,
      onDictateInput: noop,
      onTranslate: noop,
      onSelectPreset: noop,
      onRequestBreakdown: requestBreakdown,
      onTranslateToSpanish: noop,
      hasSeenResponderPromise: false,
    };

    const { rerender } = render(<ExpressionWorkspace {...baseProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Desglose' }));

    expect(requestBreakdown).toHaveBeenCalledTimes(1);

    rerender(
      <ExpressionWorkspace
        {...baseProps}
        breakdown={richBreakdown}
        breakdownStatus='ready'
      />,
    );

    expect(screen.getByRole('button', { name: /desglose/i })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    expect(screen.getByText('Simple present')).toBeInTheDocument();
  });

  it('renders a markdown study article with syntax and exercises', () => {
    const article = {
      translationRecordId: 'record-1',
      sourceLanguage: 'es',
      targetLanguage: 'en',
      sourceText: 'Yo quiero aprender ingles',
      translatedText: 'I want to learn English',
      title: 'I want to learn English',
      summary: 'A simple present phrase from personal context.',
      articleVersion: 'markdown-v3',
      lessonFocus: ['syntax', 'simple present'],
      estimatedReadingMinutes: 4,
      markdown: [
        '# I want to learn English',
        '',
        '## Syntax map',
        '| Part | Role |',
        '| --- | --- |',
        '| I | Subject |',
        '| want | Simple present verb |',
        '',
        '## Why the tense fits',
        'Simple present shows the current desire.',
        '',
        '## Common mistakes',
        '- I want learn English',
        '',
        '## Practice',
        '1. Complete: I want __ learn English.',
        '',
        '## Answer key',
        '1. to',
      ].join('\n'),
      roleplay: [
        {
          speaker: 'mentor',
          text: 'This legacy roleplay should never render.',
        },
      ],
    } as unknown as StudyArticle;

    render(
      <StudyArticleView
        article={article}
        loading={false}
        error=''
        onClose={() => undefined}
      />,
    );

    expect(
      screen.getByRole('heading', { name: 'Syntax map' }),
    ).toBeInTheDocument();
    expect(screen.getByText('simple present')).toBeInTheDocument();
    expect(
      screen.getByText('Simple present shows the current desire.'),
    ).toBeInTheDocument();
    expect(screen.getByText('I want learn English')).toBeInTheDocument();
    expect(
      screen.getByText('Complete: I want __ learn English.'),
    ).toBeInTheDocument();
    expect(screen.getByText('Answer key')).toBeInTheDocument();
    expect(
      screen.queryByLabelText('Roleplay Simulator'),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText('This legacy roleplay should never render.'),
    ).not.toBeInTheDocument();
  });
});
