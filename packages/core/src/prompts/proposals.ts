import { type Theme } from '../types/theme';

export function buildProposalPrompt(theme: Theme, sampleFeedback: string[]): string {
  return `You are a product manager generating a feature proposal based on user feedback themes.

Theme: "${theme.name}"
Description: ${theme.description}
Category: ${theme.category}
Pain Points: ${theme.painPoints.join(', ')}
Feedback Count: ${theme.feedbackCount}
Average Sentiment: ${theme.avgSentiment}
Average Urgency: ${theme.avgUrgency}

Sample feedback:
${sampleFeedback.map((f, i) => `${i + 1}. "${f}"`).join('\n')}

Generate a feature proposal. Respond with JSON only:
{
  "title": "Short actionable title (5-10 words)",
  "problem": "What problem does this solve? (2-3 sentences)",
  "solution": "What should we build? (2-3 sentences)",
  "reach": 1-10,
  "impact": 1-10,
  "confidence": 1-10,
  "effort": 1-10
}`;
}
