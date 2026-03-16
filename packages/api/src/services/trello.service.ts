import { prisma } from '../lib/prisma';
import { NotFound, BadRequest } from '../lib/errors';
import { logger } from '../lib/logger';
import { settingsService } from './settings.service';

// ─── Setting Keys ─────────────────────────────────────────

export const TRELLO_SETTING_KEYS = {
  TRELLO_API_KEY: 'trello_api_key',
  TRELLO_TOKEN: 'trello_token',
  TRELLO_BOARD_ID: 'trello_board_id',
  TRELLO_LIST_ID: 'trello_list_id',
  TRELLO_DONE_LIST_NAMES: 'trello_done_list_names',
} as const;

// ─── Types ────────────────────────────────────────────────

interface TrelloConfig {
  apiKey: string;
  token: string;
  boardId: string;
  listId: string;
  doneListNames: string[];
}

interface TrelloBoard {
  id: string;
  name: string;
  url: string;
}

interface TrelloList {
  id: string;
  name: string;
  closed: boolean;
}

interface TrelloCardResponse {
  id: string;
  name: string;
  url: string;
  idList: string;
  idBoard: string;
  desc: string;
}

interface TrelloLabel {
  id: string;
  name: string;
  color: string;
}

// ─── RICE tier helpers ────────────────────────────────────

function getRiceTier(riceScore: number | null): { label: string; color: string } {
  if (riceScore === null) return { label: 'Unscored', color: 'sky' };
  if (riceScore >= 8) return { label: 'High Priority', color: 'red' };
  if (riceScore >= 4) return { label: 'Medium Priority', color: 'yellow' };
  return { label: 'Low Priority', color: 'green' };
}

function getCategoryColor(category: string | null): string {
  switch (category) {
    case 'bug':
      return 'red';
    case 'feature_request':
      return 'blue';
    case 'ux_issue':
      return 'purple';
    case 'performance':
      return 'orange';
    case 'documentation':
      return 'lime';
    case 'pricing':
      return 'yellow';
    default:
      return 'sky';
  }
}

function effortToDueDays(effortScore: number | null): number | null {
  if (effortScore === null) return null;
  // Map 1-10 effort → 7-90 days
  const map: Record<number, number> = {
    1: 7,
    2: 14,
    3: 21,
    4: 30,
    5: 37,
    6: 44,
    7: 51,
    8: 60,
    9: 75,
    10: 90,
  };
  return map[effortScore] || 30;
}

// ─── Helpers ──────────────────────────────────────────────

const DEFAULT_TRELLO_DONE_LIST_NAMES = [
  'done',
  'complete',
  'completed',
  'shipped',
  'released',
  'closed',
];

async function getTrelloConfig(): Promise<TrelloConfig> {
  const [apiKey, token, boardId, listId, doneListNames] = await Promise.all([
    settingsService.getRaw(TRELLO_SETTING_KEYS.TRELLO_API_KEY),
    settingsService.getRaw(TRELLO_SETTING_KEYS.TRELLO_TOKEN),
    settingsService.getRaw(TRELLO_SETTING_KEYS.TRELLO_BOARD_ID),
    settingsService.getRaw(TRELLO_SETTING_KEYS.TRELLO_LIST_ID),
    settingsService.getRaw(TRELLO_SETTING_KEYS.TRELLO_DONE_LIST_NAMES),
  ]);

  if (!apiKey || !token) {
    throw BadRequest('Trello is not configured. Please set API key and token in settings.');
  }

  const parsedDoneNames = doneListNames
    ? doneListNames
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : DEFAULT_TRELLO_DONE_LIST_NAMES;

  return {
    apiKey,
    token,
    boardId: boardId || '',
    listId: listId || '',
    doneListNames: parsedDoneNames,
  };
}

function trelloAuthParams(config: TrelloConfig): string {
  return `key=${encodeURIComponent(config.apiKey)}&token=${encodeURIComponent(config.token)}`;
}

