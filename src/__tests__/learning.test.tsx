import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { StudyArticle } from '@eb-packages/flowtranslate-core';
import { STARTER_LEARNING_SITUATIONS } from '@eb-packages/flowtranslate-core';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
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
    starterSituations: STARTER_LEARNING_SITUATIONS,
    learningSessions: [],
    savedPhrases: [],
    activeSession: null,
    progressLoading: false,
    progressError: '',
    sessionLoading: false,
    sessionError: '',
    selectedBestOptionId: '',
    attemptLoading: false,
    attemptError: '',
    latestAttempt: null,
    studyArticle: null,
    studyLoading: false,
    studyError: '',
    selectedStudyRecordId: null,
    upgradePrompt: null,
    onStartSession: () => undefined,
    onResumeSession: () => undefined,
    onLeaveSession: () => undefined,
    onSelectBestOption: () => undefined,
    onSubmitAttempt: () => undefined,
    onSavePhrase: () => undefined,
    onArchivePhrase: () => undefined,
    onCompleteSession: () => undefined,
    onUsePhraseInResponder: () => undefined,
    onOpenStudy: () => undefined,
    onCloseStudy: () => undefined,
    onDelete: () => undefined,
    onClear: () => undefined,
  };

  return render(<LearningView {...defaultProps} {...props} />);
};

