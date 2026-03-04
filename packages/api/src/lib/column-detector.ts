export interface ColumnDetectionResult {
  contentColumn: string;
  confidence: 'high' | 'medium' | 'low';
  suggestedMappings: {
    content: string;
    author?: string;
    email?: string;
    channel?: string;
    date?: string;
  };
}

const CONTENT_NAMES = [
  'content',
  'feedback',
  'text',
  'message',
  'comment',
  'body',
  'description',
  'review',
  'note',
  'response',
];

const AUTHOR_NAMES = ['author', 'name', 'user', 'username', 'from', 'submitted_by'];

const EMAIL_NAMES = ['email', 'mail'];

const CHANNEL_NAMES = ['channel', 'source', 'type', 'category', 'platform'];

const DATE_NAMES = ['date', 'time', 'created', 'timestamp', 'submitted'];

function normalize(header: string): string {
  return header
    .toLowerCase()
    .replace(/[\s_-]+/g, '_')
    .trim();
}

function matchHeader(headers: string[], knownNames: string[]): string | undefined {
  for (const header of headers) {
    const norm = normalize(header);
    if (knownNames.includes(norm)) {
      return header;
    }
    // Partial match: header contains one of the known names
    for (const name of knownNames) {
      if (norm.includes(name)) {
        return header;
      }
    }
  }
  return undefined;
}

function detectEmailByValues(
  headers: string[],
  sampleRows: Record<string, string>[],
): string | undefined {
  for (const header of headers) {
    const values = sampleRows
      .map((r) => r[header])
      .filter((v) => v !== undefined && v !== null && v !== '');
    if (values.length === 0) continue;
    const emailCount = values.filter((v) => v.includes('@')).length;
    if (emailCount / values.length >= 0.5) {
      return header;
    }
  }
  return undefined;
}

function isIdColumn(header: string): boolean {
  const norm = normalize(header);
  return (
    norm === 'id' ||
    norm === '_id' ||
    norm.endsWith('_id') ||
    (norm.endsWith('id') && norm.length <= 4)
  );
}

export function detectColumns(
  headers: string[],
  sampleRows: Record<string, string>[],
): ColumnDetectionResult {
  // --- Content column detection ---
  let contentColumn: string | undefined;
  let confidence: 'high' | 'medium' | 'low' = 'low';

  // Tier 1: Name matching (high confidence)
  contentColumn = matchHeader(headers, CONTENT_NAMES);
  if (contentColumn) {
    confidence = 'high';
  }

  // Tier 2: Longest average text (medium confidence)
  if (!contentColumn && sampleRows.length > 0) {
    let longestAvg = 0;
    let longestHeader: string | undefined;

    for (const header of headers) {
      if (isIdColumn(header)) continue;
      const values = sampleRows.map((r) => r[header] ?? '').filter((v) => v.length > 0);
      if (values.length === 0) continue;
      const avg = values.reduce((sum, v) => sum + v.length, 0) / values.length;
      if (avg > longestAvg) {
        longestAvg = avg;
        longestHeader = header;
      }
    }

    if (longestHeader && longestAvg > 10) {
      contentColumn = longestHeader;
      confidence = 'medium';
    }
  }

  // Tier 3: First non-ID column (low confidence)
  if (!contentColumn) {
    contentColumn = headers.find((h) => !isIdColumn(h)) ?? headers[0];
    confidence = 'low';
  }

  // --- Other column detection ---
  const remainingHeaders = headers.filter((h) => h !== contentColumn);

  const authorColumn = matchHeader(remainingHeaders, AUTHOR_NAMES);
  const emailColumn =
    matchHeader(remainingHeaders, EMAIL_NAMES) ?? detectEmailByValues(remainingHeaders, sampleRows);
  const channelColumn = matchHeader(remainingHeaders, CHANNEL_NAMES);
  const dateColumn = matchHeader(remainingHeaders, DATE_NAMES);

  const suggestedMappings: ColumnDetectionResult['suggestedMappings'] = {
    content: contentColumn,
  };

  if (authorColumn) suggestedMappings.author = authorColumn;
  if (emailColumn) suggestedMappings.email = emailColumn;
  if (channelColumn) suggestedMappings.channel = channelColumn;
  if (dateColumn) suggestedMappings.date = dateColumn;

  return {
    contentColumn,
    confidence,
    suggestedMappings,
  };
}
