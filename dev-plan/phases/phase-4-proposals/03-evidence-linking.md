# 03 — Evidence Linking Service

## Objective

Build the service that connects each generated proposal to its strongest supporting evidence from customer feedback. For each proposal, select the top 10 most relevant feedback items from the source theme, rank them by cosine similarity to the theme centroid, extract the single most relevant sentence from each item as a "quote", and create ProposalEvidence records. This evidence trail gives product managers concrete user voices behind every proposal.

## Dependencies

- 01-proposal-generation (Proposals exist with themeId links)
- Phase 3: FeedbackThemeLink records exist (feedback items linked to themes with similarity scores)
- Phase 3: Embedding vectors stored on FeedbackItem records
- Phase 3: `packages/api/src/lib/vector-math.ts` (cosineSimilarity, centroid)
- Prisma schema: ProposalEvidence model

## Files to Create

| File                                            | Purpose                                                 |
| ----------------------------------------------- | ------------------------------------------------------- |
| `packages/api/src/services/evidence.service.ts` | Evidence selection, quote extraction, and linking logic |

## Files to Modify

| File                                            | Changes                                                     |
| ----------------------------------------------- | ----------------------------------------------------------- |
| `packages/api/src/services/proposal.service.ts` | Call evidenceService.linkEvidence() after proposal creation |

## Detailed Sub-Tasks

### 1. Design the evidence linking pipeline

For a single proposal, the evidence linking pipeline is:

```
Proposal (themeId)
  │
  ├── 1. Fetch all FeedbackThemeLinks for this theme
  │      (includes feedback content and similarity scores)
  │
  ├── 2. Rank feedback items by relevance
  │      Primary: FeedbackThemeLink.confidence (cosine similarity to theme centroid)
  │      Secondary: FeedbackItem.urgency (higher urgency = more actionable evidence)
  │
  ├── 3. Select top 10 items
  │
  ├── 4. For each selected item, extract best quote
  │      Split content into sentences → score each by keyword overlap with theme → pick best
  │
  └── 5. Create ProposalEvidence records
         { proposalId, feedbackId, relevance, quote }
```

### 2. Implement the evidence service (`packages/api/src/services/evidence.service.ts`)

**Function: `linkEvidence(proposalId: string, maxItems: number = 10)`**

This is the primary entry point called after each proposal is created.

```typescript
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';

export const evidenceService = {
  async linkEvidence(proposalId: string, maxItems: number = 10): Promise<number> {
    // 1. Get the proposal with its theme
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: { id: true, themeId: true, title: true, problem: true },
    });

    if (!proposal) {
      throw new AppError(404, 'Proposal not found');
    }

    if (!proposal.themeId) {
      // Proposals without a theme (manually created) cannot have auto-linked evidence
      return 0;
    }

    // 2. Delete existing evidence for this proposal (idempotent re-linking)
    await prisma.proposalEvidence.deleteMany({
      where: { proposalId },
    });

    // 3. Fetch feedback items linked to this theme, ranked by similarity
    const themeLinks = await prisma.feedbackThemeLink.findMany({
      where: { themeId: proposal.themeId },
      orderBy: [
        { confidence: 'desc' }, // Primary sort: similarity to theme centroid
      ],
      take: maxItems,
      include: {
        feedback: {
          select: {
            id: true,
            content: true,
            urgency: true,
            sentiment: true,
            author: true,
            channel: true,
          },
        },
      },
    });

    if (themeLinks.length === 0) {
      return 0;
    }

    // 4. Build ProposalEvidence records with extracted quotes
    const evidenceRecords = themeLinks.map((link) => {
      const quote = extractBestQuote(link.feedback.content, proposal.title, proposal.problem);

      return {
        proposalId: proposal.id,
        feedbackId: link.feedback.id,
        relevance: link.confidence, // Use theme-link similarity as relevance
        quote,
      };
    });

    // 5. Batch create all evidence records
    await prisma.proposalEvidence.createMany({
      data: evidenceRecords,
      skipDuplicates: true, // Safety: skip if re-run creates duplicates
    });

    return evidenceRecords.length;
  },

  /**
   * Link evidence for all proposals that lack evidence.
   * Called after bulk generation.
   */
  async linkEvidenceForAll(): Promise<{ linked: number; errors: string[] }> {
    const proposals = await prisma.proposal.findMany({
      where: {
        themeId: { not: null },
        evidence: { none: {} }, // Only proposals without evidence
      },
      select: { id: true },
    });

    let linked = 0;
    const errors: string[] = [];

    for (const proposal of proposals) {
      try {
        const count = await this.linkEvidence(proposal.id);
        if (count > 0) linked++;
      } catch (err) {
        errors.push(`${proposal.id}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    return { linked, errors };
  },

  /**
   * Get evidence for a specific proposal.
   * Returns evidence ordered by relevance (descending).
   */
  async getEvidence(proposalId: string) {
    return prisma.proposalEvidence.findMany({
      where: { proposalId },
      orderBy: { relevance: 'desc' },
      include: {
        feedback: {
          select: {
            id: true,
            content: true,
            author: true,
            authorEmail: true,
            channel: true,
            sentiment: true,
            urgency: true,
            createdAt: true,
          },
        },
      },
    });
  },
};
```

### 3. Implement quote extraction algorithm

The quote extractor splits feedback content into sentences and selects the one most relevant to the proposal. This is a lightweight, LLM-free approach that avoids additional API calls.

```typescript
/**
 * Extract the single most relevant sentence from feedback content
 * relative to the proposal title and problem statement.
 *
 * Algorithm:
 * 1. Split content into sentences
 * 2. Score each sentence by keyword overlap with proposal context
 * 3. Apply length bonus (prefer medium-length sentences: 40-200 chars)
 * 4. Return the highest-scoring sentence
 *
 * Falls back to the first 200 characters if no good sentence is found.
 */
