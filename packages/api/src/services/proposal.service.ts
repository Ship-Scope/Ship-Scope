import { type Prisma } from '@prisma/client';
import { buildProposalPrompt } from '@shipscope/core/prompts/proposals';
import { type Theme } from '@shipscope/core/types/theme';
import { NotFound, BadRequest } from '../lib/errors';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { chatCompletion } from './ai.service';

// ─── RICE Calculation ─────────────────────────────────────

/**
 * Calculate RICE score: (Reach x Impact x Confidence) / Effort
 * All inputs are integers 1-10. Returns a float.
 */
export function calculateRICE(
  reach: number,
  impact: number,
  confidence: number,
  effort: number,
): number {
  if (effort === 0) throw BadRequest('Effort score cannot be zero');
  return (reach * impact * confidence) / effort;
}

// ─── AI Output Sanitization ──────────────────────────────

interface GeneratedProposal {
  title: string;
  problem: string;
  solution: string;
  reachScore: number;
  impactScore: number;
  confidenceScore: number;
  effortScore: number;
}

function sanitizeProposal(raw: unknown): GeneratedProposal {
  const obj = raw as Record<string, unknown>;
  return {
    title: sanitizeString(obj.title, 'Untitled Proposal', 150),
    problem: sanitizeString(obj.problem, 'No problem statement generated.', 2000),
    solution: sanitizeString(obj.solution, 'No solution generated.', 2000),
    reachScore: clampScore(obj.reachScore ?? obj.reach),
    impactScore: clampScore(obj.impactScore ?? obj.impact),
    confidenceScore: clampScore(obj.confidenceScore ?? obj.confidence),
    effortScore: clampScore(obj.effortScore ?? obj.effort, 5),
  };
}

function sanitizeString(value: unknown, fallback: string, maxLength: number): string {
  if (typeof value !== 'string' || value.trim().length === 0) return fallback;
  return value.trim().slice(0, maxLength);
}

function clampScore(value: unknown, fallback = 5): number {
  const num = typeof value === 'number' ? value : parseFloat(String(value));
  if (isNaN(num)) return fallback;
  return Math.max(1, Math.min(10, Math.round(num)));
}

// ─── Status Transitions ──────────────────────────────────

const VALID_TRANSITIONS: Record<string, string[]> = {
  proposed: ['approved', 'rejected'],
  approved: ['shipped', 'rejected'],
  rejected: ['proposed'],
  shipped: [],
};

function validateStatusTransition(current: string, next: string): void {
  const allowed = VALID_TRANSITIONS[current];
  if (!allowed || !allowed.includes(next)) {
    throw BadRequest(`Cannot transition from "${current}" to "${next}"`);
  }
}

// ─── Generation ──────────────────────────────────────────

export interface ProposalGenerationResult {
  proposalsCreated: number;
  proposalsSkipped: number;
  errors: { themeId: string; themeName: string; error: string }[];
}

