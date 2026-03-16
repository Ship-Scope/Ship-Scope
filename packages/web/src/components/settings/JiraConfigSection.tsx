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
  useJiraTestConnection,
  useJiraSaveConfig,
  useJiraProjects,
  useJiraIssueTypes,
  useJiraIssues,
  useJiraImportFeedback,
  useJiraSyncAll,
  useJiraFields,
} from '@/hooks/useJira';

interface JiraConfigSectionProps {
  settings: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}

export function JiraConfigSection({ settings, onUpdate }: JiraConfigSectionProps) {
  const [host, setHost] = useState(settings['jira_host'] || '');
  const [email, setEmail] = useState(settings['jira_email'] || '');
  const [apiToken, setApiToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [projectKey, setProjectKey] = useState(settings['jira_project_key'] || '');
  const [issueType, setIssueType] = useState(settings['jira_issue_type'] || 'Story');
  const [storyPointsField, setStoryPointsField] = useState(
    settings['jira_story_points_field'] || '',
  );
  const [doneStatuses, setDoneStatuses] = useState(settings['jira_done_statuses'] || '');
  const [epicNameField, setEpicNameField] = useState(settings['jira_epic_name_field'] || '');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [jql, setJql] = useState('');
  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const testMutation = useJiraTestConnection();
  const saveMutation = useJiraSaveConfig();
  const projectsQuery = useJiraProjects();
  const issueTypesQuery = useJiraIssueTypes();
  const fieldsQuery = useJiraFields();
  const { data: jiraIssues } = useJiraIssues();
  const importMutation = useJiraImportFeedback();
  const syncAllMutation = useJiraSyncAll();

  const hasToken = (settings['jira_api_token'] || '').length > 0;
  const isConfigured = hasToken && host && email;
  const webhookUrl = `${window.location.origin}/api/jira/webhook`;

  const handleSave = () => {
    const config: Record<string, string> = {};
    if (host.trim()) config['jira_host'] = host.trim();
    if (email.trim()) config['jira_email'] = email.trim();
    if (apiToken.trim()) config['jira_api_token'] = apiToken.trim();
    if (projectKey.trim()) config['jira_project_key'] = projectKey.trim();
    if (issueType.trim()) config['jira_issue_type'] = issueType.trim();
    // Advanced fields — save even if empty (to clear previous values)
    config['jira_story_points_field'] = storyPointsField.trim();
    config['jira_done_statuses'] = doneStatuses.trim();
    config['jira_epic_name_field'] = epicNameField.trim();

    saveMutation.mutate(config, {
      onSuccess: () => {
        setApiToken('');
        // Re-fetch settings to reflect saved values
        Object.entries(config).forEach(([k, v]) => {
          if (k !== 'jira_api_token') onUpdate(k, v);
        });
      },
    });
  };

  const handleLoadProjects = () => {
    projectsQuery.refetch();
  };

  const handleLoadIssueTypes = () => {
    issueTypesQuery.refetch();
  };

  const handleImport = () => {
    importMutation.mutate(jql.trim() ? { jql: jql.trim() } : undefined);
  };

  const handleCopyWebhook = () => {
    navigator.clipboard.writeText(webhookUrl);
    setCopiedWebhook(true);
    setTimeout(() => setCopiedWebhook(false), 2000);
  };

  return (
    <div className="space-y-5">
      {/* Connection Settings */}
      <div>
        <label className="text-sm font-medium text-text-primary block mb-1.5">
          Jira Instance URL
        </label>
        <input
          type="url"
          value={host}
          onChange={(e) => setHost(e.target.value)}
          placeholder="https://your-org.atlassian.net"
          className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-text-primary block mb-1.5">Jira Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@company.com"
          className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-text-primary block mb-1.5">API Token</label>
        {hasToken && (
          <p className="text-xs text-text-muted mb-2">
            Token saved. Enter a new one to replace it.
          </p>
        )}
        <div className="relative">
          <input
            type={showToken ? 'text' : 'password'}
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder={hasToken ? 'Enter new token to replace...' : 'Paste your Jira API token'}
            className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted pr-10"
          />
          <button
            type="button"
            onClick={() => setShowToken(!showToken)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-secondary"
          >
            {showToken ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
        </div>
        <p className="text-[10px] text-text-muted mt-1">
          Generate at{' '}
          <a
            href="https://id.atlassian.com/manage-profile/security/api-tokens"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-blue hover:underline"
          >
            Atlassian API Tokens
            <ExternalLink size={10} className="inline ml-0.5" />
          </a>
        </p>
      </div>

      {/* Project & Issue Type */}
      <div className="pt-4 border-t border-border">
        <div className="flex items-end gap-2 mb-4">
          <div className="flex-1">
            <label className="text-sm font-medium text-text-primary block mb-1.5">
              Project Key
            </label>
            {projectsQuery.data && projectsQuery.data.length > 0 ? (
              <select
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value)}
                className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
              >
                <option value="">Select a project...</option>
                {projectsQuery.data.map((p) => (
                  <option key={p.key} value={p.key}>
                    {p.key} — {p.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={projectKey}
                onChange={(e) => setProjectKey(e.target.value.toUpperCase())}
                placeholder="e.g. PROJ"
                className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
              />
            )}
          </div>
          {isConfigured && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLoadProjects}
              loading={projectsQuery.isFetching}
            >
              <RefreshCw size={14} />
            </Button>
          )}
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-sm font-medium text-text-primary block mb-1.5">
              Default Issue Type
            </label>
            <select
              value={issueType}
              onChange={(e) => setIssueType(e.target.value)}
              className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
            >
              {issueTypesQuery.data && issueTypesQuery.data.length > 0
                ? issueTypesQuery.data.map((t) => (
                    <option key={t.id} value={t.name}>
                      {t.name}
                    </option>
                  ))
                : ['Story', 'Bug', 'Task', 'Epic', 'Sub-task'].map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
            </select>
          </div>
          {isConfigured && projectKey && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLoadIssueTypes}
              loading={issueTypesQuery.isFetching}
            >
              <RefreshCw size={14} />
            </Button>
          )}
        </div>
      </div>

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

      {/* Advanced Configuration */}
      {isConfigured && (
        <div className="pt-4 border-t border-border">
          <button
            type="button"
            onClick={() => setShowAdvanced(!showAdvanced)}
            className="text-sm font-medium text-text-secondary hover:text-text-primary flex items-center gap-1"
          >
            {showAdvanced ? '▾' : '▸'} Advanced Configuration
          </button>
          <p className="text-[10px] text-text-muted mt-1">
            Customize field mappings for your organization&apos;s Jira setup.
          </p>

          {showAdvanced && (
            <div className="mt-3 space-y-4">
              {/* Story Points Field */}
              <div>
                <div className="flex items-end gap-2">
                  <div className="flex-1">
                    <label className="text-sm font-medium text-text-primary block mb-1.5">
                      Story Points Field
                    </label>
                    {fieldsQuery.data && fieldsQuery.data.length > 0 ? (
                      <select
                        value={storyPointsField}
                        onChange={(e) => setStoryPointsField(e.target.value)}
                        className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
                      >
                        <option value="">Default (story_points)</option>
                        {fieldsQuery.data.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.id} — {f.name}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="text"
                        value={storyPointsField}
                        onChange={(e) => setStoryPointsField(e.target.value)}
                        placeholder="e.g. customfield_10016 (leave blank for default)"
                        className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted font-mono"
                      />
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fieldsQuery.refetch()}
                    loading={fieldsQuery.isFetching}
                    title="Load fields from Jira"
                  >
                    <RefreshCw size={14} />
                  </Button>
                </div>
                <p className="text-[10px] text-text-muted mt-1">
                  Many orgs use a custom field like{' '}
                  <code className="text-[10px]">customfield_10016</code>. Click refresh to
                  auto-detect.
                </p>
              </div>

              {/* Done Statuses */}
              <div>
                <label className="text-sm font-medium text-text-primary block mb-1.5">
                  Done Statuses
                </label>
                <input
                  type="text"
                  value={doneStatuses}
                  onChange={(e) => setDoneStatuses(e.target.value)}
                  placeholder="Done, Closed, Resolved, Released"
                  className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
                />
                <p className="text-[10px] text-text-muted mt-1">
                  Comma-separated list of Jira statuses that mark a proposal as shipped. Leave blank
                  for defaults.
                </p>
              </div>

              {/* Epic Name Field */}
              <div>
                <label className="text-sm font-medium text-text-primary block mb-1.5">
                  Epic Name Field (optional)
                </label>
                <input
                  type="text"
                  value={epicNameField}
                  onChange={(e) => setEpicNameField(e.target.value)}
                  placeholder="e.g. customfield_10011 (leave blank if not needed)"
                  className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted font-mono"
                />
                <p className="text-[10px] text-text-muted mt-1">
                  Some Jira instances require an &ldquo;Epic Name&rdquo; custom field when creating
                  Epics.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

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
      {jiraIssues && jiraIssues.length > 0 && (
        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-medium text-text-primary mb-2">
            Exported Issues ({jiraIssues.length})
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {jiraIssues.map((issue) => (
              <div
                key={issue.id}
                className="flex items-center justify-between bg-bg-surface-2 rounded-lg px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <a
                      href={issue.jiraUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-mono text-accent-blue hover:underline"
                    >
                      {issue.jiraKey}
                    </a>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-surface border border-border text-text-muted">
                      {issue.status}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary truncate">{issue.summary}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import Feedback from Jira */}
      {isConfigured && projectKey && (
        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-medium text-text-primary mb-1">Import Feedback from Jira</h4>
          <p className="text-[10px] text-text-muted mb-3">
            Pull bugs and stories from your Jira project into ShipScope as feedback items for AI
            analysis.
          </p>
          <div className="mb-2">
            <label className="text-xs text-text-secondary block mb-1">Custom JQL (optional)</label>
            <input
              type="text"
              value={jql}
              onChange={(e) => setJql(e.target.value)}
              placeholder={`project = ${projectKey} AND type in (Bug, Story) AND status != Done`}
              className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-muted font-mono"
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleImport}
            loading={importMutation.isPending}
          >
            <Download size={14} />
            Import from Jira
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
              Import failed. Check your JQL query and Jira credentials.
            </p>
          )}
        </div>
      )}

      {/* Bulk Sync */}
      {jiraIssues && jiraIssues.length > 0 && (
        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-medium text-text-primary mb-1">Status Sync</h4>
          <p className="text-[10px] text-text-muted mb-3">
            Sync all exported Jira issue statuses back to ShipScope. Proposals are auto-marked as
            &ldquo;shipped&rdquo; when their Jira issue reaches Done/Closed/Resolved.
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
            Jira Webhook (Real-time Sync)
          </h4>
          <p className="text-[10px] text-text-muted mb-3">
            Add this URL as a webhook in Jira (Settings → System → Webhooks) to enable real-time
            status sync whenever an issue is updated.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-bg-surface-2 border border-border rounded-lg px-3 py-2 font-mono text-text-secondary truncate">
              {webhookUrl}
            </code>
            <Button variant="ghost" size="sm" onClick={handleCopyWebhook}>
              {copiedWebhook ? <Check size={14} className="text-success" /> : <Copy size={14} />}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
