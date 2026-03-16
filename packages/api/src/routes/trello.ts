import { Router, type Request, type Response, type NextFunction } from 'express';
import { trelloService } from '../services/trello.service';
import { settingsService } from '../services/settings.service';
import { activityService } from '../services/activity.service';
import { validate } from '../middleware/validate';
import { trelloConfigSchema, trelloImportSchema } from '../schemas/trello.schema';
import { AppError } from '../lib/errors';

const router = Router();

// ─── Configuration ────────────────────────────────────────

/**
 * PUT /api/trello/config
 * Save Trello configuration (API key, token, board, list).
 */
router.put(
  '/config',
  validate(trelloConfigSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = req.body as Record<string, string>;
      await settingsService.bulkSet(settings);
      res.json({ data: { saved: true } });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/trello/test
 * Test the Trello connection with current credentials.
 */
router.post('/test', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await trelloService.testConnection();
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/trello/boards
 * List Trello boards for the authenticated user.
 */
router.get('/boards', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const boards = await trelloService.listBoards();
    res.json({ data: boards });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/trello/lists
 * List open lists for the configured board.
 */
router.get('/lists', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const lists = await trelloService.listLists();
    res.json({ data: lists });
  } catch (err) {
    next(err);
  }
});

// ─── Export & Sync ────────────────────────────────────────

/**
 * POST /api/trello/export/:proposalId
 * Export a proposal to Trello as a new card.
 */
router.post('/export/:proposalId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await trelloService.exportProposal(req.params.proposalId);

    await activityService.log({
      type: 'trello_export',
      description: `Exported proposal to Trello card ${result.cardId}`,
      metadata: { proposalId: req.params.proposalId, cardId: result.cardId },
    });

    res.status(201).json({ data: result });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

/**
 * POST /api/trello/sync/:proposalId
 * Sync the Trello card status (list name) back to the local record.
 */
router.post('/sync/:proposalId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await trelloService.syncStatus(req.params.proposalId);
    res.json({ data: result });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

/**
 * GET /api/trello/cards
 * List all exported Trello cards.
 */
router.get('/cards', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const cards = await trelloService.listExported();
    res.json({ data: cards });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/trello/cards/:proposalId
 * Get the Trello card linked to a specific proposal.
 */
router.get('/cards/:proposalId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const card = await trelloService.getByProposal(req.params.proposalId);
    res.json({ data: card });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/trello/cards/:proposalId
 * Unlink a Trello card from a proposal (does not delete the Trello card itself).
 */
router.delete('/cards/:proposalId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await trelloService.unlink(req.params.proposalId);
    res.status(204).send();
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

// ─── Theme → List Bulk Export ─────────────────────────────

/**
 * POST /api/trello/export-theme/:themeId
 * Export a theme as a Trello list with all proposals as cards.
 */
router.post('/export-theme/:themeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await trelloService.exportThemeAsList(req.params.themeId);

    await activityService.log({
      type: 'trello_export',
      description: `Exported theme as Trello list "${result.listName}" with ${result.cardsCreated} cards`,
      metadata: {
        themeId: req.params.themeId,
        listName: result.listName,
        cardsCreated: result.cardsCreated,
        cardsSkipped: result.cardsSkipped,
      },
    });

    res.status(201).json({ data: result });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

// ─── Spec Attachment ──────────────────────────────────────

/**
 * POST /api/trello/attach-spec/:proposalId
 * Attach the generated PRD spec as a comment on the linked Trello card.
 */
router.post('/attach-spec/:proposalId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await trelloService.attachSpec(req.params.proposalId);
    res.json({ data: result });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

// ─── Feedback Import from Trello ──────────────────────────

/**
 * POST /api/trello/import-feedback
 * Import cards from a Trello list as feedback items.
 */
router.post(
  '/import-feedback',
  validate(trelloImportSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { listId, maxResults } = req.body as { listId?: string; maxResults?: number };
      const result = await trelloService.importFeedbackFromTrello({ listId, maxResults });

      await activityService.log({
        type: 'import',
        description: `Imported ${result.imported} items from Trello (${result.skipped} skipped)`,
        metadata: { source: 'trello', imported: result.imported, skipped: result.skipped },
      });

      res.status(201).json({ data: result });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: err.message, code: err.code });
        return;
      }
      next(err);
    }
  },
);

// ─── Bulk Sync ────────────────────────────────────────────

/**
 * POST /api/trello/sync-all
 * Sync status for all linked Trello cards. Auto-ships proposals
 * when Trello card moves to a "Done" list.
 */
router.post('/sync-all', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await trelloService.syncAllStatuses();

    if (result.autoShipped > 0) {
      await activityService.log({
        type: 'trello_export',
        description: `Trello sync: ${result.synced} synced, ${result.autoShipped} auto-shipped`,
        metadata: result,
      });
    }

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// ─── Trello Webhook Receiver ─────────────────────────────

/**
 * POST /api/trello/webhook
 * Receive Trello webhook events for real-time card movement sync.
 */
router.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await trelloService.handleWebhook(req.body);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * HEAD /api/trello/webhook
 * Trello verifies webhook URLs with a HEAD request — must return 200.
 */
router.head('/webhook', (_req: Request, res: Response) => {
  res.sendStatus(200);
});

// ─── Dashboard Summary ───────────────────────────────────

/**
 * GET /api/trello/dashboard
 * Get Trello integration summary for the dashboard widget.
 */
router.get('/dashboard', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await trelloService.getDashboardSummary();
    res.json({ data: summary });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/trello/create-board
 * Create a pre-configured ShipScope board with standard lists and labels.
 */
router.post('/create-board', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await trelloService.createBoardTemplate();
    res.status(201).json({ data: result });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

export default router;
