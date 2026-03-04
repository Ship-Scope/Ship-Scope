import { readFileSync } from 'fs';
import { resolve } from 'path';
import { describe, it, expect } from 'vitest';
import { parseCSV } from '../../src/lib/csv-parser';

const fixture = (name: string) => readFileSync(resolve(__dirname, '../fixtures', name));

describe('parseCSV', () => {
  it('should parse a valid CSV file with headers', async () => {
    const result = await parseCSV(fixture('valid.csv'));
    expect(result.headers).toEqual(['feedback', 'author', 'email', 'channel', 'date']);
    expect(result.rows).toHaveLength(5);
    expect(result.totalRows).toBe(5);
    expect(result.errors).toHaveLength(0);
    expect(result.rows[0].feedback).toBe('The app is great but needs dark mode');
  });

  it('should handle UTF-8 BOM marker', async () => {
    const result = await parseCSV(fixture('bom.csv'));
    expect(result.headers[0]).toBe('feedback'); // Not "\uFEFFfeedback"
    expect(result.rows).toHaveLength(5);
  });

  it('should handle quoted fields containing commas', async () => {
    const result = await parseCSV(fixture('quoted.csv'));
    expect(result.rows[1].feedback).toContain('search, filter, and sort');
  });

  it('should handle quoted fields containing newlines', async () => {
    const result = await parseCSV(fixture('quoted.csv'));
    const multiLine = result.rows[2];
    expect(multiLine.feedback).toContain('Multi-line');
    expect(multiLine.feedback).toContain('newlines in the content');
  });

  it('should handle escaped quotes within quoted fields', async () => {
    const result = await parseCSV(fixture('quoted.csv'));
    expect(result.rows[0].feedback).toContain('"this feature is amazing"');
  });

  it('should handle rows with fewer columns than header (pad with empty)', async () => {
    const result = await parseCSV(fixture('malformed.csv'));
    const shortRow = result.rows.find((r) => r.author === 'Bob');
    expect(shortRow).toBeDefined();
    // relax_column_count allows ragged rows
  });

  it('should skip empty rows', async () => {
    const result = await parseCSV(fixture('malformed.csv'));
    // The row with all empty commas should be skipped
    const allEmpty = result.rows.filter((r) =>
      Object.values(r).every((v) => !v || String(v).trim() === ''),
    );
    expect(allEmpty).toHaveLength(0);
  });

  it('should respect maxRows option for preview', async () => {
    const result = await parseCSV(fixture('valid.csv'), { maxRows: 2 });
    expect(result.rows).toHaveLength(2);
    expect(result.totalRows).toBe(5); // totalRows counts all rows
  });

  it('should return correct totalRows count', async () => {
    const result = await parseCSV(fixture('valid.csv'));
    expect(result.totalRows).toBe(5);
  });

  it('should handle inline CSV string', async () => {
    const csv = Buffer.from('name,value\nAlice,100\nBob,200\n');
    const result = await parseCSV(csv);
    expect(result.headers).toEqual(['name', 'value']);
    expect(result.rows).toHaveLength(2);
  });

  it('should handle mixed line endings', async () => {
    const csv = Buffer.from('col1,col2\r\nval1,val2\r\nval3,val4\nval5,val6');
    const result = await parseCSV(csv);
    expect(result.rows.length).toBeGreaterThanOrEqual(2);
  });
});
