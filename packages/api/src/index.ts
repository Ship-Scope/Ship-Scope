import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import { createCorsMiddleware } from './middleware/cors';
import { requestLogger } from './middleware/requestLogger';
import { compressionMiddleware } from './middleware/compression';
import { sanitizeMiddleware } from './middleware/sanitize';
import { httpsRedirect } from './middleware/https-redirect';
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
import dashboardRoutes from './routes/dashboard';

export function createApp() {
  const app = express();

  // Trust proxy for HTTPS redirect behind reverse proxy
  app.set('trust proxy', 1);

  // Middleware (correct ordering)
  app.use(httpsRedirect);
  app.use(requestLogger);
  app.use(compressionMiddleware);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", 'data:', 'blob:'],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          connectSrc: ["'self'", process.env.CORS_ORIGIN || 'http://localhost:3000'],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
        },
      },
      frameguard: { action: 'deny' },
      referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
      hsts:
        process.env.NODE_ENV === 'production'
          ? { maxAge: 31536000, includeSubDomains: true, preload: true }
          : false,
    }),
  );
  app.use(createCorsMiddleware());
  app.use(express.json({ limit: '10mb' }));
  app.use(sanitizeMiddleware);

  // Routes
  app.use('/api/health', healthRoutes);
  app.use('/api/feedback', feedbackRoutes);
  app.use('/api/synthesis', synthesisRoutes);
  app.use('/api/proposals', proposalRoutes);
  app.use('/api/specs', specRoutes);
  app.use('/api/feedback/webhook', webhookRoutes);
  app.use('/api/settings', settingsRoutes);
  app.use('/api/dashboard', dashboardRoutes);

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
