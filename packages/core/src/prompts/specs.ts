import { type Proposal } from '../types/proposal';
import { type AgentPromptFormat } from '../types/spec';

// ─── PRD Section Names ───────────────────────────────────

export const PRD_SECTIONS = [
  'Overview',
  'Problem Statement',
  'Goals & Success Metrics',
  'User Stories',
  'Functional Requirements',
  'Non-Functional Requirements',
  'Data Model Changes',
  'API Specifications',
  'UI/UX Considerations',
  'Open Questions',
] as const;

// ─── PRD Prompt Builders ─────────────────────────────────

export function buildPRDSystemPrompt(): string {
  return `You are a senior product manager writing a PRD (Product Requirements Document).
Write in clear, professional markdown. Use ## headings for each section.
Be specific and actionable. Include acceptance criteria for each user story.
Do NOT wrap the output in a code block — output raw markdown directly.`;
}

export function buildPRDPrompt(proposal: Proposal, evidence: string[]): string {
  return `Feature: ${proposal.title}
Problem: ${proposal.problem}
Solution: ${proposal.solution}
RICE Score: ${proposal.scores.total}

Supporting evidence from users:
${evidence.map((e, i) => `${i + 1}. "${e}"`).join('\n')}

Write a complete PRD in markdown format with exactly these 10 sections (use ## headings):
1. Overview
2. Problem Statement
3. Goals & Success Metrics
4. User Stories
5. Functional Requirements
6. Non-Functional Requirements
7. Data Model Changes
8. API Specifications
9. UI/UX Considerations
10. Open Questions

Requirements:
- Each user story must have acceptance criteria
- Data model section should include field names and types
- API section should include endpoints with HTTP methods
- Be specific — avoid vague language like "improve" or "enhance"`;
}

// ─── Section Extraction ──────────────────────────────────

/**
 * Extract a named section from a markdown document.
 * Handles variations: trailing colons, slashes, extra whitespace.
 * Returns the section body (without the heading), or empty string if not found.
 */
export function extractSection(markdown: string, sectionName: string): string {
  const lines = markdown.split('\n');
  const normalizedTarget = sectionName
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .trim();

  let capturing = false;
  const capturedLines: string[] = [];

  for (const line of lines) {
    // Check if this line is a ## heading
    const headingMatch = line.match(/^##\s+(.+)/);
    if (headingMatch) {
      if (capturing) {
        // We hit the next section — stop capturing
        break;
      }
      const headingText = headingMatch[1]
        .replace(/[^a-z0-9\s]/gi, '')
        .toLowerCase()
        .trim();
      if (headingText === normalizedTarget || headingText.startsWith(normalizedTarget)) {
        capturing = true;
        continue;
      }
    } else if (capturing) {
      capturedLines.push(line);
    }
  }

  // Trim leading/trailing blank lines
  while (capturedLines.length > 0 && capturedLines[0].trim() === '') {
    capturedLines.shift();
  }
  while (capturedLines.length > 0 && capturedLines[capturedLines.length - 1].trim() === '') {
    capturedLines.pop();
  }

  return capturedLines.join('\n');
}

// ─── Agent Prompt Builders ───────────────────────────────

function buildCursorPrompt(proposal: Proposal, prdMarkdown: string): string {
  const userStories = extractSection(prdMarkdown, 'User Stories');
  const requirements = extractSection(prdMarkdown, 'Functional Requirements');
  const dataModel = extractSection(prdMarkdown, 'Data Model Changes');
  const apiSpec = extractSection(prdMarkdown, 'API Specifications');
  const uiux = extractSection(prdMarkdown, 'UI/UX Considerations');

  let prompt = `# ${proposal.title}

## Task
Implement this feature end-to-end.

## Problem
${proposal.problem}

## Solution
${proposal.solution}
`;

  if (userStories) {
    prompt += `\n## User Stories\n${userStories}\n`;
  }

  if (requirements) {
    prompt += `\n## Requirements\n${requirements}\n`;
  }

  if (dataModel && dataModel.toLowerCase() !== 'none') {
    prompt += `\n## Data Model\n${dataModel}\n`;
  }

  if (apiSpec && apiSpec.toLowerCase() !== 'none') {
    prompt += `\n## API Changes\n${apiSpec}\n`;
  }

  if (uiux) {
    prompt += `\n## UI/UX\n${uiux}\n`;
  }

  prompt += `\n## Instructions
- Follow existing code patterns and conventions
- Write tests for all new functionality
- Ensure type safety throughout
- Handle edge cases and error states`;

  return prompt;
}

function buildClaudeCodePrompt(proposal: Proposal, prdMarkdown: string): string {
  const userStories = extractSection(prdMarkdown, 'User Stories');
  const requirements = extractSection(prdMarkdown, 'Functional Requirements');
  const nonFunctional = extractSection(prdMarkdown, 'Non-Functional Requirements');
  const dataModel = extractSection(prdMarkdown, 'Data Model Changes');
  const apiSpec = extractSection(prdMarkdown, 'API Specifications');
  const uiux = extractSection(prdMarkdown, 'UI/UX Considerations');

  let prompt = `# Feature Implementation: ${proposal.title}

I need you to implement a new feature. Here's the context and requirements.

## Background
${proposal.problem}

## What We're Building
${proposal.solution}

## Implementation Steps

Please implement this feature following these steps:

1. **Understand the requirements** — Review the user stories and acceptance criteria below
2. **Plan the data model** — Create or modify database schemas as needed
3. **Build the API layer** — Implement backend endpoints with validation
4. **Build the UI** — Create frontend components following the existing design system
5. **Write tests** — Add unit and integration tests for all new code
6. **Verify** — Run the test suite and type-checker to confirm everything works
`;

  if (userStories) {
    prompt += `\n## User Stories & Acceptance Criteria\n${userStories}\n`;
  }

  if (requirements) {
    prompt += `\n## Functional Requirements\n${requirements}\n`;
  }

  if (nonFunctional) {
    prompt += `\n## Non-Functional Requirements\n${nonFunctional}\n`;
  }

  if (dataModel && dataModel.toLowerCase() !== 'none') {
    prompt += `\n## Data Model Changes\n${dataModel}\n`;
  }

  if (apiSpec && apiSpec.toLowerCase() !== 'none') {
    prompt += `\n## API Specifications\n${apiSpec}\n`;
  }

  if (uiux) {
    prompt += `\n## UI/UX Design\nThe app uses a dark theme design system with these tokens:\n- Background: #07080A (base), #0D0F12 (surface), #141720 (surface-2)\n- Text: #E8ECF1 (primary), #9BA3B0 (secondary), #6B7280 (muted)\n- Accent: #3B82F6 (blue), #22C55E (green), #EF4444 (red)\n\n${uiux}\n`;
  }

  prompt += `\n## Guidelines
- Follow existing code patterns and conventions in this repository
- Use relative imports in the API package (not @/ aliases)
- Use React Query for server state management
- Write comprehensive tests — both unit and integration
- Ensure full TypeScript type safety
- Handle loading, error, and empty states in the UI`;

  return prompt;
}

export function buildAgentPrompt(
  proposal: Proposal,
  prdMarkdown: string,
  format: AgentPromptFormat,
): string {
  if (format === 'cursor') {
    return buildCursorPrompt(proposal, prdMarkdown);
  }
  return buildClaudeCodePrompt(proposal, prdMarkdown);
}
