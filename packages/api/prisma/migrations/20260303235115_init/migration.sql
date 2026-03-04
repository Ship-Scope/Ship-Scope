-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector";

-- CreateTable
CREATE TABLE "FeedbackSource" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "filename" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackItem" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "author" TEXT,
    "email" TEXT,
    "channel" TEXT,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "sentiment" DOUBLE PRECISION,
    "urgency" DOUBLE PRECISION,
    "embedding" vector(1536),
    "embeddedAt" TIMESTAMP(3),
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeedbackItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Theme" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT,
    "painPoints" TEXT[],
    "feedbackCount" INTEGER NOT NULL DEFAULT 0,
    "avgSentiment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "avgUrgency" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "opportunityScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Theme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FeedbackThemeLink" (
    "id" TEXT NOT NULL,
    "feedbackItemId" TEXT NOT NULL,
    "themeId" TEXT NOT NULL,
    "similarityScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,

    CONSTRAINT "FeedbackThemeLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Proposal" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "problem" TEXT NOT NULL,
    "solution" TEXT NOT NULL,
    "reachScore" INTEGER,
    "impactScore" INTEGER,
    "confidenceScore" INTEGER,
    "effortScore" INTEGER,
    "riceScore" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'proposed',
    "themeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Proposal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProposalEvidence" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "feedbackItemId" TEXT NOT NULL,
    "relevanceScore" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "quote" TEXT,

    CONSTRAINT "ProposalEvidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Spec" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "prdMarkdown" TEXT,
    "agentPrompt" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Spec_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FeedbackItem_sourceId_idx" ON "FeedbackItem"("sourceId");

-- CreateIndex
CREATE INDEX "FeedbackItem_channel_idx" ON "FeedbackItem"("channel");

-- CreateIndex
CREATE INDEX "FeedbackItem_createdAt_idx" ON "FeedbackItem"("createdAt");

-- CreateIndex
CREATE INDEX "FeedbackItem_processedAt_idx" ON "FeedbackItem"("processedAt");

-- CreateIndex
CREATE INDEX "FeedbackItem_sentiment_idx" ON "FeedbackItem"("sentiment");

-- CreateIndex
CREATE INDEX "FeedbackItem_urgency_idx" ON "FeedbackItem"("urgency");

-- CreateIndex
CREATE INDEX "Theme_category_idx" ON "Theme"("category");

-- CreateIndex
CREATE INDEX "Theme_opportunityScore_idx" ON "Theme"("opportunityScore");

-- CreateIndex
CREATE UNIQUE INDEX "FeedbackThemeLink_feedbackItemId_themeId_key" ON "FeedbackThemeLink"("feedbackItemId", "themeId");

-- CreateIndex
CREATE INDEX "Proposal_status_idx" ON "Proposal"("status");

-- CreateIndex
CREATE INDEX "Proposal_riceScore_idx" ON "Proposal"("riceScore");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalEvidence_proposalId_feedbackItemId_key" ON "ProposalEvidence"("proposalId", "feedbackItemId");

-- CreateIndex
CREATE UNIQUE INDEX "Spec_proposalId_key" ON "Spec"("proposalId");

-- AddForeignKey
ALTER TABLE "FeedbackItem" ADD CONSTRAINT "FeedbackItem_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "FeedbackSource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackThemeLink" ADD CONSTRAINT "FeedbackThemeLink_feedbackItemId_fkey" FOREIGN KEY ("feedbackItemId") REFERENCES "FeedbackItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FeedbackThemeLink" ADD CONSTRAINT "FeedbackThemeLink_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Proposal" ADD CONSTRAINT "Proposal_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "Theme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalEvidence" ADD CONSTRAINT "ProposalEvidence_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProposalEvidence" ADD CONSTRAINT "ProposalEvidence_feedbackItemId_fkey" FOREIGN KEY ("feedbackItemId") REFERENCES "FeedbackItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Spec" ADD CONSTRAINT "Spec_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
