import { describe, it, expect } from 'vitest';
import { trelloConfigSchema, trelloImportSchema } from '../../src/schemas/trello.schema';

describe('Trello Schemas', () => {
  describe('trelloConfigSchema', () => {
    it('accepts valid full config', () => {
      const result = trelloConfigSchema.safeParse({
        trello_api_key: 'abc123key',
        trello_token: 'abc123token',
        trello_board_id: 'board123',
        trello_list_id: 'list456',
      });
      expect(result.success).toBe(true);
    });

    it('accepts partial config (all fields optional)', () => {
      const result = trelloConfigSchema.safeParse({
        trello_api_key: 'abc123key',
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty object', () => {
      const result = trelloConfigSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('rejects empty API key', () => {
      const result = trelloConfigSchema.safeParse({
        trello_api_key: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty token', () => {
      const result = trelloConfigSchema.safeParse({
        trello_token: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty board ID', () => {
      const result = trelloConfigSchema.safeParse({
        trello_board_id: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty list ID', () => {
      const result = trelloConfigSchema.safeParse({
        trello_list_id: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('trelloImportSchema', () => {
    it('accepts valid import params', () => {
      const result = trelloImportSchema.safeParse({
        listId: 'list123',
        maxResults: 50,
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty object', () => {
      const result = trelloImportSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('rejects maxResults over 100', () => {
      const result = trelloImportSchema.safeParse({
        maxResults: 101,
      });
      expect(result.success).toBe(false);
    });

    it('rejects maxResults of 0', () => {
      const result = trelloImportSchema.safeParse({
        maxResults: 0,
      });
      expect(result.success).toBe(false);
    });

    it('rejects non-integer maxResults', () => {
      const result = trelloImportSchema.safeParse({
        maxResults: 10.5,
      });
      expect(result.success).toBe(false);
    });
  });
});
