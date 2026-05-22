interface Props {
  selected: string[];
  onRemove: (table: string) => void;
  disabled?: boolean;
}

export default function FocusTableSummary({ selected, onRemove, disabled }: Props) {
  if (selected.length === 0) return null;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-2">
      <p className="mono-label text-[9px]">Focus tables</p>
      {selected.map((table) => (
        <span
          key={table}
          className="tag group inline-flex cursor-default items-center gap-1.5 font-mono text-[10px]"
        >
          {table}
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRemove(table)}
            className="px-0.5 text-sm leading-none text-ink-400 transition-colors group-hover:text-black disabled:opacity-30"
            aria-label={`Remove ${table} from focus`}
          >
            ×
          </button>
        </span>
      ))}
    </div>
  );
}
