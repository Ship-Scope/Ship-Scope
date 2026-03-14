import { prisma } from '../lib/prisma';
import { NotFound, BadRequest } from '../lib/errors';
import { logger } from '../lib/logger';
import { settingsService } from './settings.service';

// ─── Setting Keys ─────────────────────────────────────────

export const JIRA_SETTING_KEYS = {
  JIRA_HOST: 'jira_host',
  JIRA_EMAIL: 'jira_email',
  JIRA_API_TOKEN: 'jira_api_token',
  JIRA_PROJECT_KEY: 'jira_project_key',
  JIRA_ISSUE_TYPE: 'jira_issue_type',
} as const;

// ─── Types ────────────────────────────────────────────────

interface JiraConfig {
  host: string;
  email: string;
  apiToken: string;
  projectKey: string;
  issueType: string;
}

interface JiraProject {
  id: string;
  key: string;
  name: string;
}

interface JiraIssueType {
  id: string;
  name: string;
  subtask: boolean;
}

interface JiraCreateResponse {
  id: string;
  key: string;
  self: string;
}

interface JiraIssueResponse {
  id: string;
  key: string;
  fields: {
    summary: string;
    status: { name: string };
    issuetype: { name: string };
  };
}

// ─── Helpers ──────────────────────────────────────────────

async function getJiraConfig(): Promise<JiraConfig> {
  const [host, email, apiToken, projectKey, issueType] = await Promise.all([
    settingsService.getRaw(JIRA_SETTING_KEYS.JIRA_HOST),
    settingsService.getRaw(JIRA_SETTING_KEYS.JIRA_EMAIL),
    settingsService.getRaw(JIRA_SETTING_KEYS.JIRA_API_TOKEN),
    settingsService.getRaw(JIRA_SETTING_KEYS.JIRA_PROJECT_KEY),
    settingsService.getRaw(JIRA_SETTING_KEYS.JIRA_ISSUE_TYPE),
  ]);

  if (!host || !email || !apiToken) {
    throw BadRequest('Jira is not configured. Please set host, email, and API token in settings.');
  }

  return {
    host: host.replace(/\/+$/, ''), // strip trailing slashes
    email,
    apiToken,
    projectKey: projectKey || '',
    issueType: issueType || 'Story',
  };
}

function jiraHeaders(config: JiraConfig): Record<string, string> {
  const auth = Buffer.from(`${config.email}:${config.apiToken}`).toString('base64');
  return {
    Authorization: `Basic ${auth}`,
    'Content-Type': 'application/json',
    Accept: 'application/json',
  };
}

