import type { ComponentProps } from 'react';
import { LearningView } from '../../components/LearningView';

type LearningRouteProps = ComponentProps<typeof LearningView> & {
  historyError: string;
};

export const LearningRoute = ({
  historyError,
  ...learningViewProps
}: LearningRouteProps) => (
  <>
    {historyError ? (
      <div className='border-b border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700'>
        {historyError}
      </div>
    ) : null}
    <LearningView {...learningViewProps} />
  </>
);
