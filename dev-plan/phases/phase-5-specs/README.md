# Phase 5: Spec Generation

> **Timeline:** Days 17-20
> **Goal:** Build the complete spec generation pipeline -- LLM-powered PRD generation from approved proposals, agent-ready prompt export for Cursor and Claude Code, a polished spec viewer UI with markdown rendering and clipboard/download actions, and comprehensive test coverage. After this phase, users can generate full product specs from any approved proposal, preview them inline, and export structured development prompts directly into their coding agent of choice.

---

## Dependency Graph

```
Phase 4 (complete) ──> 01-prd-generation ──> 02-agent-prompt-export ──┐
                                                                       │
                       01 + 02 ──> 03-spec-viewer-ui ─────────────────┤
                                                                       │
                       01 + 02 ──> 04-spec-tests ─────────────────────┘

Parallelizable:
  - 02 can start as soon as 01 is complete (needs Spec record + PRD content)
  - 03 depends on both 01 and 02 (needs PRD rendering + agent prompt display)
  - 04 depends on 01 and 02 (all backend code must be complete before testing)
  - 03 and 04 can run in parallel once 01 and 02 are finished
```

---

## Tasks Overview

| #   | Task                   | Complexity | Dependencies     | Est. |
| --- | ---------------------- | ---------- | ---------------- | ---- |
| 01  | PRD Generation Service | L          | Phase 4 complete | 1d   |
| 02  | Agent Prompt Export    | M          | 01               | 0.5d |
| 03  | Spec Viewer UI         | L          | 01, 02           | 1.5d |
| 04  | Spec Tests             | L          | 01, 02           | 1d   |

---

## Key Architectural Decisions

1. **PRD as a single markdown string, not decomposed fields** -- The Prisma `Spec` model has a `prd` field (Text) that stores the full PRD as a single markdown document containing all 10 required sections. This is simpler than normalizing each section into its own column and allows the LLM maximum flexibility in how it formats subsections. Parsing individual sections (for agent prompt construction) is done at read time via regex section splitting, not at write time.

2. **Agent prompt is generated from PRD, not from a second LLM call** -- The agent-ready prompt is deterministically assembled from the stored PRD markdown and proposal metadata using `buildAgentPrompt()`. It does NOT call the LLM again. This makes export instant, reproducible, and free of API cost. The only LLM call in Phase 5 is for PRD generation.

3. **Two agent prompt formats: Cursor and Claude Code** -- Cursor prompts use `## Section` headers with concise imperative instructions. Claude Code prompts use a more conversational structure with explicit file paths and step-by-step task ordering. The format is a parameter on `buildAgentPrompt(spec, format)`, not stored separately in the database. The `agentPrompt` field on Spec stores the Cursor format as the default; the Claude Code format is generated on-the-fly.

4. **Version bumping on regeneration** -- When a user regenerates a PRD for the same proposal, the existing Spec record is updated in place (not deleted and recreated). The `version` field is incremented, `prd` and `agentPrompt` are overwritten, and `updatedAt` is refreshed. This preserves the spec ID for any external references while tracking iteration count.

5. **Spec requires approved proposal** -- PRD generation is gated on `proposal.status === 'approved'`. Attempting to generate a spec for a proposal in any other status returns a 400 error. This enforces the pipeline discipline: feedback --> themes --> proposals --> approve --> specs.

---

## Data Flow

```
Approved Proposal (Phase 4)
  │
  ├─[01] specService.generatePRD(proposalId)
  │       ├── Validate proposal status === 'approved'
  │       ├── Fetch proposal + evidence (quotes, feedback content)
  │       ├── buildPRDPrompt(proposalWithEvidence) → gpt-4o-mini → markdown string
  │       ├── buildAgentPrompt(prd, proposalData, 'cursor') → structured dev prompt
  │       ├── Upsert Spec record (prd, agentPrompt, version++)
  │       └── Return Spec with full content
  │
  ├─[02] specService.getAgentPrompt(specId, format)
  │       ├── Fetch Spec + Proposal
  │       ├── buildAgentPrompt(spec.prd, proposal, format)
  │       ├── Format: 'cursor' | 'claude-code'
  │       └── Return formatted prompt string
  │
  ├─[03] Frontend
  │       ├── SpecsPage: list of specs with linked proposal title
  │       ├── Spec detail: two tabs — "PRD" and "Agent Prompt"
  │       ├── PRD tab: rendered markdown with syntax highlighting
  │       ├── Agent Prompt tab: raw text with format toggle
  │       ├── Actions: Copy to clipboard, Download as .md, Regenerate
  │       └── Generate button on approved proposal detail view
  │
  └─[04] Tests
          ├── Unit: prompt construction, markdown validation, version bumping
          ├── Integration: POST generate, GET spec, GET agent-prompt
          └── >80% coverage on spec.service.ts
```

