import { CheckCircle2 } from 'lucide-react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { splitStudyArticleMarkdown } from '../services/study-markdown';

type MarkdownStudyArticleProps = {
  markdown: string;
};

type MarkdownSection = {
  title: string;
  body: string;
  tone: 'syntax' | 'grammar' | 'mistakes' | 'practice' | 'default';
};

const classNames = (...values: Array<string | undefined>) =>
  values.filter(Boolean).join(' ');

const withoutNode = <TProps extends { node?: unknown }>(props: TProps) => {
  const { node, ...rest } = props;
  void node;
  return rest;
};

const withClassName = <TProps extends { className?: string }>(
  props: TProps,
  className: string,
) => ({
  ...props,
  className: classNames(className, props.className),
});

const markdownComponents: Components = {
  h1: (props) => (
    <h2
      {...withClassName(
        withoutNode(props),
        'text-xl font-black leading-tight text-slate-950 md:text-2xl',
      )}
    />
  ),
  h2: (props) => (
    <h3
      {...withClassName(
        withoutNode(props),
        'mt-8 text-lg font-black leading-tight text-slate-950 first:mt-0',
      )}
    />
  ),
  h3: (props) => (
    <h4
      {...withClassName(
        withoutNode(props),
        'mt-6 text-base font-black leading-tight text-slate-950',
      )}
    />
  ),
  h4: (props) => (
    <h5
      {...withClassName(
        withoutNode(props),
        'mt-5 text-sm font-black uppercase tracking-normal text-slate-500',
      )}
    />
  ),
  p: (props) => (
    <p
      {...withClassName(
        withoutNode(props),
        'mt-3 text-sm leading-7 text-slate-700 first:mt-0',
      )}
    />
  ),
  ul: (props) => (
    <ul
      {...withClassName(
        withoutNode(props),
        'mt-3 space-y-2 pl-5 text-sm leading-7 text-slate-700',
      )}
    />
  ),
  ol: (props) => (
    <ol
      {...withClassName(
        withoutNode(props),
        'mt-3 space-y-2 pl-5 text-sm leading-7 text-slate-700',
      )}
    />
  ),
  li: (props) => (
    <li
      {...withClassName(withoutNode(props), 'pl-1 marker:font-bold marker:text-slate-400')}
    />
  ),
  blockquote: (props) => (
    <blockquote
      {...withClassName(
        withoutNode(props),
        'mt-4 rounded-md border border-sky-100 bg-sky-50 px-4 py-3 text-slate-700',
      )}
    />
  ),
  table: (props) => (
    <div className='mt-4 overflow-x-auto rounded-md border border-slate-200'>
      <table
        {...withClassName(
          withoutNode(props),
          'min-w-full border-collapse text-left text-sm text-slate-700',
        )}
      />
    </div>
  ),
  thead: (props) => (
    <thead {...withClassName(withoutNode(props), 'bg-slate-100 text-slate-950')} />
  ),
  th: (props) => (
    <th
      {...withClassName(
        withoutNode(props),
        'border-b border-slate-200 px-3 py-2 font-black',
      )}
    />
  ),
  td: (props) => (
    <td
      {...withClassName(
        withoutNode(props),
        'border-t border-slate-100 px-3 py-2 align-top',
      )}
    />
  ),
  strong: (props) => (
    <strong {...withClassName(withoutNode(props), 'font-black text-slate-950')} />
  ),
  em: (props) => (
    <em {...withClassName(withoutNode(props), 'font-semibold text-slate-700')} />
  ),
  code: (props) => (
    <code
      {...withClassName(
        withoutNode(props),
        'rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-[0.9em] text-slate-900',
      )}
    />
  ),
  a: (props) => (
    <span
      {...withClassName(
        withoutNode(props),
        'font-semibold text-slate-900 underline decoration-slate-300 underline-offset-2',
      )}
    />
  ),
  hr: (props) => (
    <hr {...withClassName(withoutNode(props), 'my-8 border-slate-200')} />
  ),
};

