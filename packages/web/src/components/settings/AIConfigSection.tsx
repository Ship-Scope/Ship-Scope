import { useState } from 'react';
import { Loader2, CheckCircle2, XCircle, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useTestAI } from '@/hooks/useSettings';

interface AIConfigSectionProps {
  settings: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}

const MODEL_OPTIONS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (Fast, Affordable)' },
  { value: 'gpt-4o', label: 'GPT-4o (Balanced)' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo (High Quality)' },
];

export function AIConfigSection({ settings, onUpdate }: AIConfigSectionProps) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const testMutation = useTestAI();

  const maskedKey = settings['openai_api_key'] || '';
  const hasKey = maskedKey.length > 0;

  const handleSaveKey = () => {
    if (apiKey.trim()) {
      onUpdate('openai_api_key', apiKey.trim());
      setApiKey('');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <label className="text-sm font-medium text-text-primary block mb-1.5">OpenAI API Key</label>
        {hasKey && (
          <p className="text-xs text-text-muted mb-2">
            Current key: <span className="font-mono">{maskedKey}</span>
          </p>
        )}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <input
              type={showKey ? 'text' : 'password'}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={hasKey ? 'Enter new key to replace...' : 'sk-...'}
              className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted pr-10"
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
            >
              {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
            </button>
          </div>
          <Button size="sm" onClick={handleSaveKey} disabled={!apiKey.trim()}>
            Save
          </Button>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-text-primary block mb-1.5">AI Model</label>
        <select
          value={settings['ai_model'] || 'gpt-4o-mini'}
          onChange={(e) => onUpdate('ai_model', e.target.value)}
          className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
        >
          {MODEL_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => testMutation.mutate()}
          loading={testMutation.isPending}
        >
          Test Connection
        </Button>
        {testMutation.data && (
          <div
            className={`mt-2 flex items-center gap-2 text-sm ${
              testMutation.data.success ? 'text-success' : 'text-danger'
            }`}
          >
            {testMutation.isPending ? (
              <Loader2 size={14} className="animate-spin" />
            ) : testMutation.data.success ? (
              <CheckCircle2 size={14} />
            ) : (
              <XCircle size={14} />
            )}
            {testMutation.data.message}
          </div>
        )}
      </div>
    </div>
  );
}