async function trelloFetch<T>(
  config: TrelloConfig,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const separator = path.includes('?') ? '&' : '?';
  const url = `https://api.trello.com/1${path}${separator}${trelloAuthParams(config)}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(options.headers as Record<string, string>),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    logger.error(`Trello API error [${response.status}]: ${body}`);
    throw BadRequest(`Trello API error (${response.status}): ${body}`);
  }

  return response.json() as Promise<T>;
}

// ─── Service ──────────────────────────────────────────────

export const trelloService = {
  /**
   * Test the Trello connection with current credentials.
   */
  async testConnection(): Promise<{ success: boolean; message: string; username?: string }> {
    try {
      const config = await getTrelloConfig();
      const data = await trelloFetch<{ id: string; username: string; fullName: string }>(
        config,
        '/members/me?fields=id,username,fullName',
      );
      return {
        success: true,
        message: `Connected as ${data.fullName || data.username}`,
        username: data.username,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Unknown error connecting to Trello',
      };
    }
  },

  /**
   * List boards the authenticated user has access to.
   */
  async listBoards(): Promise<TrelloBoard[]> {
    const config = await getTrelloConfig();
    const data = await trelloFetch<TrelloBoard[]>(
      config,
      '/members/me/boards?fields=id,name,url&filter=open',
    );
    return data.map((b) => ({ id: b.id, name: b.name, url: b.url }));
  },

  /**
   * List open lists for the configured board.
   */
  async listLists(): Promise<TrelloList[]> {
    const config = await getTrelloConfig();
    if (!config.boardId) {
      throw BadRequest('No Trello board configured');
    }
    const data = await trelloFetch<TrelloList[]>(
      config,
      `/boards/${encodeURIComponent(config.boardId)}/lists?filter=open`,
    );
    return data.map((l) => ({ id: l.id, name: l.name, closed: l.closed }));
  },

  /**
   * Export a proposal to Trello as a new card.
   */
  async exportProposal(proposalId: string): Promise<{
    id: string;
    cardId: string;
    cardUrl: string;
  }> {
    const config = await getTrelloConfig();

    if (!config.listId) {
      throw BadRequest('No Trello list configured. Select a board and list in settings.');
    }

    // Check if already exported
    const existing = await prisma.trelloCard.findUnique({ where: { proposalId } });
    if (existing) {
      throw BadRequest(`Proposal already exported to Trello as card ${existing.cardId}`);
    }

    // Get proposal with evidence
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        theme: { select: { name: true, category: true } },
        evidence: {
          take: 10,
          orderBy: { relevanceScore: 'desc' },
          include: {
            feedbackItem: { select: { content: true, author: true, channel: true } },
          },
        },
      },
    });

    if (!proposal) throw NotFound('Proposal');

    // Build description in Markdown (Trello supports Markdown)
    const description = buildTrelloDescription(proposal);

    // Prepare RICE tier label
    const riceTier = getRiceTier(proposal.riceScore);

    // Ensure label exists on the board
    const labelId = await getOrCreateLabel(config, riceTier.label, riceTier.color);

    // Due date based on effort score
    const dueDays = effortToDueDays(proposal.effortScore);
    const due = dueDays ? new Date(Date.now() + dueDays * 86400000).toISOString() : undefined;

    const cardPayload: Record<string, unknown> = {
      idList: config.listId,
      name: proposal.title,
      desc: description,
      pos: 'bottom',
      idLabels: labelId ? [labelId] : [],
    };
    if (due) cardPayload.due = due;

    const result = await trelloFetch<TrelloCardResponse>(config, '/cards', {
      method: 'POST',
      body: JSON.stringify(cardPayload),
    });

    // Set card cover color based on theme category
    const coverColor = getCategoryColor(proposal.theme?.category ?? null);
    try {
      await trelloFetch(config, `/cards/${encodeURIComponent(result.id)}`, {
        method: 'PUT',
        body: JSON.stringify({ cover: { color: coverColor, brightness: 'light', size: 'normal' } }),
      });
    } catch {
      // Cover is cosmetic — don't fail the export
      logger.warn(`Could not set cover color for card ${result.id}`);
    }

    // Attach backlink to ShipScope
    try {
      await trelloFetch(config, `/cards/${encodeURIComponent(result.id)}/attachments`, {
        method: 'POST',
        body: JSON.stringify({
          name: 'View in ShipScope',
          url: `${process.env.WEB_URL || 'http://localhost:3000'}/proposals?id=${proposalId}`,
        }),
      });
    } catch {
      logger.warn(`Could not attach backlink for card ${result.id}`);
    }

    // Get list name for status tracking
    const lists = await trelloFetch<TrelloList[]>(
      config,
      `/boards/${encodeURIComponent(config.boardId)}/lists?filter=open`,
    );
    const listName = lists.find((l) => l.id === config.listId)?.name || 'To Do';

    // Store the link in our database
    const trelloCard = await prisma.trelloCard.create({
      data: {
        proposalId,
        cardId: result.id,
        cardUrl: result.url,
        listName,
        cardName: proposal.title,
        boardId: config.boardId,
      },
    });

    logger.info(`Exported proposal ${proposalId} to Trello as card ${result.id}`);

    return {
      id: trelloCard.id,
      cardId: result.id,
      cardUrl: result.url,
    };
  },

  /**
   * Sync the status (list name) of a Trello card back to the local record.
   */
  async syncStatus(
    proposalId: string,
  ): Promise<{ cardId: string; listName: string; titleUpdated: boolean }> {
    const config = await getTrelloConfig();
    const trelloCard = await prisma.trelloCard.findUnique({ where: { proposalId } });
    if (!trelloCard) throw NotFound('Trello card for this proposal');

    const card = await trelloFetch<TrelloCardResponse>(
      config,
      `/cards/${encodeURIComponent(trelloCard.cardId)}?fields=name,idList,url`,
    );

    // Get list name
    const list = await trelloFetch<{ id: string; name: string }>(
      config,
      `/lists/${encodeURIComponent(card.idList)}?fields=name`,
    );

    // Two-way title sync: if someone renamed the card in Trello, update proposal
    let titleUpdated = false;
    if (card.name !== trelloCard.cardName) {
      await prisma.proposal.update({
        where: { id: proposalId },
        data: { title: card.name },
      });
      titleUpdated = true;
      logger.info(`Synced title from Trello card to proposal ${proposalId}: "${card.name}"`);
    }

    await prisma.trelloCard.update({
      where: { proposalId },
      data: {
        listName: list.name,
        cardName: card.name,
        syncedAt: new Date(),
      },
    });

    return { cardId: trelloCard.cardId, listName: list.name, titleUpdated };
  },

  /**
   * Get the Trello card linked to a proposal (if any).
   */
  async getByProposal(proposalId: string) {
    return prisma.trelloCard.findUnique({ where: { proposalId } });
  },

  /**
   * List all exported Trello cards.
   */
  async listExported() {
    return prisma.trelloCard.findMany({
      include: {
        proposal: { select: { id: true, title: true, status: true, riceScore: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Unlink a Trello card from a proposal (does not delete the Trello card).
   */
  async unlink(proposalId: string): Promise<void> {
    const trelloCard = await prisma.trelloCard.findUnique({ where: { proposalId } });
    if (!trelloCard) throw NotFound('Trello card link for this proposal');
    await prisma.trelloCard.delete({ where: { proposalId } });
    logger.info(`Unlinked Trello card ${trelloCard.cardId} from proposal ${proposalId}`);
  },

  /**
   * Export all proposals under a theme as Trello cards in a dedicated list.
   */
  async exportThemeAsList(themeId: string): Promise<{
    listName: string;
    cardsCreated: number;
    cardsSkipped: number;
  }> {
    const config = await getTrelloConfig();
    if (!config.boardId) throw BadRequest('No Trello board configured');

    const theme = await prisma.theme.findUnique({
      where: { id: themeId },
      include: {
        proposals: {
          include: {
            theme: { select: { name: true, category: true } },
            trelloCard: true,
            evidence: {
              take: 5,
              orderBy: { relevanceScore: 'desc' },
              include: {
                feedbackItem: { select: { content: true, author: true, channel: true } },
              },
            },
          },
        },
      },
    });

    if (!theme) throw NotFound('Theme');

    if (theme.trelloBoardListId) {
      throw BadRequest(`Theme already exported to Trello list`);
    }

    // Create a new list on the board for this theme
    const newList = await trelloFetch<{ id: string; name: string }>(config, '/lists', {
      method: 'POST',
      body: JSON.stringify({
        name: `[ShipScope] ${theme.name}`,
        idBoard: config.boardId,
        pos: 'bottom',
      }),
    });

    // Save list link on theme
    await prisma.theme.update({
      where: { id: themeId },
      data: {
        trelloBoardListId: newList.id,
        trelloBoardListUrl: `https://trello.com/b/${config.boardId}`,
      },
    });

    // Create cards for each proposal
    let cardsCreated = 0;
    let cardsSkipped = 0;

    for (const proposal of theme.proposals) {
      if (proposal.trelloCard) {
        cardsSkipped++;
        continue;
      }

      try {
        const description = buildTrelloDescription(proposal);

        // RICE label + due date + cover for each card
        const riceTier = getRiceTier(proposal.riceScore);
        const labelId = await getOrCreateLabel(config, riceTier.label, riceTier.color);
        const dueDays = effortToDueDays(proposal.effortScore);
        const due = dueDays ? new Date(Date.now() + dueDays * 86400000).toISOString() : undefined;

        const cardPayload: Record<string, unknown> = {
          idList: newList.id,
          name: proposal.title,
          desc: description,
          pos: 'bottom',
          idLabels: labelId ? [labelId] : [],
        };
        if (due) cardPayload.due = due;

        const card = await trelloFetch<TrelloCardResponse>(config, '/cards', {
          method: 'POST',
          body: JSON.stringify(cardPayload),
        });

        // Card cover by category
        const coverColor = getCategoryColor(proposal.theme?.category ?? null);
        try {
          await trelloFetch(config, `/cards/${encodeURIComponent(card.id)}`, {
            method: 'PUT',
            body: JSON.stringify({
              cover: { color: coverColor, brightness: 'light', size: 'normal' },
            }),
          });
        } catch {
          /* cosmetic */
        }

        // Backlink
        try {
          await trelloFetch(config, `/cards/${encodeURIComponent(card.id)}/attachments`, {
            method: 'POST',
            body: JSON.stringify({
              name: 'View in ShipScope',
              url: `${process.env.WEB_URL || 'http://localhost:3000'}/proposals?id=${proposal.id}`,
            }),
          });
        } catch {
          /* non-critical */
        }

        await prisma.trelloCard.create({
          data: {
            proposalId: proposal.id,
            cardId: card.id,
            cardUrl: card.url,
            listName: newList.name,
            cardName: proposal.title,
            boardId: config.boardId,
          },
        });

        cardsCreated++;
      } catch (err) {
        logger.error(`Failed to create Trello card for proposal ${proposal.id}: ${err}`);
        cardsSkipped++;
      }
    }

    logger.info(
      `Exported theme ${themeId} as Trello list "${newList.name}" with ${cardsCreated} cards`,
    );

    return {
      listName: newList.name,
      cardsCreated,
      cardsSkipped,
    };
  },

  /**
   * Attach the generated PRD spec as a comment on the linked Trello card.
   */
  async attachSpec(proposalId: string): Promise<{ cardId: string; commented: boolean }> {
    const config = await getTrelloConfig();

    const trelloCard = await prisma.trelloCard.findUnique({ where: { proposalId } });
    if (!trelloCard) throw NotFound('No Trello card linked to this proposal');

    const spec = await prisma.spec.findUnique({ where: { proposalId } });
    if (!spec || !spec.prdMarkdown) throw BadRequest('No spec generated for this proposal');

    const commentText = `📋 **PRD Spec (v${spec.version}) — Generated by ShipScope**\n\n${spec.prdMarkdown}`;

    await trelloFetch(config, `/cards/${encodeURIComponent(trelloCard.cardId)}/actions/comments`, {
      method: 'POST',
      body: JSON.stringify({ text: commentText }),
    });

    // Extract acceptance criteria and add as a checklist
    const criteria = extractAcceptanceCriteria(spec.prdMarkdown);
    if (criteria.length > 0) {
      try {
        const checklist = await trelloFetch<{ id: string }>(
          config,
          `/cards/${encodeURIComponent(trelloCard.cardId)}/checklists`,
          {
            method: 'POST',
            body: JSON.stringify({ name: 'Acceptance Criteria' }),
          },
        );
        for (const item of criteria) {
          await trelloFetch(config, `/checklists/${encodeURIComponent(checklist.id)}/checkItems`, {
            method: 'POST',
            body: JSON.stringify({ name: item }),
          });
        }
      } catch {
        logger.warn(`Could not create checklist for card ${trelloCard.cardId}`);
      }
    }

    logger.info(`Attached spec v${spec.version} to Trello card ${trelloCard.cardId}`);
    return { cardId: trelloCard.cardId, commented: true };
  },

  /**
   * Import cards from a Trello board/list as feedback items.
   */
  async importFeedbackFromTrello(
    options: {
      listId?: string;
      maxResults?: number;
    } = {},
  ): Promise<{ imported: number; skipped: number; sourceId: string }> {
    const config = await getTrelloConfig();
    if (!config.boardId) throw BadRequest('No Trello board configured');

    const targetListId = options.listId || config.listId;
    if (!targetListId) throw BadRequest('No Trello list specified for import');

    const maxResults = Math.min(options.maxResults || 50, 100);

    const cards = await trelloFetch<TrelloCardResponse[]>(
      config,
      `/lists/${encodeURIComponent(targetListId)}/cards?fields=id,name,desc,url,idList,idBoard&limit=${maxResults}`,
    );

    // Get list name for channel
    const list = await trelloFetch<{ id: string; name: string }>(
      config,
      `/lists/${encodeURIComponent(targetListId)}?fields=name`,
    );

    // Create a feedback source for this import
    const source = await prisma.feedbackSource.create({
      data: {
        name: `Trello Import (${list.name})`,
        type: 'trello',
        metadata: {
          listId: targetListId,
          listName: list.name,
          importedAt: new Date().toISOString(),
        },
      },
    });

    let imported = 0;
    let skipped = 0;

    for (const card of cards) {
      // Skip if already imported
      const existing = await prisma.feedbackItem.findFirst({
        where: {
          metadata: { path: ['trello_card_id'], equals: card.id },
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const content = card.desc ? `[${card.name}]: ${card.desc}` : card.name;

      await prisma.feedbackItem.create({
        data: {
          content: content.slice(0, 5000),
          sourceId: source.id,
          channel: `trello_${list.name.toLowerCase().replace(/\s+/g, '_')}`,
          metadata: {
            trello_card_id: card.id,
            trello_card_url: card.url,
            trello_list: list.name,
          },
        },
      });
      imported++;
    }

    // Update source row count
    await prisma.feedbackSource.update({
      where: { id: source.id },
      data: { rowCount: imported },
    });

    return { imported, skipped, sourceId: source.id };
  },

  /**
   * Sync status for ALL linked Trello cards. Auto-updates proposal
   * status when card moves to a "done" list.
   */
  async syncAllStatuses(): Promise<{
    synced: number;
    autoShipped: number;
    errors: number;
  }> {
    const config = await getTrelloConfig();
    const allCards = await prisma.trelloCard.findMany({
      include: { proposal: { select: { id: true, status: true } } },
    });

    let synced = 0;
    let autoShipped = 0;
    let errors = 0;

    for (const trelloCard of allCards) {
      try {
        const card = await trelloFetch<TrelloCardResponse>(
          config,
          `/cards/${encodeURIComponent(trelloCard.cardId)}?fields=name,idList,url`,
        );

        const list = await trelloFetch<{ id: string; name: string }>(
          config,
          `/lists/${encodeURIComponent(card.idList)}?fields=name`,
        );

        await prisma.trelloCard.update({
          where: { id: trelloCard.id },
          data: { listName: list.name, cardName: card.name, syncedAt: new Date() },
        });

        // Auto-mark proposal as \"shipped\" when card is in a done-like list
        if (
          config.doneListNames.includes(list.name.toLowerCase()) &&
          trelloCard.proposal.status !== 'shipped'
        ) {
          await prisma.proposal.update({
            where: { id: trelloCard.proposal.id },
            data: { status: 'shipped' },
          });
          autoShipped++;
          logger.info(
            `Auto-shipped proposal ${trelloCard.proposal.id} (Trello card in list "${list.name}")`,
          );
        }

        synced++;
      } catch (err) {
        logger.error(`Failed to sync Trello card ${trelloCard.cardId}: ${err}`);
        errors++;
      }
    }

    return { synced, autoShipped, errors };
  },

  /**
   * Handle incoming Trello webhook events for real-time sync.
   */
  async handleWebhook(payload: {
    action?: {
      type: string;
      data?: {
        card?: { id: string; name: string };
        listAfter?: { id: string; name: string };
        list?: { id: string; name: string };
      };
    };
  }): Promise<{ processed: boolean; cardId?: string }> {
    const action = payload.action;
    if (!action?.data?.card?.id) {
      return { processed: false };
    }

    const cardId = action.data.card.id;
    const trelloCard = await prisma.trelloCard.findUnique({ where: { cardId } });

    if (!trelloCard) {
      return { processed: false };
    }

    // Handle card moved to a different list
    const newListName = action.data.listAfter?.name || action.data.list?.name;
    if (newListName) {
      await prisma.trelloCard.update({
        where: { cardId },
        data: {
          listName: newListName,
          cardName: action.data.card.name,
          syncedAt: new Date(),
        },
      });

      // Auto-ship proposal if card moved to a done-like list
      let doneNames: string[];
      try {
        const cfg = await getTrelloConfig();
        doneNames = cfg.doneListNames;
      } catch {
        doneNames = DEFAULT_TRELLO_DONE_LIST_NAMES;
      }
      if (doneNames.includes(newListName.toLowerCase())) {
        const proposal = await prisma.proposal.findUnique({
          where: { id: trelloCard.proposalId },
          select: { status: true },
        });
        if (proposal && proposal.status !== 'shipped') {
          await prisma.proposal.update({
            where: { id: trelloCard.proposalId },
            data: { status: 'shipped' },
          });
          logger.info(
            `Webhook auto-shipped proposal ${trelloCard.proposalId} (Trello card → "${newListName}")`,
          );
        }
      }
    }

    return { processed: true, cardId };
  },

  /**
   * Get Trello sync summary for the dashboard widget.
   */
  async getDashboardSummary(): Promise<{
    totalExported: number;
    byList: Record<string, number>;
    recentExports: {
      cardId: string;
      cardName: string;
      listName: string;
      cardUrl: string;
      createdAt: string;
    }[];
  }> {
    const allCards = await prisma.trelloCard.findMany({
      select: { cardId: true, cardName: true, listName: true, cardUrl: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });

    const byList: Record<string, number> = {};
    for (const card of allCards) {
      byList[card.listName] = (byList[card.listName] || 0) + 1;
    }

    return {
      totalExported: allCards.length,
      byList,
      recentExports: allCards.slice(0, 5).map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })),
    };
  },

  /**
   * Create a pre-configured ShipScope board with standard lists and labels.
   * One-click setup for new users.
   */
  async createBoardTemplate(): Promise<{
    boardId: string;
    boardUrl: string;
    listId: string;
  }> {
    const config = await getTrelloConfig();

    // Create board
    const board = await trelloFetch<{ id: string; url: string; name: string }>(config, '/boards', {
      method: 'POST',
      body: JSON.stringify({
        name: 'ShipScope Product Board',
        desc: 'Product backlog managed by ShipScope — feedback-driven prioritization with RICE scoring.',
        defaultLists: false,
      }),
    });

    // Create standard lists (right to left so order is correct)
    const listNames = ['Done', 'In Review', 'In Progress', 'Up Next', 'Backlog'];
    let backlogListId = '';
    for (const name of listNames) {
      const list = await trelloFetch<{ id: string }>(config, '/lists', {
        method: 'POST',
        body: JSON.stringify({ name, idBoard: board.id, pos: 'bottom' }),
      });
      if (name === 'Backlog') backlogListId = list.id;
    }

    // Create RICE tier labels
    const tierLabels = [
      { name: 'High Priority', color: 'red' },
      { name: 'Medium Priority', color: 'yellow' },
      { name: 'Low Priority', color: 'green' },
      { name: 'Unscored', color: 'sky' },
    ];
    for (const label of tierLabels) {
      await trelloFetch(config, '/labels', {
        method: 'POST',
        body: JSON.stringify({ ...label, idBoard: board.id }),
      });
    }

    // Create category labels
    const categoryLabels = [
      { name: 'Bug', color: 'red' },
      { name: 'Feature', color: 'blue' },
      { name: 'UX', color: 'purple' },
      { name: 'Performance', color: 'orange' },
    ];
    for (const label of categoryLabels) {
      await trelloFetch(config, '/labels', {
        method: 'POST',
        body: JSON.stringify({ ...label, idBoard: board.id }),
      });
    }

    // Save board + list in settings
    await settingsService.bulkSet({
      [TRELLO_SETTING_KEYS.TRELLO_BOARD_ID]: board.id,
      [TRELLO_SETTING_KEYS.TRELLO_LIST_ID]: backlogListId,
    });

    logger.info(`Created ShipScope board template: ${board.id}`);

    return {
      boardId: board.id,
      boardUrl: board.url,
      listId: backlogListId,
    };
  },
};

