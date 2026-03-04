import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

const router = Router();

router.get('/', async (_req, res) => {
  const [dbOk, redisOk] = await Promise.allSettled([prisma.$queryRaw`SELECT 1`, redis.ping()]);

  res.json({
    status: dbOk.status === 'fulfilled' && redisOk.status === 'fulfilled' ? 'ok' : 'degraded',
    db: dbOk.status === 'fulfilled' ? 'connected' : 'disconnected',
    redis: redisOk.status === 'fulfilled' ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

export default router;
