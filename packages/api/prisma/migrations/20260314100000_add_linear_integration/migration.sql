-- AlterTable
ALTER TABLE "Theme" ADD COLUMN     "linearProjectId" TEXT,
ADD COLUMN     "linearProjectUrl" TEXT;

-- CreateTable
CREATE TABLE "linear_issues" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "linearId" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "linearUrl" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Backlog',
    "priority" INTEGER NOT NULL DEFAULT 0,
    "issueTitle" TEXT NOT NULL,
    "projectId" TEXT,
    "projectName" TEXT,
    "labelIds" TEXT[],
    "cycleId" TEXT,
    "estimate" INTEGER,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "linear_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "linear_issues_proposalId_idx" ON "linear_issues"("proposalId");

-- CreateIndex
CREATE INDEX "linear_issues_teamId_idx" ON "linear_issues"("teamId");

-- CreateIndex
CREATE INDEX "linear_issues_projectId_idx" ON "linear_issues"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "linear_issues_proposalId_key" ON "linear_issues"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "linear_issues_linearId_key" ON "linear_issues"("linearId");

-- CreateIndex
CREATE UNIQUE INDEX "linear_issues_identifier_key" ON "linear_issues"("identifier");

-- AddForeignKey
ALTER TABLE "linear_issues" ADD CONSTRAINT "linear_issues_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