// ─── Helpers ──────────────────────────────────────────────

interface ProposalWithEvidence {
  title: string;
  problem: string;
  solution: string;
  reachScore: number | null;
  impactScore: number | null;
  confidenceScore: number | null;
  effortScore: number | null;
  riceScore: number | null;
  theme: { name: string; category?: string | null } | null;
  evidence: {
    feedbackItem: { content: string; author: string | null; channel: string | null };
  }[];
}

/**
 * Build a Trello card description in Markdown.
 */
function buildTrelloDescription(proposal: ProposalWithEvidence): string {
  const sections: string[] = [];

  sections.push(`## Problem\n${proposal.problem}`);
  sections.push(`## Solution\n${proposal.solution}`);

  if (proposal.riceScore !== null) {
    sections.push(
      `## RICE Score\n` +
        `- Reach: ${proposal.reachScore ?? '-'}\n` +
        `- Impact: ${proposal.impactScore ?? '-'}\n` +
        `- Confidence: ${proposal.confidenceScore ?? '-'}\n` +
        `- Effort: ${proposal.effortScore ?? '-'}\n` +
        `- **Total: ${proposal.riceScore?.toFixed(1) ?? '-'}**`,
    );
  }

  if (proposal.theme) {
    sections.push(`## Theme\n${proposal.theme.name}`);
  }

  if (proposal.evidence.length > 0) {
    const quotes = proposal.evidence
      .map(
        (ev) =>
          `- "${ev.feedbackItem.content.slice(0, 200)}"${ev.feedbackItem.author ? ` — ${ev.feedbackItem.author}` : ''}${ev.feedbackItem.channel ? ` (${ev.feedbackItem.channel})` : ''}`,
      )
      .join('\n');
    sections.push(`## Customer Evidence\n${quotes}`);
  }

  sections.push(`---\n*Generated by ShipScope*`);

  return sections.join('\n\n');
}

