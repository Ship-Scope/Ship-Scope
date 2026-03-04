export function buildScoringPrompt(items: { id: string; content: string }[]): string {
  return `You are analyzing customer feedback for a product team.

For each feedback item below, provide:
- sentiment: float from -1.0 (very negative) to 1.0 (very positive). 0.0 is neutral.
- urgency: float from 0.0 (not urgent, suggestion) to 1.0 (critical, blocking user).

Respond ONLY with a JSON object containing a "scores" array. No explanation. No markdown.

Feedback items:
${items.map((item, i) => `[${i}] (id: ${item.id}) ${item.content}`).join('\n')}

Response format:
{
  "scores": [
    { "index": 0, "sentiment": -0.7, "urgency": 0.8 },
    ...
  ]
}`;
}

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
  "painPoints": ["pain point 1", "pain point 2"],
  "suggestedUrgency": 0.0
}`;
}