async function jiraFetch<T>(
  config: JiraConfig,
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${config.host}/rest/api/3${path}`;
  const response = await fetch(url, {
    ...options,
    headers: { ...jiraHeaders(config), ...(options.headers as Record<string, string>) },
  });

  if (!response.ok) {
    const body = await response.text();
    logger.error(`Jira API error [${response.status}]: ${body}`);
    throw BadRequest(`Jira API error (${response.status}): ${body}`);
  }

  return response.json() as Promise<T>;
}

// ─── Service ──────────────────────────────────────────────

export const jiraService = {
  /**
   * Test the Jira connection with current credentials.
   */
  async testConnection(): Promise<{ success: boolean; message: string; serverTitle?: string }> {
    try {
      const config = await getJiraConfig();
      const data = await jiraFetch<{ serverTitle?: string; baseUrl?: string }>(
        config,
        '/serverInfo',
      );
      return {
        success: true,
        message: `Connected to ${data.serverTitle || config.host}`,
        serverTitle: data.serverTitle,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Unknown error connecting to Jira',
      };
    }
  },

  /**
   * List available projects that the configured user has access to.
   */
  async listProjects(): Promise<JiraProject[]> {
    const config = await getJiraConfig();
    const data = await jiraFetch<JiraProject[]>(config, '/project');
    return data.map((p) => ({ id: p.id, key: p.key, name: p.name }));
  },

  /**
   * List issue types for the configured project.
   */
  async listIssueTypes(): Promise<JiraIssueType[]> {
    const config = await getJiraConfig();
    if (!config.projectKey) {
      throw BadRequest('No Jira project key configured');
    }
    const data = await jiraFetch<{ issueTypes: JiraIssueType[] }>(
      config,
      `/project/${encodeURIComponent(config.projectKey)}`,
    );
    return (data.issueTypes || [])
      .filter((t) => !t.subtask)
      .map((t) => ({ id: t.id, name: t.name, subtask: t.subtask }));
  },

  /**
   * Export a proposal to Jira as a new issue.
   */
  async exportProposal(proposalId: string): Promise<{
    id: string;
    jiraKey: string;
    jiraUrl: string;
  }> {
    const config = await getJiraConfig();

    if (!config.projectKey) {
      throw BadRequest('No Jira project key configured');
    }

    // Check if already exported
    const existing = await prisma.jiraIssue.findUnique({ where: { proposalId } });
    if (existing) {
      throw BadRequest(`Proposal already exported to Jira as ${existing.jiraKey}`);
    }

    // Get proposal with evidence
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        theme: { select: { name: true } },
        evidence: {
          take: 10,
          orderBy: { relevanceScore: 'desc' },
          include: {
            feedbackItem: { select: { content: true, author: true, channel: true } },
          },
        },
      },
    });

    if (!proposal) throw NotFound('Proposal');

    // Build description in Atlassian Document Format (ADF)
    const descriptionAdf = buildJiraDescription(proposal);

    const issueData = {
      fields: {
        project: { key: config.projectKey },
        summary: proposal.title,
        description: descriptionAdf,
        issuetype: { name: config.issueType },
        labels: [
          'shipscope',
          proposal.theme?.name ? `theme-${slugify(proposal.theme.name)}` : '',
        ].filter(Boolean),
      },
    };

    const result = await jiraFetch<JiraCreateResponse>(config, '/issue', {
      method: 'POST',
      body: JSON.stringify(issueData),
    });

    const jiraUrl = `${config.host}/browse/${result.key}`;

    // Store the link in our database
    const jiraIssue = await prisma.jiraIssue.create({
      data: {
        proposalId,
        jiraKey: result.key,
        jiraId: result.id,
        jiraUrl,
        issueType: config.issueType,
        summary: proposal.title,
        status: 'To Do',
      },
    });

    logger.info(`Exported proposal ${proposalId} to Jira as ${result.key}`);

    return {
      id: jiraIssue.id,
      jiraKey: result.key,
      jiraUrl,
    };
  },

  /**
   * Sync the status of a Jira issue back to the local record.
   */
  async syncStatus(proposalId: string): Promise<{ jiraKey: string; status: string }> {
    const config = await getJiraConfig();
    const jiraIssue = await prisma.jiraIssue.findUnique({ where: { proposalId } });
    if (!jiraIssue) throw NotFound('Jira issue for this proposal');

    const issue = await jiraFetch<JiraIssueResponse>(
      config,
      `/issue/${encodeURIComponent(jiraIssue.jiraKey)}?fields=status,summary,issuetype`,
    );

    const updatedStatus = issue.fields.status.name;

    await prisma.jiraIssue.update({
      where: { proposalId },
      data: {
        status: updatedStatus,
        summary: issue.fields.summary,
        syncedAt: new Date(),
      },
    });

    return { jiraKey: jiraIssue.jiraKey, status: updatedStatus };
  },

  /**
   * Get the Jira issue linked to a proposal (if any).
   */
  async getByProposal(proposalId: string) {
    return prisma.jiraIssue.findUnique({ where: { proposalId } });
  },

  /**
   * List all exported Jira issues.
   */
  async listExported() {
    return prisma.jiraIssue.findMany({
      include: {
        proposal: { select: { id: true, title: true, status: true, riceScore: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Unlink a Jira issue from a proposal (does not delete the Jira issue).
   */
  async unlink(proposalId: string): Promise<void> {
    const jiraIssue = await prisma.jiraIssue.findUnique({ where: { proposalId } });
    if (!jiraIssue) throw NotFound('Jira issue link for this proposal');
    await prisma.jiraIssue.delete({ where: { proposalId } });
    logger.info(`Unlinked Jira issue ${jiraIssue.jiraKey} from proposal ${proposalId}`);
  },

  // ─── Theme → Epic + Bulk Export ────────────────────────

  /**
   * Export a theme as a Jira Epic, then export all its proposals as Stories
   * linked under that Epic. This is the "one-click roadmap push" feature.
   */
  async exportThemeAsEpic(themeId: string): Promise<{
    epicKey: string;
    epicUrl: string;
    storiesCreated: number;
    storiesSkipped: number;
  }> {
    const config = await getJiraConfig();
    if (!config.projectKey) throw BadRequest('No Jira project key configured');

    const theme = await prisma.theme.findUnique({
      where: { id: themeId },
      include: {
        proposals: {
          include: {
            theme: { select: { name: true } },
            jiraIssue: true,
            evidence: {
              take: 5,
              orderBy: { relevanceScore: 'desc' },
              include: {
                feedbackItem: { select: { content: true, author: true, channel: true } },
              },
            },
          },
        },
      },
    });

    if (!theme) throw NotFound('Theme');

    // Check if epic already exists
    if (theme.jiraEpicKey) {
      throw BadRequest(`Theme already exported to Jira as Epic ${theme.jiraEpicKey}`);
    }

    // 1. Create Epic
    const epicData = {
      fields: {
        project: { key: config.projectKey },
        summary: theme.name,
        description: buildEpicDescription(theme),
        issuetype: { name: 'Epic' },
        labels: ['shipscope', `category-${theme.category || 'general'}`],
      },
    };

    const epicResult = await jiraFetch<JiraCreateResponse>(config, '/issue', {
      method: 'POST',
      body: JSON.stringify(epicData),
    });

    const epicUrl = `${config.host}/browse/${epicResult.key}`;

    // Save Epic link on theme
    await prisma.theme.update({
      where: { id: themeId },
      data: { jiraEpicKey: epicResult.key, jiraEpicUrl: epicUrl },
    });

    // 2. Create Stories for each proposal under the Epic
    let storiesCreated = 0;
    let storiesSkipped = 0;

    for (const proposal of theme.proposals) {
      if (proposal.jiraIssue) {
        storiesSkipped++;
        continue;
      }

      try {
        const descriptionAdf = buildJiraDescription(proposal);

        const storyData = {
          fields: {
            project: { key: config.projectKey },
            summary: proposal.title,
            description: descriptionAdf,
            issuetype: { name: config.issueType || 'Story' },
            labels: ['shipscope', `theme-${slugify(theme.name)}`],
            parent: { key: epicResult.key },
          },
        };

        const storyResult = await jiraFetch<JiraCreateResponse>(config, '/issue', {
          method: 'POST',
          body: JSON.stringify(storyData),
        });

        await prisma.jiraIssue.create({
          data: {
            proposalId: proposal.id,
            jiraKey: storyResult.key,
            jiraId: storyResult.id,
            jiraUrl: `${config.host}/browse/${storyResult.key}`,
            issueType: config.issueType || 'Story',
            summary: proposal.title,
            status: 'To Do',
            epicKey: epicResult.key,
          },
        });

        storiesCreated++;
      } catch (err) {
        logger.error(`Failed to create Jira story for proposal ${proposal.id}: ${err}`);
        storiesSkipped++;
      }
    }

    logger.info(
      `Exported theme ${themeId} as Epic ${epicResult.key} with ${storiesCreated} stories`,
    );

    return {
      epicKey: epicResult.key,
      epicUrl,
      storiesCreated,
      storiesSkipped,
    };
  },

  // ─── Spec Attachment ───────────────────────────────────

  /**
   * Attach the generated PRD spec as a comment on the linked Jira issue.
   */
  async attachSpec(proposalId: string): Promise<{ jiraKey: string; commented: boolean }> {
    const config = await getJiraConfig();

    const jiraIssue = await prisma.jiraIssue.findUnique({ where: { proposalId } });
    if (!jiraIssue) throw NotFound('No Jira issue linked to this proposal');

    const spec = await prisma.spec.findUnique({ where: { proposalId } });
    if (!spec || !spec.prdMarkdown) throw BadRequest('No spec generated for this proposal');

    // Add PRD as a comment (ADF format)
    const commentBody = buildSpecComment(spec.prdMarkdown, spec.version);

    await jiraFetch(config, `/issue/${encodeURIComponent(jiraIssue.jiraKey)}/comment`, {
      method: 'POST',
      body: JSON.stringify({ body: commentBody }),
    });

    logger.info(`Attached spec v${spec.version} to Jira issue ${jiraIssue.jiraKey}`);
    return { jiraKey: jiraIssue.jiraKey, commented: true };
  },

  // ─── Jira → ShipScope Feedback Import ──────────────────

  /**
   * Import issues from a Jira project (bugs, stories with customer labels)
   * as ShipScope feedback items. This creates a bi-directional flow.
   */
  async importFeedbackFromJira(
    options: {
      jql?: string;
      maxResults?: number;
    } = {},
  ): Promise<{ imported: number; skipped: number; sourceId: string }> {
    const config = await getJiraConfig();
    if (!config.projectKey) throw BadRequest('No Jira project key configured');

    const jql =
      options.jql ||
      `project = ${config.projectKey} AND type in (Bug, Story) AND status != Done ORDER BY created DESC`;
    const maxResults = Math.min(options.maxResults || 50, 100);

    const searchResult = await jiraFetch<{
      issues: {
        key: string;
        fields: {
          summary: string;
          description?: unknown;
          issuetype: { name: string };
          reporter?: { displayName?: string; emailAddress?: string };
          created: string;
          labels: string[];
          status: { name: string };
        };
      }[];
      total: number;
    }>(config, '/search/jql', {
      method: 'POST',
      body: JSON.stringify({
        jql,
        maxResults,
        fields: ['summary', 'description', 'issuetype', 'reporter', 'created', 'labels', 'status'],
      }),
    });

    // Create a feedback source for this import
    const source = await prisma.feedbackSource.create({
      data: {
        name: `Jira Import (${config.projectKey})`,
        type: 'jira',
        metadata: { jql, projectKey: config.projectKey, importedAt: new Date().toISOString() },
      },
    });

    let imported = 0;
    let skipped = 0;

    for (const issue of searchResult.issues) {
      // Skip if already imported (check by metadata)
      const existing = await prisma.feedbackItem.findFirst({
        where: {
          metadata: { path: ['jira_key'], equals: issue.key },
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const descriptionText = extractTextFromAdf(issue.fields.description);
      const content = descriptionText
        ? `[${issue.key}] ${issue.fields.summary}: ${descriptionText}`
        : `[${issue.key}] ${issue.fields.summary}`;

      await prisma.feedbackItem.create({
        data: {
          content: content.slice(0, 5000),
          sourceId: source.id,
          author: issue.fields.reporter?.displayName || null,
          email: issue.fields.reporter?.emailAddress || null,
          channel: `jira_${issue.fields.issuetype.name.toLowerCase()}`,
          metadata: {
            jira_key: issue.key,
            jira_status: issue.fields.status.name,
            jira_labels: issue.fields.labels,
            jira_url: `${config.host}/browse/${issue.key}`,
          },
        },
      });
      imported++;
    }

    // Update source row count
    await prisma.feedbackSource.update({
      where: { id: source.id },
      data: { rowCount: imported },
    });

    return { imported, skipped, sourceId: source.id };
  },

  // ─── Bulk Sync All Statuses ────────────────────────────

  /**
   * Sync status for ALL linked Jira issues. Also auto-updates
   * proposal status when Jira issue reaches "Done".
   */
  async syncAllStatuses(): Promise<{
    synced: number;
    autoShipped: number;
    errors: number;
  }> {
    const config = await getJiraConfig();
    const allIssues = await prisma.jiraIssue.findMany({
      include: { proposal: { select: { id: true, status: true } } },
    });

    let synced = 0;
    let autoShipped = 0;
    let errors = 0;

    for (const jiraIssue of allIssues) {
      try {
        const issue = await jiraFetch<JiraIssueResponse>(
          config,
          `/issue/${encodeURIComponent(jiraIssue.jiraKey)}?fields=status,summary`,
        );

        const newStatus = issue.fields.status.name;

        await prisma.jiraIssue.update({
          where: { id: jiraIssue.id },
          data: { status: newStatus, summary: issue.fields.summary, syncedAt: new Date() },
        });

        // Auto-mark proposal as "shipped" when Jira issue is Done
        const doneStatuses = ['done', 'closed', 'resolved', 'released'];
        if (
          doneStatuses.includes(newStatus.toLowerCase()) &&
          jiraIssue.proposal.status !== 'shipped'
        ) {
          await prisma.proposal.update({
            where: { id: jiraIssue.proposal.id },
            data: { status: 'shipped' },
          });
          autoShipped++;
          logger.info(
            `Auto-shipped proposal ${jiraIssue.proposal.id} (Jira ${jiraIssue.jiraKey} → ${newStatus})`,
          );
        }

        synced++;
      } catch (err) {
        logger.error(`Failed to sync Jira issue ${jiraIssue.jiraKey}: ${err}`);
        errors++;
      }
    }

    return { synced, autoShipped, errors };
  },

  // ─── Jira Webhook Handler ──────────────────────────────

  /**
   * Handle incoming Jira webhooks for real-time status sync.
   * Jira sends webhooks on issue:updated events.
   */
  async handleWebhook(payload: {
    webhookEvent?: string;
    issue?: {
      key: string;
      fields: {
        status: { name: string };
        summary: string;
      };
    };
  }): Promise<{ processed: boolean; jiraKey?: string }> {
    if (!payload.issue?.key) {
      return { processed: false };
    }

    const jiraKey = payload.issue.key;
    const jiraIssue = await prisma.jiraIssue.findUnique({ where: { jiraKey } });

    if (!jiraIssue) {
      // Not a tracked issue — ignore
      return { processed: false };
    }

    const newStatus = payload.issue.fields.status.name;

    await prisma.jiraIssue.update({
      where: { jiraKey },
      data: {
        status: newStatus,
        summary: payload.issue.fields.summary,
        syncedAt: new Date(),
      },
    });

    // Auto-ship proposal if Jira issue is done
    const doneStatuses = ['done', 'closed', 'resolved', 'released'];
    if (doneStatuses.includes(newStatus.toLowerCase())) {
      const proposal = await prisma.proposal.findUnique({
        where: { id: jiraIssue.proposalId },
        select: { status: true },
      });
      if (proposal && proposal.status !== 'shipped') {
        await prisma.proposal.update({
          where: { id: jiraIssue.proposalId },
          data: { status: 'shipped' },
        });
        logger.info(
          `Webhook auto-shipped proposal ${jiraIssue.proposalId} (Jira ${jiraKey} → ${newStatus})`,
        );
      }
    }

    return { processed: true, jiraKey };
  },

  // ─── Dashboard Data ────────────────────────────────────

  /**
   * Get Jira sync summary for the dashboard widget.
   */
  async getDashboardSummary(): Promise<{
    totalExported: number;
    byStatus: Record<string, number>;
    recentExports: {
      jiraKey: string;
      summary: string;
      status: string;
      jiraUrl: string;
      createdAt: string;
    }[];
    epicCount: number;
  }> {
    const [allIssues, epicCount] = await Promise.all([
      prisma.jiraIssue.findMany({
        select: { jiraKey: true, summary: true, status: true, jiraUrl: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.theme.count({ where: { jiraEpicKey: { not: null } } }),
    ]);

    const byStatus: Record<string, number> = {};
    for (const issue of allIssues) {
      byStatus[issue.status] = (byStatus[issue.status] || 0) + 1;
    }

    return {
      totalExported: allIssues.length,
      byStatus,
      recentExports: allIssues
        .slice(0, 5)
        .map(
          (i: {
            jiraKey: string;
            summary: string;
            status: string;
            jiraUrl: string;
            createdAt: Date;
          }) => ({
            ...i,
            createdAt: i.createdAt.toISOString(),
          }),
        ),
      epicCount,
    };
  },
};

// ─── Helpers ──────────────────────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 50);
}

interface ProposalWithEvidence {
  title: string;
  problem: string;
  solution: string;
  reachScore: number | null;
  impactScore: number | null;
  confidenceScore: number | null;
  effortScore: number | null;
  riceScore: number | null;
  theme: { name: string } | null;
  evidence: {
    feedbackItem: { content: string; author: string | null; channel: string | null };
  }[];
}

/**
 * Build a Jira description using Atlassian Document Format (ADF).
 */
function buildJiraDescription(proposal: ProposalWithEvidence) {
  const content: unknown[] = [];

  // Problem section
  content.push(heading('Problem'));
  content.push(paragraph(proposal.problem));

  // Solution section
  content.push(heading('Solution'));
  content.push(paragraph(proposal.solution));

  // RICE scores
  if (proposal.riceScore !== null) {
    content.push(heading('RICE Score'));
    const scores = [
      `Reach: ${proposal.reachScore ?? '-'}`,
      `Impact: ${proposal.impactScore ?? '-'}`,
      `Confidence: ${proposal.confidenceScore ?? '-'}`,
      `Effort: ${proposal.effortScore ?? '-'}`,
      `Total: ${proposal.riceScore?.toFixed(1) ?? '-'}`,
    ];
    content.push({
      type: 'bulletList',
      content: scores.map((s) => ({
        type: 'listItem',
        content: [paragraph(s)],
      })),
    });
  }

  // Theme
  if (proposal.theme) {
    content.push(heading('Theme'));
    content.push(paragraph(proposal.theme.name));
  }

  // Customer evidence
  if (proposal.evidence.length > 0) {
    content.push(heading('Customer Evidence'));
    content.push({
      type: 'bulletList',
      content: proposal.evidence.map((ev) => ({
        type: 'listItem',
        content: [
          paragraph(
            `"${ev.feedbackItem.content.slice(0, 200)}"${ev.feedbackItem.author ? ` — ${ev.feedbackItem.author}` : ''}${ev.feedbackItem.channel ? ` (${ev.feedbackItem.channel})` : ''}`,
          ),
        ],
      })),
    });
  }

  // Generated by
  content.push({
    type: 'paragraph',
    content: [
      {
        type: 'text',
        text: 'Generated by ShipScope',
        marks: [{ type: 'em' }],
      },
    ],
  });

  return {
    type: 'doc',
    version: 1,
    content,
  };
}

function heading(text: string) {
  return {
    type: 'heading',
    attrs: { level: 3 },
    content: [{ type: 'text', text }],
  };
}

function paragraph(text: string) {
  return {
    type: 'paragraph',
    content: [{ type: 'text', text }],
  };
}

/**
 * Build ADF description for a Jira Epic from a Theme.
 */
function buildEpicDescription(theme: {
  name: string;
  description: string;
  feedbackCount: number;
  avgSentiment: number;
  opportunityScore: number;
  category: string | null;
}) {
  const content: unknown[] = [];

  content.push(heading('Theme Overview'));
  content.push(paragraph(theme.description));

  content.push(heading('Metrics'));
  content.push({
    type: 'bulletList',
    content: [
      `Feedback Count: ${theme.feedbackCount}`,
      `Average Sentiment: ${theme.avgSentiment.toFixed(2)}`,
      `Opportunity Score: ${theme.opportunityScore.toFixed(1)}`,
      `Category: ${theme.category || 'Uncategorized'}`,
    ].map((s) => ({
      type: 'listItem',
      content: [paragraph(s)],
    })),
  });

  content.push({
    type: 'paragraph',
    content: [{ type: 'text', text: 'Generated by ShipScope', marks: [{ type: 'em' }] }],
  });

  return { type: 'doc', version: 1, content };
}

/**
 * Build ADF comment body for attaching a spec/PRD.
 */
function buildSpecComment(prdMarkdown: string, version: number) {
  const content: unknown[] = [];

  content.push({
    type: 'heading',
    attrs: { level: 2 },
    content: [{ type: 'text', text: `📋 PRD Spec (v${version}) — Generated by ShipScope` }],
  });

  // Convert markdown sections to ADF paragraphs
  const lines = prdMarkdown.split('\n');
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('## ')) {
      content.push(heading(trimmed.slice(3)));
    } else if (trimmed.startsWith('# ')) {
      content.push({
        type: 'heading',
        attrs: { level: 2 },
        content: [{ type: 'text', text: trimmed.slice(2) }],
      });
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      content.push({
        type: 'bulletList',
        content: [
          {
            type: 'listItem',
            content: [paragraph(trimmed.slice(2))],
          },
        ],
      });
    } else {
      content.push(paragraph(trimmed));
    }
  }

  return { type: 'doc', version: 1, content };
}

/**
 * Extract plain text from Jira's Atlassian Document Format (ADF).
 * Used when importing Jira issues as feedback.
 */
function extractTextFromAdf(adf: unknown): string {
  if (!adf || typeof adf !== 'object') return '';

  const doc = adf as { content?: unknown[] };
  if (!doc.content || !Array.isArray(doc.content)) return '';

  const texts: string[] = [];

  function walk(node: unknown) {
    if (!node || typeof node !== 'object') return;
    const n = node as { type?: string; text?: string; content?: unknown[] };
    if (n.type === 'text' && n.text) {
      texts.push(n.text);
    }
    if (n.content && Array.isArray(n.content)) {
      n.content.forEach(walk);
    }
  }

  doc.content.forEach(walk);
  return texts.join(' ').slice(0, 2000);
}
