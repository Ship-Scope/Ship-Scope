import { Router, type Request, type Response, type NextFunction } from 'express';
import { NotFound } from '../lib/errors';
import { validate } from '../middleware/validate';
import { apiRateLimit } from '../middleware/rateLimit';
import { createApiKeySchema } from '../schemas/webhook.schema';
import { webhookService } from '../services/webhook.service';

const router = Router();

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
