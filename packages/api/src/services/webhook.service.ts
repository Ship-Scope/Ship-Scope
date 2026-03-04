import crypto from 'crypto';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';

function hashKey(key: string): string {
  return crypto.createHash('sha256').update(key).digest('hex');
}

export const webhookService = {
  /**
   * Generate a new API key. The full key is returned only once
   * and is never stored — only the SHA-256 hash is persisted.
   */
  async generateApiKey(name?: string) {
    const rawSecret = crypto.randomBytes(32).toString('hex');
    const fullKey = `sk_live_${rawSecret}`;
    const keyHashValue = hashKey(fullKey);
    const keyPrefix = fullKey.slice(0, 12);

    const apiKey = await prisma.apiKey.create({
      data: {
        name: name || 'Default',
        keyHash: keyHashValue,
        keyPrefix,
      },
    });

    logger.info('API key generated', { id: apiKey.id, keyPrefix });

    return {
      key: fullKey,
      id: apiKey.id,
      name: apiKey.name,
      keyPrefix,
    };
  },

  /**
   * Validate an incoming API key using constant-time comparison.
   * Updates lastUsedAt on success.
   */
  async validateApiKey(key: string): Promise<boolean> {
    if (!key || !key.startsWith('sk_live_')) {
      return false;
    }

    const keyHashValue = hashKey(key);

    const apiKey = await prisma.apiKey.findUnique({
      where: { keyHash: keyHashValue },
    });

    if (!apiKey) {
      return false;
    }

    // Constant-time comparison to prevent timing attacks
    const storedHashBuffer = Buffer.from(apiKey.keyHash, 'hex');
    const incomingHashBuffer = Buffer.from(keyHashValue, 'hex');

    if (storedHashBuffer.length !== incomingHashBuffer.length) {
      return false;
    }

    const isMatch = crypto.timingSafeEqual(storedHashBuffer, incomingHashBuffer);

    if (!isMatch) {
      return false;
    }

    if (!apiKey.isActive) {
      logger.warn('Inactive API key used', { id: apiKey.id, keyPrefix: apiKey.keyPrefix });
      return false;
    }

    // Update last used timestamp asynchronously (fire-and-forget)
    prisma.apiKey
      .update({
        where: { id: apiKey.id },
        data: { lastUsedAt: new Date() },
      })
      .catch((err) => {
        logger.error('Failed to update lastUsedAt', { error: String(err) });
      });

    return true;
  },

  /**
   * Revoke an API key by setting isActive to false.
   */
  async revokeApiKey(id: string) {
    const apiKey = await prisma.apiKey.findUnique({ where: { id } });
    if (!apiKey) {
      return null;
    }

    await prisma.apiKey.update({
      where: { id },
      data: { isActive: false },
    });

    logger.info('API key revoked', { id, keyPrefix: apiKey.keyPrefix });
    return true;
  },

  /**
   * List all API keys with safe fields only (never expose keyHash).
   */
  async listApiKeys() {
    const keys = await prisma.apiKey.findMany({
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        lastUsedAt: true,
        createdAt: true,
        isActive: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return keys;
  },
};
