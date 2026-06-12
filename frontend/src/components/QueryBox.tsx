interface QueryBoxProps {
  question: string;
  loading: boolean;
  loadingLabel?: string;
  disabled: boolean;
  suggestions: string[];
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export default function QueryBox({ question, loading, loadingLabel = "Processing", disabled, suggestions, onChange, onSubmit }: QueryBoxProps) {
  return (
    <div className="space-y-6">
      <div className="relative">
        <textarea
          value={question}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled || loading}
          rows={5}
          placeholder="Which region generated the highest revenue in Q1?"
          className="input-ink min-h-[140px] resize-none font-sans text-lg leading-relaxed"
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) onSubmit();
          }}
        />
        <div className="absolute bottom-4 right-4 font-mono text-[10px] text-ink-600">
          ⌘ + Enter
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <button type="button" onClick={onSubmit} disabled={disabled || loading || question.trim().length < 3} className="btn-ink min-w-[200px]">
          {loading ? (
            <span className="flex items-center gap-3">
              <span className="h-4 w-4 animate-spin border-2 border-black/20 border-t-black" />
              {loadingLabel}
            </span>
          ) : (
            "Execute Query"
          )}
        </button>
      </div>

      <div>
        <p className="mono-label mb-3">Suggestions</p>
        <div className="flex flex-wrap gap-2">
          {suggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => onChange(s)}
              disabled={disabled || loading}
              className="tag transition hover:border-ink-500 hover:bg-ink-900 hover:text-white disabled:opacity-30"
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
