# 05 — LLM Theme Extraction

## Objective

For each cluster produced by the clustering engine, use gpt-4o-mini to generate a human-readable theme name, description, category classification, pain points, and suggested urgency. Create Theme records in the database and link them to their constituent feedback items via FeedbackThemeLink.

## Dependencies

- 04-clustering-engine (provides clusters of feedback item indices)
- 01-openai-client (aiService.chatJSON())
- Phase 1: Prisma, shared types

## Files to Create

| File                                         | Purpose                         |
| -------------------------------------------- | ------------------------------- |
| `packages/api/src/services/theme.service.ts` | Theme CRUD and extraction logic |

## Files to Modify

| File                                     | Changes                                            |
| ---------------------------------------- | -------------------------------------------------- |
| `packages/core/src/prompts/synthesis.ts` | Ensure buildThemeExtractionPrompt() is implemented |

## Detailed Sub-Tasks

### 1. Implement theme extraction prompt

The prompt from `packages/core/src/prompts/synthesis.ts`:

```typescript
export function buildThemeExtractionPrompt(feedbackItems: string[]): string {
  return `You are analyzing a cluster of related customer feedback items.

These items were grouped by semantic similarity. Your job is to identify the common theme.

Feedback items in this cluster:
${feedbackItems.map((item, i) => `${i + 1}. "${item}"`).join('\n')}

Respond with JSON only:
{
  "name": "Short theme name (3-6 words)",
  "description": "What users are saying, in 1-2 sentences",
  "category": "bug" | "feature_request" | "ux_issue" | "performance" | "documentation" | "pricing" | "other",
  "painPoints": ["pain point 1", "pain point 2", ...],
  "suggestedUrgency": 0.0 to 1.0
}`;
}
```

### 2. Build theme service (`packages/api/src/services/theme.service.ts`)

**Function: `extractThemesFromClusters(clusters, feedbackItems, vectors)`**

For each cluster:

1. Get the top 10 most representative items (closest to centroid)
2. Build theme extraction prompt with their content
3. Call `aiService.chatJSON()` to get theme data
4. Parse and validate response
5. Create or update Theme record
6. Create FeedbackThemeLink records for all items in the cluster
7. Calculate aggregate scores: feedbackCount, avgSentiment, avgUrgency, opportunityScore

```typescript
interface ExtractedTheme {
  name: string;
  description: string;
  category: ThemeCategory;
  painPoints: string[];
  suggestedUrgency: number;
}

async function extractThemeForCluster(
  clusterItems: FeedbackItem[],
  representativeItems: FeedbackItem[],
): Promise<ExtractedTheme> {
  const prompt = buildThemeExtractionPrompt(representativeItems.map((item) => item.content));

  const result = await aiService.chatJSON<ExtractedTheme>(prompt);

  // Validate and sanitize
  return {
    name: (result.name || 'Unnamed Theme').slice(0, 100),
    description: (result.description || '').slice(0, 500),
    category: validateCategory(result.category),
    painPoints: Array.isArray(result.painPoints) ? result.painPoints.slice(0, 5).map(String) : [],
    suggestedUrgency: clamp(parseFloat(String(result.suggestedUrgency)) || 0, 0, 1),
  };
}
```

### 3. Calculate aggregate theme scores

```typescript
function calculateThemeScores(feedbackItems: FeedbackItem[]): {
  feedbackCount: number;
  avgSentiment: number;
  avgUrgency: number;
  opportunityScore: number;
} {
  const count = feedbackItems.length;
  const scoredItems = feedbackItems.filter((i) => i.sentiment !== null && i.urgency !== null);

  const avgSentiment =
    scoredItems.length > 0
      ? scoredItems.reduce((sum, i) => sum + (i.sentiment || 0), 0) / scoredItems.length
      : 0;

  const avgUrgency =
    scoredItems.length > 0
      ? scoredItems.reduce((sum, i) => sum + (i.urgency || 0), 0) / scoredItems.length
      : 0;

  // Opportunity score: high count + high urgency + negative sentiment = high opportunity
  const opportunityScore = count * avgUrgency * (1 - avgSentiment);

  return { feedbackCount: count, avgSentiment, avgUrgency, opportunityScore };
}
```

