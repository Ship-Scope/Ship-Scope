import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler } from './middleware/errorHandler';
import { prisma } from './lib/prisma';
import { redis } from './lib/redis';
import { logger } from './lib/logger';
import healthRoutes from './routes/health';
import feedbackRoutes from './routes/feedback';
import synthesisRoutes from './routes/synthesis';
import proposalRoutes from './routes/proposals';
import specRoutes from './routes/specs';
import webhookRoutes from './routes/webhook';
import settingsRoutes from './routes/settings';

export function createApp() {
  const app = express();

  // Middleware (correct ordering)
  app.use(requestLogger);
  app.use(helmet());
  app.use(cors({ origin: process.env.APP_URL || 'http://localhost:3000' }));
  app.use(express.json({ limit: '50mb' }));

  // Routes
  app.use('/api/health', healthRoutes);
  app.use('/api/feedback', feedbackRoutes);
  app.use('/api/synthesis', synthesisRoutes);
  app.use('/api/proposals', proposalRoutes);
  app.use('/api/specs', specRoutes);
  app.use('/api/feedback/webhook', webhookRoutes);
  app.use('/api/settings', settingsRoutes);

  // Error handler (must be last)
  app.use(errorHandler);

  return app;
}

// Only listen when run directly
if (process.env.NODE_ENV !== 'test') {
  const PORT = process.env.PORT || 4000;
  const app = createApp();
  app.listen(PORT, () => {
    logger.info(`ShipScope API v0.1.0 running on http://localhost:${PORT}`);
  });

  // Graceful shutdown
  const shutdown = async () => {
    logger.info('Shutting down gracefully...');
    await prisma.$disconnect();
    redis.disconnect();
    process.exit(0);
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}
