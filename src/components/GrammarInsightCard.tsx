import { Lightbulb, BookOpen } from 'lucide-react';

type GrammarInsightCardProps = {
  tense: string;
  structure: string;
  observation: string;
  onStudyClick?: () => void;
};

export const GrammarInsightCard = ({
  tense,
  structure,
  observation,
  onStudyClick,
}: GrammarInsightCardProps) => {
  return (
    <div className="mt-4 p-4 rounded-xl bg-blue-50 border border-blue-100 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-300">
      <div className="flex items-start gap-3">
        <div className="mt-1 flex-shrink-0 bg-blue-100 p-1.5 rounded-full">
          <Lightbulb className="w-5 h-5 text-blue-600" />
        </div>
        <div className="flex-1 space-y-2">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
            <div>
              <h4 className="font-semibold text-blue-900 text-sm">
                Estructura: {tense}
              </h4>
              <p className="text-blue-800 text-xs font-mono mt-0.5 bg-blue-100/50 inline-block px-1.5 py-0.5 rounded">
                {structure}
              </p>
            </div>

            {onStudyClick && (
              <button
                onClick={onStudyClick}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:outline-none"
              >
                <BookOpen className="w-3.5 h-3.5" />
                Practicar esto
              </button>
            )}
          </div>

          <p className="text-blue-700 text-sm leading-relaxed">
            {observation}
          </p>
        </div>
      </div>
    </div>
  );
};
