import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function createFeedbackSource(overrides = {}) {
  return prisma.feedbackSource.create({
    data: {
      name: 'Test Source',
      type: 'csv',
      filename: 'test.csv',
      rowCount: 0,
      metadata: {},
      ...overrides,
    },
  });
}

export async function createFeedbackItem(sourceId: string, overrides = {}) {
  return prisma.feedbackItem.create({
    data: {
      content: 'Test feedback content that is at least 10 characters',
      channel: 'manual',
      sourceId,
      metadata: {},
      ...overrides,
    },
  });
}

export async function createTheme(overrides = {}) {
  return prisma.theme.create({
    data: {
      name: 'Test Theme',
      description: 'A test theme description',
      category: 'feature_request',
      painPoints: ['pain point 1'],
      feedbackCount: 0,
      avgSentiment: 0,
      avgUrgency: 0,
      opportunityScore: 0,
      ...overrides,
    },
  });
}

export async function createProposal(themeId: string, overrides = {}) {
  return prisma.proposal.create({
    data: {
      title: 'Test Proposal',
      problem: 'Test problem statement',
      solution: 'Test solution description',
      status: 'proposed',
      reachScore: 5,
      impactScore: 5,
      confidenceScore: 5,
      effortScore: 5,
      riceScore: 12.5,
      themeId,
      ...overrides,
    },
  });
}

export async function createSpec(proposalId: string, overrides = {}) {
  return prisma.spec.create({
    data: {
      proposalId,
      prdMarkdown: '# Test PRD\n\nThis is a test specification.',
      agentPrompt: 'Build a test feature.',
      version: 1,
      ...overrides,
    },
  });
}

export async function createJiraIssue(proposalId: string, overrides = {}) {
  return prisma.jiraIssue.create({
    data: {
      proposalId,
      jiraKey: 'PROJ-1',
      jiraId: '10001',
      jiraUrl: 'https://test.atlassian.net/browse/PROJ-1',
      issueType: 'Story',
      summary: 'Test Jira Issue',
      status: 'To Do',
      ...overrides,
    },
  });
}

// Create a full pipeline of test data
export async function createFullPipelineData() {
  const source = await createFeedbackSource();
  const items = await Promise.all(
    Array.from({ length: 10 }, (_, i) =>
      createFeedbackItem(source.id, { content: `Feedback item ${i + 1} with enough content` }),
    ),
  );
  const theme = await createTheme({ feedbackCount: items.length });
  const proposal = await createProposal(theme.id);
  const spec = await createSpec(proposal.id);
  return { source, items, theme, proposal, spec };
}
