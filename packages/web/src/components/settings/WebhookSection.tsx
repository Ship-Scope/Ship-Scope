import { useState } from 'react';
import { Copy, Plus, Trash2, Key } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useApiKeys, useCreateApiKey, useRevokeApiKey } from '@/hooks/useSettings';
import { formatDate } from '@/lib/utils';

export function WebhookSection() {
  const { data: apiKeys, isLoading } = useApiKeys();
  const createMutation = useCreateApiKey();
  const revokeMutation = useRevokeApiKey();
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyValue, setNewKeyValue] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const webhookUrl = `${window.location.origin}/api/feedback/webhook`;

  const handleCopyUrl = async () => {
    await navigator.clipboard.writeText(webhookUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateKey = async () => {
    const result = await createMutation.mutateAsync(newKeyName || undefined);
    setNewKeyValue(result.key);
    setNewKeyName('');
  };

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-sm font-medium text-text-primary mb-1">Webhook URL</h4>
        <p className="text-xs text-text-muted mb-2">
          Send POST requests to this URL to ingest feedback from external services.
        </p>
        <div className="flex items-center gap-2">
          <code className="flex-1 bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs font-mono text-text-secondary truncate">
            {webhookUrl}
          </code>
          <Button variant="secondary" size="sm" onClick={handleCopyUrl}>
            <Copy size={14} />
            {copied ? 'Copied!' : 'Copy'}
          </Button>
        </div>
      </div>

      <div className="pt-4 border-t border-border">
        <h4 className="text-sm font-medium text-text-primary mb-1">API Keys</h4>
        <p className="text-xs text-text-muted mb-3">
          Manage API keys for webhook authentication. Keys are shown only once when created.
        </p>

        {newKeyValue && (
          <div className="bg-success-dim border border-success/20 rounded-lg p-3 mb-3">
            <p className="text-xs text-success font-medium mb-1">
              New API key created. Copy it now — it will not be shown again.
            </p>
            <code className="text-xs font-mono text-text-primary break-all">{newKeyValue}</code>
            <Button
              variant="secondary"
              size="sm"
              className="mt-2"
              onClick={async () => {
                await navigator.clipboard.writeText(newKeyValue);
                setNewKeyValue(null);
              }}
            >
              <Copy size={14} />
              Copy & Dismiss
            </Button>
          </div>
        )}

        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newKeyName}
            onChange={(e) => setNewKeyName(e.target.value)}
            placeholder="Key name (optional)"
            className="flex-1 bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
          />
          <Button size="sm" onClick={handleCreateKey} loading={createMutation.isPending}>
            <Plus size={14} />
            Create Key
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-text-muted">Loading keys...</p>
        ) : !apiKeys || apiKeys.length === 0 ? (
          <p className="text-sm text-text-muted">No API keys yet.</p>
        ) : (
          <div className="space-y-2">
            {apiKeys.map((key) => (
              <div
                key={key.id}
                className="flex items-center justify-between bg-bg-surface-2 rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2">
                  <Key size={14} className="text-text-muted" />
                  <span className="text-sm text-text-primary">{key.name}</span>
                  <span className="text-xs font-mono text-text-muted">{key.keyPrefix}...</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-text-muted">{formatDate(key.createdAt)}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => revokeMutation.mutate(key.id)}
                    loading={revokeMutation.isPending}
                  >
                    <Trash2 size={14} className="text-danger" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
