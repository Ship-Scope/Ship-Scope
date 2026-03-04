import { Router } from 'express';

const router = Router();

// POST /api/proposals/generate - Generate feature proposals from themes
router.post('/generate', async (_req, res) => {
  // TODO: Implement proposal generation
  // 1. Take top themes from synthesis
  // 2. Use LLM to generate feature proposals
  // 3. Link evidence (feedback items) to each proposal
  // 4. Calculate RICE scores
  res.json({ message: 'Proposal generation - coming in v0.1' });
});

// GET /api/proposals - List all proposals
router.get('/', async (_req, res) => {
  res.json({ proposals: [], message: 'Coming in v0.1' });
});

// PATCH /api/proposals/:id/status - Update proposal status
router.patch('/:id/status', async (_req, res) => {
  res.json({ message: 'Coming in v0.1' });
});

export default router;
