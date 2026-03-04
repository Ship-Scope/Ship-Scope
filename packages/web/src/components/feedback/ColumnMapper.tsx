import { Check } from 'lucide-react';

interface ColumnMapperProps {
  headers: string[];
  mapping: Record<string, string>;
  suggestedMapping: Record<string, string | undefined>;
  onChange: (field: string, column: string) => void;
}

const FIELDS = [
  { key: 'content', label: 'Content', required: true },
  { key: 'author', label: 'Author', required: false },
  { key: 'email', label: 'Email', required: false },
  { key: 'channel', label: 'Channel', required: false },
  { key: 'date', label: 'Date', required: false },
];

export function ColumnMapper({ headers, mapping, suggestedMapping, onChange }: ColumnMapperProps) {
  const selectClasses =
    'w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary focus:outline-none focus:border-accent-blue';

  return (
    <div className="space-y-3">
      <p className="text-xs text-text-muted font-medium uppercase tracking-wider mb-2">
        Column Mapping
      </p>
      {FIELDS.map((field) => {
        const isSuggested =
          suggestedMapping[field.key] === mapping[field.key] && mapping[field.key];
        return (
          <div key={field.key} className="flex items-center gap-3">
            <span className="text-sm text-text-primary w-20 shrink-0">
              {field.label}
              {field.required && <span className="text-danger">*</span>}
            </span>
            <div className="flex-1 relative">
              <select
                value={mapping[field.key] || ''}
                onChange={(e) => onChange(field.key, e.target.value)}
                className={selectClasses}
              >
                <option value="">— Skip —</option>
                {headers.map((h) => (
                  <option key={h} value={h}>
                    {h}
                  </option>
                ))}
              </select>
            </div>
            {isSuggested && (
              <span className="flex items-center gap-1 text-xs text-success whitespace-nowrap">
                <Check size={12} /> Detected
              </span>
            )}
          </div>
        );
      })}
      {!mapping.content && (
        <p className="text-xs text-danger mt-2">
          Content column is required. Select which column contains the feedback text.
        </p>
      )}
    </div>
  );
}