export async function generateFromThemes(topN = 20): Promise<ProposalGenerationResult> {
  const themes = await prisma.theme.findMany({
    orderBy: { opportunityScore: 'desc' },
    take: topN,
    include: {
      feedbackItems: {
        include: { feedbackItem: { select: { content: true } } },
        orderBy: { similarityScore: 'desc' },
        take: 5,
      },
    },
  });

  if (themes.length === 0) {
    throw NotFound('No themes found. Run synthesis first.');
  }

  const result: ProposalGenerationResult = {
    proposalsCreated: 0,
    proposalsSkipped: 0,
    errors: [],
  };

  for (const theme of themes) {
    // Skip themes with approved/shipped proposals
    const protectedProposal = await prisma.proposal.findFirst({
      where: { themeId: theme.id, status: { in: ['approved', 'shipped'] } },
    });

    if (protectedProposal) {
      result.proposalsSkipped++;
      continue;
    }

    // Skip themes with very few feedback items
    if (theme.feedbackCount < 2) {
      result.proposalsSkipped++;
      continue;
    }

    // Delete existing "proposed" proposals for this theme (safe regeneration)
    await prisma.proposalEvidence.deleteMany({
      where: { proposal: { themeId: theme.id, status: 'proposed' } },
    });
    await prisma.proposal.deleteMany({
      where: { themeId: theme.id, status: 'proposed' },
    });

    const sampleFeedback = theme.feedbackItems.map((link) => link.feedbackItem.content);
    const themeForPrompt: Theme = {
      id: theme.id,
      name: theme.name,
      description: theme.description,
      category: theme.category as Theme['category'],
      painPoints: theme.painPoints,
      feedbackCount: theme.feedbackCount,
      avgSentiment: theme.avgSentiment,
      avgUrgency: theme.avgUrgency,
      opportunityScore: theme.opportunityScore,
      createdAt: theme.createdAt.toISOString(),
      updatedAt: theme.updatedAt.toISOString(),
    };

    try {
      const raw = await chatCompletion<unknown>(
        `You are a senior product manager at a SaaS company. Generate actionable, specific feature proposals grounded in evidence. Score conservatively (avoid giving everything 8-10). Always respond with valid JSON.`,
        buildProposalPrompt(themeForPrompt, sampleFeedback),
      );

      const sanitized = sanitizeProposal(raw);
      const riceScore = calculateRICE(
        sanitized.reachScore,
        sanitized.impactScore,
        sanitized.confidenceScore,
        sanitized.effortScore,
      );

      await prisma.proposal.create({
        data: {
          title: sanitized.title,
          problem: sanitized.problem,
          solution: sanitized.solution,
          reachScore: sanitized.reachScore,
          impactScore: sanitized.impactScore,
          confidenceScore: sanitized.confidenceScore,
          effortScore: sanitized.effortScore,
          riceScore,
          status: 'proposed',
          themeId: theme.id,
        },
      });

      result.proposalsCreated++;
    } catch (err) {
      logger.error('Proposal generation failed for theme', {
        themeId: theme.id,
        themeName: theme.name,
        error: err instanceof Error ? err.message : String(err),
      });
      result.errors.push({
        themeId: theme.id,
        themeName: theme.name,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return result;
}

// ─── CRUD ────────────────────────────────────────────────

export async function listProposals(params: {
  page?: number;
  pageSize?: number;
  status?: string;
  themeId?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}) {
  const page = params.page || 1;
  const pageSize = params.pageSize || 20;

  const where: Prisma.ProposalWhereInput = {};
  if (params.status) where.status = params.status;
  if (params.themeId) where.themeId = params.themeId;
  if (params.search) {
    where.OR = [
      { title: { contains: params.search, mode: 'insensitive' } },
      { problem: { contains: params.search, mode: 'insensitive' } },
      { solution: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  const [data, total] = await Promise.all([
    prisma.proposal.findMany({
      where,
      orderBy: { [params.sortBy || 'riceScore']: params.sortOrder || 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        theme: { select: { id: true, name: true, category: true } },
        _count: { select: { evidence: true } },
      },
    }),
    prisma.proposal.count({ where }),
  ]);

  return {
    data: data.map((p) => ({
      ...p,
      evidenceCount: p._count.evidence,
      _count: undefined,
    })),
    pagination: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
  };
}

export async function getProposalById(id: string) {
  const proposal = await prisma.proposal.findUnique({
    where: { id },
    include: {
      theme: { select: { id: true, name: true, category: true, description: true } },
      evidence: {
        include: {
          feedbackItem: {
            select: {
              id: true,
              content: true,
              author: true,
              channel: true,
              sentiment: true,
              urgency: true,
            },
          },
        },
        orderBy: { relevanceScore: 'desc' },
      },
    },
  });
  if (!proposal) throw NotFound('Proposal');
  return proposal;
}

export async function updateProposal(
  id: string,
  data: {
    title?: string;
    problem?: string;
    solution?: string;
    status?: string;
    reachScore?: number;
    impactScore?: number;
    confidenceScore?: number;
    effortScore?: number;
  },
) {
  const existing = await prisma.proposal.findUnique({ where: { id } });
  if (!existing) throw NotFound('Proposal');

  // Validate status transition if status is being changed
  if (data.status && data.status !== existing.status) {
    validateStatusTransition(existing.status, data.status);
  }

  // Recalculate RICE if any score changed
  const reach = data.reachScore ?? existing.reachScore;
  const impact = data.impactScore ?? existing.impactScore;
  const confidence = data.confidenceScore ?? existing.confidenceScore;
  const effort = data.effortScore ?? existing.effortScore;

  let riceScore = existing.riceScore;
  if (reach && impact && confidence && effort) {
    riceScore = calculateRICE(reach, impact, confidence, effort);
  }

  return prisma.proposal.update({
    where: { id },
    data: {
      ...data,
      riceScore,
    },
    include: {
      theme: { select: { id: true, name: true, category: true } },
    },
  });
}

export async function deleteProposal(id: string) {
  const existing = await prisma.proposal.findUnique({ where: { id } });
  if (!existing) throw NotFound('Proposal');

  // Cascade delete evidence first
  await prisma.proposalEvidence.deleteMany({ where: { proposalId: id } });
  await prisma.proposal.delete({ where: { id } });
  return { deleted: true };
}
