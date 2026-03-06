# Phase 4: Feature Proposals

> **Timeline:** Days 13-16
> **Goal:** Build the complete proposal generation pipeline -- LLM-powered proposal generation from synthesized themes, RICE scoring with manual overrides, evidence linking to source feedback items, full CRUD with status workflow, proposals page UI with card and detail views, and comprehensive test coverage. After this phase, users can generate, review, approve, and manage prioritized feature proposals backed by real customer evidence.

---

## Dependency Graph

```
Phase 3 (complete) ──> 01-proposal-generation ──┬──> 02-rice-scoring-crud ──┐
                                                  │                           │
                                                  └──> 03-evidence-linking ───┤
                                                                              │
                                                  02 + 03 ──> 04-proposals-page-ui
                                                                              │
                                                  01-03 ──> 05-proposal-tests ┘

Parallelizable:
  - 02 and 03 can start simultaneously after 01
  - 04 depends on 02 and 03 (needs CRUD endpoints and evidence API)
  - 05 depends on 01, 02, 03 (all backend code must be complete)
```

---

## Tasks Overview

| #   | Task                                   | Complexity | Dependencies     | Est. |
| --- | -------------------------------------- | ---------- | ---------------- | ---- |
| 01  | LLM Proposal Generation Service        | L          | Phase 3 complete | 1d   |
| 02  | RICE Scoring, CRUD & Status Management | L          | 01               | 1d   |
| 03  | Evidence Linking Service               | M          | 01               | 0.5d |
| 04  | Proposals Page UI                      | XL         | 02, 03           | 1.5d |
| 05  | Proposal Tests                         | L          | 01, 02, 03       | 1d   |

---

## Key Architectural Decisions

1. **One proposal per theme (V1)** -- Each theme produces exactly one proposal. If the user regenerates proposals, existing proposals with status "proposed" are replaced. Proposals that have been approved, rejected, or shipped are preserved and never overwritten. This keeps the mental model simple while allowing iteration on draft proposals.

2. **RICE formula: (Reach x Impact x Confidence) / Effort** -- All four components are integers on a 1-10 scale. The AI generates initial scores, but users can override any score manually. When any component changes, riceScore is recomputed immediately. The formula intentionally keeps Effort as a denominator -- high-effort items are deprioritized even if impactful.

3. **Evidence linking as a post-generation step** -- After a proposal is created, the evidence service runs as a separate step that selects the top 10 most relevant feedback items from the source theme. Each piece of evidence includes a "quote" -- the single most relevant sentence extracted from the feedback content. This separation allows re-linking evidence without regenerating the entire proposal.

4. **Sequential LLM calls (not parallel)** -- Proposals are generated one at a time, not in parallel. This avoids rate-limit cascades with OpenAI, simplifies error handling (a single failure does not abort the batch), and makes progress tracking straightforward. For 20 themes, this takes approximately 30-40 seconds.

5. **Thin route pattern** -- Following the convention established in Phase 2, all business logic lives in `proposal.service.ts` and `evidence.service.ts`. Route handlers in `proposals.ts` are thin HTTP adapters that validate input, call the service, and format the response. This makes services independently testable.

---

## Data Flow

```
Themes (Phase 3)
  │
  ├─[01] proposalService.generateFromThemes(topN)
  │       ├── For each theme: buildProposalPrompt() → gpt-4o-mini → parse JSON
  │       ├── Calculate RICE score
  │       └── Create Proposal record linked to Theme
  │
  ├─[03] evidenceService.linkEvidence(proposalId)
  │       ├── Get feedback items from source theme (via FeedbackThemeLink)
  │       ├── Rank by similarity to theme centroid (relevanceScore)
  │       ├── Extract best quote from each top-10 item
  │       └── Create ProposalEvidence records
  │
  ├─[02] CRUD & Status Management
  │       ├── List/filter/sort proposals
  │       ├── Update scores (manual override → recalculate RICE)
  │       ├── Status transitions: proposed → approved/rejected → shipped
  │       └── Delete proposal + cascade evidence
  │
  └─[04] Frontend
          ├── Card grid with RICE badges, status pills, evidence counts
          ├── Detail drawer with score bars, evidence panel, approve/reject
          └── Filters (status) and sorts (RICE, date, evidence count)
```

---

## Exit Criteria

Before moving to Phase 5, ALL of the following must be true:

- [ ] POST /api/proposals/generate triggers proposal generation from top N themes
- [ ] Each generated proposal has: title, problem, solution, impact/effort/confidence/reach scores
- [ ] RICE score calculated as (Reach x Impact x Confidence) / Effort
- [ ] Each proposal linked to its source Theme via themeId
- [ ] Evidence linking attaches top 10 feedback items with quotes and relevance scores
- [ ] GET /api/proposals returns paginated, filterable (status), sortable (RICE/date) list
- [ ] GET /api/proposals/:id returns proposal with full evidence panel
- [ ] PATCH /api/proposals/:id updates scores, status, or description
- [ ] PATCH /api/proposals/:id with score changes triggers RICE recalculation
- [ ] DELETE /api/proposals/:id removes proposal and cascades to ProposalEvidence
- [ ] Status workflow enforced: proposed -> approved/rejected, approved -> shipped
- [ ] Manual score editing works (sliders in UI update scores via PATCH)
- [ ] Proposals page shows card grid with RICE badge, status pill, evidence count
- [ ] Proposal detail view shows problem, solution, score bars, evidence quotes
- [ ] One-click approve/reject buttons work from detail view
- [ ] Regenerating proposals replaces only "proposed" status items (preserves approved/shipped)
- [ ] Malformed AI output handled gracefully with defaults and retry
- [ ] All unit and integration tests pass
- [ ] > 80% coverage on proposal service and evidence service
