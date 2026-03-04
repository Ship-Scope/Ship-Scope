import { redis } from './redis';

interface CacheOptions {
  ttlSeconds: number;
  prefix?: string;
}

const DEFAULT_PREFIX = 'shipscope:cache';

export async function cacheable<T>(
  key: string,
  loader: () => Promise<T>,
  options: CacheOptions,
): Promise<T> {
  const fullKey = `${options.prefix || DEFAULT_PREFIX}:${key}`;

  try {
    const cached = await redis.get(fullKey);
    if (cached) {
      return JSON.parse(cached) as T;
    }
  } catch {
    // Cache read failure — fall through to loader
  }

  const data = await loader();

  redis.set(fullKey, JSON.stringify(data), 'EX', options.ttlSeconds).catch(() => {
    // Non-blocking cache write failure
  });

  return data;
}

export async function invalidateCache(key: string, prefix?: string): Promise<void> {
  const fullKey = `${prefix || DEFAULT_PREFIX}:${key}`;
  await redis.del(fullKey);
}

export async function invalidateCachePattern(pattern: string, prefix?: string): Promise<void> {
  const fullPattern = `${prefix || DEFAULT_PREFIX}:${pattern}`;
  let cursor = '0';
  do {
    const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', fullPattern, 'COUNT', 100);
    cursor = nextCursor;
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  } while (cursor !== '0');
}
