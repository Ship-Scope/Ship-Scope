import { describe, it, expect } from 'vitest';
import { linearConfigSchema, linearImportSchema } from '../../src/schemas/linear.schema';

describe('Linear Schemas', () => {
  describe('linearConfigSchema', () => {
    it('accepts valid full config', () => {
      const result = linearConfigSchema.safeParse({
        linear_api_key: 'lin_api_abc123',
        linear_team_id: 'team-001',
        linear_project_id: 'project-001',
        linear_done_states: 'Done,Cancelled',
        linear_default_label_id: 'label-001',
        linear_cycle_id: 'cycle-001',
      });
      expect(result.success).toBe(true);
    });

    it('accepts partial config (all fields optional)', () => {
      const result = linearConfigSchema.safeParse({
        linear_api_key: 'lin_api_abc123',
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty object', () => {
      const result = linearConfigSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('rejects empty API key', () => {
      const result = linearConfigSchema.safeParse({
        linear_api_key: '',
      });
      expect(result.success).toBe(false);
    });

    it('rejects empty team ID', () => {
      const result = linearConfigSchema.safeParse({
        linear_team_id: '',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('linearImportSchema', () => {
    it('accepts valid import options', () => {
      const result = linearImportSchema.safeParse({
        projectId: 'project-001',
        stateType: 'started',
        maxResults: 50,
      });
      expect(result.success).toBe(true);
    });

    it('accepts empty object', () => {
      const result = linearImportSchema.safeParse({});
      expect(result.success).toBe(true);
    });

    it('rejects invalid stateType', () => {
      const result = linearImportSchema.safeParse({
        stateType: 'invalid_state',
      });
      expect(result.success).toBe(false);
    });

    it('rejects maxResults > 100', () => {
      const result = linearImportSchema.safeParse({
        maxResults: 200,
      });
      expect(result.success).toBe(false);
    });

    it('rejects maxResults < 1', () => {
      const result = linearImportSchema.safeParse({
        maxResults: 0,
      });
      expect(result.success).toBe(false);
    });
  });
});
