import { PrismaClient } from '@prisma/client';
import { beforeAll, afterAll, beforeEach } from 'vitest';

// Use test database
process.env.DATABASE_URL =
  process.env.DATABASE_URL?.replace('/shipscope?', '/shipscope_test?') ||
  'postgresql://shipscope:shipscope@localhost:5432/shipscope_test?schema=public';
process.env.NODE_ENV = 'test';

const prisma = new PrismaClient();

beforeAll(async () => {
  await prisma.$executeRawUnsafe('CREATE EXTENSION IF NOT EXISTS vector');
});

beforeEach(async () => {
  // Clean all tables in dependency order (child tables first)
  await prisma.$transaction([
    prisma.trelloCard.deleteMany(),
    prisma.jiraIssue.deleteMany(),
    prisma.proposalEvidence.deleteMany(),
    prisma.spec.deleteMany(),
    prisma.proposal.deleteMany(),
    prisma.feedbackThemeLink.deleteMany(),
    prisma.theme.deleteMany(),
    prisma.feedbackItem.deleteMany(),
    prisma.feedbackSource.deleteMany(),
    prisma.apiKey.deleteMany(),
    prisma.activityLog.deleteMany(),
    prisma.setting.deleteMany(),
  ]);
});

afterAll(async () => {
  await prisma.$disconnect();
});

export { prisma };
