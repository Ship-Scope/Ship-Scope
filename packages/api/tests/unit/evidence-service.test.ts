import { describe, it, expect } from 'vitest';
import {
  extractBestQuote,
  splitSentences,
  extractKeywords,
} from '../../src/services/evidence.service';

describe('splitSentences', () => {
  it('splits text on period followed by space', () => {
    const result = splitSentences('First sentence here. Second sentence here.');
    expect(result).toEqual(['First sentence here.', 'Second sentence here.']);
  });

  it('splits on exclamation and question marks', () => {
    const result = splitSentences('What is this? It is great! Indeed it is.');
    expect(result).toEqual(['What is this?', 'It is great!', 'Indeed it is.']);
  });

  it('filters out very short fragments', () => {
    const result = splitSentences('Okay. This is a longer sentence here.');
    // 'Okay.' is only 5 chars, should be filtered
    expect(result).toEqual(['This is a longer sentence here.']);
  });

  it('returns empty array for empty string', () => {
    expect(splitSentences('')).toEqual([]);
  });

  it('handles single sentence without terminal punctuation', () => {
    const result = splitSentences('This is a sentence without a period');
    expect(result).toEqual(['This is a sentence without a period']);
  });
});

describe('extractKeywords', () => {
  it('removes common stop words', () => {
    const result = extractKeywords('the quick brown fox jumps over the lazy dog');
    expect(result).toContain('quick');
    expect(result).toContain('brown');
    expect(result).toContain('fox');
    expect(result).toContain('jumps');
    expect(result).toContain('over');
    expect(result).toContain('lazy');
    expect(result).toContain('dog');
    expect(result).not.toContain('the');
  });

  it('converts to lowercase', () => {
    const result = extractKeywords('Dashboard Loading Performance');
    expect(result).toContain('dashboard');
    expect(result).toContain('loading');
    expect(result).toContain('performance');
  });

  it('filters short words (<=2 chars)', () => {
    const result = extractKeywords('a is to go run it');
    // 'go' and 'it' are 2 chars, should be excluded
    // 'run' is 3 chars but 'a', 'is', 'to' are stop words
    expect(result).toEqual(['run']);
  });

  it('strips punctuation', () => {
    const result = extractKeywords("user's dashboard! loading... performance?");
    expect(result).toContain('users');
    expect(result).toContain('dashboard');
    expect(result).toContain('loading');
    expect(result).toContain('performance');
  });

  it('returns empty array for all stop words', () => {
    const result = extractKeywords('the a an is are');
    expect(result).toEqual([]);
  });
});

describe('extractBestQuote', () => {
  it('returns the sentence with most keyword overlap', () => {
    const content =
      'The weather is nice today. The dashboard loading is very slow and frustrating. I like cats.';
    const keywords = ['dashboard', 'loading', 'slow'];
    const quote = extractBestQuote(content, keywords);
    expect(quote).toContain('dashboard');
    expect(quote).toContain('slow');
  });

  it('prefers sentences with urgency signals', () => {
    const content =
      'The feature is okay I guess. The export feature is critical and completely broken right now.';
    const keywords = ['export', 'feature'];
    const quote = extractBestQuote(content, keywords);
    expect(quote).toContain('critical');
  });

  it('returns full content (sliced) when only one sentence', () => {
    const content = 'This single sentence has dashboard keyword';
    const quote = extractBestQuote(content, ['dashboard']);
    expect(quote).toBe(content);
  });

  it('returns truncated content for very short input', () => {
    const content = 'Hi';
    const quote = extractBestQuote(content, ['test']);
    expect(quote).toBe('Hi');
  });

  it('truncates quotes to 300 characters', () => {
    const longSentence = 'A'.repeat(400) + '. Short.';
    const quote = extractBestQuote(longSentence, []);
    expect(quote.length).toBeLessThanOrEqual(300);
  });
});
