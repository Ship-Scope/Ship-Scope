import { describe, it, expect } from 'vitest';
import { detectColumns } from '../../src/lib/column-detector';

describe('detectColumns', () => {
  describe('name matching (Tier 1)', () => {
    it('should detect column named "content" with high confidence', () => {
      const result = detectColumns(['id', 'content', 'author'], []);
      expect(result.contentColumn).toBe('content');
      expect(result.confidence).toBe('high');
    });

    it('should detect column named "feedback" with high confidence', () => {
      const result = detectColumns(['id', 'feedback', 'date'], []);
      expect(result.contentColumn).toBe('feedback');
      expect(result.confidence).toBe('high');
    });

    it('should detect column named "text" with high confidence', () => {
      const result = detectColumns(['id', 'text', 'author'], []);
      expect(result.contentColumn).toBe('text');
      expect(result.confidence).toBe('high');
    });

    it('should detect column named "message" with high confidence', () => {
      const result = detectColumns(['message', 'author'], []);
      expect(result.contentColumn).toBe('message');
      expect(result.confidence).toBe('high');
    });

    it('should detect "user_feedback_text" via partial match', () => {
      const result = detectColumns(['id', 'user_feedback_text', 'author'], []);
      expect(result.contentColumn).toBe('user_feedback_text');
      expect(result.confidence).toBe('high');
    });

    it('should be case-insensitive', () => {
      const result = detectColumns(['ID', 'CONTENT', 'AUTHOR'], []);
      expect(result.contentColumn).toBe('CONTENT');
      expect(result.confidence).toBe('high');
    });
  });

  describe('length heuristic (Tier 2)', () => {
    it('should pick column with longest average text when no name match', () => {
      const headers = ['id', 'short_col', 'long_col'];
      const rows = [
        { id: '1', short_col: 'hi', long_col: 'This is a much longer text value for testing' },
        { id: '2', short_col: 'ok', long_col: 'Another long text value that should be detected' },
      ];
      const result = detectColumns(headers, rows);
      expect(result.contentColumn).toBe('long_col');
      expect(result.confidence).toBe('medium');
    });

    it('should return medium confidence for length-based detection', () => {
      const headers = ['col_a', 'col_b'];
      const rows = [
        { col_a: 'x', col_b: 'This is definitely the longer column value' },
        { col_a: 'y', col_b: 'And this one is also quite long for heuristic detection' },
      ];
      const result = detectColumns(headers, rows);
      expect(result.confidence).toBe('medium');
    });
  });

  describe('auto-mapping other columns', () => {
    it('should detect "author" column', () => {
      const result = detectColumns(['content', 'author', 'date'], []);
      expect(result.suggestedMappings.author).toBe('author');
    });

    it('should detect "email" column', () => {
      const result = detectColumns(['content', 'email', 'author'], []);
      expect(result.suggestedMappings.email).toBe('email');
    });

    it('should detect email column by @ symbol in values', () => {
      const headers = ['content', 'contact_info'];
      const rows = [
        { content: 'Feedback text here', contact_info: 'alice@example.com' },
        { content: 'More feedback text', contact_info: 'bob@example.com' },
      ];
      const result = detectColumns(headers, rows);
      expect(result.suggestedMappings.email).toBe('contact_info');
    });

    it('should detect "channel" column', () => {
      const result = detectColumns(['content', 'channel', 'date'], []);
      expect(result.suggestedMappings.channel).toBe('channel');
    });

    it('should detect "source" as channel column', () => {
      const result = detectColumns(['content', 'source', 'date'], []);
      expect(result.suggestedMappings.channel).toBe('source');
    });

    it('should detect "date" column', () => {
      const result = detectColumns(['content', 'author', 'date'], []);
      expect(result.suggestedMappings.date).toBe('date');
    });

    it('should detect "created_at" as date column', () => {
      const result = detectColumns(['content', 'author', 'created_at'], []);
      expect(result.suggestedMappings.date).toBe('created_at');
    });

    it('should detect "timestamp" as date column', () => {
      const result = detectColumns(['content', 'timestamp'], []);
      expect(result.suggestedMappings.date).toBe('timestamp');
    });
  });

  describe('edge cases', () => {
    it('should handle single-column CSV', () => {
      const result = detectColumns(['feedback'], [{ feedback: 'Some feedback text' }]);
      expect(result.contentColumn).toBe('feedback');
    });

    it('should handle CSV with only ID and content columns', () => {
      const result = detectColumns(['id', 'content'], []);
      expect(result.contentColumn).toBe('content');
    });

    it('should handle columns with all empty values', () => {
      const headers = ['id', 'col_a', 'col_b'];
      const rows = [
        { id: '1', col_a: '', col_b: '' },
        { id: '2', col_a: '', col_b: '' },
      ];
      const result = detectColumns(headers, rows);
      // Should still return something (first non-ID column as low confidence)
      expect(result.contentColumn).toBeDefined();
      expect(result.confidence).toBe('low');
    });

    it('should not select ID column as content', () => {
      const headers = ['id', 'data'];
      const rows = [{ id: '12345678901234567890', data: 'short' }];
      const result = detectColumns(headers, rows);
      expect(result.contentColumn).not.toBe('id');
    });
  });
});
