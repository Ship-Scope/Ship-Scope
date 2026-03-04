import { Router, type Request, type Response, type NextFunction } from 'express';
import { parse } from 'csv-parse/sync';
import multer from 'multer';
import { prisma } from '../lib/prisma';
import { validate } from '../middleware/validate';
import { feedbackService } from '../services/feedback.service';
import {
  createFeedbackSchema,
  feedbackQuerySchema,
  bulkDeleteSchema,
} from '../schemas/feedback.schema';
import { activityService } from '../services/activity.service';

const upload = multer({ storage: multer.memoryStorage() });
const router = Router();

// POST /api/feedback - Create a single feedback item
router.post(
  '/',
  validate(createFeedbackSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const item = await feedbackService.create(req.body);
      res.status(201).json(item);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/feedback - List feedback items with filtering and pagination
router.get(
  '/',
  validate(feedbackQuerySchema, 'query'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await feedbackService.list(req.query as any);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// GET /api/feedback/stats - Get feedback statistics
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await feedbackService.getStats();
    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// GET /api/feedback/:id - Get a single feedback item by ID
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await feedbackService.findById(req.params.id);
    res.json(item);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/feedback/:id - Delete a single feedback item
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await feedbackService.delete(req.params.id);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
});

// POST /api/feedback/bulk-delete - Delete multiple feedback items
router.post(
  '/bulk-delete',
  validate(bulkDeleteSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await feedbackService.bulkDelete(req.body.ids);
      res.json(result);
    } catch (err) {
      next(err);
    }
  },
);

// POST /api/feedback/mark-processed - Mark feedback items as processed
router.post('/mark-processed', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { ids } = req.body;
    const result = await feedbackService.markAsProcessed(ids);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ============================================
// IMPORT ROUTES (to be updated by Task 02)
// ============================================

// POST /api/feedback/import/csv - Import from CSV file
router.post('/import/csv', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const csvContent = req.file.buffer.toString('utf-8');
    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (records.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty' });
    }

    // Auto-detect the content column
    const firstRow = records[0];
    const contentColumn =
      Object.keys(firstRow).find((key) =>
        ['content', 'feedback', 'text', 'message', 'comment', 'body', 'description'].includes(
          key.toLowerCase(),
        ),
      ) || Object.keys(firstRow)[0];

    const source = await prisma.feedbackSource.create({
      data: {
        name: `CSV Import - ${req.file.originalname}`,
        type: 'csv',
        filename: req.file.originalname,
        metadata: { columns: Object.keys(firstRow) },
      },
    });

    const items = records
      .filter((row: Record<string, string>) => row[contentColumn]?.trim())
      .map((row: Record<string, string>) => ({
        content: row[contentColumn].trim(),
        author: row['author'] || row['name'] || row['user'] || undefined,
        email: row['email'] || row['author_email'] || undefined,
        channel: row['channel'] || row['source'] || row['type'] || 'csv',
        sourceId: source.id,
        metadata: row,
      }));

    const created = await prisma.feedbackItem.createMany({ data: items });

    // Update source row count
    await prisma.feedbackSource.update({
      where: { id: source.id },
      data: { rowCount: created.count },
    });

    await activityService.log({
      type: 'import',
      description: `Imported ${created.count} feedback items from ${req.file.originalname}`,
      metadata: { count: created.count, format: 'csv', filename: req.file.originalname },
    });

    res.status(201).json({
      count: created.count,
      source: source.id,
      contentColumn,
      message: `Imported ${created.count} feedback items from ${req.file.originalname}`,
    });
  } catch (err) {
    console.error('CSV import error:', err);
    res.status(500).json({ error: 'Failed to import CSV' });
  }
});

export default router;
