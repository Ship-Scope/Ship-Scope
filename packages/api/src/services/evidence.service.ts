import { prisma } from '../lib/prisma';
import { NotFound } from '../lib/errors';

/**
 * Link the top N most relevant feedback items to a proposal as evidence.
 * Ranks by FeedbackThemeLink similarity score, extracts best quote from each.
 */
export async function linkEvidence(proposalId: string, maxItems = 10): Promise<number> {
  const proposal = await prisma.proposal.findUnique({
    where: { id: proposalId },
    select: { id: true, themeId: true, title: true, problem: true },
  });

  if (!proposal) throw NotFound('Proposal');
  if (!proposal.themeId) return 0;

  // Delete existing evidence (idempotent re-linking)
  await prisma.proposalEvidence.deleteMany({ where: { proposalId } });

  // Fetch feedback linked to this theme, ranked by similarity
  const themeLinks = await prisma.feedbackThemeLink.findMany({
    where: { themeId: proposal.themeId },
    orderBy: { similarityScore: 'desc' },
    take: maxItems,
    include: {
      feedbackItem: {
        select: { id: true, content: true, urgency: true },
      },
    },
  });

  if (themeLinks.length === 0) return 0;

  // Extract keywords from proposal for quote scoring
  const keywords = extractKeywords(`${proposal.title} ${proposal.problem}`);

  // Create evidence records with best quote
  const evidenceData = themeLinks.map((link) => ({
    proposalId,
    feedbackItemId: link.feedbackItem.id,
    relevanceScore: link.similarityScore,
    quote: extractBestQuote(link.feedbackItem.content, keywords),
  }));

  await prisma.proposalEvidence.createMany({ data: evidenceData });
  return evidenceData.length;
}

/**
 * Extract the most relevant sentence from content based on keyword overlap.
 */
function extractBestQuote(content: string, keywords: string[]): string {
  const sentences = splitSentences(content);
  if (sentences.length === 0) return content.slice(0, 200);
  if (sentences.length === 1) return sentences[0];

  let bestSentence = sentences[0];
  let bestScore = -1;

  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    let score = 0;

    // Keyword overlap
    for (const keyword of keywords) {
      if (lowerSentence.includes(keyword)) score += 2;
    }

    // Prefer longer sentences (more context) but not too long
    const len = sentence.length;
    if (len >= 20 && len <= 200) score += 1;

    // Urgency signal detection
    const urgencyPatterns = [
      /\bcritical\b/i,
      /\burgent\b/i,
      /\bblocking\b/i,
      /\bbroken\b/i,
      /\bcrash/i,
      /\bneed\b/i,
      /\bmust\b/i,
      /\bcan'?t\b/i,
      /\bimpossible\b/i,
    ];
    for (const pattern of urgencyPatterns) {
      if (pattern.test(sentence)) score += 1;
    }

    if (score > bestScore) {
      bestScore = score;
      bestSentence = sentence;
    }
  }

  return bestSentence.slice(0, 300);
}

/**
 * Split text into sentences, handling common edge cases.
 */
function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 5);
}

/**
 * Extract meaningful keywords from text (removes stop words).
 */
function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    'the',
    'a',
    'an',
    'is',
    'are',
    'was',
    'were',
    'be',
    'been',
    'being',
    'have',
    'has',
    'had',
    'do',
    'does',
    'did',
    'will',
    'would',
    'could',
    'should',
    'may',
    'might',
    'can',
    'shall',
    'to',
    'of',
    'in',
    'for',
    'on',
    'with',
    'at',
    'by',
    'from',
    'as',
    'into',
    'through',
    'and',
    'but',
    'or',
    'nor',
    'not',
    'so',
    'yet',
    'both',
    'either',
    'neither',
    'this',
    'that',
    'these',
    'those',
    'it',
    'its',
    'we',
    'our',
    'they',
    'their',
    'them',
    'i',
    'me',
    'my',
    'you',
    'your',
    'he',
    'she',
    'his',
    'her',
    'what',
    'which',
    'who',
    'when',
    'where',
    'how',
    'all',
    'each',
    'every',
    'no',
    'some',
    'any',
    'most',
    'more',
    'other',
    'than',
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !stopWords.has(w));
}

export { extractBestQuote, splitSentences, extractKeywords };
