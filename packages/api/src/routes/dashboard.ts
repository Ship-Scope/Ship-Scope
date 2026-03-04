import { Router, type Request, type Response, type NextFunction } from 'express';
import { dashboardService } from '../services/dashboard.service';
import { activityService } from '../services/activity.service';

const router = Router();

// GET /api/dashboard/stats
router.get('/stats', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await dashboardService.getStats();
    res.json({ data: stats });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/activity
router.get('/activity', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 10, 50);
    const activity = await activityService.getRecent(limit);
    res.json({ data: activity });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/top-themes
router.get('/top-themes', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 5, 20);
    const themes = await dashboardService.getTopThemes(limit);
    res.json({ data: themes });
  } catch (err) {
    next(err);
  }
});

// GET /api/dashboard/sentiment
router.get('/sentiment', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const sentiment = await dashboardService.getSentimentDistribution();
    res.json({ data: sentiment });
  } catch (err) {
    next(err);
  }
});

export default router;
