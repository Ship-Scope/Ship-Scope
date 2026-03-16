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
  LayoutTemplate,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  useTrelloTestConnection,
  useTrelloSaveConfig,
  useTrelloBoards,
  useTrelloLists,
  useTrelloCards,
  useTrelloImportFeedback,
  useTrelloSyncAll,
  useTrelloCreateBoard,
} from '@/hooks/useTrello';

interface TrelloConfigSectionProps {
  settings: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}

export function TrelloConfigSection({ settings, onUpdate }: TrelloConfigSectionProps) {
  const [apiKey, setApiKey] = useState(settings['trello_api_key'] || '');
  const [token, setToken] = useState('');
  const [showToken, setShowToken] = useState(false);
  const [boardId, setBoardId] = useState(settings['trello_board_id'] || '');
  const [listId, setListId] = useState(settings['trello_list_id'] || '');
  const [doneListNames, setDoneListNames] = useState(settings['trello_done_list_names'] || '');

  const [copiedWebhook, setCopiedWebhook] = useState(false);

  const testMutation = useTrelloTestConnection();
  const saveMutation = useTrelloSaveConfig();
  const boardsQuery = useTrelloBoards();
  const listsQuery = useTrelloLists();
  const { data: trelloCards } = useTrelloCards();
  const importMutation = useTrelloImportFeedback();
  const syncAllMutation = useTrelloSyncAll();
  const createBoardMutation = useTrelloCreateBoard();

  const hasToken = (settings['trello_token'] || '').length > 0;
  const isConfigured = hasToken && apiKey;
  const webhookUrl = `${window.location.origin}/api/trello/webhook`;

  const handleSave = () => {
    const config: Record<string, string> = {};
    if (apiKey.trim()) config['trello_api_key'] = apiKey.trim();
    if (token.trim()) config['trello_token'] = token.trim();
    if (boardId.trim()) config['trello_board_id'] = boardId.trim();
    if (listId.trim()) config['trello_list_id'] = listId.trim();
    config['trello_done_list_names'] = doneListNames.trim();

    saveMutation.mutate(config, {
      onSuccess: () => {
        setToken('');
        Object.entries(config).forEach(([k, v]) => {
          if (k !== 'trello_token') onUpdate(k, v);
        });
      },
    });
  };

  const handleLoadBoards = () => {
    boardsQuery.refetch();
  };

  const handleLoadLists = () => {
    listsQuery.refetch();
  };

  const handleImport = () => {
    importMutation.mutate(listId ? { listId } : undefined);
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
        <label className="text-sm font-medium text-text-primary block mb-1.5">Trello API Key</label>
        <input
          type="text"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="Your Trello API key"
          className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
        />
        <p className="text-[10px] text-text-muted mt-1">
          Get your key at{' '}
          <a
            href="https://trello.com/power-ups/admin"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-blue hover:underline"
          >
            Trello Power-Ups Admin
            <ExternalLink size={10} className="inline ml-0.5" />
          </a>
        </p>
      </div>

      <div>
        <label className="text-sm font-medium text-text-primary block mb-1.5">Token</label>
        {hasToken && (
          <p className="text-xs text-text-muted mb-2">
            Token saved. Enter a new one to replace it.
          </p>
        )}
        <div className="relative">
          <input
            type={showToken ? 'text' : 'password'}
            value={token}
            onChange={(e) => setToken(e.target.value)}
            placeholder={hasToken ? 'Enter new token to replace...' : 'Paste your Trello token'}
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
          Generate a token via{' '}
          <a
            href="https://trello.com/1/authorize?expiration=never&scope=read,write&response_type=token&name=ShipScope"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent-blue hover:underline"
          >
            Trello Authorization
            <ExternalLink size={10} className="inline ml-0.5" />
          </a>{' '}
          (requires API key first)
        </p>
      </div>

      {/* Board & List Selection */}
      <div className="pt-4 border-t border-border">
        {/* Quick Start — Create Board */}
        {isConfigured && !boardId && (
          <div className="mb-4 p-3 bg-accent-blue/5 border border-accent-blue/20 rounded-lg">
            <p className="text-sm font-medium text-text-primary mb-1">Quick Start</p>
            <p className="text-[10px] text-text-muted mb-2">
              Create a pre-configured board with Backlog → Up Next → In Progress → In Review → Done
              lists and RICE priority labels.
            </p>
            <Button
              variant="secondary"
              size="sm"
              onClick={() =>
                createBoardMutation.mutate(undefined, {
                  onSuccess: (data) => {
                    setBoardId(data.boardId);
                    setListId(data.listId);
                    onUpdate('trello_board_id', data.boardId);
                    onUpdate('trello_list_id', data.listId);
                  },
                })
              }
              loading={createBoardMutation.isPending}
            >
              <LayoutTemplate size={14} />
              Create ShipScope Board
            </Button>
            {createBoardMutation.data && (
              <p className="text-xs text-success mt-2 flex items-center gap-1">
                <CheckCircle2 size={12} />
                Board created!{' '}
                <a
                  href={createBoardMutation.data.boardUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-accent-blue hover:underline"
                >
                  Open in Trello <ExternalLink size={10} className="inline" />
                </a>
              </p>
            )}
            {createBoardMutation.isError && (
              <p className="text-xs text-danger mt-2">
                {(createBoardMutation.error as Error)?.message || 'Failed to create board'}
              </p>
            )}
          </div>
        )}
        <div className="flex items-end gap-2 mb-4">
          <div className="flex-1">
            <label className="text-sm font-medium text-text-primary block mb-1.5">Board</label>
            {boardsQuery.data && boardsQuery.data.length > 0 ? (
              <select
                value={boardId}
                onChange={(e) => {
                  setBoardId(e.target.value);
                  setListId('');
                }}
                className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
              >
                <option value="">Select a board...</option>
                {boardsQuery.data.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={boardId}
                onChange={(e) => setBoardId(e.target.value)}
                placeholder="Board ID"
                className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
              />
            )}
          </div>
          {isConfigured && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLoadBoards}
              loading={boardsQuery.isFetching}
            >
              <RefreshCw size={14} />
            </Button>
          )}
        </div>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="text-sm font-medium text-text-primary block mb-1.5">
              Default List
            </label>
            {listsQuery.data && listsQuery.data.length > 0 ? (
              <select
                value={listId}
                onChange={(e) => setListId(e.target.value)}
                className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
              >
                <option value="">Select a list...</option>
                {listsQuery.data.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            ) : (
              <input
                type="text"
                value={listId}
                onChange={(e) => setListId(e.target.value)}
                placeholder="List ID"
                className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
              />
            )}
          </div>
          {isConfigured && boardId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLoadLists}
              loading={listsQuery.isFetching}
            >
              <RefreshCw size={14} />
            </Button>
          )}
        </div>
      </div>

      {/* Done List Names */}
      {isConfigured && boardId && (
        <div className="pt-4 border-t border-border">
          <label className="text-sm font-medium text-text-primary block mb-1.5">
            Done List Names
          </label>
          <input
            type="text"
            value={doneListNames}
            onChange={(e) => setDoneListNames(e.target.value)}
            placeholder="Done, Complete, Shipped, Released, Closed"
            className="w-full bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted"
          />
          <p className="text-[10px] text-text-muted mt-1">
            Comma-separated list names that trigger auto-shipping proposals. Leave blank for
            defaults.
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

      {/* Exported Cards Overview */}
      {trelloCards && trelloCards.length > 0 && (
        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-medium text-text-primary mb-2">
            Exported Cards ({trelloCards.length})
          </h4>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {trelloCards.map((card) => (
              <div
                key={card.id}
                className="flex items-center justify-between bg-bg-surface-2 rounded-lg px-3 py-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <a
                      href={card.cardUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm font-mono text-accent-blue hover:underline"
                    >
                      {card.cardName}
                    </a>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-bg-surface border border-border text-text-muted">
                      {card.listName}
                    </span>
                  </div>
                  <p className="text-xs text-text-secondary truncate">
                    {card.proposal?.title || 'Unknown proposal'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Import Feedback from Trello */}
      {isConfigured && boardId && (
        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-medium text-text-primary mb-1">
            Import Feedback from Trello
          </h4>
          <p className="text-[10px] text-text-muted mb-3">
            Pull cards from a Trello list into ShipScope as feedback items for AI analysis.
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={handleImport}
            loading={importMutation.isPending}
            disabled={!listId}
          >
            <Download size={14} />
            Import from Trello
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
              Import failed. Check your Trello credentials and list selection.
            </p>
          )}
        </div>
      )}

      {/* Bulk Sync */}
      {trelloCards && trelloCards.length > 0 && (
        <div className="pt-4 border-t border-border">
          <h4 className="text-sm font-medium text-text-primary mb-1">Status Sync</h4>
          <p className="text-[10px] text-text-muted mb-3">
            Sync all exported Trello card statuses back to ShipScope. Proposals are auto-marked as
            &ldquo;shipped&rdquo; when their card moves to a Done/Complete list.
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
            Trello Webhook (Real-time Sync)
          </h4>
          <p className="text-[10px] text-text-muted mb-3">
            Use this URL as the callback URL when creating a Trello webhook via the API for
            real-time card movement sync.
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
