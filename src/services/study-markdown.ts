export type SplitStudyArticleMarkdown = {
  lessonMarkdown: string;
  answerHeading: string;
  answerMarkdown: string;
};

const answerHeadingPattern =
  /^#{2,4}\s+(answer key|answers|check your answers|respuestas)\b.*$/im;

export const splitStudyArticleMarkdown = (
  markdown: string,
): SplitStudyArticleMarkdown => {
  const match = answerHeadingPattern.exec(markdown);

  if (!match || typeof match.index !== 'number') {
    return {
      lessonMarkdown: markdown.trim(),
      answerHeading: 'Answer key',
      answerMarkdown: '',
    };
  }

  const heading = match[0].replace(/^#{2,4}\s+/, '').trim() || 'Answer key';

  return {
    lessonMarkdown: markdown.slice(0, match.index).trim(),
    answerHeading: heading,
    answerMarkdown: markdown.slice(match.index + match[0].length).trim(),
  };
};