describe('learning UI', () => {
  it('keeps Learning in a separate view with empty history state', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /aprender/i }));

    expect(screen.getByText('Hoy en tu ingles')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Avisar una demora/i })).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /Empezar practica/i }).length,
    ).toBeGreaterThan(0);
    expect(screen.getAllByText('Frases guardadas').length).toBeGreaterThan(0);
    expect(screen.getByText('Fuentes recientes')).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Panel de Learning' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Recommended exercises' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Practice' })).not.toBeInTheDocument();
  });

  it('renders a contextual Pro prompt in the Learning progress area', () => {
    renderLearningView({
      upgradePrompt: (
        <div>
          FlowTranslate Pro suma mas sesiones de Learning y frases guardadas.
        </div>
      ),
    });

    expect(
      screen.getByText(/FlowTranslate Pro suma mas sesiones de Learning/i),
    ).toBeInTheDocument();
  });

  it('shows a continue action when the recommended practice already exists', () => {
    renderLearningView({
      learningSessions: [
        {
          id: 'session-1',
          situationId: 'delay-update',
          catalogVersion: 'flowtranslate:learning-situations:v1',
          status: 'active',
          sourceRecordIds: [],
          createdAt: '2026-06-05T12:00:00.000Z',
          content: {
            situationTitle: 'Avisar una demora sin sonar defensivo',
            anchorPhrase: 'The report is taking a bit longer than expected.',
            whyItWorks: 'Shows ownership without sounding defensive.',
            grammarNotes: [],
            bestOption: {
              prompt: 'Which option sounds best?',
              choices: [],
            },
            rewritePrompt: 'Tell the client the report will be ready tomorrow.',
            suggestedPhrases: [],
          },
        },
      ],
    });

    expect(
      screen.getByRole('button', { name: /Continuar practica/i }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /Empezar practica/i }).length,
    ).toBeGreaterThan(0);
  });

  it('shows completed recommended practice as review instead of continue', () => {
    renderLearningView({
      learningSessions: [
        {
          id: 'old-active-session',
          situationId: 'delay-update',
          catalogVersion: 'flowtranslate:learning-situations:v1',
          status: 'active',
          sourceRecordIds: [],
          createdAt: '2026-06-05T12:00:00.000Z',
          content: {
            situationTitle: 'Avisar una demora sin sonar defensivo',
            anchorPhrase: 'The report is taking a bit longer than expected.',
            whyItWorks: 'Shows ownership without sounding defensive.',
            grammarNotes: [],
            bestOption: {
              prompt: 'Which option sounds best?',
              choices: [],
            },
            rewritePrompt: 'Tell the client the report will be ready tomorrow.',
            suggestedPhrases: [],
          },
        },
        {
          id: 'completed-session',
          situationId: 'delay-update',
          catalogVersion: 'flowtranslate:learning-situations:v1',
          status: 'completed',
          sourceRecordIds: [],
          createdAt: '2026-06-05T12:30:00.000Z',
          completedAt: '2026-06-05T12:40:00.000Z',
          content: {
            situationTitle: 'Avisar una demora sin sonar defensivo',
            anchorPhrase: 'The report is taking a bit longer than expected.',
            whyItWorks: 'Shows ownership without sounding defensive.',
            grammarNotes: [],
            bestOption: {
              prompt: 'Which option sounds best?',
              choices: [],
            },
            rewritePrompt: 'Tell the client the report will be ready tomorrow.',
            suggestedPhrases: [],
          },
        },
      ],
    });

    expect(
      screen.getByRole('button', { name: /Repasar practica/i }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /Continuar practica/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Tus practicas')).not.toBeInTheDocument();
  });

  it('keeps practice cards unique and labels completed sessions as review', () => {
    renderLearningView({
      learningSessions: [
        {
          id: 'recommended-completed-session',
          situationId: 'delay-update',
          catalogVersion: 'flowtranslate:learning-situations:v1',
          status: 'completed',
          sourceRecordIds: [],
          createdAt: '2026-06-05T12:00:00.000Z',
          completedAt: '2026-06-05T12:20:00.000Z',
          content: {
            situationTitle: 'Avisar una demora sin sonar defensivo',
            anchorPhrase: 'The report is taking a bit longer than expected.',
            whyItWorks: 'Shows ownership without sounding defensive.',
            grammarNotes: [],
            bestOption: {
              prompt: 'Which option sounds best?',
              choices: [],
            },
            rewritePrompt: 'Tell the client the report will be ready tomorrow.',
            suggestedPhrases: [],
          },
        },
        {
          id: 'follow-up-old-active',
          situationId: 'follow-up',
          catalogVersion: 'flowtranslate:learning-situations:v1',
          status: 'active',
          sourceRecordIds: [],
          createdAt: '2026-06-05T12:10:00.000Z',
          content: {
            situationTitle: 'Hacer seguimiento sin presionar',
            anchorPhrase: 'Just checking in on this.',
            whyItWorks: 'Keeps the follow-up light.',
            grammarNotes: [],
            bestOption: {
              prompt: 'Which option sounds best?',
              choices: [],
            },
            rewritePrompt: 'Follow up on a proposal.',
            suggestedPhrases: [],
          },
        },
        {
          id: 'follow-up-completed',
          situationId: 'follow-up',
          catalogVersion: 'flowtranslate:learning-situations:v1',
          status: 'completed',
          sourceRecordIds: [],
          createdAt: '2026-06-05T12:30:00.000Z',
          completedAt: '2026-06-05T12:45:00.000Z',
          content: {
            situationTitle: 'Hacer seguimiento sin presionar',
            anchorPhrase: 'Just checking in on this.',
            whyItWorks: 'Keeps the follow-up light.',
            grammarNotes: [],
            bestOption: {
              prompt: 'Which option sounds best?',
              choices: [],
            },
            rewritePrompt: 'Follow up on a proposal.',
            suggestedPhrases: [],
          },
        },
      ],
    });

    expect(screen.getByText('Tus practicas')).toBeInTheDocument();
    expect(
      screen.getAllByText('Hacer seguimiento sin presionar'),
    ).toHaveLength(1);
    expect(screen.getByText('Completada')).toBeInTheDocument();
    expect(screen.getByText('Repasar')).toBeInTheDocument();
  });

  it('opens a selected history conversation as a dedicated study surface', () => {
    const history = [
      {
        id: 'record-1',
        sourceLanguage: 'es' as const,
        targetLanguage: 'en' as const,
        sourceText: 'Ellos van a comer en el restaurante',
        translatedText: 'They are going to eat at the restaurant',
        createdAt: '2026-06-05T12:00:00.000Z',
      },
    ];

    renderLearningView({
      history,
      studyArticle: {
          translationRecordId: 'record-1',
          sourceLanguage: 'es',
          targetLanguage: 'en',
          sourceText: history[0].sourceText,
          translatedText: history[0].translatedText,
          mode: 'translate_to_english',
          title: 'Talking about Plans',
          summary: 'A near-future phrase in context.',
          articleVersion: 'markdown-v3',
          lessonFocus: ['near future', 'movement verb'],
          estimatedReadingMinutes: 4,
          markdown: [
            '# Talking about Plans',
            '',
            '## Syntactic breakdown',
            '| Part | Role |',
            '| --- | --- |',
            '| Ellos | Subject |',
            '| van a comer | Verb phrase |',
            '',
            '## Common mistakes',
            '- Ellos van comer.',
          ].join('\n'),
      },
      selectedStudyRecordId: 'record-1',
    });

    expect(screen.getByRole('heading', { name: 'Articulo de estudio' })).toBeInTheDocument();
    expect(screen.getByText('Leccion: Talking about Plans')).toBeInTheDocument();
    expect(screen.getByText(history[0].sourceText)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: /Hoy en tu ingles/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Historial' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Practice' })).not.toBeInTheDocument();
  });

  it('preloads the saved Spanish breakdown when a history record opens for study', () => {
    const history = [
      {
        id: 'record-1',
        sourceLanguage: 'en' as const,
        targetLanguage: 'es' as const,
        sourceText:
          'When I lived in Toronto I use to buy weed every weekend in a store near me house.',
        translatedText:
          'Cuando vivia en Toronto solia comprar marihuana todos los fines de semana en una tienda cerca de mi casa.',
        mode: 'translate_to_spanish' as const,
        breakdown: {
          changed: true,
          confidence: 'high' as const,
          feedback: [
            "Se corrigio la conjugacion del verbo 'use' a 'used' para el pasado habitual.",
          ],
          tense: 'Past habitual',
          structure: [
            {
              text: 'When I lived in Toronto',
              role: 'modifier' as const,
              note: 'Introductory time clause.',
            },
            {
              text: 'used to buy',
              role: 'verb' as const,
              note: 'Past habit.',
            },
          ],
          whyThisWorks:
            "La estructura 'used to + infinitivo' expresa habitos pasados.",
          commonMistake:
            "Uso incorrecto de 'use to' en lugar de 'used to' para habitos pasados.",
          alternatives: [
            {
              label: 'More casual',
              text: "Back when I was in Toronto, I'd buy weed every weekend.",
              note: "Usa 'would' para habitos pasados en un tono mas casual.",
            },
          ],
        },
        createdAt: '2026-06-05T12:00:00.000Z',
      },
    ];

    renderLearningView({
      history,
      studyLoading: true,
      selectedStudyRecordId: 'record-1',
    });

    expect(screen.getByText('Desglose')).toBeInTheDocument();
    expect(screen.getByText('Ajustado')).toBeInTheDocument();
    expect(screen.getByText('Past habitual')).toBeInTheDocument();
    expect(screen.getByText('used to buy')).toBeInTheDocument();
    expect(
      screen.getByText(/Se corrigio la conjugacion del verbo/),
    ).toBeInTheDocument();
    expect(screen.getByText('Generando articulo de estudio')).toBeInTheDocument();
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
      <ExpressionBreakdownDetails
        defaultOpen
        breakdown={null}
        isEnriching
      />,
    );

    expect(screen.getByText('Preparando desglose...')).toBeInTheDocument();
  });

  it('requests on-demand breakdown when the panel opens', () => {
    const requestBreakdown = vi.fn();

    render(
      <ExpressionBreakdownDetails
        breakdown={null}
        onOpen={requestBreakdown}
      />,
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
      <ExpressionBreakdownDetails
        breakdown={null}
        onOpen={requestBreakdown}
      />,
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
        within(mobileSheet as HTMLElement).getByText('Respuesta en ingles'),
      ).toBeInTheDocument(),
    );
    expect(
      within(mobileSheet as HTMLElement).getAllByText(resultText),
    ).toHaveLength(1);

    fireEvent.click(
      within(mobileSheet as HTMLElement).getByRole('button', {
        name: /listo para mandar/i,
      }),
    );

    expect(
      within(mobileSheet as HTMLElement).getAllByText(resultText),
    ).toHaveLength(1);
    expect(
      within(mobileSheet as HTMLElement).queryByRole('button', { name: /^ES$/i }),
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

    expect(screen.getAllByLabelText('Preparando respuesta').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Analizando contexto').length).toBeGreaterThan(0);
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
      expect(screen.getAllByText('Respuesta en espanol').length).toBeGreaterThan(0),
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
    expect(screen.getByRole('button', { name: 'Traducir' })).toBeInTheDocument();
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

  it('lets the user ask AI questions about a saved Spanish breakdown', async () => {
    const history = [
      {
        id: 'record-1',
        sourceLanguage: 'en' as const,
        targetLanguage: 'en' as const,
        sourceText: 'I need help',
        translatedText: 'I need some help.',
        mode: 'improve_english' as const,
        breakdown: {
          changed: true,
          confidence: 'high' as const,
          feedback: ['"some help" suaviza la frase.'],
          tense: 'Simple present',
          whyThisWorks:
            'La frase mantiene el sentido pero suena mas natural en ingles.',
        },
        createdAt: '2026-06-05T12:00:00.000Z',
      },
    ];
    const askBreakdownQuestion = vi.fn().mockResolvedValue(
      'Si dices "I need help with this", agregas contexto y sigue sonando natural.',
    );

    renderLearningView({
      history,
      selectedStudyRecordId: 'record-1',
      onAskBreakdownQuestion: askBreakdownQuestion,
    });

    fireEvent.change(screen.getByLabelText('Preguntar sobre este desglose'), {
      target: { value: 'What if I said "I need help with this"?' },
    });
    fireEvent.click(
      screen.getByRole('button', { name: 'Enviar pregunta del desglose' }),
    );

    expect(
      await screen.findByText(/agregas contexto y sigue sonando natural/),
    ).toBeInTheDocument();
    expect(askBreakdownQuestion).toHaveBeenCalledWith(
      history[0],
      'What if I said "I need help with this"?',
      [],
    );
  });

  it('renders a focused learning session with feedback and actions', () => {
    const onSelectBestOption = vi.fn();
    const onSubmitAttempt = vi.fn();
    const onCompleteSession = vi.fn();
    const session = {
      id: 'session-1',
      situationId: 'delay-update',
      catalogVersion: 'flowtranslate:learning-situations:v1',
      status: 'active' as const,
      sourceRecordIds: [],
      createdAt: '2026-06-05T12:00:00.000Z',
      content: {
        situationTitle: 'Avisar una demora sin sonar defensivo',
        anchorPhrase: 'The report is taking a bit longer than expected.',
        whyItWorks: 'Shows ownership without sounding defensive.',
        grammarNotes: [
          {
            label: 'Present continuous',
            text: 'is taking',
            note: 'Marca algo que sigue en proceso.',
          },
        ],
        bestOption: {
          prompt: 'Which option sounds best?',
          choices: [
            {
              id: 'preferred',
              text: 'The report is taking a bit longer than expected.',
              preferred: true,
              feedback: 'Clear and calm.',
            },
            {
              id: 'rough',
              text: 'The report is delayed.',
              preferred: false,
              feedback: 'A bit flat.',
            },
          ],
        },
        rewritePrompt: 'Tell the client the report will be ready tomorrow.',
        suggestedPhrases: ['I will send you a clean version tomorrow.'],
      },
    };

    renderLearningView({
      activeSession: session,
      selectedBestOptionId: 'preferred',
      latestAttempt: {
        id: 'attempt-1',
        sessionId: 'session-1',
        userAnswer: 'I will send the report tomorrow.',
        createdAt: '2026-06-05T12:05:00.000Z',
        feedback: {
          naturalness: 'close',
          summary: 'Good, just soften it a bit.',
          improvedVersion: 'I will send you a clean version tomorrow.',
          notes: [
            {
              label: 'Chunk',
              text: 'clean version',
              note: 'Sounds more useful than just report.',
            },
          ],
        },
      },
      onSelectBestOption,
      onSubmitAttempt,
      onCompleteSession,
    });

    expect(screen.getByText('Practica enfocada')).toBeInTheDocument();
    expect(screen.getByText('Present continuous')).toBeInTheDocument();
    expect(screen.getByText('Clear and calm.')).toBeInTheDocument();
    expect(screen.getByText('Version mejorada')).toBeInTheDocument();
    expect(
      screen.getAllByText('I will send you a clean version tomorrow.').length,
    ).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: /The report is delayed/i }));
    expect(onSelectBestOption).toHaveBeenCalledWith('rough');

    fireEvent.change(screen.getByLabelText('Tu version en ingles'), {
      target: { value: 'I will send it tomorrow.' },
    });
    fireEvent.click(screen.getByRole('button', { name: /Revisar mi version/i }));
    expect(onSubmitAttempt).toHaveBeenCalledWith('I will send it tomorrow.');

    fireEvent.click(screen.getByRole('button', { name: /Completar practica/i }));
    expect(onCompleteSession).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('heading', { name: 'Practice' })).not.toBeInTheDocument();
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

    expect(screen.getByRole('heading', { name: 'Syntax map' })).toBeInTheDocument();
    expect(screen.getByText('simple present')).toBeInTheDocument();
    expect(screen.getByText('Simple present shows the current desire.')).toBeInTheDocument();
    expect(screen.getByText('I want learn English')).toBeInTheDocument();
    expect(screen.getByText('Complete: I want __ learn English.')).toBeInTheDocument();
    expect(screen.getByText('Answer key')).toBeInTheDocument();
    expect(screen.queryByLabelText('Roleplay Simulator')).not.toBeInTheDocument();
    expect(
      screen.queryByText('This legacy roleplay should never render.'),
    ).not.toBeInTheDocument();
  });
});
