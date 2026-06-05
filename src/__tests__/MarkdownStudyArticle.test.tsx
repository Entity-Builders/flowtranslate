import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { MarkdownStudyArticle } from '../components/MarkdownStudyArticle';
import { splitStudyArticleMarkdown } from '../services/study-markdown';

describe('MarkdownStudyArticle', () => {
  it('renders GFM structure and folds the answer key', () => {
    render(
      <MarkdownStudyArticle
        markdown={[
          '# Phrase lesson',
          '',
          '## Syntax map',
          '| Part | Role |',
          '| --- | --- |',
          '| I | Subject |',
          '',
          '> Learn the full phrase before translating word by word.',
          '',
          '## Practice',
          '1. Complete the phrase.',
          '',
          '## Answer key',
          '1. to',
        ].join('\n')}
      />,
    );

    expect(screen.getByRole('heading', { name: 'Syntax map' })).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
    expect(screen.getByText('Learn the full phrase before translating word by word.')).toBeInTheDocument();
    expect(screen.getByText('Answer key').closest('summary')).toBeInTheDocument();
  });

  it('does not render raw html or clickable links', () => {
    const { container } = render(
      <MarkdownStudyArticle
        markdown={[
          '# Phrase lesson',
          '',
          '## Notes',
          '<script>alert("x")</script>',
          '',
          'Read this [outside source](https://example.com).',
        ].join('\n')}
      />,
    );

    expect(container.querySelector('script')).toBeNull();
    expect(screen.getByText('outside source').closest('a')).toBeNull();
  });

  it('splits common answer headings from the lesson body', () => {
    const split = splitStudyArticleMarkdown(
      '# Lesson\n\n## Practice\nTry it.\n\n### Answers\nDone.',
    );

    expect(split.lessonMarkdown).toContain('## Practice');
    expect(split.answerHeading).toBe('Answers');
    expect(split.answerMarkdown).toBe('Done.');
  });
});
