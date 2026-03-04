import { Router, type Request, type Response, type NextFunction } from 'express';
import { type Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { Unauthorized } from '../lib/errors';
import { validate } from '../middleware/validate';
import { apiRateLimit } from '../middleware/rateLimit';
import { webhookPayloadSchema, type WebhookItemInput } from '../schemas/webhook.schema';
import { webhookService } from '../services/webhook.service';

const router = Router();

/**
 * Middleware: Authenticate webhook requests via X-API-Key header.
 */
async function authenticateWebhook(req: Request, _res: Response, next: NextFunction) {
  const apiKey = req.headers['x-api-key'] as string | undefined;

  if (!apiKey) {
    return next(Unauthorized('Missing X-API-Key header'));
  }

  const isValid = await webhookService.validateApiKey(apiKey);

  if (!isValid) {
    return next(Unauthorized('Invalid or revoked API key'));
  }

  next();
}

/**
 * POST /api/feedback/webhook
 *
 * Accepts a single feedback item or an array of up to 100 items.
 * Requires a valid API key in the X-API-Key header.
 */
router.post(
  '/',
  apiRateLimit,
  authenticateWebhook,
  validate(webhookPayloadSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const payload = req.body as WebhookItemInput | WebhookItemInput[];

      // Normalize to array
      const items: WebhookItemInput[] = Array.isArray(payload) ? payload : [payload];

      // Create a FeedbackSource for this webhook batch
      const source = await prisma.feedbackSource.create({
        data: {
          name: `Webhook Import - ${new Date().toISOString()}`,
          type: 'webhook',
          rowCount: items.length,
          metadata: {
            itemCount: items.length,
            receivedAt: new Date().toISOString(),
          },
        },
      });

      // Create all feedback items in a single batch
      const feedbackData = items.map((item) => ({
        content: item.content,
        author: item.author || null,
        email: item.email || null,
        channel: item.channel || 'other',
        metadata: (item.metadata || {}) as Prisma.InputJsonValue,
        sourceId: source.id,
      }));

      await prisma.feedbackItem.createMany({
        data: feedbackData,
      });

      // Fetch the created items to return their IDs
      const createdItems = await prisma.feedbackItem.findMany({
        where: { sourceId: source.id },
        select: { id: true },
        orderBy: { createdAt: 'asc' },
      });

      const ids = createdItems.map((item) => item.id);

      logger.info('Webhook feedback received', {
        sourceId: source.id,
        count: ids.length,
      });

      res.status(201).json({
        ids,
        count: ids.length,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
