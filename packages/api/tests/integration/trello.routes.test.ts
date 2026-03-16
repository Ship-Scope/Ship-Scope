import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/index';
import { prisma } from '../setup';
import { createTheme, createProposal, createSpec, createTrelloCard } from '../helpers/factories';

// Mock global fetch for Trello API calls (external service)
function mockFetch(response: unknown, status = 200) {
  return vi.spyOn(globalThis, 'fetch').mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(response),
    text: () => Promise.resolve(JSON.stringify(response)),
  } as Response);
}

async function seedTrelloConfig() {
  const settings = {
    trello_api_key: 'test-api-key',
    trello_token: 'test-token',
    trello_board_id: 'board123',
    trello_list_id: 'list456',
  };
  for (const [key, value] of Object.entries(settings)) {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }
}

const app = createApp();

describe('Trello Routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  // ─── PUT /api/trello/config ────────────────────────────

  describe('PUT /api/trello/config', () => {
    it('saves valid Trello config', async () => {
      const res = await request(app)
        .put('/api/trello/config')
        .send({
          trello_api_key: 'my-api-key',
          trello_token: 'my-token',
          trello_board_id: 'board789',
          trello_list_id: 'list012',
        })
        .expect(200);

      expect(res.body.data.saved).toBe(true);

      const key = await prisma.setting.findUnique({ where: { key: 'trello_api_key' } });
      expect(key!.value).toBe('my-api-key');
    });

    it('accepts partial config', async () => {
      const res = await request(app)
        .put('/api/trello/config')
        .send({ trello_board_id: 'newboard' })
        .expect(200);

      expect(res.body.data.saved).toBe(true);
    });

    it('rejects empty API key', async () => {
      await request(app).put('/api/trello/config').send({ trello_api_key: '' }).expect(400);
    });
  });

  // ─── POST /api/trello/test ─────────────────────────────

  describe('POST /api/trello/test', () => {
    it('returns success when connection works', async () => {
      await seedTrelloConfig();
      mockFetch({ id: 'user1', username: 'testuser', fullName: 'Test User' });

      const res = await request(app).post('/api/trello/test').expect(200);

      expect(res.body.data.success).toBe(true);
      expect(res.body.data.message).toContain('Test User');
    });

    it('returns failure when not configured', async () => {
      const res = await request(app).post('/api/trello/test').expect(200);

      expect(res.body.data.success).toBe(false);
      expect(res.body.data.message).toContain('not configured');
    });
  });

  // ─── GET /api/trello/boards ────────────────────────────

  describe('GET /api/trello/boards', () => {
    it('returns board list', async () => {
      await seedTrelloConfig();
      mockFetch([
        { id: 'b1', name: 'Board 1', url: 'https://trello.com/b/b1' },
        { id: 'b2', name: 'Board 2', url: 'https://trello.com/b/b2' },
      ]);

      const res = await request(app).get('/api/trello/boards').expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].name).toBe('Board 1');
    });
  });

  // ─── GET /api/trello/lists ─────────────────────────────

  describe('GET /api/trello/lists', () => {
    it('returns lists for configured board', async () => {
      await seedTrelloConfig();
      mockFetch([
        { id: 'l1', name: 'To Do', closed: false },
        { id: 'l2', name: 'Done', closed: false },
      ]);

      const res = await request(app).get('/api/trello/lists').expect(200);

      expect(res.body.data).toHaveLength(2);
      expect(res.body.data[0].name).toBe('To Do');
    });
  });

  // ─── POST /api/trello/export/:proposalId ───────────────

  describe('POST /api/trello/export/:proposalId', () => {
    it('exports proposal to Trello and returns 201', async () => {
      await seedTrelloConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);

      const fetchMock = vi.spyOn(globalThis, 'fetch');
      const okResponse = (data: unknown) =>
        ({
          ok: true,
          status: 200,
          json: () => Promise.resolve(data),
          text: () => Promise.resolve(''),
        }) as Response;

      // 1. Get board labels
      fetchMock.mockResolvedValueOnce(okResponse([]));
      // 2. Create label (since board has none)
      fetchMock.mockResolvedValueOnce(okResponse({ id: 'lbl1', name: 'Unscored', color: 'sky' }));
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
      // 5. Add backlink
      fetchMock.mockResolvedValueOnce(okResponse({ id: 'att1' }));
      // 6. Get lists
      fetchMock.mockResolvedValueOnce(
        okResponse([{ id: 'list456', name: 'To Do', closed: false }]),
      );

      const res = await request(app).post(`/api/trello/export/${proposal.id}`).expect(201);

      expect(res.body.data.cardId).toBe('card-new');
      expect(res.body.data.cardUrl).toBe('https://trello.com/c/card-new');

      const dbCard = await prisma.trelloCard.findUnique({ where: { proposalId: proposal.id } });
      expect(dbCard).not.toBeNull();
    });

    it('returns error when proposal already exported', async () => {
      await seedTrelloConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createTrelloCard(proposal.id);

      await request(app).post(`/api/trello/export/${proposal.id}`).expect(400);
    });
  });

  // ─── POST /api/trello/sync/:proposalId ─────────────────

  describe('POST /api/trello/sync/:proposalId', () => {
    it('syncs card status from Trello', async () => {
      await seedTrelloConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createTrelloCard(proposal.id);

      const fetchMock = vi.spyOn(globalThis, 'fetch');
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ name: 'Card', idList: 'list789', url: 'url' }),
        text: () => Promise.resolve(''),
      } as Response);
      fetchMock.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: 'list789', name: 'In Review' }),
        text: () => Promise.resolve(''),
      } as Response);

      const res = await request(app).post(`/api/trello/sync/${proposal.id}`).expect(200);

      expect(res.body.data.listName).toBe('In Review');
    });
  });

  // ─── GET /api/trello/cards ─────────────────────────────

  describe('GET /api/trello/cards', () => {
    it('returns all exported cards', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createTrelloCard(proposal.id);

      const res = await request(app).get('/api/trello/cards').expect(200);

      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].cardId).toBe('card123abc');
    });
  });

  // ─── GET /api/trello/cards/:proposalId ─────────────────

  describe('GET /api/trello/cards/:proposalId', () => {
    it('returns card for proposal', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createTrelloCard(proposal.id);

      const res = await request(app).get(`/api/trello/cards/${proposal.id}`).expect(200);

      expect(res.body.data.cardId).toBe('card123abc');
    });

    it('returns null when no card linked', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);

      const res = await request(app).get(`/api/trello/cards/${proposal.id}`).expect(200);

      expect(res.body.data).toBeNull();
    });
  });

  // ─── DELETE /api/trello/cards/:proposalId ──────────────

  describe('DELETE /api/trello/cards/:proposalId', () => {
    it('unlinks card and returns 204', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createTrelloCard(proposal.id);

      await request(app).delete(`/api/trello/cards/${proposal.id}`).expect(204);

      const card = await prisma.trelloCard.findUnique({ where: { proposalId: proposal.id } });
      expect(card).toBeNull();
    });

    it('returns error when no card linked', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);

      await request(app).delete(`/api/trello/cards/${proposal.id}`).expect(404);
    });
  });

  // ─── POST /api/trello/attach-spec/:proposalId ─────────

  describe('POST /api/trello/attach-spec/:proposalId', () => {
    it('attaches spec as comment', async () => {
      await seedTrelloConfig();
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createTrelloCard(proposal.id);
      await createSpec(proposal.id);

      mockFetch({ id: 'comment1' });

      const res = await request(app).post(`/api/trello/attach-spec/${proposal.id}`).expect(200);

      expect(res.body.data.commented).toBe(true);
    });
  });

  // ─── POST /api/trello/webhook ──────────────────────────

  describe('POST /api/trello/webhook', () => {
    it('processes card move event', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createTrelloCard(proposal.id);

      const res = await request(app)
        .post('/api/trello/webhook')
        .send({
          action: {
            type: 'updateCard',
            data: {
              card: { id: 'card123abc', name: 'Card' },
              listAfter: { id: 'l2', name: 'In Progress' },
            },
          },
        })
        .expect(200);

      expect(res.body.data.processed).toBe(true);
    });

    it('returns processed:false for unknown cards', async () => {
      const res = await request(app)
        .post('/api/trello/webhook')
        .send({
          action: {
            type: 'updateCard',
            data: {
              card: { id: 'unknown', name: 'Card' },
              listAfter: { id: 'l1', name: 'Done' },
            },
          },
        })
        .expect(200);

      expect(res.body.data.processed).toBe(false);
    });
  });

  // ─── HEAD /api/trello/webhook ──────────────────────────

  describe('HEAD /api/trello/webhook', () => {
    it('returns 200 for Trello webhook verification', async () => {
      await request(app).head('/api/trello/webhook').expect(200);
    });
  });

  // ─── GET /api/trello/dashboard ─────────────────────────

  describe('GET /api/trello/dashboard', () => {
    it('returns dashboard summary', async () => {
      const theme = await createTheme();
      const proposal = await createProposal(theme.id);
      await createTrelloCard(proposal.id);

      const res = await request(app).get('/api/trello/dashboard').expect(200);

      expect(res.body.data.totalExported).toBe(1);
      expect(res.body.data.byList).toBeDefined();
      expect(res.body.data.recentExports).toHaveLength(1);
    });
  });
});
