import { Router, type Request, type Response } from 'express';
import { triggerSynthesis, getStatus } from '../services/synthesis.service';
import { getThemes, getThemeById } from '../services/theme.service';
import { getTokenStats } from '../services/ai.service';
import { validate } from '../middleware/validate';
import { themesQuerySchema } from '../schemas/synthesis.schema';

const router = Router();

// POST /api/synthesis/run — Trigger the synthesis pipeline
router.post('/run', async (_req: Request, res: Response) => {
  try {
    const result = await triggerSynthesis();
    res.status(202).json({ data: result });
  } catch (error) {
    if (
      error instanceof Error &&
      'statusCode' in error &&
      (error as { statusCode: number }).statusCode === 409
    ) {
      res
        .status(409)
        .json({ error: 'Synthesis already in progress', code: 'SYNTHESIS_IN_PROGRESS' });
      return;
    }
    throw error;
  }
});

// GET /api/synthesis/status — Get current synthesis pipeline status
router.get('/status', async (_req: Request, res: Response) => {
  const status = await getStatus();
  res.json({ data: status });
});

// GET /api/synthesis/themes — List themes with pagination
router.get('/themes', validate(themesQuerySchema, 'query'), async (req: Request, res: Response) => {
  const query = req.query as unknown as {
    page: number;
    pageSize: number;
    category?: string;
    sortBy: 'opportunityScore' | 'feedbackCount' | 'avgSentiment' | 'avgUrgency' | 'createdAt';
    sortOrder: 'asc' | 'desc';
  };
  const result = await getThemes(query);
  res.json(result);
});

// GET /api/synthesis/themes/:id — Get a single theme with feedback
router.get('/themes/:id', async (req: Request, res: Response) => {
  const theme = await getThemeById(req.params.id);
  if (!theme) {
    res.status(404).json({ error: 'Theme not found', code: 'NOT_FOUND' });
    return;
  }
  res.json({ data: theme });
});

// GET /api/synthesis/cost — Get token usage/cost stats
router.get('/cost', async (_req: Request, res: Response) => {
  const stats = getTokenStats();
  res.json({ data: stats });
});

export default router;
