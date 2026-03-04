import { Router, type Request, type Response } from 'express';
import {
  generateSpec,
  listSpecs,
  getSpecById,
  getSpecByProposalId,
  getAgentPrompt,
} from '../services/spec.service';
import { validate } from '../middleware/validate';
import { agentPromptQuerySchema } from '../schemas/spec.schema';
import { AppError } from '../lib/errors';

const router = Router();

// POST /api/specs/generate/:proposalId — Generate spec from approved proposal
router.post('/generate/:proposalId', async (req: Request, res: Response) => {
  try {
    const result = await generateSpec(req.params.proposalId);
    res.status(result.isRegeneration ? 200 : 201).json({ data: result });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    throw err;
  }
});

// GET /api/specs — List all specs
router.get('/', async (_req: Request, res: Response) => {
  const specs = await listSpecs();
  res.json({ data: specs });
});

// GET /api/specs/by-proposal/:proposalId — Get spec by proposal ID
// Must be registered before /:id to avoid matching "by-proposal" as an id
router.get('/by-proposal/:proposalId', async (req: Request, res: Response) => {
  const spec = await getSpecByProposalId(req.params.proposalId);
  if (!spec) {
    res.status(404).json({ error: 'Spec not found', code: 'NOT_FOUND' });
    return;
  }
  res.json({ data: spec });
});

// GET /api/specs/:id — Get a single spec
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const spec = await getSpecById(req.params.id);
    res.json({ data: spec });
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 404) {
      res.status(404).json({ error: 'Spec not found', code: 'NOT_FOUND' });
      return;
    }
    throw err;
  }
});

// GET /api/specs/:id/agent-prompt — Get agent-ready prompt in specified format
router.get(
  '/:id/agent-prompt',
  validate(agentPromptQuerySchema, 'query'),
  async (req: Request, res: Response) => {
    try {
      const { format } = req.query as unknown as { format: 'cursor' | 'claude_code' };
      const prompt = await getAgentPrompt(req.params.id, format);
      res.json({ data: prompt });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: err.message, code: err.code });
        return;
      }
      throw err;
    }
  },
);

export default router;
