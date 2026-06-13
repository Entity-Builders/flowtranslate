export type SuggestionChip = {
  label: string;
  prompt: string;
};

type SuggestionChipsProps = {
  suggestions: SuggestionChip[];
  onSelect: (suggestion: string) => void;
  disabled?: boolean;
};

export const SuggestionChips = ({
  suggestions,
  onSelect,
  disabled,
}: SuggestionChipsProps) => {
  if (!suggestions.length) return null;

  return (
    <div className='mt-3 flex flex-wrap gap-2'>
      {suggestions.map((suggestion) => (
        <button
          key={suggestion.label}
          onClick={() => onSelect(suggestion.prompt)}
          disabled={disabled}
          className='rounded-full border border-brand-200 bg-brand-50 px-3 py-1.5 text-sm font-medium text-brand-700 transition-colors hover:bg-brand-100 disabled:cursor-not-allowed disabled:opacity-50'
        >
          {suggestion.label}
        </button>
      ))}
    </div>
  );
};
