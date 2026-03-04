import { Router } from 'express';
import { prisma } from '../lib/prisma';
import { redis } from '../lib/redis';

const router = Router();

router.get('/', async (_req, res) => {
  const checks: Record<string, { status: string; latencyMs?: number }> = {};

  const dbStart = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.db = { status: 'connected', latencyMs: Date.now() - dbStart };
  } catch {
    checks.db = { status: 'disconnected', latencyMs: Date.now() - dbStart };
  }

  const redisStart = Date.now();
  try {
    await redis.ping();
    checks.redis = { status: 'connected', latencyMs: Date.now() - redisStart };
  } catch {
    checks.redis = { status: 'disconnected', latencyMs: Date.now() - redisStart };
  }

  const allHealthy = Object.values(checks).every((c) => c.status === 'connected');

  res.status(allHealthy ? 200 : 503).json({
    status: allHealthy ? 'ok' : 'degraded',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks,
  });
});

export default router;
