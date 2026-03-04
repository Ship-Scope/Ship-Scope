import { Queue } from 'bullmq';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const url = new URL(REDIS_URL);

const connectionOpts = {
  host: url.hostname,
  port: parseInt(url.port || '6379'),
  password: url.password || undefined,
  db: url.pathname ? parseInt(url.pathname.slice(1)) || 0 : 0,
};

const defaultOpts = {
  connection: connectionOpts,
  defaultJobOptions: {
    removeOnComplete: { age: 3600, count: 100 },
    removeOnFail: { age: 86400, count: 500 },
    attempts: 3,
    backoff: { type: 'exponential' as const, delay: 2000 },
  },
};

export const embeddingQueue = new Queue('embedding', defaultOpts);
export const synthesisQueue = new Queue('synthesis', defaultOpts);
export const importQueue = new Queue('import', defaultOpts);
