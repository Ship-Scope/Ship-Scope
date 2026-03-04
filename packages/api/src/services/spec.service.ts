import { type Proposal } from '@shipscope/core/types/proposal';
import {
  buildPRDSystemPrompt,
  buildPRDPrompt,
  buildAgentPrompt,
  extractSection,
  PRD_SECTIONS,
} from '@shipscope/core/prompts/specs';
import { type AgentPromptFormat } from '@shipscope/core/types/spec';
import { NotFound, BadRequest, Conflict } from '../lib/errors';
import { logger } from '../lib/logger';
import { prisma } from '../lib/prisma';
import { chatCompletionText } from './ai.service';
import { activityService } from './activity.service';

// ─── Concurrency Guard ───────────────────────────────────

const generatingProposals = new Set<string>();

// ─── PRD Validation ──────────────────────────────────────

export function validatePRD(markdown: string): { valid: boolean; missingSections: string[] } {
  const missing: string[] = [];
  for (const section of PRD_SECTIONS) {
    const content = extractSection(markdown, section);
    if (!content) {
      missing.push(section);
    }
  }
  return { valid: missing.length === 0, missingSections: missing };
}

function appendMissingSections(markdown: string, missing: string[]): string {
  let result = markdown;
  for (const section of missing) {
    result += `\n\n## ${section}\n\n_To be determined._`;
  }
  return result;
}

// ─── Prisma → Core Type Mapper ───────────────────────────

function mapProposalToCore(p: {
  id: string;
  title: string;
  problem: string;
  solution: string;
  status: string;
  reachScore: number | null;
  impactScore: number | null;
  confidenceScore: number | null;
  effortScore: number | null;
  riceScore: number | null;
  themeId: string | null;
  createdAt: Date;
  updatedAt: Date;
  _count?: { evidence: number };
}): Proposal {
  return {
    id: p.id,
    title: p.title,
    problem: p.problem,
    solution: p.solution,
    status: p.status as Proposal['status'],
    scores: {
      reach: p.reachScore ?? 5,
      impact: p.impactScore ?? 5,
      confidence: p.confidenceScore ?? 5,
      effort: p.effortScore ?? 5,
      total: p.riceScore ?? 0,
    },
    themeId: p.themeId ?? '',
    evidenceCount: p._count?.evidence ?? 0,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  };
}

// ─── Generation ──────────────────────────────────────────

export async function generateSpec(proposalId: string) {
  // Concurrency guard
  if (generatingProposals.has(proposalId)) {
    throw Conflict('Spec generation already in progress for this proposal');
  }

  generatingProposals.add(proposalId);
  try {
    // Fetch proposal with evidence
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        theme: { select: { id: true, name: true, category: true } },
        evidence: {
          include: {
            feedbackItem: {
              select: { id: true, content: true, author: true, channel: true },
            },
          },
          orderBy: { relevanceScore: 'desc' },
          take: 10,
        },
        _count: { select: { evidence: true } },
      },
    });

    if (!proposal) throw NotFound('Proposal');
    if (proposal.status !== 'approved') {
      throw BadRequest('Only approved proposals can generate specs');
    }

    // Check for existing spec (for version bumping)
    const existing = await prisma.spec.findUnique({ where: { proposalId } });
    const nextVersion = existing ? existing.version + 1 : 1;

    // Build evidence strings
    const evidenceStrings = proposal.evidence.map((e) => e.quote || e.feedbackItem.content);

    // Map to core type for prompt builder
    const coreProposal = mapProposalToCore(proposal);

    // Generate PRD via LLM
    let prdMarkdown = await chatCompletionText(
      buildPRDSystemPrompt(),
      buildPRDPrompt(coreProposal, evidenceStrings),
    );

    // Validate and patch missing sections
    const { valid, missingSections } = validatePRD(prdMarkdown);
    if (!valid) {
      logger.warn('PRD missing sections, appending placeholders', { missingSections });
      prdMarkdown = appendMissingSections(prdMarkdown, missingSections);
    }

    // Generate default agent prompt (cursor format)
    const agentPrompt = buildAgentPrompt(coreProposal, prdMarkdown, 'cursor');

    // Upsert spec
    let spec;
    if (existing) {
      spec = await prisma.spec.update({
        where: { proposalId },
        data: { prdMarkdown, agentPrompt, version: nextVersion },
        include: { proposal: true },
      });
    } else {
      spec = await prisma.spec.create({
        data: { proposalId, prdMarkdown, agentPrompt, version: 1 },
        include: { proposal: true },
      });
    }

    await activityService.log({
      type: 'spec_generation',
      description: `Generated spec v${spec.version} for "${proposal.title}"`,
      metadata: { specId: spec.id, proposalId, version: spec.version },
    });

    return {
      spec,
      isRegeneration: !!existing,
      previousVersion: existing ? existing.version : null,
    };
  } finally {
    generatingProposals.delete(proposalId);
  }
}

// ─── CRUD ────────────────────────────────────────────────

export async function listSpecs() {
  return prisma.spec.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      proposal: {
        select: { id: true, title: true, status: true, riceScore: true },
      },
    },
  });
}

export async function getSpecById(id: string) {
  const spec = await prisma.spec.findUnique({
    where: { id },
    include: {
      proposal: {
        select: {
          id: true,
          title: true,
          status: true,
          problem: true,
          solution: true,
          riceScore: true,
          reachScore: true,
          impactScore: true,
          confidenceScore: true,
          effortScore: true,
          themeId: true,
        },
      },
    },
  });
  if (!spec) throw NotFound('Spec');
  return spec;
}

export async function getSpecByProposalId(proposalId: string) {
  return prisma.spec.findUnique({
    where: { proposalId },
    include: {
      proposal: {
        select: {
          id: true,
          title: true,
          status: true,
          problem: true,
          solution: true,
          riceScore: true,
          reachScore: true,
          impactScore: true,
          confidenceScore: true,
          effortScore: true,
          themeId: true,
        },
      },
    },
  });
}

export async function getAgentPrompt(specId: string, format: AgentPromptFormat) {
  const spec = await prisma.spec.findUnique({
    where: { id: specId },
    include: {
      proposal: {
        include: {
          _count: { select: { evidence: true } },
        },
      },
    },
  });
  if (!spec) throw NotFound('Spec');
  if (!spec.prdMarkdown) throw BadRequest('Spec has no PRD content');

  const coreProposal = mapProposalToCore(spec.proposal);
  return buildAgentPrompt(coreProposal, spec.prdMarkdown, format);
}
