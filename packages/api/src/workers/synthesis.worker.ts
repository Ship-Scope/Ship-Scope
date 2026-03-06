import { Worker, type Job } from 'bullmq';
import { runSynthesisPipeline } from '../services/synthesis.service';
import { logger } from '../lib/logger';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const url = new URL(REDIS_URL);

const connection = {
  host: url.hostname,
  port: parseInt(url.port || '6379'),
  password: url.password || undefined,
  db: url.pathname ? parseInt(url.pathname.slice(1)) || 0 : 0,
};

const synthesisWorker = new Worker(
  'synthesis',
  async (job: Job) => {
    logger.info('Synthesis worker started', { jobId: job.id });
    await runSynthesisPipeline(job.id!);
    logger.info('Synthesis worker completed', { jobId: job.id });
  },
  {
    connection,
    concurrency: 1, // Only one synthesis at a time
    removeOnComplete: { age: 3600, count: 10 },
    removeOnFail: { age: 86400, count: 50 },
  },
);

synthesisWorker.on('failed', (job, err) => {
  logger.error('Synthesis worker failed', {
    jobId: job?.id,
    error: err.message,
  });
});

export { synthesisWorker };