const MarkdownBlock = ({ markdown }: MarkdownStudyArticleProps) => (
  <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
    {markdown}
  </ReactMarkdown>
);

const sectionTone = (title: string): MarkdownSection['tone'] => {
  const normalized = title.toLowerCase();
  if (/syntax|syntactic|breakdown|map|structure/.test(normalized)) return 'syntax';
  if (/tense|grammar|why|explanation|fits|rule/.test(normalized)) return 'grammar';
  if (/mistake|common error|watch out/.test(normalized)) return 'mistakes';
  if (/practice|drill|exercise|self-check|try/.test(normalized)) return 'practice';
  return 'default';
};

const removeLeadingTitle = (markdown: string) =>
  markdown.replace(/^#\s+.+(?:\n+|$)/, '').trim();

const splitIntoSections = (markdown: string): MarkdownSection[] => {
  const lines = removeLeadingTitle(markdown).split('\n');
  const sections: MarkdownSection[] = [];
  let currentTitle = 'Lesson notes';
  let currentBody: string[] = [];
  let sawSectionHeading = false;

  const flush = () => {
    const body = currentBody.join('\n').trim();
    if (!body) return;

    sections.push({
      title: currentTitle,
      body,
      tone: sectionTone(currentTitle),
    });
  };

  lines.forEach((line) => {
    const match = /^##\s+(.+?)\s*$/.exec(line);
    if (!match) {
      currentBody.push(line);
      return;
    }

    flush();
    sawSectionHeading = true;
    currentTitle = match[1];
    currentBody = [];
  });

  flush();

  if (!sawSectionHeading && sections.length === 1) {
    return [{ ...sections[0], title: 'Lesson notes' }];
  }

  return sections;
};

const SECTION_STYLES: Record<MarkdownSection['tone'], string> = {
  syntax: 'border-sky-100 bg-sky-50/40',
  grammar: 'border-emerald-100 bg-emerald-50/40',
  mistakes: 'border-rose-100 bg-rose-50/40',
  practice: 'border-amber-100 bg-amber-50/40',
  default: 'border-slate-200 bg-white',
};

const SECTION_DOTS: Record<MarkdownSection['tone'], string> = {
  syntax: 'bg-sky-400',
  grammar: 'bg-emerald-400',
  mistakes: 'bg-rose-400',
  practice: 'bg-amber-400',
  default: 'bg-slate-300',
};

export const MarkdownStudyArticle = ({ markdown }: MarkdownStudyArticleProps) => {
  const split = splitStudyArticleMarkdown(markdown);
  const sections = splitIntoSections(split.lessonMarkdown);

  return (
    <div className='min-w-0 space-y-4'>
      {sections.map((section) => (
        <section
          key={`${section.title}-${section.body.slice(0, 20)}`}
          className={`rounded-lg border p-4 shadow-sm ${SECTION_STYLES[section.tone]}`}
        >
          <div className='mb-3 flex items-center gap-2'>
            <span
              className={`h-2.5 w-2.5 rounded-full ${SECTION_DOTS[section.tone]}`}
              aria-hidden
            />
            <h3 className='text-xs font-black uppercase tracking-normal text-slate-700'>
              {section.title}
            </h3>
          </div>
          <MarkdownBlock markdown={section.body} />
        </section>
      ))}

      {split.answerMarkdown ? (
        <details className='rounded-lg border border-emerald-200 bg-emerald-50 p-4 shadow-sm'>
          <summary className='flex cursor-pointer list-none items-center gap-2 text-sm font-black text-emerald-900'>
            <CheckCircle2 size={16} />
            {split.answerHeading}
          </summary>
          <div className='mt-4 border-t border-emerald-200 pt-4'>
            <MarkdownBlock markdown={split.answerMarkdown} />
          </div>
        </details>
      ) : null}
    </div>
  );
};
