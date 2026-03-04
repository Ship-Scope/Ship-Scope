import { Router, type Request, type Response, type NextFunction } from 'express';
import { NotFound } from '../lib/errors';
import { validate } from '../middleware/validate';
import { apiRateLimit } from '../middleware/rateLimit';
import { createApiKeySchema } from '../schemas/webhook.schema';
import { webhookService } from '../services/webhook.service';
import { settingsService } from '../services/settings.service';

const router = Router();

// ─── Settings CRUD ────────────────────────────────────────

/**
 * GET /api/settings
 * Get all settings (API key is masked).
 */
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = await settingsService.getAll();
    res.json({ data: settings });
  } catch (err) {
    next(err);
  }
});

/**
 * PUT /api/settings
 * Bulk update settings.
 */
router.put('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const settings = req.body as Record<string, string>;
    await settingsService.bulkSet(settings);
    const updated = await settingsService.getAll();
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/settings/test-ai
 * Test the AI connection with current settings.
 */
router.post('/test-ai', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await settingsService.testAIConnection();
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/settings/export
 * Export all application data as JSON.
 */
router.post('/export', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await settingsService.exportAllData();
    res.json({ data });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/settings/data
 * Delete all application data (destructive).
 */
router.delete('/data', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await settingsService.deleteAllData();
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/settings/api-keys
 *
 * Generate a new API key. The full key is returned only once in the response.
 */
router.post(
  '/api-keys',
  apiRateLimit,
  validate(createApiKeySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { name } = req.body as { name?: string };
      const result = await webhookService.generateApiKey(name);

      res.status(201).json({
        key: result.key,
        id: result.id,
        name: result.name,
        keyPrefix: result.keyPrefix,
      });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * GET /api/settings/api-keys
 *
 * List all API keys. Returns prefix only, never the full key or hash.
 */
router.get('/api-keys', apiRateLimit, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const keys = await webhookService.listApiKeys();
    res.json({ keys });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/settings/api-keys/:id
 *
 * Revoke an API key by setting isActive to false.
 */
router.delete(
  '/api-keys/:id',
  apiRateLimit,
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const result = await webhookService.revokeApiKey(id);

      if (!result) {
        throw NotFound('API key');
      }

      res.status(204).send();
    } catch (err) {
      next(err);
    }
  },
);

export default router;
