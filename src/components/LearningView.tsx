import type {
  BreakdownChatMessage,
  ExpressionMode,
  LanguageCode,
  LearningAttempt,
  LearningSession,
  LearningSituation,
  SavedPhrase,
  StudyArticle,
  TranslationRecord,
} from '@eb-packages/flowtranslate-core';
import {
  LEARNING_HISTORY_PERSONALIZATION_THRESHOLD,
  chooseRecommendedLearningSituation,
} from '@eb-packages/flowtranslate-core';
import {
  Archive,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  Clock,
  Loader2,
  LockKeyhole,
  MessageSquareText,
  NotebookPen,
  Play,
  Save,
  Send,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { MAX_LEARNING_HISTORY } from '../constants';
import type { SaveLearningPhraseInput } from '../services/learning-progress';
import { StudyArticleView } from './StudyArticleView';

type AccountKind = 'none' | 'guest' | 'permanent';

type LearningViewProps = {
  history: TranslationRecord[];
  accountKind: AccountKind;
  starterSituations: LearningSituation[];
  learningSessions: LearningSession[];
  savedPhrases: SavedPhrase[];
  activeSession: LearningSession | null;
  progressLoading: boolean;
  progressError: string;
  sessionLoading: boolean;
  sessionError: string;
  selectedBestOptionId: string;
  attemptLoading: boolean;
  attemptError: string;
  latestAttempt: LearningAttempt | null;
  studyArticle: StudyArticle | null;
  studyLoading: boolean;
  studyError: string;
  selectedStudyRecordId: string | null;
  onStartSession: (situationId?: string) => void;
  onResumeSession: (session: LearningSession) => void;
  onLeaveSession: () => void;
  onSelectBestOption: (choiceId: string) => void;
  onSubmitAttempt: (attemptText: string) => void;
  onSavePhrase: (input: SaveLearningPhraseInput) => void;
  onArchivePhrase: (id: string) => void;
  onCompleteSession: () => void;
  onUsePhraseInResponder: (text: string) => void;
  onOpenStudy: (record: TranslationRecord) => void;
  onCloseStudy: () => void;
  onListenPhrase?: (language: LanguageCode, text: string) => void;
  onAskBreakdownQuestion?: (
    record: TranslationRecord,
    question: string,
    history: BreakdownChatMessage[],
  ) => Promise<string>;
  upgradePrompt?: ReactNode;
  onDelete: (id: string) => void;
  onClear: () => void;
};

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('es', {
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));

const formatDirection = (
  record: Pick<TranslationRecord, 'sourceLanguage' | 'targetLanguage'>,
) => `${record.sourceLanguage.toUpperCase()} a ${record.targetLanguage.toUpperCase()}`;

const modeLabel: Record<ExpressionMode, string> = {
  translate_to_english: 'Espanol a ingles',
  improve_english: 'Ingles mejorado',
  translate_to_spanish: 'Ingles a espanol',
};

const formatRecordLabel = (record: TranslationRecord) =>
  record.mode ? modeLabel[record.mode] : formatDirection(record);

const isStarterSessionId = (sessionId: string) => sessionId.startsWith('starter-');

const naturalnessLabel: Record<LearningAttempt['feedback']['naturalness'], string> = {
  strong: 'Suena natural',
  close: 'Esta cerca',
  needs_work: 'Hay que pulirlo',
};

const sourceRecordForSession = (
  session: LearningSession,
  history: TranslationRecord[],
) =>
  history.find((record) => session.sourceRecordIds.includes(record.id)) ||
  history[0] ||
  null;

const sessionSortTime = (session: LearningSession) => {
  const timestamp = session.completedAt || session.createdAt;
  const parsed = Date.parse(timestamp);
  return Number.isNaN(parsed) ? 0 : parsed;
};

const compactSessionsBySituation = (sessions: LearningSession[]) => {
  const sessionsBySituation = new Map<string, LearningSession>();

  sessions
    .filter((session) => session.status !== 'archived')
    .forEach((session) => {
      const current = sessionsBySituation.get(session.situationId);
      if (!current || sessionSortTime(session) > sessionSortTime(current)) {
        sessionsBySituation.set(session.situationId, session);
      }
    });

  return Array.from(sessionsBySituation.values()).sort(
    (first, second) => sessionSortTime(second) - sessionSortTime(first),
  );
};

const findReusableSession = (
  sessions: LearningSession[],
  situationId: string,
) =>
  sessions.find((session) => session.situationId === situationId) || null;

const practiceActionLabel = (session: LearningSession | null) => {
  if (!session) return 'Empezar practica';
  return session.status === 'completed' ? 'Repasar practica' : 'Continuar practica';
};

const practiceStatusLabel = (session: LearningSession) =>
  session.status === 'completed' ? 'Completada' : 'En progreso';

const compactPracticeActionLabel = (session: LearningSession) =>
  session.status === 'completed' ? 'Repasar' : 'Continuar';

const FocusedSessionView = ({
  session,
  history,
  selectedBestOptionId,
  attemptLoading,
  attemptError,
  latestAttempt,
  sessionError,
  onBack,
  onSelectBestOption,
  onSubmitAttempt,
  onSavePhrase,
  onCompleteSession,
  onUsePhraseInResponder,
  onOpenStudy,
}: {
  session: LearningSession;
  history: TranslationRecord[];
  selectedBestOptionId: string;
  attemptLoading: boolean;
  attemptError: string;
  latestAttempt: LearningAttempt | null;
  sessionError: string;
  onBack: () => void;
  onSelectBestOption: (choiceId: string) => void;
  onSubmitAttempt: (attemptText: string) => void;
  onSavePhrase: (input: SaveLearningPhraseInput) => void;
  onCompleteSession: () => void;
  onUsePhraseInResponder: (text: string) => void;
  onOpenStudy: (record: TranslationRecord) => void;
}) => {
  const [rewriteText, setRewriteText] = useState('');
  const [saveMessage, setSaveMessage] = useState('');
  const selectedChoice = session.content.bestOption.choices.find(
    (choice) => choice.id === selectedBestOptionId,
  );
  const sourceRecord = sourceRecordForSession(session, history);
  const completed = session.status === 'completed';
  const persistedSessionId = isStarterSessionId(session.id) ? null : session.id;

  useEffect(() => {
    setRewriteText('');
    setSaveMessage('');
  }, [session.id]);

  const savePhrase = (text: string, note?: string) => {
    onSavePhrase({
      text,
      note,
      situationId: session.situationId,
      catalogVersion: session.catalogVersion,
      sessionId: persistedSessionId,
      sourceRecordIds: session.sourceRecordIds,
    });
    setSaveMessage('Frase enviada a tu repertorio.');
  };

  return (
    <main className='min-h-0 flex-1 overflow-y-auto bg-[#f6f7f4] px-4 py-5 sm:px-6'>
      <div className='mx-auto flex max-w-5xl flex-col gap-4'>
        <button
          type='button'
          onClick={onBack}
          className='inline-flex w-fit items-center gap-2 rounded-md px-2 py-2 text-sm font-bold text-slate-600 hover:bg-white hover:text-slate-950'
        >
          <ArrowLeft size={16} />
          Volver a Aprender
        </button>

        <section className='rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200/70 sm:p-6'>
          <div className='flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between'>
            <div className='min-w-0'>
              <p className='text-sm font-bold text-emerald-700'>Practica enfocada</p>
              <h2 className='mt-2 text-3xl font-black leading-tight text-slate-950'>
                {session.content.situationTitle}
              </h2>
              <p className='mt-3 max-w-2xl text-base leading-7 text-slate-600'>
                {session.content.whyItWorks}
              </p>
            </div>
            <div className='flex shrink-0 flex-wrap gap-2'>
              {sourceRecord ? (
                <button
                  type='button'
                  onClick={() => onOpenStudy(sourceRecord)}
                  className='inline-flex h-10 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50'
                >
                  <BookOpen size={16} />
                  Ver explicacion completa
                </button>
              ) : null}
              <button
                type='button'
                onClick={() => onUsePhraseInResponder(session.content.anchorPhrase)}
                className='inline-flex h-10 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-bold text-white hover:bg-slate-800'
              >
                <Send size={16} />
                Usar en Responder
              </button>
            </div>
          </div>

          <div className='mt-6 rounded-lg bg-slate-950 p-5 text-white'>
            <p className='text-sm font-bold text-emerald-200'>Frase ancla</p>
            <p className='mt-2 text-3xl font-black leading-tight'>
              {session.content.anchorPhrase}
            </p>
            <button
              type='button'
              onClick={() => savePhrase(session.content.anchorPhrase, 'Frase ancla')}
              className='mt-4 inline-flex h-10 items-center gap-2 rounded-md bg-white px-3 text-sm font-bold text-slate-950 hover:bg-emerald-50'
            >
              <Save size={16} />
              Guardar frase
            </button>
          </div>

          {sessionError ? (
            <div className='mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800'>
              {sessionError}
            </div>
          ) : null}
          {saveMessage ? (
            <div className='mt-4 rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800'>
              {saveMessage}
            </div>
          ) : null}
        </section>

        <section className='grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]'>
          <div className='rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200/70'>
            <h3 className='flex items-center gap-2 text-lg font-black text-slate-950'>
              <NotebookPen size={19} />
              Estructura que conviene notar
            </h3>
            <div className='mt-4 space-y-3'>
              {session.content.grammarNotes.map((note) => (
                <article key={`${note.label}-${note.text}`} className='rounded-md bg-slate-50 p-3'>
                  <p className='text-xs font-black uppercase text-slate-400'>
                    {note.label}
                  </p>
                  <p className='mt-2 text-base font-black text-slate-950'>
                    {note.text}
                  </p>
                  <p className='mt-1 text-sm leading-6 text-slate-600'>
                    {note.note}
                  </p>
                </article>
              ))}
            </div>
          </div>

          <div className='rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200/70'>
            <h3 className='flex items-center gap-2 text-lg font-black text-slate-950'>
              <MessageSquareText size={19} />
              Elegi la mejor opcion
            </h3>
            <p className='mt-2 text-sm leading-6 text-slate-600'>
              {session.content.bestOption.prompt}
            </p>
            <div className='mt-4 space-y-3'>
              {session.content.bestOption.choices.map((choice) => {
                const selected = choice.id === selectedBestOptionId;
                return (
                  <button
                    key={choice.id}
                    type='button'
                    onClick={() => onSelectBestOption(choice.id)}
                    className={`flex w-full items-start justify-between gap-3 rounded-md border p-4 text-left transition-colors ${
                      selected
                        ? choice.preferred
                          ? 'border-emerald-300 bg-emerald-50'
                          : 'border-amber-300 bg-amber-50'
                        : 'border-slate-200 bg-white hover:bg-slate-50'
                    }`}
                  >
                    <span className='text-base font-bold leading-6 text-slate-950'>
                      {choice.text}
                    </span>
                    {selected ? (
                      <CheckCircle2
                        size={20}
                        className={choice.preferred ? 'text-emerald-600' : 'text-amber-600'}
                      />
                    ) : null}
                  </button>
                );
              })}
            </div>
            {selectedChoice ? (
              <p className='mt-4 rounded-md bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-700'>
                {selectedChoice.feedback}
              </p>
            ) : null}
          </div>
        </section>

        <section className='rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200/70'>
          <h3 className='text-lg font-black text-slate-950'>Tu version</h3>
          <p className='mt-2 text-sm leading-6 text-slate-600'>
            {session.content.rewritePrompt}
          </p>
          <form
            className='mt-4 space-y-3'
            onSubmit={(event) => {
              event.preventDefault();
              onSubmitAttempt(rewriteText);
            }}
          >
            <label className='sr-only' htmlFor='learning-rewrite'>
              Tu version en ingles
            </label>
            <textarea
              id='learning-rewrite'
              value={rewriteText}
              onChange={(event) => setRewriteText(event.target.value)}
              className='min-h-28 w-full resize-none rounded-md border border-slate-200 bg-white p-4 text-base leading-7 text-slate-950 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100'
              placeholder='Escribi una respuesta corta en ingles...'
            />
            <div className='flex flex-wrap items-center gap-3'>
              <button
                type='submit'
                disabled={attemptLoading || !rewriteText.trim()}
                className='inline-flex h-11 items-center gap-2 rounded-md bg-emerald-600 px-4 text-sm font-black text-white hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400'
              >
                {attemptLoading ? <Loader2 size={16} className='animate-spin' /> : <Sparkles size={16} />}
                Revisar mi version
              </button>
              {completed ? (
                <span className='inline-flex items-center gap-2 text-sm font-bold text-emerald-700'>
                  <CheckCircle2 size={16} />
                  Practica completada
                </span>
              ) : null}
            </div>
          </form>

          {attemptError ? (
            <div className='mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800'>
              {attemptError}
            </div>
          ) : null}

          {latestAttempt ? (
            <div className='mt-5 rounded-lg bg-slate-50 p-4'>
              <div className='flex flex-wrap items-center gap-2'>
                <span className='rounded-md bg-white px-2 py-1 text-xs font-black uppercase text-emerald-700'>
                  {naturalnessLabel[latestAttempt.feedback.naturalness]}
                </span>
                <p className='text-sm font-semibold text-slate-600'>
                  {latestAttempt.feedback.summary}
                </p>
              </div>
              <p className='mt-3 text-xs font-black uppercase text-slate-400'>
                Version mejorada
              </p>
              <p className='mt-2 text-xl font-black leading-snug text-slate-950'>
                {latestAttempt.feedback.improvedVersion}
              </p>
              <div className='mt-3 flex flex-wrap gap-2'>
                <button
                  type='button'
                  onClick={() =>
                    savePhrase(latestAttempt.feedback.improvedVersion, 'Version mejorada')
                  }
                  className='inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50'
                >
                  <Save size={15} />
                  Guardar version
                </button>
                <button
                  type='button'
                  onClick={() =>
                    onUsePhraseInResponder(latestAttempt.feedback.improvedVersion)
                  }
                  className='inline-flex h-9 items-center gap-2 rounded-md bg-slate-950 px-3 text-sm font-bold text-white hover:bg-slate-800'
                >
                  <Send size={15} />
                  Usar en Responder
                </button>
              </div>
              {latestAttempt.feedback.notes.length > 0 ? (
                <div className='mt-4 grid gap-3 md:grid-cols-2'>
                  {latestAttempt.feedback.notes.map((note) => (
                    <article key={`${note.label}-${note.text}`} className='rounded-md bg-white p-3'>
                      <p className='text-xs font-black uppercase text-slate-400'>
                        {note.label}
                      </p>
                      <p className='mt-1 font-black text-slate-950'>{note.text}</p>
                      <p className='mt-1 text-sm leading-6 text-slate-600'>
                        {note.note}
                      </p>
                    </article>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <section className='rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200/70'>
          <div className='flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between'>
            <div>
              <h3 className='text-lg font-black text-slate-950'>Frases para guardar</h3>
              <p className='mt-1 text-sm text-slate-600'>
                Chunks que conviene tener listos para mensajes parecidos.
              </p>
            </div>
            <button
              type='button'
              onClick={onCompleteSession}
              className='inline-flex h-11 items-center justify-center gap-2 rounded-md bg-slate-950 px-4 text-sm font-black text-white hover:bg-slate-800'
            >
              <CheckCircle2 size={16} />
              {completed ? 'Completada' : 'Completar practica'}
            </button>
          </div>
          <div className='mt-4 grid gap-3 md:grid-cols-3'>
            {session.content.suggestedPhrases.map((phrase) => (
              <article key={phrase} className='rounded-md bg-slate-50 p-3'>
                <p className='text-base font-black leading-6 text-slate-950'>
                  {phrase}
                </p>
                <button
                  type='button'
                  onClick={() => savePhrase(phrase, session.content.situationTitle)}
                  className='mt-3 inline-flex h-9 items-center gap-2 rounded-md bg-white px-3 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-emerald-50 hover:text-emerald-800'
                >
                  <Save size={15} />
                  Guardar
                </button>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
};

export const LearningView = ({
  history,
  accountKind,
  starterSituations,
  learningSessions,
  savedPhrases,
  activeSession,
  progressLoading,
  progressError,
  sessionLoading,
  sessionError,
  selectedBestOptionId,
  attemptLoading,
  attemptError,
  latestAttempt,
  studyArticle,
  studyLoading,
  studyError,
  selectedStudyRecordId,
  onStartSession,
  onResumeSession,
  onLeaveSession,
  onSelectBestOption,
  onSubmitAttempt,
  onSavePhrase,
  onArchivePhrase,
  onCompleteSession,
  onUsePhraseInResponder,
  onOpenStudy,
  onCloseStudy,
  onListenPhrase,
  onAskBreakdownQuestion,
  upgradePrompt,
  onDelete,
  onClear,
}: LearningViewProps) => {
  const [historyOpen, setHistoryOpen] = useState(false);
  const recommendation = useMemo(
    () =>
      chooseRecommendedLearningSituation(history, {
        catalog: starterSituations,
      }),
    [history, starterSituations],
  );
  const recommended = recommendation.recommended;
  const otherCandidates = recommendation.candidates.filter(
    (candidate) => candidate.situation.id !== recommended.id,
  );
  const selectedStudyRecord = history.find(
    (record) => record.id === selectedStudyRecordId,
  );
  const studyIsOpen = Boolean(
    selectedStudyRecordId || studyArticle || studyLoading || studyError,
  );
  const compactLearningSessions = useMemo(
    () => compactSessionsBySituation(learningSessions),
    [learningSessions],
  );
  const completedSessions = new Set(
    learningSessions
      .filter((session) => session.status === 'completed')
      .map((session) => session.situationId),
  ).size;
  const recommendedSession = findReusableSession(
    compactLearningSessions,
    recommended.id,
  );
  const existingPracticeSituationIds = new Set(
    compactLearningSessions.map((session) => session.situationId),
  );
  const activeSavedPhrases = savedPhrases.filter((phrase) => !phrase.archivedAt);
  const thinHistory = history.length < LEARNING_HISTORY_PERSONALIZATION_THRESHOLD;
  const personalizedReady = accountKind === 'permanent' && recommendation.personalized;
  const recentSessions = compactLearningSessions
    .filter((session) => session.situationId !== recommended.id)
    .sort((first, second) => {
      if (first.status !== second.status) {
        return first.status === 'active' ? -1 : 1;
      }

      return sessionSortTime(second) - sessionSortTime(first);
    })
    .slice(0, 3);
  const freshOtherCandidates = otherCandidates.filter(
    (candidate) => !existingPracticeSituationIds.has(candidate.situation.id),
  );
  const recentHistory = history.slice(0, 8);

  if (studyIsOpen) {
    return (
      <main className='min-h-0 flex-1 overflow-y-auto bg-[#f6f7f4] p-3 sm:p-5'>
        <StudyArticleView
          article={studyArticle}
          selectedRecord={selectedStudyRecord}
          loading={studyLoading}
          error={studyError}
          onClose={onCloseStudy}
          onListenPhrase={onListenPhrase}
          onAskBreakdownQuestion={onAskBreakdownQuestion}
        />
      </main>
    );
  }

  if (activeSession) {
    return (
      <FocusedSessionView
        session={activeSession}
        history={history}
        selectedBestOptionId={selectedBestOptionId}
        attemptLoading={attemptLoading}
        attemptError={attemptError}
        latestAttempt={latestAttempt}
        sessionError={sessionError}
        onBack={onLeaveSession}
        onSelectBestOption={onSelectBestOption}
        onSubmitAttempt={onSubmitAttempt}
        onSavePhrase={onSavePhrase}
        onCompleteSession={onCompleteSession}
        onUsePhraseInResponder={onUsePhraseInResponder}
        onOpenStudy={onOpenStudy}
      />
    );
  }

  return (
    <main className='min-h-0 flex-1 overflow-y-auto bg-[#f6f7f4] px-4 py-5 sm:px-6'>
      <div className='mx-auto flex max-w-7xl flex-col gap-5'>
        <section className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]'>
          <div className='rounded-lg bg-slate-950 p-5 text-white shadow-sm sm:p-6'>
            <div className='flex flex-wrap items-center gap-2'>
              <span className='inline-flex items-center gap-2 rounded-md bg-emerald-400/15 px-3 py-1 text-sm font-black text-emerald-200'>
                <Sparkles size={15} />
                Hoy en tu ingles
              </span>
              <span className='rounded-md bg-white/10 px-3 py-1 text-sm font-bold text-slate-200'>
                {personalizedReady ? 'Personalizado por historial' : 'Starter pack'}
              </span>
            </div>
            <h2 className='mt-5 max-w-3xl text-4xl font-black leading-tight sm:text-5xl'>
              {recommended.title}
            </h2>
            <p className='mt-4 max-w-2xl text-base leading-7 text-slate-300'>
              {recommended.description}
            </p>
            <div className='mt-5 rounded-lg bg-white/10 p-4 ring-1 ring-white/10'>
              <p className='text-sm font-black uppercase text-slate-400'>
                Frase que vas a practicar
              </p>
              <p className='mt-2 text-2xl font-black leading-snug'>
                {recommended.samplePhrases[0]}
              </p>
            </div>
            {sessionError ? (
              <div className='mt-4 rounded-md border border-amber-300/40 bg-amber-100 px-3 py-2 text-sm font-semibold text-amber-900'>
                {sessionError}
              </div>
            ) : null}
            <div className='mt-5 flex flex-wrap items-center gap-3'>
              <button
                type='button'
                onClick={() => onStartSession(recommended.id)}
                disabled={sessionLoading}
                className='inline-flex h-12 items-center gap-2 rounded-md bg-emerald-400 px-4 text-sm font-black text-slate-950 hover:bg-emerald-300 disabled:bg-slate-700 disabled:text-slate-400'
              >
                {sessionLoading ? <Loader2 size={17} className='animate-spin' /> : <Play size={17} />}
                {practiceActionLabel(recommendedSession)}
              </button>
              {accountKind !== 'permanent' ? (
                <span className='inline-flex items-center gap-2 text-sm font-semibold text-slate-300'>
                  <LockKeyhole size={15} />
                  Feedback y guardado requieren cuenta.
                </span>
              ) : null}
            </div>
          </div>

          <aside className='rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200/70'>
            <h3 className='text-lg font-black text-slate-950'>Progreso suave</h3>
            <p className='mt-1 text-sm leading-6 text-slate-600'>
              Sin puntos ni niveles: solo situaciones practicadas y frases que podes volver a usar.
            </p>
            {progressLoading ? (
              <div className='mt-4 inline-flex items-center gap-2 text-sm font-bold text-slate-500'>
                <Loader2 size={16} className='animate-spin' />
                Cargando progreso
              </div>
            ) : null}
            {progressError ? (
              <div className='mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-800'>
                {progressError}
              </div>
            ) : null}
            <dl className='mt-5 space-y-4'>
              <div>
                <dt className='text-xs font-black uppercase text-slate-400'>
                  Practicas completadas
                </dt>
                <dd className='mt-1 text-2xl font-black text-slate-950'>
                  {completedSessions}
                </dd>
              </div>
              <div>
                <dt className='text-xs font-black uppercase text-slate-400'>
                  Frases guardadas
                </dt>
                <dd className='mt-1 text-2xl font-black text-slate-950'>
                  {activeSavedPhrases.length}
                </dd>
              </div>
              <div>
                <dt className='text-xs font-black uppercase text-slate-400'>
                  Historial disponible
                </dt>
                <dd className='mt-1 text-sm font-bold text-slate-700'>
                  {Math.min(history.length, MAX_LEARNING_HISTORY)} respuestas recientes
                </dd>
              </div>
            </dl>
            {thinHistory ? (
              <p className='mt-5 rounded-md bg-emerald-50 p-3 text-sm font-semibold leading-6 text-emerald-900'>
                Con algunas respuestas mas, la recomendacion empieza a salir de tus propios mensajes.
              </p>
            ) : null}
            {upgradePrompt ? <div className='mt-5'>{upgradePrompt}</div> : null}
          </aside>
        </section>

        {recentSessions.length > 0 ? (
          <section className='rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200/70'>
            <div>
              <h3 className='text-lg font-black text-slate-950'>Tus practicas</h3>
              <p className='mt-1 text-sm leading-6 text-slate-600'>
                Lo pendiente queda primero; lo completado queda como repaso.
              </p>
            </div>
            <div className='mt-4 grid gap-3 md:grid-cols-3'>
              {recentSessions.map((session) => (
                <button
                  key={session.id}
                  type='button'
                  onClick={() => onResumeSession(session)}
                  className='group rounded-md bg-slate-50 p-4 text-left ring-1 ring-slate-100 hover:bg-white hover:ring-emerald-200'
                >
                  <p className='line-clamp-2 text-base font-black leading-6 text-slate-950'>
                    {session.content.situationTitle}
                  </p>
                  <p className='mt-2 text-sm font-semibold text-slate-500'>
                    {practiceStatusLabel(session)}
                  </p>
                  <span className='mt-3 inline-flex items-center gap-2 text-sm font-black text-emerald-700'>
                    {compactPracticeActionLabel(session)}
                    <ArrowRight size={15} className='transition group-hover:translate-x-0.5' />
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        <section
          className={`grid gap-4 ${
            freshOtherCandidates.length > 0
              ? 'xl:grid-cols-[minmax(0,1fr)_380px]'
              : ''
          }`}
        >
          {freshOtherCandidates.length > 0 ? (
            <div className='rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200/70'>
              <div className='flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between'>
                <div>
                  <h3 className='text-lg font-black text-slate-950'>Practicar otra situacion</h3>
                  <p className='mt-1 text-sm text-slate-600'>
                    Opciones nuevas para cambiar de contexto sin navegar el historial.
                  </p>
                </div>
              </div>
              <div className='mt-4 grid gap-3 md:grid-cols-2'>
                {freshOtherCandidates.map((candidate) => (
                  <button
                    key={candidate.situation.id}
                    type='button'
                    onClick={() => onStartSession(candidate.situation.id)}
                    disabled={sessionLoading}
                    className='group rounded-md bg-slate-50 p-4 text-left ring-1 ring-slate-100 transition hover:bg-white hover:ring-emerald-200 disabled:opacity-60'
                  >
                    <p className='text-base font-black leading-6 text-slate-950'>
                      {candidate.situation.title}
                    </p>
                    <p className='mt-2 line-clamp-2 text-sm leading-6 text-slate-600'>
                      {candidate.situation.description}
                    </p>
                    <span className='mt-3 inline-flex items-center gap-2 text-sm font-black text-emerald-700'>
                      Empezar practica
                      <ArrowRight size={15} className='transition group-hover:translate-x-0.5' />
                    </span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <section className='rounded-lg bg-white p-5 shadow-sm ring-1 ring-slate-200/70'>
            <h3 className='text-lg font-black text-slate-950'>Frases guardadas</h3>
            <p className='mt-1 text-sm leading-6 text-slate-600'>
              Tu repertorio chico, practico y listo para copiar.
            </p>
            <div className='mt-4 space-y-3'>
              {activeSavedPhrases.length === 0 ? (
                <p className='rounded-md bg-slate-50 p-3 text-sm font-semibold leading-6 text-slate-500'>
                  Cuando guardes una frase de una practica, va a aparecer aca.
                </p>
              ) : (
                activeSavedPhrases.slice(0, 5).map((phrase) => (
                  <article key={phrase.id} className='rounded-md bg-slate-50 p-3'>
                    <p className='text-base font-black leading-6 text-slate-950'>
                      {phrase.text}
                    </p>
                    {phrase.note ? (
                      <p className='mt-1 text-sm leading-6 text-slate-600'>
                        {phrase.note}
                      </p>
                    ) : null}
                    <div className='mt-3 flex flex-wrap gap-2'>
                      <button
                        type='button'
                        onClick={() => onUsePhraseInResponder(phrase.text)}
                        className='inline-flex h-9 items-center gap-2 rounded-md bg-white px-3 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-emerald-50'
                      >
                        <Send size={15} />
                        Usar
                      </button>
                      <button
                        type='button'
                        onClick={() => onArchivePhrase(phrase.id)}
                        className='inline-flex h-9 items-center gap-2 rounded-md bg-white px-3 text-sm font-bold text-slate-500 ring-1 ring-slate-200 hover:bg-rose-50 hover:text-rose-700'
                      >
                        <Archive size={15} />
                        Archivar
                      </button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </section>

        <section className='rounded-lg bg-white shadow-sm ring-1 ring-slate-200/70'>
          <button
            type='button'
            onClick={() => setHistoryOpen((current) => !current)}
            className='flex w-full items-center justify-between gap-3 p-5 text-left'
          >
            <span>
              <span className='flex items-center gap-2 text-lg font-black text-slate-950'>
                <Clock size={18} />
                Fuentes recientes
              </span>
              <span className='mt-1 block text-sm text-slate-600'>
                Historial para estudiar en detalle, borrar o limpiar.
              </span>
            </span>
            <ChevronDown
              size={19}
              className={`shrink-0 text-slate-400 transition ${
                historyOpen ? 'rotate-180' : ''
              }`}
            />
          </button>

          {historyOpen ? (
            <div className='border-t border-slate-100 p-5'>
              <div className='mb-4 flex flex-wrap items-center justify-between gap-3'>
                <p className='text-sm font-semibold text-slate-500'>
                  {history.length
                    ? `${history.length} respuestas guardadas`
                    : 'Todavia no hay historial guardado'}
                </p>
                <button
                  type='button'
                  onClick={onClear}
                  disabled={history.length === 0}
                  className='inline-flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3 text-sm font-bold text-slate-500 hover:bg-rose-50 hover:text-rose-700 disabled:opacity-40'
                >
                  <Trash2 size={15} />
                  Limpiar
                </button>
              </div>
              {recentHistory.length === 0 ? (
                <p className='rounded-md bg-slate-50 p-4 text-sm leading-6 text-slate-500'>
                  Guarda respuestas desde `Responder` y van a alimentar recomendaciones personales.
                </p>
              ) : (
                <div className='grid gap-3 md:grid-cols-2'>
                  {recentHistory.map((record) => (
                    <article key={record.id} className='rounded-md bg-slate-50 p-4'>
                      <p className='text-xs font-black uppercase text-slate-400'>
                        {formatRecordLabel(record)} - {formatDate(record.createdAt)}
                      </p>
                      <p className='mt-2 line-clamp-2 text-sm font-black leading-6 text-slate-950'>
                        {record.translatedText}
                      </p>
                      <p className='mt-1 line-clamp-2 text-sm leading-6 text-slate-600'>
                        {record.sourceText}
                      </p>
                      <div className='mt-3 flex flex-wrap gap-2'>
                        <button
                          type='button'
                          onClick={() => onOpenStudy(record)}
                          className='inline-flex h-9 items-center gap-2 rounded-md bg-white px-3 text-sm font-bold text-slate-700 ring-1 ring-slate-200 hover:bg-emerald-50'
                        >
                          <BookOpen size={15} />
                          Estudiar
                        </button>
                        <button
                          type='button'
                          onClick={() => onDelete(record.id)}
                          className='inline-flex h-9 items-center gap-2 rounded-md bg-white px-3 text-sm font-bold text-slate-500 ring-1 ring-slate-200 hover:bg-rose-50 hover:text-rose-700'
                        >
                          <Trash2 size={15} />
                          Borrar
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </div>
          ) : null}
        </section>
      </div>
    </main>
  );
};