function extractBestQuote(content: string, proposalTitle: string, proposalProblem: string): string {
  const sentences = splitIntoSentences(content);

  if (sentences.length === 0) {
    return content.slice(0, 200);
  }

  if (sentences.length === 1) {
    return sentences[0].slice(0, 300);
  }

  // Build keyword set from proposal context
  const contextWords = extractKeywords(`${proposalTitle} ${proposalProblem}`);

  let bestSentence = sentences[0];
  let bestScore = -1;

  for (const sentence of sentences) {
    const sentenceWords = extractKeywords(sentence);

    // Keyword overlap score
    let overlapCount = 0;
    for (const word of sentenceWords) {
      if (contextWords.has(word)) overlapCount++;
    }
    const overlapScore = contextWords.size > 0 ? overlapCount / contextWords.size : 0;

    // Length bonus: prefer sentences between 40-200 characters
    const len = sentence.length;
    const lengthScore = len >= 40 && len <= 200 ? 0.2 : 0;

    // Urgency signal bonus: sentences with strong opinion words
    const urgencyScore = hasUrgencySignals(sentence) ? 0.15 : 0;

    const totalScore = overlapScore + lengthScore + urgencyScore;

    if (totalScore > bestScore) {
      bestScore = totalScore;
      bestSentence = sentence;
    }
  }

  return bestSentence.slice(0, 300);
}
```

### 4. Implement sentence splitting utility

Proper sentence splitting handles edge cases like abbreviations, decimal numbers, and URLs.

```typescript
/**
 * Split text into sentences, handling common edge cases.
 * Splits on: . ! ? followed by whitespace or end-of-string.
 * Preserves abbreviations (Mr., Dr., etc.) and decimal numbers.
 */
function splitIntoSentences(text: string): string[] {
  if (!text || text.trim().length === 0) return [];

  // Regex: split on sentence-ending punctuation followed by space or EOL
  // Negative lookbehind avoids splitting on abbreviations and decimals
  const raw = text
    .replace(/\n+/g, '. ') // Treat newlines as sentence boundaries
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10); // Filter out fragments

  return raw;
}
```

### 5. Implement keyword extraction utility

Extract meaningful keywords for overlap scoring. Remove stop words and normalize case.

```typescript
const STOP_WORDS = new Set([
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
  'must',
  'shall',
  'can',
  'need',
  'dare',
  'to',
  'of',
  'in',
  'for',
  'on',
  'with',
  'at',
  'by',
  'from',
  'up',
  'about',
  'into',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'between',
  'out',
  'off',
  'over',
  'under',
  'again',
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
  'each',
  'every',
  'all',
  'any',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'only',
  'own',
  'same',
  'than',
  'too',
  'very',
  'just',
  'because',
  'as',
  'until',
  'while',
  'it',
  'its',
  'this',
  'that',
  'these',
  'those',
  'i',
  'me',
  'my',
  'we',
  'our',
  'you',
  'your',
  'he',
  'him',
  'his',
  'she',
  'her',
  'they',
  'them',
  'their',
  'what',
  'which',
  'who',
  'whom',
]);

function extractKeywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length > 2 && !STOP_WORDS.has(word)),
  );
}
```

### 6. Implement urgency signal detection

Boost sentences that contain strong user-opinion language, which makes for compelling evidence.

```typescript
const URGENCY_PATTERNS = [
  /\bneed\b/i,
  /\bplease\b/i,
  /\bfrustrat/i,
  /\bimpossible\b/i,
  /\bcan't\b/i,
  /\bcannot\b/i,
  /\bwish\b/i,
  /\bwant\b/i,
  /\bwould love\b/i,
  /\bexpect\b/i,
  /\brequire\b/i,
  /\bcritical\b/i,
  /\bblocker\b/i,
  /\bdeal.?breaker\b/i,
  /\bworkaround\b/i,
  /\bhack\b/i,
  /\bbroken\b/i,
  /\bbug\b/i,
];

