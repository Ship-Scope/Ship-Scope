import { describe, it, expect } from 'vitest';
import { webhookService } from '../../src/services/webhook.service';

describe('WebhookService', () => {
  describe('generateApiKey', () => {
    it('should return a key starting with "sk_live_"', async () => {
      const result = await webhookService.generateApiKey('Test Key');
      expect(result.key).toMatch(/^sk_live_/);
    });

    it('should store keyPrefix as first 12 characters', async () => {
      const result = await webhookService.generateApiKey();
      expect(result.keyPrefix).toBe(result.key.slice(0, 12));
      expect(result.keyPrefix).toMatch(/^sk_live_/);
      expect(result.key.startsWith(result.keyPrefix)).toBe(true);
    });

    it('should never return the same key twice', async () => {
      const result1 = await webhookService.generateApiKey();
      const result2 = await webhookService.generateApiKey();
      expect(result1.key).not.toBe(result2.key);
    });

    it('should use "Default" as name when not provided', async () => {
      const result = await webhookService.generateApiKey();
      expect(result.name).toBe('Default');
    });

    it('should use custom name when provided', async () => {
      const result = await webhookService.generateApiKey('My Custom Key');
      expect(result.name).toBe('My Custom Key');
    });
  });

  describe('validateApiKey', () => {
    it('should return true for a valid active key', async () => {
      const { key } = await webhookService.generateApiKey();
      const isValid = await webhookService.validateApiKey(key);
      expect(isValid).toBe(true);
    });

    it('should return false for an invalid key', async () => {
      const isValid = await webhookService.validateApiKey('sk_live_invalid_key_here');
      expect(isValid).toBe(false);
    });

    it('should return false for a key not starting with sk_live_', async () => {
      const isValid = await webhookService.validateApiKey('not_a_valid_prefix');
      expect(isValid).toBe(false);
    });

    it('should return false for an empty key', async () => {
      const isValid = await webhookService.validateApiKey('');
      expect(isValid).toBe(false);
    });

    it('should return false for a revoked key', async () => {
      const { key, id } = await webhookService.generateApiKey();
      await webhookService.revokeApiKey(id);
      const isValid = await webhookService.validateApiKey(key);
      expect(isValid).toBe(false);
    });
  });

  describe('revokeApiKey', () => {
    it('should return true on successful revocation', async () => {
      const { id } = await webhookService.generateApiKey();
      const result = await webhookService.revokeApiKey(id);
      expect(result).toBe(true);
    });

    it('should return null for non-existent key', async () => {
      const result = await webhookService.revokeApiKey('non-existent-id');
      expect(result).toBeNull();
    });

    it('should prevent future validation after revocation', async () => {
      const { key, id } = await webhookService.generateApiKey();
      await webhookService.revokeApiKey(id);
      const isValid = await webhookService.validateApiKey(key);
      expect(isValid).toBe(false);
    });
  });

  describe('listApiKeys', () => {
    it('should return keys with safe fields only', async () => {
      await webhookService.generateApiKey('Key 1');
      await webhookService.generateApiKey('Key 2');

      const keys = await webhookService.listApiKeys();
      expect(keys).toHaveLength(2);

      for (const key of keys) {
        expect(key).toHaveProperty('id');
        expect(key).toHaveProperty('name');
        expect(key).toHaveProperty('keyPrefix');
        expect(key).toHaveProperty('isActive');
        expect(key).not.toHaveProperty('keyHash');
      }
    });

    it('should return empty array when no keys exist', async () => {
      const keys = await webhookService.listApiKeys();
      expect(keys).toHaveLength(0);
    });
  });
});
