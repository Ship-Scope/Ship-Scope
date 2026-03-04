import { Router, type Request, type Response } from 'express';
import {
  generateFromThemes,
  listProposals,
  getProposalById,
  updateProposal,
  deleteProposal,
} from '../services/proposal.service';
import { linkEvidence } from '../services/evidence.service';
import { validate } from '../middleware/validate';
import {
  generateProposalsSchema,
  proposalQuerySchema,
  updateProposalSchema,
} from '../schemas/proposal.schema';
import { AppError } from '../lib/errors';
import { activityService } from '../services/activity.service';

const router = Router();

// POST /api/proposals/generate — Generate proposals from top themes
router.post(
  '/generate',
  validate(generateProposalsSchema, 'body'),
  async (req: Request, res: Response) => {
    const { topN } = req.body;
    const result = await generateFromThemes(topN);

    // Link evidence for newly created proposals
    const proposals = await listProposals({ status: 'proposed', pageSize: 100 });
    for (const proposal of proposals.data) {
      try {
        await linkEvidence(proposal.id);
      } catch {
        // Non-fatal: evidence linking failure shouldn't fail the response
      }
    }

    await activityService.log({
      type: 'proposal_generation',
      description: `Generated ${result.proposalsCreated} proposals (${result.proposalsSkipped} skipped)`,
      metadata: {
        created: result.proposalsCreated,
        skipped: result.proposalsSkipped,
        errors: result.errors.length,
      },
    });

    res.status(201).json({ data: result });
  },
);

// GET /api/proposals — List proposals with filters and pagination
router.get('/', validate(proposalQuerySchema, 'query'), async (req: Request, res: Response) => {
  const query = req.query as unknown as {
    page: number;
    pageSize: number;
    status?: string;
    themeId?: string;
    sortBy: string;
    sortOrder: 'asc' | 'desc';
    search?: string;
  };
  const result = await listProposals(query);
  res.json(result);
});

// GET /api/proposals/:id — Get proposal with evidence
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const proposal = await getProposalById(req.params.id);
    res.json({ data: proposal });
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 404) {
      res.status(404).json({ error: 'Proposal not found', code: 'NOT_FOUND' });
      return;
    }
    throw err;
  }
});

// PATCH /api/proposals/:id — Update proposal (title, scores, status)
router.patch(
  '/:id',
  validate(updateProposalSchema, 'body'),
  async (req: Request, res: Response) => {
    try {
      const proposal = await updateProposal(req.params.id, req.body);
      res.json({ data: proposal });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: err.message, code: err.code });
        return;
      }
      throw err;
    }
  },
);

// DELETE /api/proposals/:id — Delete proposal and evidence
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await deleteProposal(req.params.id);
    res.json({ data: { deleted: true } });
  } catch (err) {
    if (err instanceof AppError && err.statusCode === 404) {
      res.status(404).json({ error: 'Proposal not found', code: 'NOT_FOUND' });
      return;
    }
    throw err;
  }
});

export default router;
