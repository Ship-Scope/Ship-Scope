import { createHmac, timingSafeEqual, randomBytes } from 'crypto';

const HASH_SECRET = process.env.API_KEY_HASH_SECRET || 'dev-secret';

export function hashApiKey(rawKey: string): string {
  return createHmac('sha256', HASH_SECRET).update(rawKey).digest('hex');
}

export function verifyApiKey(rawKey: string, storedHash: string): boolean {
  const candidateHash = hashApiKey(rawKey);
  const a = Buffer.from(candidateHash, 'hex');
  const b = Buffer.from(storedHash, 'hex');

  if (a.length !== b.length) {
    return false;
  }

  return timingSafeEqual(a, b);
}

export function generateApiKey(): string {
  const random = randomBytes(32).toString('hex');
  return `sk_live_${random}`;
}