### 4. Handle theme creation vs update (idempotent re-runs)

On re-run synthesis:

1. Delete all existing FeedbackThemeLinks
2. Delete all existing Themes that were auto-generated (not manually created)
3. Recreate Themes from new clusters
4. Recreate FeedbackThemeLinks

This ensures re-running synthesis produces fresh, accurate themes without duplicates.

```typescript
async function clearExistingThemes(): Promise<void> {
  await prisma.$transaction([prisma.feedbackThemeLink.deleteMany(), prisma.theme.deleteMany()]);
}
```

### 5. Handle unclustered items

Items that don't belong to any cluster:

- Create a single "Uncategorized" theme with category "other"
- Link all unclustered items to this theme
- Set opportunityScore to 0 (low priority)

### 6. Create FeedbackThemeLinks with similarity scores

```typescript
async function linkFeedbackToTheme(
  themeId: string,
  feedbackIds: string[],
  vectors: number[][],
  indices: number[],
  centroidVector: number[],
): Promise<void> {
  const links = indices.map((idx, i) => ({
    feedbackItemId: feedbackIds[idx],
    themeId,
    similarityScore: cosineSimilarity(vectors[idx], centroidVector),
  }));

  await prisma.feedbackThemeLink.createMany({ data: links });
}
```

### 7. Add theme retrieval functions

**Function: `listThemes(sortBy?, sortOrder?)`**

- Fetch all themes with feedback count
- Sort by opportunityScore (default), feedbackCount, avgUrgency, name
- Return array of Theme objects

**Function: `getThemeById(id)`**

- Fetch theme with linked feedback items (via FeedbackThemeLink)
- Include similarity scores for ranking
- Return ThemeWithFeedback

**Function: `getThemeStats()`**

- Total themes count
- Themes by category breakdown
- Top 5 themes by opportunity score

## Acceptance Criteria

- [ ] Each cluster gets a human-readable theme name (3-6 words)
- [ ] Each theme has a description, category, and pain points
- [ ] Category is one of: bug, feature_request, ux_issue, performance, documentation, pricing, other
- [ ] Pain points list has 2-5 items per theme
- [ ] FeedbackThemeLink records created for all items in each cluster
- [ ] Similarity scores stored on FeedbackThemeLinks
- [ ] Aggregate scores calculated: feedbackCount, avgSentiment, avgUrgency, opportunityScore
- [ ] Opportunity score formula: count _ urgency _ (1 - sentiment)
- [ ] Unclustered items assigned to "Uncategorized" theme
- [ ] Re-running synthesis clears and recreates themes (no duplicates)
- [ ] `listThemes()` returns all themes sorted by opportunity score
- [ ] `getThemeById()` returns theme with linked feedback items
- [ ] Malformed LLM output handled gracefully (default names/categories)

## Complexity Estimate

**L (Large)** — Multiple LLM calls (one per cluster), response validation, database operations for themes and links, aggregate score calculations, and idempotent re-run logic.

## Risk Factors & Mitigations

| Risk                                  | Impact                         | Mitigation                                                                            |
| ------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------- |
| LLM generates poor theme names        | Medium — themes are confusing  | Use top 10 representative items for better context; add fallback naming               |
| Category classification is wrong      | Low — cosmetic issue           | User can manually recategorize later; default to "other" if uncertain                 |
| Many small clusters (1-2 items each)  | Medium — too many themes       | Increase similarity threshold or merge small clusters post-hoc                        |
| LLM rate limiting on many clusters    | Medium — extraction takes long | Process clusters sequentially with delay; batch if possible                           |
| Re-run deletes manually edited themes | Medium — user loses work       | In V1, all themes are auto-generated; manual editing comes later with a "pinned" flag |
