import { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  RefreshCw,
  ExternalLink,
  Download,
  Copy,
  Check,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  useLinearTestConnection,
  useLinearSaveConfig,
  useLinearTeams,
  useLinearProjects,
  useLinearLabels,
  useLinearCycles,
  useLinearIssues,
  useLinearImportFeedback,
  useLinearSyncAll,
  useLinearRegisterWebhook,
  useLinearUnregisterWebhook,
} from '@/hooks/useLinear';

interface LinearConfigSectionProps {
  settings: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}

const PRIORITY_LABELS: Record<number, string> = {
  0: 'No Priority',
  1: 'Urgent',
  2: 'High',
  3: 'Medium',
  4: 'Low',
};

export function LinearConfigSection({ settings, onUpdate }: LinearConfigSectionProps) {
  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  // Local overrides: null = not yet touched (fall through to settings)
  const [localTeamId, setLocalTeamId] = useState<string | null>(null);
  const [localProjectId, setLocalProjectId] = useState<string | null>(null);
  const [localDefaultLabelId, setLocalDefaultLabelId] = useState<string | null>(null);
  const [localCycleId, setLocalCycleId] = useState<string | null>(null);
  const [localDoneStates, setLocalDoneStates] = useState<string | null>(null);

  // Derived values: local override takes priority, then server setting
  const teamId = localTeamId ?? settings['linear_team_id'] ?? '';
  const projectId = localProjectId ?? settings['linear_project_id'] ?? '';
  const defaultLabelId = localDefaultLabelId ?? settings['linear_default_label_id'] ?? '';
  const cycleId = localCycleId ?? settings['linear_cycle_id'] ?? '';
  const doneStates = localDoneStates ?? settings['linear_done_states'] ?? '';

  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const testMutation = useLinearTestConnection();
  const saveMutation = useLinearSaveConfig();
  const teamsQuery = useLinearTeams();
  const projectsQuery = useLinearProjects();
  const labelsQuery = useLinearLabels();
  const cyclesQuery = useLinearCycles();
  const { data: linearIssues } = useLinearIssues();
  const importMutation = useLinearImportFeedback();
  const syncAllMutation = useLinearSyncAll();
  const registerWebhookMutation = useLinearRegisterWebhook();
  const unregisterWebhookMutation = useLinearUnregisterWebhook();

  const hasKey = (settings['linear_api_key'] || '').length > 0;
  const isConfigured = hasKey;
  const webhookUrl = `${window.location.origin}/api/linear/webhook`;
  const hasWebhookRegistered = (settings['linear_webhook_id'] || '').length > 0;

  const handleSave = () => {
    const config: Record<string, string> = {};
    if (apiKey.trim()) config['linear_api_key'] = apiKey.trim();
    if (teamId.trim()) config['linear_team_id'] = teamId.trim();
    if (projectId.trim()) config['linear_project_id'] = projectId.trim();
    if (defaultLabelId.trim()) config['linear_default_label_id'] = defaultLabelId.trim();
    if (cycleId.trim()) config['linear_cycle_id'] = cycleId.trim();
    config['linear_done_states'] = doneStates.trim();

    saveMutation.mutate(config, {
      onSuccess: () => {
        setApiKey('');
        Object.entries(config).forEach(([k, v]) => {
          if (k !== 'linear_api_key') onUpdate(k, v);
        });
      },
    });
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* API Key */}
      <div>
        <label className="text-sm font-medium text-text-primary block mb-1.5">Linear API Key</label>
        {hasKey && (
          <p className="text-xs text-text-muted mb-2">
            Key saved ({settings['linear_api_key']}). Enter a new one to replace it.
          </p>
        )}
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder={hasKey ? 'Enter new API key to replace...' : 'lin_api_...'}
            className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted pr-10 font-mono"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
          >
            {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <p className="text-[10px] text-text-muted mt-1">
          Create a personal API key at{' '}
          <a
            href="https://linear.app/settings/api"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-blue hover:underline"
          >
            Linear Settings → API
            <ExternalLink size={10} className="inline ml-0.5" />
          </a>
        </p>
      </div>

      {/* Team Selection */}
      <div className="pt-4 border-t border-border">
        <div className="flex items-end gap-2 mb-4">
          <div className="flex-1">
            <label className="text-sm font-medium text-text-primary block mb-1.5">Team</label>
            {teamsQuery.data && teamsQuery.data.length > 0 ? (
              <select
                value={teamId}
                onChange={(e) => {
                  setLocalTeamId(e.target.value);
                  setLocalProjectId('');
                  setLocalDefaultLabelId('');
                  setLocalCycleId('');
                }}
                className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
              >
                <option value="">Select a team...</option>
                {teamsQuery.data.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.key})
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={teamId}
                onChange={(e) => setLocalTeamId(e.target.value)}
                placeholder="Team ID"
                className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted font-mono"
              />
            )}
          </div>
          {isConfigured && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => teamsQuery.refetch()}
              loading={teamsQuery.isFetching}
            >
              <RefreshCw size={14} />
            </Button>
          )}
        </div>

        {/* Project Selection */}
        <div className="flex items-end gap-2 mb-4">
          <div className="flex-1">
            <label className="text-sm font-medium text-text-primary block mb-1.5">
              Default Project (optional)
            </label>
            {projectsQuery.data && projectsQuery.data.length > 0 ? (
              <select
                value={projectId}
                onChange={(e) => setLocalProjectId(e.target.value)}
                className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
              >
                <option value="">No default project</option>
                {projectsQuery.data.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={projectId}
                onChange={(e) => setLocalProjectId(e.target.value)}
                placeholder="Project ID (optional)"
                className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted font-mono"
              />
            )}
          </div>
          {isConfigured && teamId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => projectsQuery.refetch()}
              loading={projectsQuery.isFetching}
            >
              <RefreshCw size={14} />
            </Button>
          )}
        </div>

        {/* Default Label */}
        <div className="flex items-end gap-2 mb-4">
          <div className="flex-1">
            <label className="text-sm font-medium text-text-primary block mb-1.5">
              Default Label (optional)
            </label>
            {labelsQuery.data && labelsQuery.data.length > 0 ? (
              <select
                value={defaultLabelId}
                onChange={(e) => setLocalDefaultLabelId(e.target.value)}
                className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
              >
                <option value="">No default label</option>
                {labelsQuery.data.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={defaultLabelId}
                onChange={(e) => setLocalDefaultLabelId(e.target.value)}
                placeholder="Label ID (optional)"
                className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted font-mono"
              />
            )}
          </div>
          {isConfigured && teamId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => labelsQuery.refetch()}
              loading={labelsQuery.isFetching}
            >
              <RefreshCw size={14} />
            </Button>
          )}
        </div>

        {/* Cycle / Sprint */}
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-sm font-medium text-text-primary block mb-1.5">
              Active Cycle (optional)
            </label>
            {cyclesQuery.data && cyclesQuery.data.length > 0 ? (
              <select
                value={cycleId}
                onChange={(e) => setLocalCycleId(e.target.value)}
                className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
              >
                <option value="">No cycle</option>
                {cyclesQuery.data.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name || `Cycle ${c.number}`}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={cycleId}
                onChange={(e) => setLocalCycleId(e.target.value)}
                placeholder="Cycle ID (optional)"
                className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted font-mono"
              />
            )}
          </div>
          {isConfigured && teamId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => cyclesQuery.refetch()}
              loading={cyclesQuery.isFetching}
            >
              <RefreshCw size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Done States */}
      {isConfigured && teamId && (
        <div className="pt-4 border-t border-border">
          <label className="text-sm font-medium text-text-primary block mb-1.5">Done States</label>
          <input
            type="text"
            value={doneStates}
            onChange={(e) => setLocalDoneStates(e.target.value)}
            placeholder="Done, Completed, Closed, Shipped, Released"
            className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
          />
          <p className="text-[10px] text-text-muted mt-1">
            Comma-separated state names that trigger auto-shipping proposals. Leave blank for
            defaults. Linear&apos;s built-in &ldquo;completed&rdquo; state type is always
            recognized.
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-4 border-t border-border">
        <Button size="sm" onClick={handleSave} loading={saveMutation.isPending}>
          Save Configuration
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => testMutation.mutate()}
          loading={testMutation.isPending}
          disabled={!isConfigured}
        >
          Test Connection
        </Button>
      </div>

      {saveMutation.isSuccess && (
        <p className="text-xs text-success flex items-center gap-1">
          <CheckCircle2 size={12} /> Configuration saved.
        </p>
      )}

      {testMutation.data && (
        <div
          className={`flex items-center gap-2 text-sm ${
            testMutation.data.success ? 'text-success' : 'text-danger'
          }`}
        >
          {testMutation.data.success ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
          {testMutation.data.message}
        </div>
      )}

      {/* Exported Issues Overview */}
      {linearIssues && linearIssues.length > 0 && (
        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-medium text-text-primary mb-2">
            Exported Issues ({linearIssues.length})
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {linearIssues.map((issue) => (
              <div
                key={issue.id}
                className="flex items-center justify-between bg-bg-surface-2 rounded-lg px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <a
                      href={issue.linearUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-mono text-accent-blue hover:underline"
                    >
                      {issue.identifier}
                    </a>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-surface border border-border text-text-muted">
                      {issue.status}
                    </span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-surface border border-border text-text-muted">
                      {PRIORITY_LABELS[issue.priority] || 'Unknown'}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary truncate">
                    {issue.proposal?.title || issue.issueTitle}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import Feedback from Linear */}
      {isConfigured && teamId && (
        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-medium text-text-primary mb-1">
            Import Feedback from Linear
          </h4>
          <p className="text-[10px] text-text-muted mb-3">
            Pull issues from your Linear team into ShipScope as feedback items for AI analysis.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => importMutation.mutate(projectId ? { projectId } : undefined)}
            loading={importMutation.isPending}
          >
            <Download size={14} />
            Import from Linear
          </Button>
          {importMutation.data && (
            <p className="text-xs text-success mt-2 flex items-center gap-1">
              <CheckCircle2 size={12} />
              Imported {importMutation.data.imported} items ({importMutation.data.skipped}{' '}
              duplicates skipped)
            </p>
          )}
          {importMutation.isError && (
            <p className="text-xs text-danger mt-2">
              Import failed. Check your Linear credentials and team selection.
            </p>
          )}
        </div>
      )}

      {/* Bulk Sync */}
      {linearIssues && linearIssues.length > 0 && (
        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-medium text-text-primary mb-1">Status Sync</h4>
          <p className="text-[10px] text-text-muted mb-3">
            Sync all exported Linear issues back to ShipScope. Proposals are auto-marked as
            &ldquo;shipped&rdquo; when their issue moves to a completed state.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => syncAllMutation.mutate()}
            loading={syncAllMutation.isPending}
          >
            <RefreshCw size={14} />
            Sync All Statuses
          </Button>
          {syncAllMutation.data && (
            <p className="text-xs text-success mt-2 flex items-center gap-1">
              <CheckCircle2 size={12} />
              {syncAllMutation.data.synced} synced
              {syncAllMutation.data.autoShipped > 0 &&
                `, ${syncAllMutation.data.autoShipped} auto-shipped`}
              {syncAllMutation.data.errors > 0 && `, ${syncAllMutation.data.errors} errors`}
            </p>
          )}
        </div>
      )}

      {/* Webhook URL */}
      {isConfigured && (
        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-medium text-text-primary mb-1">
            Linear Webhook (Real-time Sync)
          </h4>
          <p className="text-[10px] text-text-muted mb-3">
            {hasWebhookRegistered
              ? 'Webhook is registered and active. Linear will send real-time issue updates.'
              : 'Auto-register a webhook, or manually add this URL in Linear Settings → API → Webhooks.'}
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-bg-surface-2 border border-border rounded-lg px-3 py-2 font-mono text-text-secondary truncate">
              {webhookUrl}
            </code>
            <Button variant="ghost" size="sm" onClick={handleCopyWebhook}>
              {copiedWebhook ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            </Button>
          </div>
          <div className="flex items-center gap-2 mt-3">
            {hasWebhookRegistered ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => unregisterWebhookMutation.mutate()}
                disabled={unregisterWebhookMutation.isPending}
              >
                {unregisterWebhookMutation.isPending ? (
                  <RefreshCw size={12} className="animate-spin mr-1.5" />
                ) : null}
                Unregister Webhook
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                onClick={() => registerWebhookMutation.mutate(webhookUrl)}
                disabled={registerWebhookMutation.isPending}
              >
                {registerWebhookMutation.isPending ? (
                  <RefreshCw size={12} className="animate-spin mr-1.5" />
                ) : null}
                Auto-Register Webhook
              </Button>
            )}
            {registerWebhookMutation.isSuccess && (
              <span className="text-xs text-success flex items-center gap-1">
                <CheckCircle2 size={12} /> Webhook registered
              </span>
            )}
            {unregisterWebhookMutation.isSuccess && (
              <span className="text-xs text-text-muted flex items-center gap-1">
                <CheckCircle2 size={12} /> Webhook removed
              </span>
            )}
            {(registerWebhookMutation.isError || unregisterWebhookMutation.isError) && (
              <span className="text-xs text-error flex items-center gap-1">
                <XCircle size={12} /> Failed
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
