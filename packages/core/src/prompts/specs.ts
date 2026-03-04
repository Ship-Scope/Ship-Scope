import { type Proposal } from '../types/proposal';
import { type AgentPromptFormat } from '../types/spec';

export function buildPRDPrompt(proposal: Proposal, evidence: string[]): string {
  return `You are a senior product manager writing a PRD (Product Requirements Document).

Feature: ${proposal.title}
Problem: ${proposal.problem}
Solution: ${proposal.solution}
RICE Score: ${proposal.scores.total}

Supporting evidence from users:
${evidence.map((e, i) => `${i + 1}. "${e}"`).join('\n')}

Write a complete PRD in markdown format with these sections:
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

Be specific and actionable. Include acceptance criteria for each user story.`;
}

export function buildAgentPrompt(
  proposal: Proposal,
  prdMarkdown: string,
  format: AgentPromptFormat,
): string {
  const header = format === 'cursor' ? '# Cursor Agent Prompt' : '# Claude Code Agent Prompt';

  return `${header}

## Task
Implement the following feature: ${proposal.title}

## Context
${proposal.problem}

## Solution
${proposal.solution}

## Full PRD
${prdMarkdown}

## Instructions
- Follow existing code patterns and conventions
- Write tests for all new functionality
- Ensure type safety throughout
- Handle edge cases and error states
- Update relevant documentation`;
}
