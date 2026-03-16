import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prisma } from '../setup';
import { createTheme, createProposal, createSpec, createTrelloCard } from '../helpers/factories';
import { trelloService, TRELLO_SETTING_KEYS } from '../../src/services/trello.service';

// Helper to seed Trello config settings in the database
async function seedTrelloConfig(overrides: Record<string, string> = {}) {
  const defaults: Record<string, string> = {
    [TRELLO_SETTING_KEYS.TRELLO_API_KEY]: 'test-api-key',
    [TRELLO_SETTING_KEYS.TRELLO_TOKEN]: 'test-token',
    [TRELLO_SETTING_KEYS.TRELLO_BOARD_ID]: 'board123',
    [TRELLO_SETTING_KEYS.TRELLO_LIST_ID]: 'list456',
    ...overrides,
  };
  for (const [key, value] of Object.entries(defaults)) {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}

// Mock global fetch for Trello API calls
function mockFetch(response: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(JSON.stringify(response)),
  } as Response);
}

describe('Trello Service', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ─── testConnection ─────────────────────────────────────

  describe('testConnection', () => {
    it('returns success when Trello API responds', async () => {
      await seedTrelloConfig();
      mockFetch({ id: 'user1', username: 'testuser', fullName: 'Test User' });

      const result = await trelloService.testConnection();
      expect(result.success).toBe(true);
      expect(result.message).toContain('Test User');
      expect(result.username).toBe('testuser');
    });

    it('returns failure when Trello is not configured', async () => {
      const result = await trelloService.testConnection();
      expect(result.success).toBe(false);
      expect(result.message).toContain('not configured');
    });

    it('returns failure when Trello API rejects credentials', async () => {
      await seedTrelloConfig();
      mockFetch('invalid token', 401);

      const result = await trelloService.testConnection();
      expect(result.success).toBe(false);
      expect(result.message).toContain('401');
    });
  });

  // ─── listBoards ────────────────────────────────────────

  describe('listBoards', () => {
    it('returns mapped board list', async () => {
      await seedTrelloConfig();
      mockFetch([
        { id: 'b1', name: 'Board One', url: 'https://trello.com/b/b1' },
        { id: 'b2', name: 'Board Two', url: 'https://trello.com/b/b2' },
      ]);

      const boards = await trelloService.listBoards();
      expect(boards).toHaveLength(2);
      expect(boards[0]).toEqual({ id: 'b1', name: 'Board One', url: 'https://trello.com/b/b1' });
    });

    it('throws when not configured', async () => {
      await expect(trelloService.listBoards()).rejects.toThrow('not configured');
    });
  });

  // ─── listLists ─────────────────────────────────────────

  describe('listLists', () => {
    it('returns mapped list of lists', async () => {
      await seedTrelloConfig();
      mockFetch([
        { id: 'l1', name: 'To Do', closed: false },
        { id: 'l2', name: 'Done', closed: false },
      ]);

      const lists = await trelloService.listLists();
      expect(lists).toHaveLength(2);
      expect(lists[0]).toEqual({ id: 'l1', name: 'To Do', closed: false });
    });

    it('throws when no board configured', async () => {
      await seedTrelloConfig({ [TRELLO_SETTING_KEYS.TRELLO_BOARD_ID]: '' });
      await expect(trelloService.listLists()).rejects.toThrow('board');
    });
  });

  // ─── exportProposal ────────────────────────────────────

  describe('exportProposal', () => {
    it('creates a Trello card with labels, due date, cover, and backlink', async () => {
      await seedTrelloConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);

      const fetchMock = vi.spyOn(globalThis, 'fetch');

      // Helper: always-ok response
      const okResponse = (data: unknown) =>
        ({
          ok: true,
          status: 200,
          json: () => Promise.resolve(data),
          text: () => Promise.resolve(''),
        }) as Response;

      // 1. Get board labels (riceScore=12.5 → "High Impact" red, not in existing labels)
      fetchMock.mockResolvedValueOnce(okResponse([{ id: 'lbl1', name: 'Unscored', color: 'sky' }]));
      // 2. Create missing "High Impact" label
      fetchMock.mockResolvedValueOnce(
        okResponse({ id: 'lbl-new', name: 'High Impact', color: 'red' }),
      );
      // 3. Create card
      fetchMock.mockResolvedValueOnce(
        okResponse({
          id: 'card-new',
          name: proposal.title,
          url: 'https://trello.com/c/card-new',
          idList: 'list456',
          idBoard: 'board123',
          desc: '',
        }),
      );
      // 4. Set cover
      fetchMock.mockResolvedValueOnce(okResponse({}));
      // 5. Add backlink attachment
      fetchMock.mockResolvedValueOnce(okResponse({ id: 'att1' }));
      // 6. Get lists (for list name)
      fetchMock.mockResolvedValueOnce(
        okResponse([{ id: 'list456', name: 'To Do', closed: false }]),
      );

      const result = await trelloService.exportProposal(proposal.id);
      expect(result.cardId).toBe('card-new');
      expect(result.cardUrl).toBe('https://trello.com/c/card-new');

      // Verify DB record created
      const dbCard = await prisma.trelloCard.findUnique({ where: { proposalId: proposal.id } });
      expect(dbCard).not.toBeNull();
      expect(dbCard?.cardId).toBe('card-new');
      expect(dbCard?.listName).toBe('To Do');

      // Verify fetch calls: getLabels + createLabel + createCard + cover + backlink + getLists
      expect(fetchMock).toHaveBeenCalledTimes(6);
    });

    it('throws when proposal already exported', async () => {
      await seedTrelloConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createTrelloCard(proposal.id);

      await expect(trelloService.exportProposal(proposal.id)).rejects.toThrow('already exported');
    });

    it('throws when no list configured', async () => {
      await seedTrelloConfig({ [TRELLO_SETTING_KEYS.TRELLO_LIST_ID]: '' });
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);

      await expect(trelloService.exportProposal(proposal.id)).rejects.toThrow('list');
    });

    it('throws when proposal not found', async () => {
      await seedTrelloConfig();
      await expect(trelloService.exportProposal('nonexistent')).rejects.toThrow();
    });
  });

  // ─── syncStatus ────────────────────────────────────────

  describe('syncStatus', () => {
    it('syncs the list name and detects title changes', async () => {
      await seedTrelloConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id, { title: 'Original Title' });
      await createTrelloCard(proposal.id, { cardName: 'Original Title' });

      const fetchMock = vi.spyOn(globalThis, 'fetch');
      // Get card — title was renamed in Trello
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ name: 'Renamed in Trello', idList: 'list789', url: 'url' }),
        text: () => Promise.resolve(''),
      } as Response);
      // Get list name
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'list789', name: 'In Progress' }),
        text: () => Promise.resolve(''),
      } as Response);

      const result = await trelloService.syncStatus(proposal.id);
      expect(result.listName).toBe('In Progress');
      expect(result.titleUpdated).toBe(true);

      // Verify proposal title was updated
      const updatedProposal = await prisma.proposal.findUnique({ where: { id: proposal.id } });
      expect(updatedProposal?.title).toBe('Renamed in Trello');

      const updated = await prisma.trelloCard.findUnique({ where: { proposalId: proposal.id } });
      expect(updated?.listName).toBe('In Progress');
      expect(updated?.cardName).toBe('Renamed in Trello');
    });

    it('throws when no linked card', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await expect(trelloService.syncStatus(proposal.id)).rejects.toThrow();
    });
  });

  // ─── getByProposal ────────────────────────────────────

  describe('getByProposal', () => {
    it('returns the linked card', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createTrelloCard(proposal.id);

      const card = await trelloService.getByProposal(proposal.id);
      expect(card).not.toBeNull();
      expect(card?.cardId).toBe('card123abc');
    });

    it('returns null when no card linked', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      const card = await trelloService.getByProposal(proposal.id);
      expect(card).toBeNull();
    });
  });

  // ─── listExported ─────────────────────────────────────

  describe('listExported', () => {
    it('returns all exported cards with proposals', async () => {
      const theme = await createTheme();
      const p1 = await createProposal(theme.id, { title: 'Proposal 1' });
      const p2 = await createProposal(theme.id, { title: 'Proposal 2' });
      await createTrelloCard(p1.id, { cardId: 'c1' });
      await createTrelloCard(p2.id, { cardId: 'c2' });

      const exported = await trelloService.listExported();
      expect(exported).toHaveLength(2);
      expect(exported[0].proposal).toBeDefined();
    });

    it('returns empty array when none exported', async () => {
      const exported = await trelloService.listExported();
      expect(exported).toHaveLength(0);
    });
  });

  // ─── unlink ────────────────────────────────────────────

  describe('unlink', () => {
    it('removes the card link from database', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createTrelloCard(proposal.id);

      await trelloService.unlink(proposal.id);

      const card = await prisma.trelloCard.findUnique({ where: { proposalId: proposal.id } });
      expect(card).toBeNull();
    });

    it('throws when no card linked', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await expect(trelloService.unlink(proposal.id)).rejects.toThrow();
    });
  });

  // ─── attachSpec ────────────────────────────────────────

  describe('attachSpec', () => {
    it('throws when no card linked', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await expect(trelloService.attachSpec(proposal.id)).rejects.toThrow();
    });

    it('throws when no spec generated', async () => {
      await seedTrelloConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createTrelloCard(proposal.id);
      await expect(trelloService.attachSpec(proposal.id)).rejects.toThrow('spec');
    });

    it('posts spec as comment on card and creates acceptance criteria checklist', async () => {
      await seedTrelloConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createTrelloCard(proposal.id);
      await createSpec(proposal.id, {
        prdMarkdown:
          '# Spec\n## Acceptance Criteria\n- User can do X\n- System handles Y\n\n## Notes\nDone',
      });

      const fetchMock = vi.spyOn(globalThis, 'fetch');
      // 1. Post comment
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'comment1' }),
        text: () => Promise.resolve(''),
      } as Response);
      // 2. Create checklist
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'cl1' }),
        text: () => Promise.resolve(''),
      } as Response);
      // 3. Add checkItem 1
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'ci1' }),
        text: () => Promise.resolve(''),
      } as Response);
      // 4. Add checkItem 2
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'ci2' }),
        text: () => Promise.resolve(''),
      } as Response);

      const result = await trelloService.attachSpec(proposal.id);
      expect(result.cardId).toBe('card123abc');
      expect(result.commented).toBe(true);
      // comment + checklist + 2 checkItems = 4 calls
      expect(fetchMock).toHaveBeenCalledTimes(4);
    });
  });

  // ─── handleWebhook ────────────────────────────────────

  describe('handleWebhook', () => {
    it('returns processed:false when no card.id in payload', async () => {
      const result = await trelloService.handleWebhook({ action: { type: 'updateCard' } });
      expect(result.processed).toBe(false);
    });

    it('returns processed:false when card not in our DB', async () => {
      const result = await trelloService.handleWebhook({
        action: {
          type: 'updateCard',
          data: {
            card: { id: 'unknown-card', name: 'Card' },
            listAfter: { id: 'l1', name: 'Done' },
          },
        },
      });
      expect(result.processed).toBe(false);
    });

    it('updates list name when card moves', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createTrelloCard(proposal.id);

      const result = await trelloService.handleWebhook({
        action: {
          type: 'updateCard',
          data: {
            card: { id: 'card123abc', name: 'Updated Card' },
            listAfter: { id: 'l2', name: 'In Progress' },
          },
        },
      });

      expect(result.processed).toBe(true);
      const updated = await prisma.trelloCard.findUnique({ where: { proposalId: proposal.id } });
      expect(updated?.listName).toBe('In Progress');
    });

    it('auto-ships proposal when card moves to Done list', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id, { status: 'approved' });
      await createTrelloCard(proposal.id);

      await trelloService.handleWebhook({
        action: {
          type: 'updateCard',
          data: {
            card: { id: 'card123abc', name: 'Card' },
            listAfter: { id: 'l3', name: 'Done' },
          },
        },
      });

      const updated = await prisma.proposal.findUnique({ where: { id: proposal.id } });
      expect(updated?.status).toBe('shipped');
    });
  });

  // ─── getDashboardSummary ──────────────────────────────

  describe('getDashboardSummary', () => {
    it('returns summary with zero exports', async () => {
      const summary = await trelloService.getDashboardSummary();
      expect(summary.totalExported).toBe(0);
      expect(summary.byList).toEqual({});
      expect(summary.recentExports).toHaveLength(0);
    });

    it('returns correct counts and breakdown', async () => {
      const theme = await createTheme();
      const p1 = await createProposal(theme.id);
      const p2 = await createProposal(theme.id);
      await createTrelloCard(p1.id, { cardId: 'c1', listName: 'To Do' });
      await createTrelloCard(p2.id, { cardId: 'c2', listName: 'Done' });

      const summary = await trelloService.getDashboardSummary();
      expect(summary.totalExported).toBe(2);
      expect(summary.byList['To Do']).toBe(1);
      expect(summary.byList['Done']).toBe(1);
      expect(summary.recentExports).toHaveLength(2);
    });
  });

  // ─── createBoardTemplate ──────────────────────────────

  describe('createBoardTemplate', () => {
    it('creates a board with standard lists and labels', async () => {
      await seedTrelloConfig();

      const fetchMock = vi.spyOn(globalThis, 'fetch');
      const okResponse = (data: unknown) =>
        ({
          ok: true,
          status: 200,
          json: () => Promise.resolve(data),
          text: () => Promise.resolve(''),
        }) as Response;

      // 1. Create board
      fetchMock.mockResolvedValueOnce(
        okResponse({
          id: 'new-board',
          url: 'https://trello.com/b/new-board',
          name: 'ShipScope Product Board',
        }),
      );
      // 2-6: Create 5 lists (Done, In Review, In Progress, Up Next, Backlog)
      fetchMock.mockResolvedValueOnce(okResponse({ id: 'list-done' }));
      fetchMock.mockResolvedValueOnce(okResponse({ id: 'list-review' }));
      fetchMock.mockResolvedValueOnce(okResponse({ id: 'list-progress' }));
      fetchMock.mockResolvedValueOnce(okResponse({ id: 'list-next' }));
      fetchMock.mockResolvedValueOnce(okResponse({ id: 'list-backlog' }));
      // 7-14: Create 8 labels (4 RICE tier + 4 category)
      for (let i = 0; i < 8; i++) {
        fetchMock.mockResolvedValueOnce(okResponse({ id: `label-${i}` }));
      }

      const result = await trelloService.createBoardTemplate();
      expect(result.boardId).toBe('new-board');
      expect(result.boardUrl).toBe('https://trello.com/b/new-board');
      expect(result.listId).toBe('list-backlog');

      // Verify settings were saved
      const savedBoard = await prisma.setting.findUnique({ where: { key: 'trello_board_id' } });
      expect(savedBoard?.value).toBe('new-board');
      const savedList = await prisma.setting.findUnique({ where: { key: 'trello_list_id' } });
      expect(savedList?.value).toBe('list-backlog');
    });
  });
});