/**
 * Get or create a Trello label on the configured board.
 */
async function getOrCreateLabel(
  config: TrelloConfig,
  name: string,
  color: string,
): Promise<string | null> {
  try {
    if (!config.boardId) return null;
    const labels = await trelloFetch<TrelloLabel[]>(
      config,
      `/boards/${encodeURIComponent(config.boardId)}/labels`,
    );
    const existing = labels.find((l) => l.name === name && l.color === color);
    if (existing) return existing.id;

    const created = await trelloFetch<TrelloLabel>(config, '/labels', {
      method: 'POST',
      body: JSON.stringify({ name, color, idBoard: config.boardId }),
    });
    return created.id;
  } catch {
    return null;
  }
}

/**
 * Extract acceptance criteria from PRD markdown.
 * Looks for bullet points under headings containing "acceptance" or "criteria" or "requirements".
 */
function extractAcceptanceCriteria(prdMarkdown: string): string[] {
  const lines = prdMarkdown.split('\n');
  const criteria: string[] = [];
  let inSection = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^#{1,4}\s+/i.test(trimmed)) {
      inSection = /acceptance|criteria|requirement|definition of done/i.test(trimmed);
      continue;
    }
    if (inSection && /^[-*]\s+/.test(trimmed)) {
      const text = trimmed.replace(/^[-*]\s+/, '').slice(0, 200);
      if (text) criteria.push(text);
    }
    // Stop capturing if we hit an empty line after collecting items
    if (inSection && !trimmed && criteria.length > 0) {
      break;
    }
  }

  return criteria.slice(0, 20); // Cap at 20 checklist items
}
