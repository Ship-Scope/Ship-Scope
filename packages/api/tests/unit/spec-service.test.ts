import { describe, it, expect } from 'vitest';
import { validatePRD } from '../../src/services/spec.service';

const fullPRD = `# Feature PRD

## Overview
Overview content here.

## Problem Statement
Problem content here.

## Goals & Success Metrics
Goals content here.

## User Stories
User stories content here.

## Functional Requirements
Requirements content here.

## Non-Functional Requirements
Non-functional content here.

## Data Model Changes
Data model content here.

## API Specifications
API specs content here.

## UI/UX Considerations
UI/UX content here.

## Open Questions
Open questions content here.
`;

const partialPRD = `# Feature PRD

## Overview
Overview content here.

## Problem Statement
Problem content here.

## User Stories
User stories content here.
`;

describe('validatePRD', () => {
  it('returns valid for a complete PRD with all 10 sections', () => {
    const result = validatePRD(fullPRD);
    expect(result.valid).toBe(true);
    expect(result.missingSections).toEqual([]);
  });

  it('detects missing sections', () => {
    const result = validatePRD(partialPRD);
    expect(result.valid).toBe(false);
    expect(result.missingSections).toContain('Goals & Success Metrics');
    expect(result.missingSections).toContain('Functional Requirements');
    expect(result.missingSections).toContain('Non-Functional Requirements');
    expect(result.missingSections).toContain('Data Model Changes');
    expect(result.missingSections).toContain('API Specifications');
    expect(result.missingSections).toContain('UI/UX Considerations');
    expect(result.missingSections).toContain('Open Questions');
  });

  it('returns all 10 sections missing for empty string', () => {
    const result = validatePRD('');
    expect(result.valid).toBe(false);
    expect(result.missingSections).toHaveLength(10);
  });

  it('handles sections with trailing colons', () => {
    const prd = fullPRD.replace('## Overview', '## Overview:');
    const result = validatePRD(prd);
    // The colon gets stripped during normalization
    expect(result.missingSections).not.toContain('Overview');
  });
});
