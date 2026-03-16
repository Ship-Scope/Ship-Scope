import { ExternalLink, RefreshCw, Blocks } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/Button';
import { useTrelloDashboard, useTrelloSyncAll } from '@/hooks/useTrello';

const LIST_COLORS: Record<string, string> = {
  'To Do': 'bg-text-muted/20 text-text-muted',
  Doing: 'bg-accent-blue/20 text-accent-blue',
  'In Progress': 'bg-accent-blue/20 text-accent-blue',
  Review: 'bg-accent-purple/20 text-accent-purple',
  Done: 'bg-success/20 text-success',
  Complete: 'bg-success/20 text-success',
  Completed: 'bg-success/20 text-success',
  Shipped: 'bg-success/20 text-success',
};

function getListColor(listName: string): string {
  return LIST_COLORS[listName] || 'bg-bg-surface-2 text-text-secondary';
}

export function TrelloSyncWidget() {
  const { data, isLoading } = useTrelloDashboard();
  const syncAllMutation = useTrelloSyncAll();
  const navigate = useNavigate();

  if (isLoading || !data) return null;

  if (data.totalExported === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-6 text-center">
        <Blocks size={28} className="text-text-muted mb-2" />
        <p className="text-sm text-text-secondary mb-1">No proposals exported to Trello yet</p>
        <p className="text-xs text-text-muted mb-3">
          Export proposals or themes from their detail pages, or configure Trello in Settings.
        </p>
        <Button variant="secondary" size="sm" onClick={() => navigate('/settings')}>
          Configure Trello
        </Button>
      </div>
    );
  }

  const listEntries = Object.entries(data.byList).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="flex items-center gap-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-text-primary">{data.totalExported}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Cards</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-accent-purple">{listEntries.length}</p>
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Lists</p>
        </div>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => syncAllMutation.mutate()}
          loading={syncAllMutation.isPending}
          title="Sync all statuses from Trello"
        >
          <RefreshCw size={14} />
          Sync All
        </Button>
      </div>

      {syncAllMutation.data && (
        <p className="text-xs text-success">
          Synced {syncAllMutation.data.synced} cards
          {syncAllMutation.data.autoShipped > 0 &&
            `, ${syncAllMutation.data.autoShipped} auto-shipped`}
        </p>
      )}

      {/* List breakdown bar */}
      {listEntries.length > 0 && (
        <div>
          <div className="flex rounded-full overflow-hidden h-2 mb-2">
            {listEntries.map(([listName, count]) => (
              <div
                key={listName}
                className={getListColor(listName).split(' ')[0]}
                style={{ width: `${(count / data.totalExported) * 100}%` }}
                title={`${listName}: ${count}`}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            {listEntries.map(([listName, count]) => (
              <div key={listName} className="flex items-center gap-1.5">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${getListColor(listName).split(' ')[0]}`}
                />
                <span className="text-[10px] text-text-muted">
                  {listName} ({count})
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent exports */}
      {data.recentExports.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] text-text-muted uppercase tracking-wider">Recent</p>
          {data.recentExports.map((card) => (
            <div
              key={card.cardId}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-bg-surface-2 transition-colors"
            >
              <a
                href={card.cardUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-accent-blue hover:underline flex items-center gap-1 shrink-0"
              >
                <ExternalLink size={9} />
              </a>
              <span
                className={`text-[10px] px-1.5 py-0.5 rounded-full whitespace-nowrap ${getListColor(card.listName)}`}
              >
                {card.listName}
              </span>
              <p className="text-xs text-text-secondary truncate flex-1">{card.cardName}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
