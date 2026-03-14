-- CreateTable
CREATE TABLE "jira_issues" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "jiraKey" TEXT NOT NULL,
    "jiraId" TEXT NOT NULL,
    "jiraUrl" TEXT NOT NULL,
    "issueType" TEXT NOT NULL DEFAULT 'Story',
    "status" TEXT NOT NULL DEFAULT 'To Do',
    "summary" TEXT NOT NULL,
    "epicKey" TEXT,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jira_issues_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "jira_issues_proposalId_key" ON "jira_issues"("proposalId");

-- CreateIndex
CREATE UNIQUE INDEX "jira_issues_jiraKey_key" ON "jira_issues"("jiraKey");

-- CreateIndex
CREATE INDEX "jira_issues_proposalId_idx" ON "jira_issues"("proposalId");

-- CreateIndex
CREATE INDEX "jira_issues_epicKey_idx" ON "jira_issues"("epicKey");

-- AlterTable - Add Jira Epic fields to Theme
ALTER TABLE "Theme" ADD COLUMN "jiraEpicKey" TEXT;
ALTER TABLE "Theme" ADD COLUMN "jiraEpicUrl" TEXT;

-- AddForeignKey
ALTER TABLE "jira_issues" ADD CONSTRAINT "jira_issues_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
