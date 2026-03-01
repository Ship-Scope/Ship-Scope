import { Router } from "express";

export const specRouter = Router();

// POST /api/specs/generate/:proposalId - Generate spec from approved proposal
specRouter.post("/generate/:proposalId", async (_req, res) => {
  // TODO: Implement spec generation
  // 1. Take an approved proposal
  // 2. Generate PRD, user stories, acceptance criteria
  // 3. Generate data model changes and API specs
  // 4. Generate task breakdown
  // 5. Generate agent-ready prompt for Cursor/Claude Code
  res.json({ message: "Spec generation - coming in v0.1" });
});

// GET /api/specs/:id - Get a generated spec
specRouter.get("/:id", async (_req, res) => {
  res.json({ message: "Coming in v0.1" });
});

// GET /api/specs/:id/agent-prompt - Get the agent-ready prompt
specRouter.get("/:id/agent-prompt", async (_req, res) => {
  // This is the killer feature - output a prompt that can be
  // pasted directly into Cursor or Claude Code
  res.json({ message: "Agent prompt export - coming in v0.1" });
});