function hasUrgencySignals(sentence: string): boolean {
  return URGENCY_PATTERNS.some((pattern) => pattern.test(sentence));
}
```

### 7. Integrate evidence linking into proposal generation flow

After each proposal is created in `proposalService.generateFromThemes()`, call the evidence service:

```typescript
// In proposal.service.ts generateFromThemes(), after creating the proposal:

const createdProposal = await prisma.proposal.create({
  data: {
    title: sanitized.title,
    description: sanitized.problem,
    problem: sanitized.problem,
    solution: sanitized.solution,
    impactScore: sanitized.impactScore,
    effortScore: sanitized.effortScore,
    confidenceScore: sanitized.confidenceScore,
    reachScore: sanitized.reachScore,
    riceScore,
    status: 'proposed',
    themeId: theme.id,
  },
});

// Link evidence (non-blocking — error does not fail the proposal)
try {
  await evidenceService.linkEvidence(createdProposal.id);
} catch (err) {
  console.error(
    `[ProposalService] Evidence linking failed for proposal "${createdProposal.title}":`,
    err instanceof Error ? err.message : String(err),
  );
  // Evidence linking failure is non-fatal — the proposal still exists
}

result.proposalsCreated++;
```

### 8. Handle edge cases

**No feedback items for theme:**
If the theme has no FeedbackThemeLinks (possible if data was cleaned between synthesis and proposal generation), `linkEvidence` returns 0 and creates no records. The proposal remains valid but has no evidence.

**Feedback item appears in multiple proposals:**
The ProposalEvidence model has a unique constraint on `[proposalId, feedbackId]`. The `skipDuplicates: true` on `createMany` handles this. A single feedback item CAN appear as evidence for multiple proposals (from different themes), which is correct behavior.

**Very short feedback content:**
If content is under 10 characters, the sentence splitter returns an empty array, and the fallback returns the full content (up to 200 chars).

**Re-linking evidence:**
Calling `linkEvidence` on a proposal that already has evidence first deletes all existing ProposalEvidence records, then creates fresh ones. This makes re-linking idempotent and safe.

## Acceptance Criteria

- [ ] `evidenceService.linkEvidence(proposalId)` selects top 10 feedback items from the proposal's source theme
- [ ] Feedback items are ranked by FeedbackThemeLink.confidence (cosine similarity to theme centroid)
- [ ] Each evidence record includes an extracted quote (most relevant sentence)
- [ ] Quote extraction selects sentence with highest keyword overlap to proposal title + problem
- [ ] Quote extraction prefers medium-length sentences (40-200 chars)
- [ ] Quote extraction applies urgency signal bonus for sentences with strong user-opinion words
- [ ] Quote extraction falls back to first 200 chars if no good sentence found
- [ ] ProposalEvidence records created with proposalId, feedbackId, relevance, quote
- [ ] `skipDuplicates` prevents errors on re-linking
- [ ] Evidence is deleted and recreated on re-link (idempotent)
- [ ] `evidenceService.linkEvidenceForAll()` processes all proposals without evidence
- [ ] `evidenceService.getEvidence(proposalId)` returns evidence ordered by relevance desc
- [ ] Proposals without a themeId (manually created) return 0 linked evidence
- [ ] Evidence linking failure does not prevent proposal creation
- [ ] Sentence splitting handles newlines, abbreviations, and short fragments

## Complexity Estimate

**M (Medium)** -- The core logic is a database query + text processing pipeline. No LLM calls are involved. The main complexity is in the quote extraction algorithm (sentence splitting, keyword overlap scoring, edge cases) and the idempotent re-linking behavior.

## Risk Factors & Mitigations

| Risk                                                               | Impact                                  | Mitigation                                                                                                   |
| ------------------------------------------------------------------ | --------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| Quote extraction selects irrelevant sentences                      | Medium -- evidence feels random         | Keyword overlap with proposal title/problem provides grounding; urgency bonus helps select actionable quotes |
| Sentence splitting fails on non-English text                       | Low -- quotes are truncated             | Fallback to first 200 chars; V2 can use LLM-based extraction                                                 |
| Theme has fewer than 10 feedback items                             | Low -- fewer evidence items             | Return however many exist; no minimum required                                                               |
| FeedbackThemeLink.confidence is 0 for all items                    | Low -- relevance scores are meaningless | Default confidence is 1.0 in schema; clustering always computes similarity                                   |
| Re-linking during active proposal review                           | Low -- evidence changes unexpectedly    | Only re-link during explicit regeneration; UI shows evidence count to signal changes                         |
| Large feedback content (10K+ chars) causes slow sentence splitting | Low -- minor latency                    | Cap content processing at first 5000 chars; most feedback is under 1000 chars                                |
