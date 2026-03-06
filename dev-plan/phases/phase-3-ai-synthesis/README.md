# Phase 3: AI Synthesis Engine

> **Timeline:** Days 8-12
> **Goal:** Build the complete AI synthesis pipeline — embedding generation, sentiment/urgency scoring, vector-based clustering, LLM-powered theme extraction, full pipeline orchestration with job tracking, themes page UI, and comprehensive test coverage. This is the most technically complex phase, forming the intelligence core of ShipScope.

---

## Dependency Graph

```
Phase 2 (complete) ──> 01-openai-client ──┬──> 02-embedding-worker ──┐
                                           │                          │
                                           └──> 03-sentiment-urgency ─┤
                                                                       │
                                           04-clustering-engine ───────┤
                                                                       │
                                           05-theme-extraction ────────┤
                                                                       │
                                           06-synthesis-orchestrator ──┘──> 07-themes-page-ui
                                                                       │
                                           08-synthesis-tests ─────────┘

Parallelizable:
  - 02 and 03 can start simultaneously after 01
  - 04 is independent (pure algorithm, no AI dependency)
  - 05 depends on 04 (needs clusters to name)
  - 06 depends on 02, 03, 04, 05 (orchestrates all stages)
  - 07 depends on 06 (needs API endpoints for themes and status)
  - 08 depends on 01-06 (all backend code must be complete)
```

---

## Tasks Overview

| #   | Task                          | Complexity | Dependencies          | Est. |
| --- | ----------------------------- | ---------- | --------------------- | ---- |
| 01  | OpenAI Client & Configuration | M          | Phase 2               | 0.5d |
| 02  | Embedding Generation Worker   | XL         | 01                    | 1d   |
| 03  | Sentiment & Urgency Scoring   | L          | 01                    | 1d   |
| 04  | Clustering Engine             | XL         | None (pure algorithm) | 1.5d |
| 05  | LLM Theme Extraction          | L          | 04                    | 0.5d |
| 06  | Synthesis Orchestrator        | XL         | 02, 03, 04, 05        | 1d   |
| 07  | Themes Page UI                | L          | 06                    | 1d   |
| 08  | Synthesis Tests               | L          | 01-06                 | 1d   |

---

## Key Architectural Decisions

1. **JS-based clustering (not HDBSCAN)** — We use agglomerative clustering implemented in pure JavaScript/TypeScript. This avoids a Python microservice dependency for V1. The algorithm works well for datasets up to ~10K items. If scaling beyond that, we'll add a Python sidecar in a future phase.

2. **Pipeline as staged BullMQ job** — The synthesis pipeline runs as a single BullMQ job that progresses through stages: embed → score → cluster → name themes. Each stage updates job progress, allowing real-time status display in the UI.

3. **Idempotent re-runs** — Running synthesis again updates existing themes rather than creating duplicates. Feedback items that already have embeddings are skipped. This makes the "Run Synthesis" button safe to click multiple times.

4. **Cost tracking** — Every OpenAI API call logs token usage. The synthesis status response includes estimated cost. This transparency helps users manage API spend.

---

## Exit Criteria

Before moving to Phase 4, ALL of the following must be true:

- [ ] POST /api/synthesis/run triggers the full pipeline and returns a jobId
- [ ] GET /api/synthesis/status returns current stage, progress, and stats
- [ ] Embedding worker generates 1536-dim vectors for all unprocessed feedback items
- [ ] Sentiment scoring assigns -1 to 1 scores to all items
- [ ] Urgency scoring assigns 0 to 1 scores to all items
- [ ] Clustering groups similar feedback items based on embedding similarity
- [ ] LLM names each cluster as a human-readable theme with category and pain points
- [ ] GET /api/synthesis/themes returns all themes with aggregate scores
- [ ] GET /api/synthesis/themes/:id returns theme detail with linked feedback
- [ ] Themes page UI shows theme cards with counts, scores, and categories
- [ ] Theme detail view shows linked feedback items
- [ ] Re-running synthesis updates existing themes (no duplicates)
- [ ] Full synthesis completes in <60 seconds for 200 seed items (with mocked AI)
- [ ] All unit and integration tests pass
- [ ] > 80% coverage on synthesis services
