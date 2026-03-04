interface FormatToggleProps {
  value: 'cursor' | 'claude_code';
  onChange: (format: 'cursor' | 'claude_code') => void;
}

export function FormatToggle({ value, onChange }: FormatToggleProps) {
  return (
    <div className="inline-flex rounded-lg bg-bg-surface-2 p-0.5">
      <button
        onClick={() => onChange('cursor')}
        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
          value === 'cursor'
            ? 'bg-accent-blue text-white'
            : 'text-text-muted hover:text-text-secondary'
        }`}
      >
        Cursor
      </button>
      <button
        onClick={() => onChange('claude_code')}
        className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
          value === 'claude_code'
            ? 'bg-accent-blue text-white'
            : 'text-text-muted hover:text-text-secondary'
        }`}
      >
        Claude Code
      </button>
    </div>
  );
}
