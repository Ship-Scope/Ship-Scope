import { parse } from 'csv-parse';

export interface ParseCSVOptions {
  maxRows?: number;
  skipEmpty?: boolean;
}

export interface ParseCSVResult {
  headers: string[];
  rows: Record<string, string>[];
  totalRows: number;
  errors: { row: number; message: string }[];
}

export async function parseCSV(buffer: Buffer, options?: ParseCSVOptions): Promise<ParseCSVResult> {
  const { maxRows, skipEmpty = true } = options ?? {};

  return new Promise((resolve, reject) => {
    const rows: Record<string, string>[] = [];
    const errors: { row: number; message: string }[] = [];
    let headers: string[] = [];
    let rowIndex = 0;

    const parser = parse(buffer, {
      columns: true,
      skip_empty_lines: skipEmpty,
      relax_column_count: true,
      trim: true,
      bom: true,
      cast: false,
      max_record_size: 1_000_000,
    });

    parser.on('readable', () => {
      let record: Record<string, string> | null;
      while ((record = parser.read()) !== null) {
        rowIndex++;

        // Capture headers from the first record's keys
        if (headers.length === 0) {
          headers = Object.keys(record);
        }

        // Skip if we have already collected maxRows
        if (maxRows && rows.length >= maxRows) {
          continue;
        }

        // Skip rows where every value is empty
        const allEmpty = Object.values(record).every(
          (v) => v === undefined || v === null || String(v).trim() === '',
        );
        if (skipEmpty && allEmpty) {
          continue;
        }

        rows.push(record);
      }
    });

    parser.on('error', (err) => {
      // Non-fatal parse errors get recorded; fatal ones reject
      if (rowIndex > 0) {
        errors.push({ row: rowIndex + 1, message: err.message });
      } else {
        reject(err);
      }
    });

    parser.on('end', () => {
      resolve({
        headers,
        rows,
        totalRows: rowIndex,
        errors,
      });
    });
  });
}
