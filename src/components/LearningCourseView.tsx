import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';

type LearningCourseViewProps = {
  markdown: string;
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
        'mt-6 text-lg font-black leading-tight text-slate-950 first:mt-0',
      )}
    />
  ),
  h2: (props) => (
    <h3
      {...withClassName(
        withoutNode(props),
        'mt-6 text-base font-black leading-tight text-slate-950 first:mt-0',
      )}
    />
  ),
  h3: (props) => (
    <h4
      {...withClassName(
        withoutNode(props),
        'mt-5 text-sm font-black leading-tight text-slate-950',
      )}
    />
  ),
  p: (props) => (
    <p
      {...withClassName(
        withoutNode(props),
        'mt-3 whitespace-pre-line text-sm leading-6 text-slate-700 first:mt-0',
      )}
    />
  ),
  ul: (props) => (
    <ul
      {...withClassName(
        withoutNode(props),
        'mt-3 space-y-1.5 pl-5 text-sm leading-6 text-slate-700',
      )}
    />
  ),
  ol: (props) => (
    <ol
      {...withClassName(
        withoutNode(props),
        'mt-3 space-y-1.5 pl-5 text-sm leading-6 text-slate-700',
      )}
    />
  ),
  li: (props) => (
    <li
      {...withClassName(withoutNode(props), 'pl-1 marker:font-bold marker:text-slate-400')}
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
        'border-b border-slate-200 px-3 py-2 align-top font-black',
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
  hr: (props) => (
    <hr {...withClassName(withoutNode(props), 'my-6 border-slate-200')} />
  ),
  blockquote: (props) => (
    <blockquote
      {...withClassName(
        withoutNode(props),
        'mt-4 rounded-md border border-emerald-100 bg-emerald-50 px-4 py-3 text-slate-700',
      )}
    />
  ),
};

export const LearningCourseView = ({ markdown }: LearningCourseViewProps) => (
  <div className='min-w-0'>
    <ReactMarkdown components={markdownComponents} remarkPlugins={[remarkGfm]}>
      {markdown}
    </ReactMarkdown>
  </div>
);
