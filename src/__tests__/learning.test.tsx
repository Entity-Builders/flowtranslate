import { fireEvent, render, screen } from '@testing-library/react';
import type { StudyArticle } from '@eb-packages/flowtranslate-core';
import { describe, expect, it } from 'vitest';
import App from '../App';
import { LearningView } from '../components/LearningView';
import { StudyArticleView } from '../components/StudyArticleView';

describe('learning UI', () => {
  it('keeps Learning in a separate view with empty history state', () => {
    render(<App />);

    fireEvent.click(screen.getByRole('button', { name: /learning/i }));

    expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument();
    expect(screen.getAllByText(/Translate a few real phrases/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Learning dashboard' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Recommended exercises' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Practice' })).toBeInTheDocument();
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
        practice={null}
        loading={false}
        insufficientHistory={false}
        error=''
        studyArticle={{
          translationRecordId: 'record-1',
          sourceLanguage: 'es',
          targetLanguage: 'en',
          sourceText: history[0].sourceText,
          translatedText: history[0].translatedText,
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
        onGenerate={() => undefined}
        onOpenStudy={() => undefined}
        onCloseStudy={() => undefined}
        onDelete={() => undefined}
        onClear={() => undefined}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Study Article' })).toBeInTheDocument();
    expect(screen.getByText('Lesson: Talking about Plans')).toBeInTheDocument();
    expect(screen.getByText(history[0].sourceText)).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Learning dashboard' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'History' })).not.toBeInTheDocument();
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