---

## Prisma Schema Reference

```prisma
model Spec {
  id         String   @id @default(cuid())
  proposalId String
  proposal   Proposal @relation(fields: [proposalId], references: [id])

  // Generated content
  prd          String?  // Full PRD markdown (all 10 sections)
  userStories  Json?    // Array of user stories (extracted from PRD)
  acceptanceCriteria Json? // Array of acceptance criteria (extracted from PRD)
  dataModel    String?  // Data model changes section
  apiSpec      String?  // API endpoint specifications section
  taskBreakdown Json?   // Development tasks
  agentPrompt  String?  // Ready-to-use prompt for Cursor/Claude Code

  // Export
  exportedTo   String?  // "linear", "jira", "github"
  exportedAt   DateTime?

  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
}
```

**Note:** The schema has individual fields (userStories, acceptanceCriteria, etc.) that were designed for potential decomposed storage. In this phase, the primary content lives in `prd` (full markdown) and `agentPrompt` (formatted dev prompt). The individual fields are populated as a convenience by parsing the generated PRD sections, allowing future features (e.g., exporting just user stories to Linear) without re-parsing.

---

## API Surface

| Method | Endpoint                                                 | Description                                          |
| ------ | -------------------------------------------------------- | ---------------------------------------------------- |
| `POST` | `/api/specs/generate/:proposalId`                        | Generate PRD + agent prompt for an approved proposal |
| `GET`  | `/api/specs/:id`                                         | Get full spec (PRD + agent prompt + metadata)        |
| `GET`  | `/api/specs/:id/prd`                                     | Get just the PRD markdown                            |
| `GET`  | `/api/specs/:id/agent-prompt?format=cursor\|claude-code` | Get agent prompt in specified format                 |
| `GET`  | `/api/specs/by-proposal/:proposalId`                     | Get spec by its linked proposal ID                   |

---

## Exit Criteria

Before moving to Phase 6, ALL of the following must be true:

- [ ] POST /api/specs/generate/:proposalId generates a full PRD with all 10 required sections
- [ ] PRD is stored on Spec record linked to the source Proposal
- [ ] Agent prompt is generated from PRD content (no additional LLM call)
- [ ] Agent prompt supports two formats: Cursor and Claude Code
- [ ] GET /api/specs/:id returns full spec with prd, agentPrompt, version, timestamps
- [ ] GET /api/specs/:id/prd returns raw PRD markdown
- [ ] GET /api/specs/:id/agent-prompt?format=cursor returns Cursor-formatted prompt
- [ ] GET /api/specs/:id/agent-prompt?format=claude-code returns Claude Code-formatted prompt
- [ ] Regenerating a spec bumps version, overwrites prd and agentPrompt
- [ ] Generating spec for non-approved proposal returns 400
- [ ] Generating spec for non-existent proposal returns 404
- [ ] Spec viewer renders PRD markdown with syntax highlighting
- [ ] Spec viewer has two tabs: PRD and Agent Prompt
- [ ] Copy to clipboard works for both PRD and agent prompt
- [ ] Download as .md works for both PRD and agent prompt
- [ ] Format toggle switches between Cursor and Claude Code agent prompt formats
- [ ] Regenerate button triggers new generation and refreshes the view
- [ ] Malformed AI output handled gracefully (fallback sections, error message)
- [ ] All unit and integration tests pass
- [ ] > 80% coverage on spec.service.ts and specs.ts prompt builder
