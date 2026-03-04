import { Router } from 'express';

const router = Router();

// POST /api/synthesis/run - Trigger AI synthesis on unprocessed feedback
router.post('/run', async (_req, res) => {
  // TODO: Implement AI synthesis pipeline
  // 1. Fetch unprocessed feedback items
  // 2. Generate embeddings via OpenAI/Anthropic
  // 3. Cluster similar feedback using HDBSCAN or LLM-based clustering
  // 4. Extract themes and pain points
  // 5. Score each theme (volume × sentiment × urgency)
  // 6. Mark feedback as processed
  res.json({ message: 'Synthesis pipeline - coming in v0.1' });
});

// GET /api/synthesis/themes - Get all extracted themes
router.get('/themes', async (_req, res) => {
  res.json({ themes: [], message: 'Coming in v0.1' });
});

export default router;
