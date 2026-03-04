import { describe, it, expect } from 'vitest';
import {
  buildPRDPrompt,
  buildPRDSystemPrompt,
  buildAgentPrompt,
  extractSection,
  PRD_SECTIONS,
} from '@shipscope/core/prompts/specs';
import { type Proposal } from '@shipscope/core/types/proposal';

const mockProposal: Proposal = {
  id: 'prop-1',
  title: 'Dashboard Redesign',
  problem: 'Users find the current dashboard confusing and hard to navigate.',
  solution: 'Redesign the dashboard with clearer layout, better navigation, and stat cards.',
  status: 'approved',
  scores: { reach: 8, impact: 7, confidence: 6, effort: 4, total: 84 },
  themeId: 'theme-1',
  evidenceCount: 5,
  createdAt: '2024-01-01T00:00:00Z',
  updatedAt: '2024-01-02T00:00:00Z',
};

const mockPRD = `# Dashboard Redesign PRD

## Overview
This PRD describes the dashboard redesign feature.

## Problem Statement
Users find the current dashboard confusing.

## Goals & Success Metrics
- Improve user satisfaction by 20%
- Reduce time to first action by 30%

## User Stories
- As a user, I want a cleaner dashboard so I can find things faster.

## Functional Requirements
- Display stat cards at the top
- Activity feed below the fold

## Non-Functional Requirements
- Page load under 2 seconds
- Accessible to screen readers

## Data Model Changes
No schema changes required.

## API Specifications
GET /api/dashboard/stats — returns stat cards data

## UI/UX Considerations
Use the existing dark theme design system with card-based layout.

## Open Questions
- Should we include charts in v1?
`;

describe('buildPRDSystemPrompt', () => {
  it('returns a non-empty system prompt', () => {
    const prompt = buildPRDSystemPrompt();
    expect(prompt).toBeTruthy();
    expect(prompt).toContain('PRD');
  });
});

describe('buildPRDPrompt', () => {
  it('includes proposal title, problem, and solution', () => {
    const prompt = buildPRDPrompt(mockProposal, ['user feedback 1']);
    expect(prompt).toContain('Dashboard Redesign');
    expect(prompt).toContain('confusing and hard to navigate');
    expect(prompt).toContain('clearer layout');
  });

  it('includes evidence', () => {
    const prompt = buildPRDPrompt(mockProposal, ['feedback A', 'feedback B']);
    expect(prompt).toContain('feedback A');
    expect(prompt).toContain('feedback B');
  });

  it('includes RICE score', () => {
    const prompt = buildPRDPrompt(mockProposal, []);
    expect(prompt).toContain('84');
  });

  it('lists all 10 sections', () => {
    const prompt = buildPRDPrompt(mockProposal, []);
    for (const section of PRD_SECTIONS) {
      expect(prompt).toContain(section);
    }
  });
});

describe('extractSection', () => {
  it('extracts a named section', () => {
    const content = extractSection(mockPRD, 'Problem Statement');
    expect(content).toContain('confusing');
  });

  it('extracts section with special characters (UI/UX)', () => {
    const content = extractSection(mockPRD, 'UI/UX Considerations');
    expect(content).toContain('dark theme');
  });

  it('extracts section with ampersand (Goals & Success Metrics)', () => {
    const content = extractSection(mockPRD, 'Goals & Success Metrics');
    expect(content).toContain('satisfaction');
  });

  it('returns empty string for non-existent section', () => {
    const content = extractSection(mockPRD, 'Nonexistent Section');
    expect(content).toBe('');
  });

  it('captures until the next ## heading', () => {
    const content = extractSection(mockPRD, 'Functional Requirements');
    expect(content).toContain('stat cards');
    expect(content).not.toContain('Page load under 2 seconds');
  });

  it('handles section at end of document', () => {
    const content = extractSection(mockPRD, 'Open Questions');
    expect(content).toContain('charts');
  });

  it('trims leading and trailing blank lines', () => {
    const content = extractSection(mockPRD, 'Overview');
    expect(content).not.toMatch(/^\n/);
    expect(content).not.toMatch(/\n$/);
  });
});

describe('buildAgentPrompt', () => {
  describe('cursor format', () => {
    it('includes proposal title as main heading', () => {
      const prompt = buildAgentPrompt(mockProposal, mockPRD, 'cursor');
      expect(prompt).toContain('# Dashboard Redesign');
    });

    it('includes task, problem, and solution sections', () => {
      const prompt = buildAgentPrompt(mockProposal, mockPRD, 'cursor');
      expect(prompt).toContain('## Task');
      expect(prompt).toContain('## Problem');
      expect(prompt).toContain('## Solution');
    });

    it('extracts user stories from PRD', () => {
      const prompt = buildAgentPrompt(mockProposal, mockPRD, 'cursor');
      expect(prompt).toContain('cleaner dashboard');
    });

    it('includes instructions section', () => {
      const prompt = buildAgentPrompt(mockProposal, mockPRD, 'cursor');
      expect(prompt).toContain('## Instructions');
      expect(prompt).toContain('Follow existing code patterns');
    });

    it('omits data model section when content is "None"', () => {
      const prdWithNone = mockPRD.replace('No schema changes required.', 'None');
      const prompt = buildAgentPrompt(mockProposal, prdWithNone, 'cursor');
      expect(prompt).not.toContain('## Data Model');
    });
  });

  describe('claude_code format', () => {
    it('includes feature implementation heading', () => {
      const prompt = buildAgentPrompt(mockProposal, mockPRD, 'claude_code');
      expect(prompt).toContain('# Feature Implementation: Dashboard Redesign');
    });

    it('includes numbered implementation steps', () => {
      const prompt = buildAgentPrompt(mockProposal, mockPRD, 'claude_code');
      expect(prompt).toContain('1.');
      expect(prompt).toContain('2.');
      expect(prompt).toContain('## Implementation Steps');
    });

    it('includes design system tokens', () => {
      const prompt = buildAgentPrompt(mockProposal, mockPRD, 'claude_code');
      expect(prompt).toContain('#07080A');
      expect(prompt).toContain('#3B82F6');
    });

    it('includes non-functional requirements', () => {
      const prompt = buildAgentPrompt(mockProposal, mockPRD, 'claude_code');
      expect(prompt).toContain('Page load under 2 seconds');
    });

    it('includes guidelines section', () => {
      const prompt = buildAgentPrompt(mockProposal, mockPRD, 'claude_code');
      expect(prompt).toContain('## Guidelines');
      expect(prompt).toContain('relative imports');
    });
  });
});
