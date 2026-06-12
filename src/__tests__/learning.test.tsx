import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { StudyArticle } from '@eb-packages/flowtranslate-core';
import { describe, expect, it, vi } from 'vitest';
import App from '../App';
import { ExpressionBreakdownDetails } from '../components/ExpressionBreakdownDetails';
import { ExpressionWorkspace } from '../components/ExpressionWorkspace';
import { LearningView } from '../components/LearningView';
import { StudyArticleView } from '../components/StudyArticleView';

describe('learning UI', () => {
  it('keeps Learning in a separate view with empty history state', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /aprender/i }));

    expect(screen.getByRole('heading', { name: 'Historial' })).toBeInTheDocument();
    expect(screen.getAllByText(/Tus respuestas guardadas van a aparecer aca/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Panel de Learning' })).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: 'Ingles util desde tu historial' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Recommended exercises' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Practice' })).not.toBeInTheDocument();
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

    render(
      <LearningView
        history={history}
        learningInsight={null}
        insightLoading={false}
        insightError=''
        studyArticle={{
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
        }}
        studyLoading={false}
        studyError=''
        selectedStudyRecordId='record-1'
        onRefreshInsight={() => undefined}
        onOpenStudy={() => undefined}
        onCloseStudy={() => undefined}
        onDelete={() => undefined}
        onClear={() => undefined}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Articulo de estudio' })).toBeInTheDocument();
    expect(screen.getByText('Leccion: Talking about Plans')).toBeInTheDocument();
    expect(screen.getByText(history[0].sourceText)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Panel de Learning' })).not.toBeInTheDocument();
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

    render(
      <LearningView
        history={history}
        learningInsight={null}
        insightLoading={false}
        insightError=''
        studyArticle={null}
        studyLoading
        studyError=''
        selectedStudyRecordId='record-1'
        onRefreshInsight={() => undefined}
        onOpenStudy={() => undefined}
        onCloseStudy={() => undefined}
        onDelete={() => undefined}
        onClear={() => undefined}
      />,
    );

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

    render(
      <LearningView
        history={history}
        learningInsight={null}
        insightLoading={false}
        insightError=''
        studyArticle={null}
        studyLoading={false}
        studyError=''
        selectedStudyRecordId='record-1'
        onRefreshInsight={() => undefined}
        onOpenStudy={() => undefined}
        onCloseStudy={() => undefined}
        onAskBreakdownQuestion={askBreakdownQuestion}
        onDelete={() => undefined}
        onClear={() => undefined}
      />,
    );

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

  it('renders cached learning insights in writing and conversation groups', () => {
    render(
      <LearningView
        history={[]}
        learningInsight={{
          insightVersion: 'insight-v1',
          historySnapshotHash: 'hash',
          generatedAt: '2026-06-05T12:00:00.000Z',
          summary: 'You are working on direct, practical English.',
          sourceRecordIds: ['record-1'],
          writingItems: [
            {
              title: 'Next time say',
              expression: 'I need help with this task.',
              explanation: 'A clean way to ask for support.',
              example: 'I need help with this task before Friday.',
            },
          ],
          conversationItems: [
            {
              title: 'Conversation phrase',
              expression: 'Can you follow up?',
              explanation: 'Useful when someone asks for next steps.',
            },
          ],
        }}
        insightLoading={false}
        insightError=''
        studyArticle={null}
        studyLoading={false}
        studyError=''
        selectedStudyRecordId={null}
        onRefreshInsight={() => undefined}
        onOpenStudy={() => undefined}
        onCloseStudy={() => undefined}
        onDelete={() => undefined}
        onClear={() => undefined}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Ingles util desde tu historial' })).toBeInTheDocument();
    expect(screen.getByText('Desde lo que escribis')).toBeInTheDocument();
    expect(screen.getByText('Desde conversaciones')).toBeInTheDocument();
    expect(screen.getByText('I need help with this task.')).toBeInTheDocument();
    expect(screen.getByText('Can you follow up?')).toBeInTheDocument();
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
