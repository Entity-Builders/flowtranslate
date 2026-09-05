import type { BreakdownChatMessage } from '@entity-builders/flowtranslate-core';
import {
  AlertCircle,
  Loader2,
  MessageCircleQuestion,
  Send,
} from 'lucide-react';
import { useState } from 'react';

type LearningCourseChatProps = {
  onAskQuestion: (
    question: string,
    history: BreakdownChatMessage[],
  ) => Promise<string>;
};

const starterQuestions = [
  'Podes resumir la clase en 3 puntos?',
  'Dame un ejemplo mas para practicar.',
  'Como uso esto en una conversacion real?',
];

export const LearningCourseChat = ({
  onAskQuestion,
}: LearningCourseChatProps) => {
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<BreakdownChatMessage[]>([]);
  const [asking, setAsking] = useState(false);
  const [chatError, setChatError] = useState('');

  const submitQuestion = async () => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || asking) return;

    const history = messages;
    setQuestion('');
    setChatError('');
    setAsking(true);
    setMessages((current) => [
      ...current,
      { role: 'user', content: trimmedQuestion },
    ]);

    try {
      const answer = await onAskQuestion(trimmedQuestion, history);
      setMessages((current) => [
        ...current,
        { role: 'assistant', content: answer },
      ]);
    } catch (error) {
      setChatError(
        error instanceof Error
          ? error.message
          : 'No pudimos responder esta pregunta.',
      );
    } finally {
      setAsking(false);
    }
  };

  return (
    <div className='flex flex-col gap-3'>
      <div className='flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#6b7280]'>
        <MessageCircleQuestion size={14} />
        Preguntar sobre esta clase
      </div>

      {messages.length ? (
        <div className='max-h-40 space-y-2 overflow-y-auto'>
          {messages.map((message, index) => (
            <div
              key={`${message.role}-${index}-${message.content.slice(0, 20)}`}
              className={`max-w-[92%] break-words rounded-md px-3 py-2 text-[13px] leading-relaxed [overflow-wrap:anywhere] ${
                message.role === 'user'
                  ? 'ml-auto bg-[#0f1117] text-white'
                  : 'bg-white text-[#0f1117] ring-1 ring-black/10'
              }`}
            >
              <div
                className={`mb-1 text-[10px] font-semibold uppercase tracking-wider ${
                  message.role === 'user' ? 'text-white/60' : 'text-[#6b7280]'
                }`}
              >
                {message.role === 'user' ? 'Vos' : 'Tutor'}
              </div>
              {message.content}
            </div>
          ))}
        </div>
      ) : (
        <div className='flex flex-wrap gap-2'>
          {starterQuestions.map((starter) => (
            <button
              key={starter}
              type='button'
              onClick={() => setQuestion(starter)}
              className='rounded-md border border-black/10 bg-white px-2.5 py-1.5 text-left text-[12px] font-medium text-[#6b7280] transition-colors hover:border-black/20 hover:text-[#0f1117]'
            >
              {starter}
            </button>
          ))}
        </div>
      )}

      {chatError ? (
        <div className='flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-2 text-[12px] font-medium leading-5 text-amber-800'>
          <AlertCircle size={14} className='mt-0.5 shrink-0' />
          {chatError}
        </div>
      ) : null}

      <form
        className='flex min-w-0 items-center gap-2'
        onSubmit={(event) => {
          event.preventDefault();
          void submitQuestion();
        }}
      >
        <input
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          disabled={asking}
          aria-label='Preguntar sobre esta clase'
          placeholder='Pregunta algo sobre esta clase...'
          className='min-w-0 flex-1 rounded-md border border-black/10 bg-white px-3 py-2 text-[13px] font-medium text-[#0f1117] outline-none transition focus:border-[#0e7f72] focus:ring-2 focus:ring-[#0e7f72]/15 disabled:bg-black/5'
        />
        <button
          type='submit'
          disabled={!question.trim() || asking}
          aria-label='Enviar pregunta'
          title='Enviar pregunta'
          className={`inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md transition ${
            question.trim() && !asking
              ? 'bg-[#0f1117] text-white hover:bg-black'
              : 'bg-black/10 text-[#9aa1ab]'
          }`}
        >
          {asking ? (
            <Loader2 size={15} className='animate-spin' />
          ) : (
            <Send size={15} />
          )}
        </button>
      </form>
    </div>
  );
};
