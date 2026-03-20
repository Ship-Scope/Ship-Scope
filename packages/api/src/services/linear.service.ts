import { createHmac, timingSafeEqual } from 'node:crypto';
import { prisma } from '../lib/prisma';
import { NotFound, BadRequest } from '../lib/errors';
import { logger } from '../lib/logger';
import { settingsService } from './settings.service';

// ─── Setting Keys ─────────────────────────────────────────

export const LINEAR_SETTING_KEYS = {
  LINEAR_API_KEY: 'linear_api_key',
  LINEAR_TEAM_ID: 'linear_team_id',
  LINEAR_PROJECT_ID: 'linear_project_id',
  LINEAR_DONE_STATES: 'linear_done_states',
  LINEAR_DEFAULT_LABEL_ID: 'linear_default_label_id',
  LINEAR_CYCLE_ID: 'linear_cycle_id',
  LINEAR_WEBHOOK_SECRET: 'linear_webhook_secret',
  LINEAR_WEBHOOK_ID: 'linear_webhook_id',
} as const;

// ─── Types ────────────────────────────────────────────────

interface LinearConfig {
  apiKey: string;
  teamId: string;
  projectId: string;
  doneStates: string[];
  defaultLabelId: string;
  cycleId: string;
  webhookSecret: string;
  webhookId: string;
}

interface LinearTeam {
  id: string;
  name: string;
  key: string;
}

interface LinearProject {
  id: string;
  name: string;
  url: string;
  state: string;
}

interface LinearLabel {
  id: string;
  name: string;
  color: string;
}

interface LinearCycle {
  id: string;
  name: string | null;
  number: number;
  startsAt: string;
  endsAt: string;
}

interface LinearState {
  id: string;
  name: string;
  type: string; // backlog, unstarted, started, completed, cancelled
  color: string;
}

interface LinearIssueResponse {
  id: string;
  identifier: string;
  title: string;
  url: string;
  priority: number;
  estimate: number | null;
  state: { id: string; name: string; type: string };
  team: { id: string; key: string };
  project: { id: string; name: string } | null;
  labels: { nodes: { id: string; name: string }[] };
}

// ─── RICE tier helpers ────────────────────────────────────

function getRiceTier(riceScore: number | null): { label: string; color: string } {
  if (riceScore === null) return { label: 'Unscored', color: '#94A3B8' };
  if (riceScore >= 8) return { label: 'High Priority', color: '#EF4444' };
  if (riceScore >= 4) return { label: 'Medium Priority', color: '#F59E0B' };
  return { label: 'Low Priority', color: '#22C55E' };
}

function riceToPriority(riceScore: number | null): number {
  if (riceScore === null) return 0; // No priority
  if (riceScore >= 8) return 1; // Urgent
  if (riceScore >= 5) return 2; // High
  if (riceScore >= 3) return 3; // Medium
  return 4; // Low
}

function effortToEstimate(effortScore: number | null): number | null {
  if (effortScore === null) return null;
  // Map 1-10 effort → fibonacci estimates (1, 2, 3, 5, 8, 13, 21)
  const map: Record<number, number> = {
    1: 1,
    2: 1,
    3: 2,
    4: 3,
    5: 5,
    6: 5,
    7: 8,
    8: 13,
    9: 21,
    10: 21,
  };
  return map[effortScore] ?? null;
}

// ─── Default done states ──────────────────────────────────

const DEFAULT_DONE_STATES = ['done', 'completed', 'closed', 'shipped', 'released', 'cancelled'];

// ─── Helpers ──────────────────────────────────────────────

async function getLinearConfig(): Promise<LinearConfig> {
  const [apiKey, teamId, projectId, doneStates, defaultLabelId, cycleId, webhookSecret, webhookId] =
    await Promise.all([
      settingsService.getRaw(LINEAR_SETTING_KEYS.LINEAR_API_KEY),
      settingsService.getRaw(LINEAR_SETTING_KEYS.LINEAR_TEAM_ID),
      settingsService.getRaw(LINEAR_SETTING_KEYS.LINEAR_PROJECT_ID),
      settingsService.getRaw(LINEAR_SETTING_KEYS.LINEAR_DONE_STATES),
      settingsService.getRaw(LINEAR_SETTING_KEYS.LINEAR_DEFAULT_LABEL_ID),
      settingsService.getRaw(LINEAR_SETTING_KEYS.LINEAR_CYCLE_ID),
      settingsService.getRaw(LINEAR_SETTING_KEYS.LINEAR_WEBHOOK_SECRET),
      settingsService.getRaw(LINEAR_SETTING_KEYS.LINEAR_WEBHOOK_ID),
    ]);

  if (!apiKey) {
    throw BadRequest('Linear is not configured. Please set your API key in settings.');
  }

  const parsedDoneStates = doneStates
    ? doneStates
        .split(',')
        .map((s) => s.trim().toLowerCase())
        .filter(Boolean)
    : DEFAULT_DONE_STATES;

  return {
    apiKey,
    teamId: teamId || '',
    projectId: projectId || '',
    doneStates: parsedDoneStates,
    defaultLabelId: defaultLabelId || '',
    cycleId: cycleId || '',
    webhookSecret: webhookSecret || '',
    webhookId: webhookId || '',
  };
}

async function linearGraphQL<T>(
  config: LinearConfig,
  query: string,
  variables: Record<string, unknown> = {},
): Promise<T> {
  const response = await fetch('https://api.linear.app/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: config.apiKey,
    },
    body: JSON.stringify({ query, variables }),
  });

  if (!response.ok) {
    const body = await response.text();
    logger.error(`Linear API error [${response.status}]: ${body}`);
    throw BadRequest(`Linear API error (${response.status}): ${body}`);
  }

  const json = (await response.json()) as { data?: T; errors?: { message: string }[] };

  if (json.errors && json.errors.length > 0) {
    const msg = json.errors.map((e) => e.message).join('; ');
    logger.error(`Linear GraphQL errors: ${msg}`);
    throw BadRequest(`Linear API error: ${msg}`);
  }

  return json.data as T;
}

// ─── Webhook Signature Verification ───────────────────────

/**
 * Verify Linear webhook signature using HMAC-SHA256.
 * Linear sends the signature in the `linear-signature` header.
 * Also checks `webhookTimestamp` for replay protection (60s window).
 */
export function verifyWebhookSignature(
  rawBody: Buffer,
  signature: string,
  secret: string,
): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  try {
    return timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

// ─── Service ──────────────────────────────────────────────

export const linearService = {
  /**
   * Test the Linear connection with current credentials.
   */
  async testConnection(): Promise<{ success: boolean; message: string; userName?: string }> {
    try {
      const config = await getLinearConfig();
      const data = await linearGraphQL<{
        viewer: { id: string; name: string; email: string };
      }>(config, `query { viewer { id name email } }`);
      return {
        success: true,
        message: `Connected as ${data.viewer.name} (${data.viewer.email})`,
        userName: data.viewer.name,
      };
    } catch (err) {
      return {
        success: false,
        message: err instanceof Error ? err.message : 'Unknown error connecting to Linear',
      };
    }
  },

  /**
   * List teams the authenticated user belongs to.
   */
  async listTeams(): Promise<LinearTeam[]> {
    const config = await getLinearConfig();
    const data = await linearGraphQL<{
      teams: { nodes: LinearTeam[] };
    }>(config, `query { teams { nodes { id name key } } }`);
    return data.teams.nodes;
  },

  /**
   * List projects for the configured team.
   */
  async listProjects(): Promise<LinearProject[]> {
    const config = await getLinearConfig();
    if (!config.teamId) throw BadRequest('No Linear team configured');
    const data = await linearGraphQL<{
      team: { projects: { nodes: LinearProject[] } };
    }>(
      config,
      `query($teamId: String!) {
        team(id: $teamId) {
          projects(filter: { state: { in: ["planned", "started", "paused"] } }) {
            nodes { id name url state }
          }
        }
      }`,
      { teamId: config.teamId },
    );
    return data.team.projects.nodes;
  },

  /**
   * List labels for the configured team.
   */
  async listLabels(): Promise<LinearLabel[]> {
    const config = await getLinearConfig();
    if (!config.teamId) throw BadRequest('No Linear team configured');
    const data = await linearGraphQL<{
      team: { labels: { nodes: LinearLabel[] } };
    }>(
      config,
      `query($teamId: String!) {
        team(id: $teamId) {
          labels { nodes { id name color } }
        }
      }`,
      { teamId: config.teamId },
    );
    return data.team.labels.nodes;
  },

  /**
   * List workflow states for the configured team.
   */
  async listStates(): Promise<LinearState[]> {
    const config = await getLinearConfig();
    if (!config.teamId) throw BadRequest('No Linear team configured');
    const data = await linearGraphQL<{
      team: { states: { nodes: LinearState[] } };
    }>(
      config,
      `query($teamId: String!) {
        team(id: $teamId) {
          states { nodes { id name type color } }
        }
      }`,
      { teamId: config.teamId },
    );
    return data.team.states.nodes;
  },

  /**
   * List active cycles (sprints) for the configured team.
   */
  async listCycles(): Promise<LinearCycle[]> {
    const config = await getLinearConfig();
    if (!config.teamId) throw BadRequest('No Linear team configured');
    const data = await linearGraphQL<{
      team: { cycles: { nodes: LinearCycle[] } };
    }>(
      config,
      `query($teamId: String!) {
        team(id: $teamId) {
          cycles(filter: { isActive: { eq: true } }) {
            nodes { id name number startsAt endsAt }
          }
        }
      }`,
      { teamId: config.teamId },
    );
    return data.team.cycles.nodes;
  },

  /**
   * Export a proposal to Linear as a new issue.
   */
  async exportProposal(proposalId: string): Promise<{
    id: string;
    identifier: string;
    linearUrl: string;
  }> {
    const config = await getLinearConfig();

    if (!config.teamId) {
      throw BadRequest('No Linear team configured. Select a team in settings.');
    }

    // Check if already exported
    const existing = await prisma.linearIssue.findUnique({ where: { proposalId } });
    if (existing) {
      throw BadRequest(`Proposal already exported to Linear as ${existing.identifier}`);
    }

    // Get proposal with evidence
    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      include: {
        theme: { select: { name: true, category: true } },
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

    // Build description in Linear's markdown format
    const description = buildLinearDescription(proposal);

    // Map RICE to Linear priority (0=No, 1=Urgent, 2=High, 3=Medium, 4=Low)
    const priority = riceToPriority(proposal.riceScore);
    const estimate = effortToEstimate(proposal.effortScore);

    // Get or create RICE tier label
    const riceTier = getRiceTier(proposal.riceScore);
    const labelId = await getOrCreateLabel(config, riceTier.label, riceTier.color);

    // Build label IDs
    const labelIds: string[] = [];
    if (labelId) labelIds.push(labelId);
    if (config.defaultLabelId) labelIds.push(config.defaultLabelId);

    // Category label
    if (proposal.theme?.category) {
      const catLabel = await getOrCreateLabel(
        config,
        formatCategory(proposal.theme.category),
        getCategoryColor(proposal.theme.category),
      );
      if (catLabel) labelIds.push(catLabel);
    }

    // Build mutation input
    const input: Record<string, unknown> = {
      teamId: config.teamId,
      title: proposal.title,
      description,
      priority,
      labelIds: [...new Set(labelIds)],
    };

    if (estimate !== null) input.estimate = estimate;
    if (config.projectId) input.projectId = config.projectId;
    if (config.cycleId) input.cycleId = config.cycleId;

    const data = await linearGraphQL<{
      issueCreate: {
        success: boolean;
        issue: LinearIssueResponse;
      };
    }>(
      config,
      `mutation($input: IssueCreateInput!) {
        issueCreate(input: $input) {
          success
          issue {
            id identifier title url priority estimate
            state { id name type }
            team { id key }
            project { id name }
            labels { nodes { id name } }
          }
        }
      }`,
      { input },
    );

    if (!data.issueCreate.success) {
      throw BadRequest('Failed to create Linear issue');
    }

    const issue = data.issueCreate.issue;

    // Store the link in our database
    const linearIssue = await prisma.linearIssue.create({
      data: {
        proposalId,
        linearId: issue.id,
        identifier: issue.identifier,
        linearUrl: issue.url,
        teamId: config.teamId,
        status: issue.state.name,
        priority: issue.priority,
        issueTitle: proposal.title,
        projectId: issue.project?.id || null,
        projectName: issue.project?.name || null,
        labelIds: labelIds,
        cycleId: config.cycleId || null,
        estimate: estimate,
      },
    });

    logger.info(`Exported proposal ${proposalId} to Linear as ${issue.identifier}`);

    return {
      id: linearIssue.id,
      identifier: issue.identifier,
      linearUrl: issue.url,
    };
  },

  /**
   * Sync the status of a Linear issue back to the local record.
   */
  async syncStatus(
    proposalId: string,
  ): Promise<{ identifier: string; status: string; titleUpdated: boolean }> {
    const config = await getLinearConfig();
    const linearIssue = await prisma.linearIssue.findUnique({ where: { proposalId } });
    if (!linearIssue) throw NotFound('Linear issue for this proposal');

    const data = await linearGraphQL<{
      issue: LinearIssueResponse;
    }>(
      config,
      `query($id: String!) {
        issue(id: $id) {
          id identifier title url priority estimate
          state { id name type }
          team { id key }
          project { id name }
          labels { nodes { id name } }
        }
      }`,
      { id: linearIssue.linearId },
    );

    const issue = data.issue;

    // Two-way title sync
    let titleUpdated = false;
    if (issue.title !== linearIssue.issueTitle) {
      await prisma.proposal.update({
        where: { id: proposalId },
        data: { title: issue.title },
      });
      titleUpdated = true;
      logger.info(`Synced title from Linear issue to proposal ${proposalId}: "${issue.title}"`);
    }

    await prisma.linearIssue.update({
      where: { proposalId },
      data: {
        status: issue.state.name,
        priority: issue.priority,
        issueTitle: issue.title,
        estimate: issue.estimate,
        projectId: issue.project?.id || null,
        projectName: issue.project?.name || null,
        syncedAt: new Date(),
      },
    });

    // Auto-ship if state type is "completed"
    if (
      issue.state.type === 'completed' ||
      config.doneStates.includes(issue.state.name.toLowerCase())
    ) {
      const proposal = await prisma.proposal.findUnique({
        where: { id: proposalId },
        select: { status: true },
      });
      if (proposal && proposal.status !== 'shipped') {
        await prisma.proposal.update({
          where: { id: proposalId },
          data: { status: 'shipped' },
        });
        logger.info(
          `Auto-shipped proposal ${proposalId} (Linear issue state: "${issue.state.name}")`,
        );
      }
    }

    return { identifier: linearIssue.identifier, status: issue.state.name, titleUpdated };
  },

  /**
   * Get the Linear issue linked to a proposal (if any).
   */
  async getByProposal(proposalId: string) {
    return prisma.linearIssue.findUnique({ where: { proposalId } });
  },

  /**
   * List all exported Linear issues.
   */
  async listExported() {
    return prisma.linearIssue.findMany({
      include: {
        proposal: { select: { id: true, title: true, status: true, riceScore: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  },

  /**
   * Unlink a Linear issue from a proposal (does not delete the Linear issue).
   */
  async unlink(proposalId: string): Promise<void> {
    const linearIssue = await prisma.linearIssue.findUnique({ where: { proposalId } });
    if (!linearIssue) throw NotFound('Linear issue link for this proposal');
    await prisma.linearIssue.delete({ where: { proposalId } });
    logger.info(`Unlinked Linear issue ${linearIssue.identifier} from proposal ${proposalId}`);
  },

  /**
   * Export all proposals under a theme as Linear issues in a dedicated project.
   */
  async exportThemeAsProject(themeId: string): Promise<{
    projectName: string;
    projectUrl: string;
    issuesCreated: number;
    issuesSkipped: number;
  }> {
    const config = await getLinearConfig();
    if (!config.teamId) throw BadRequest('No Linear team configured');

    const theme = await prisma.theme.findUnique({
      where: { id: themeId },
      include: {
        proposals: {
          include: {
            theme: { select: { name: true, category: true } },
            linearIssue: true,
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

    if (theme.linearProjectId) {
      throw BadRequest(`Theme already exported to Linear project`);
    }

    // Create a new project for this theme
    const projectData = await linearGraphQL<{
      projectCreate: {
        success: boolean;
        project: { id: string; name: string; url: string };
      };
    }>(
      config,
      `mutation($input: ProjectCreateInput!) {
        projectCreate(input: $input) {
          success
          project { id name url }
        }
      }`,
      {
        input: {
          name: `[ShipScope] ${theme.name}`,
          description: `Product theme: ${theme.description}\n\nCategory: ${theme.category || 'General'}\nFeedback count: ${theme.feedbackCount}\nOpportunity score: ${theme.opportunityScore.toFixed(1)}`,
          teamIds: [config.teamId],
        },
      },
    );

    if (!projectData.projectCreate.success) {
      throw BadRequest('Failed to create Linear project');
    }

    const project = projectData.projectCreate.project;

    // Save project link on theme
    await prisma.theme.update({
      where: { id: themeId },
      data: {
        linearProjectId: project.id,
        linearProjectUrl: project.url,
      },
    });

    // Create issues for each proposal
    let issuesCreated = 0;
    let issuesSkipped = 0;

    for (const proposal of theme.proposals) {
      if (proposal.linearIssue) {
        issuesSkipped++;
        continue;
      }

      try {
        const description = buildLinearDescription(proposal);
        const priority = riceToPriority(proposal.riceScore);
        const estimate = effortToEstimate(proposal.effortScore);

        // Labels
        const riceTier = getRiceTier(proposal.riceScore);
        const labelId = await getOrCreateLabel(config, riceTier.label, riceTier.color);
        const labelIds: string[] = [];
        if (labelId) labelIds.push(labelId);

        const input: Record<string, unknown> = {
          teamId: config.teamId,
          title: proposal.title,
          description,
          priority,
          projectId: project.id,
          labelIds,
        };
        if (estimate !== null) input.estimate = estimate;
        if (config.cycleId) input.cycleId = config.cycleId;

        const issueData = await linearGraphQL<{
          issueCreate: {
            success: boolean;
            issue: LinearIssueResponse;
          };
        }>(
          config,
          `mutation($input: IssueCreateInput!) {
            issueCreate(input: $input) {
              success
              issue {
                id identifier title url priority estimate
                state { id name type }
                team { id key }
                project { id name }
                labels { nodes { id name } }
              }
            }
          }`,
          { input },
        );

        if (!issueData.issueCreate.success) {
          issuesSkipped++;
          continue;
        }

        const issue = issueData.issueCreate.issue;

        await prisma.linearIssue.create({
          data: {
            proposalId: proposal.id,
            linearId: issue.id,
            identifier: issue.identifier,
            linearUrl: issue.url,
            teamId: config.teamId,
            status: issue.state.name,
            priority: issue.priority,
            issueTitle: proposal.title,
            projectId: project.id,
            projectName: project.name,
            labelIds,
            estimate: estimate,
          },
        });

        issuesCreated++;
      } catch (err) {
        logger.error(`Failed to create Linear issue for proposal ${proposal.id}: ${err}`);
        issuesSkipped++;
      }
    }

    logger.info(
      `Exported theme ${themeId} as Linear project "${project.name}" with ${issuesCreated} issues`,
    );

    return {
      projectName: project.name,
      projectUrl: project.url,
      issuesCreated,
      issuesSkipped,
    };
  },

  /**
   * Attach the generated PRD spec as a comment on the linked Linear issue.
   */
  async attachSpec(proposalId: string): Promise<{ identifier: string; commented: boolean }> {
    const config = await getLinearConfig();

    const linearIssue = await prisma.linearIssue.findUnique({ where: { proposalId } });
    if (!linearIssue) throw NotFound('No Linear issue linked to this proposal');

    const spec = await prisma.spec.findUnique({ where: { proposalId } });
    if (!spec || !spec.prdMarkdown) throw BadRequest('No spec generated for this proposal');

    const commentBody = `## PRD Spec (v${spec.version}) — Generated by ShipScope\n\n${spec.prdMarkdown}`;

    await linearGraphQL(
      config,
      `mutation($input: CommentCreateInput!) {
        commentCreate(input: $input) { success }
      }`,
      {
        input: {
          issueId: linearIssue.linearId,
          body: commentBody,
        },
      },
    );

    logger.info(`Attached spec v${spec.version} to Linear issue ${linearIssue.identifier}`);
    return { identifier: linearIssue.identifier, commented: true };
  },

  /**
   * Import issues from a Linear team/project as feedback items.
   */
  async importFeedbackFromLinear(
    options: {
      projectId?: string;
      stateType?: string;
      maxResults?: number;
    } = {},
  ): Promise<{ imported: number; skipped: number; sourceId: string }> {
    const config = await getLinearConfig();
    if (!config.teamId) throw BadRequest('No Linear team configured');

    const maxResults = Math.min(options.maxResults || 50, 100);

    // Build filter for issues query
    const filterParts: string[] = [];
    if (options.projectId) {
      filterParts.push(`project: { id: { eq: "${options.projectId}" } }`);
    }
    if (options.stateType) {
      filterParts.push(`state: { type: { eq: "${options.stateType}" } }`);
    }
    const filterArg = filterParts.length > 0 ? `, filter: { ${filterParts.join(', ')} }` : '';

    const data = await linearGraphQL<{
      team: {
        issues: {
          nodes: {
            id: string;
            identifier: string;
            title: string;
            description: string | null;
            url: string;
            priority: number;
            state: { name: string; type: string };
            assignee: { name: string } | null;
          }[];
        };
      };
    }>(
      config,
      `query($teamId: String!, $first: Int!) {
        team(id: $teamId) {
          issues(first: $first${filterArg}) {
            nodes {
              id identifier title description url priority
              state { name type }
              assignee { name }
            }
          }
        }
      }`,
      { teamId: config.teamId, first: maxResults },
    );

    // Create a feedback source for this import
    const source = await prisma.feedbackSource.create({
      data: {
        name: `Linear Import (${config.teamId})`,
        type: 'linear',
        metadata: {
          teamId: config.teamId,
          projectId: options.projectId || null,
          importedAt: new Date().toISOString(),
        },
      },
    });

    let imported = 0;
    let skipped = 0;

    for (const issue of data.team.issues.nodes) {
      // Skip if already imported
      const existing = await prisma.feedbackItem.findFirst({
        where: {
          metadata: { path: ['linear_id'], equals: issue.id },
        },
      });

      if (existing) {
        skipped++;
        continue;
      }

      const content = issue.description
        ? `[${issue.identifier}] ${issue.title}: ${issue.description}`
        : `[${issue.identifier}] ${issue.title}`;

      await prisma.feedbackItem.create({
        data: {
          content: content.slice(0, 5000),
          sourceId: source.id,
          author: issue.assignee?.name || null,
          channel: `linear_${issue.state.type}`,
          metadata: {
            linear_id: issue.id,
            linear_identifier: issue.identifier,
            linear_url: issue.url,
            linear_status: issue.state.name,
            linear_priority: issue.priority,
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

  /**
   * Sync status for ALL linked Linear issues. Auto-updates proposal
   * status when an issue moves to a "completed" state.
   */
  async syncAllStatuses(): Promise<{
    synced: number;
    autoShipped: number;
    errors: number;
  }> {
    const config = await getLinearConfig();
    const allIssues = await prisma.linearIssue.findMany({
      include: { proposal: { select: { id: true, status: true } } },
    });

    let synced = 0;
    let autoShipped = 0;
    let errors = 0;

    for (const linearIssue of allIssues) {
      try {
        const data = await linearGraphQL<{
          issue: {
            id: string;
            identifier: string;
            title: string;
            url: string;
            priority: number;
            estimate: number | null;
            state: { id: string; name: string; type: string };
          };
        }>(
          config,
          `query($id: String!) {
            issue(id: $id) {
              id identifier title url priority estimate
              state { id name type }
            }
          }`,
          { id: linearIssue.linearId },
        );

        const issue = data.issue;

        await prisma.linearIssue.update({
          where: { id: linearIssue.id },
          data: {
            status: issue.state.name,
            priority: issue.priority,
            issueTitle: issue.title,
            estimate: issue.estimate,
            syncedAt: new Date(),
          },
        });

        // Auto-mark proposal as "shipped" when state is completed
        const isDone =
          issue.state.type === 'completed' ||
          config.doneStates.includes(issue.state.name.toLowerCase());

        if (isDone && linearIssue.proposal.status !== 'shipped') {
          await prisma.proposal.update({
            where: { id: linearIssue.proposal.id },
            data: { status: 'shipped' },
          });
          autoShipped++;
          logger.info(
            `Auto-shipped proposal ${linearIssue.proposal.id} (Linear issue state: "${issue.state.name}")`,
          );
        }

        synced++;
      } catch (err) {
        logger.error(`Failed to sync Linear issue ${linearIssue.identifier}: ${err}`);
        errors++;
      }
    }

    return { synced, autoShipped, errors };
  },

  /**
   * Handle incoming Linear webhook events for real-time sync.
   * Linear webhooks send JSON with type, action, data, and url fields.
   */
  async handleWebhook(payload: {
    type?: string;
    action?: string;
    data?: {
      id?: string;
      identifier?: string;
      title?: string;
      state?: { id: string; name: string; type: string };
      priority?: number;
    };
    url?: string;
  }): Promise<{ processed: boolean; identifier?: string }> {
    // Only process Issue updates
    if (payload.type !== 'Issue' || !payload.data?.id) {
      return { processed: false };
    }

    const linearId = payload.data.id;
    const linearIssue = await prisma.linearIssue.findUnique({ where: { linearId } });

    if (!linearIssue) {
      return { processed: false }; // Not tracked by us
    }

    const updateData: Record<string, unknown> = { syncedAt: new Date() };

    if (payload.data.state?.name) {
      updateData.status = payload.data.state.name;
    }
    if (payload.data.title) {
      updateData.issueTitle = payload.data.title;
    }
    if (payload.data.priority !== undefined) {
      updateData.priority = payload.data.priority;
    }

    await prisma.linearIssue.update({
      where: { linearId },
      data: updateData,
    });

    // Auto-ship proposal if state is completed
    const stateType = payload.data.state?.type;
    const stateName = payload.data.state?.name?.toLowerCase();
    let doneStates: string[];
    try {
      const cfg = await getLinearConfig();
      doneStates = cfg.doneStates;
    } catch {
      doneStates = DEFAULT_DONE_STATES;
    }

    if (stateType === 'completed' || (stateName && doneStates.includes(stateName))) {
      const proposal = await prisma.proposal.findUnique({
        where: { id: linearIssue.proposalId },
        select: { status: true },
      });
      if (proposal && proposal.status !== 'shipped') {
        await prisma.proposal.update({
          where: { id: linearIssue.proposalId },
          data: { status: 'shipped' },
        });
        logger.info(
          `Webhook auto-shipped proposal ${linearIssue.proposalId} (Linear issue → "${payload.data.state?.name}")`,
        );
      }
    }

    return { processed: true, identifier: linearIssue.identifier };
  },

  /**
   * Create a rich ShipScope attachment on a Linear issue (idempotent by URL).
   */
  async createAttachment(
    proposalId: string,
    appBaseUrl: string,
  ): Promise<{ attachmentId: string }> {
    const config = await getLinearConfig();

    const linearIssue = await prisma.linearIssue.findUnique({ where: { proposalId } });
    if (!linearIssue) throw NotFound('No Linear issue linked to this proposal');

    const proposal = await prisma.proposal.findUnique({
      where: { id: proposalId },
      select: {
        title: true,
        riceScore: true,
        status: true,
        theme: { select: { name: true } },
        _count: { select: { evidence: true } },
      },
    });
    if (!proposal) throw NotFound('Proposal');

    const riceTier = getRiceTier(proposal.riceScore);
    const subtitle = [
      `RICE: ${proposal.riceScore?.toFixed(1) ?? 'N/A'}`,
      `Status: ${proposal.status}`,
      proposal.theme ? `Theme: ${proposal.theme.name}` : null,
      `${proposal._count.evidence} evidence items`,
    ]
      .filter(Boolean)
      .join(' · ');

    const url = `${appBaseUrl}/proposals/${proposalId}`;

    const data = await linearGraphQL<{
      attachmentCreate: { success: boolean; attachment: { id: string } };
    }>(
      config,
      `mutation($input: AttachmentCreateInput!) {
        attachmentCreate(input: $input) {
          success
          attachment { id }
        }
      }`,
      {
        input: {
          issueId: linearIssue.linearId,
          title: `ShipScope: ${proposal.title}`,
          subtitle,
          url,
          iconUrl: `${appBaseUrl}/favicon.ico`,
          metadata: {
            messages: [
              {
                icon: 'signal',
                color: riceTier.color,
                message: `${riceTier.label} — RICE ${proposal.riceScore?.toFixed(1) ?? 'N/A'}`,
              },
            ],
            attributes: [
              { label: 'Status', value: proposal.status, type: 'string' },
              { label: 'Evidence', value: String(proposal._count.evidence), type: 'string' },
            ],
          },
        },
      },
    );

    if (!data.attachmentCreate.success) {
      throw BadRequest('Failed to create attachment on Linear issue');
    }

    logger.info(`Created ShipScope attachment on Linear issue ${linearIssue.identifier}`);
    return { attachmentId: data.attachmentCreate.attachment.id };
  },

  /**
   * Register a webhook programmatically via Linear's API.
   * Stores the webhook ID in settings for future management.
   */
  async registerWebhook(callbackUrl: string): Promise<{ webhookId: string; enabled: boolean }> {
    const config = await getLinearConfig();

    if (config.webhookId) {
      throw BadRequest('Webhook already registered. Unregister the existing one first.');
    }

    const data = await linearGraphQL<{
      webhookCreate: {
        success: boolean;
        webhook: { id: string; enabled: boolean; secret: string };
      };
    }>(
      config,
      `mutation($input: WebhookCreateInput!) {
        webhookCreate(input: $input) {
          success
          webhook { id enabled secret }
        }
      }`,
      {
        input: {
          url: callbackUrl,
          teamId: config.teamId || undefined,
          allPublicTeams: !config.teamId,
          resourceTypes: ['Issue', 'Comment', 'Project'],
          label: 'ShipScope Integration',
          enabled: true,
        },
      },
    );

    if (!data.webhookCreate.success) {
      throw BadRequest('Failed to register Linear webhook');
    }

    const webhook = data.webhookCreate.webhook;

    // Store webhook ID and secret in settings
    await settingsService.bulkSet({
      [LINEAR_SETTING_KEYS.LINEAR_WEBHOOK_ID]: webhook.id,
      [LINEAR_SETTING_KEYS.LINEAR_WEBHOOK_SECRET]: webhook.secret,
    });

    logger.info(`Registered Linear webhook ${webhook.id}`);
    return { webhookId: webhook.id, enabled: webhook.enabled };
  },

  /**
   * Unregister the currently registered Linear webhook.
   */
  async unregisterWebhook(): Promise<void> {
    const config = await getLinearConfig();

    if (!config.webhookId) {
      throw BadRequest('No webhook registered');
    }

    await linearGraphQL(
      config,
      `mutation($id: String!) {
        webhookDelete(id: $id) { success }
      }`,
      { id: config.webhookId },
    );

    // Clear webhook settings
    await settingsService.bulkSet({
      [LINEAR_SETTING_KEYS.LINEAR_WEBHOOK_ID]: '',
      [LINEAR_SETTING_KEYS.LINEAR_WEBHOOK_SECRET]: '',
    });

    logger.info(`Unregistered Linear webhook ${config.webhookId}`);
  },

  /**
   * Get Linear sync summary for the dashboard widget.
   */
  async getDashboardSummary(): Promise<{
    totalExported: number;
    byStatus: Record<string, number>;
    byPriority: Record<string, number>;
    recentExports: {
      identifier: string;
      issueTitle: string;
      status: string;
      priority: number;
      linearUrl: string;
      createdAt: string;
    }[];
  }> {
    const allIssues = await prisma.linearIssue.findMany({
      select: {
        identifier: true,
        issueTitle: true,
        status: true,
        priority: true,
        linearUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const byStatus: Record<string, number> = {};
    const byPriority: Record<string, number> = {};
    const priorityNames = ['No Priority', 'Urgent', 'High', 'Medium', 'Low'];

    for (const issue of allIssues) {
      byStatus[issue.status] = (byStatus[issue.status] || 0) + 1;
      const pName = priorityNames[issue.priority] || 'Unknown';
      byPriority[pName] = (byPriority[pName] || 0) + 1;
    }

    return {
      totalExported: allIssues.length,
      byStatus,
      byPriority,
      recentExports: allIssues.slice(0, 5).map((i) => ({
        ...i,
        createdAt: i.createdAt.toISOString(),
      })),
    };
  },
};

// ─── Helpers ──────────────────────────────────────────────

interface ProposalWithEvidence {
  title: string;
  problem: string;
  solution: string;
  reachScore: number | null;
  impactScore: number | null;
  confidenceScore: number | null;
  effortScore: number | null;
  riceScore: number | null;
  theme: { name: string; category?: string | null } | null;
  evidence: {
    feedbackItem: { content: string; author: string | null; channel: string | null };
  }[];
}

/**
 * Build a Linear issue description in Markdown.
 */
function buildLinearDescription(proposal: ProposalWithEvidence): string {
  const sections: string[] = [];

  sections.push(`## Problem\n${proposal.problem}`);
  sections.push(`## Solution\n${proposal.solution}`);

  if (proposal.riceScore !== null) {
    sections.push(
      `## RICE Score\n` +
        `| Metric | Score |\n|--------|-------|\n` +
        `| Reach | ${proposal.reachScore ?? '-'} |\n` +
        `| Impact | ${proposal.impactScore ?? '-'} |\n` +
        `| Confidence | ${proposal.confidenceScore ?? '-'} |\n` +
        `| Effort | ${proposal.effortScore ?? '-'} |\n` +
        `| **Total** | **${proposal.riceScore?.toFixed(1) ?? '-'}** |`,
    );
  }

  if (proposal.theme) {
    sections.push(`## Theme\n${proposal.theme.name}`);
  }

  if (proposal.evidence.length > 0) {
    const quotes = proposal.evidence
      .map(
        (ev) =>
          `> ${ev.feedbackItem.content.slice(0, 200)}${ev.feedbackItem.author ? `\n> — ${ev.feedbackItem.author}` : ''}${ev.feedbackItem.channel ? ` *(${ev.feedbackItem.channel})*` : ''}`,
      )
      .join('\n\n');
    sections.push(`## Customer Evidence\n${quotes}`);
  }

  sections.push(`---\n*Generated by ShipScope*`);

  return sections.join('\n\n');
}

function formatCategory(category: string): string {
  const labels: Record<string, string> = {
    bug: 'Bug',
    feature_request: 'Feature',
    ux_issue: 'UX',
    performance: 'Performance',
    documentation: 'Documentation',
    pricing: 'Pricing',
  };
  return labels[category] || category;
}

function getCategoryColor(category: string | null): string {
  const colors: Record<string, string> = {
    bug: '#EF4444',
    feature_request: '#3B82F6',
    ux_issue: '#A855F7',
    performance: '#F97316',
    documentation: '#84CC16',
    pricing: '#EAB308',
  };
  return colors[category || ''] || '#94A3B8';
}

/**
 * Get or create a Linear label on the configured team.
 */
async function getOrCreateLabel(
  config: LinearConfig,
  name: string,
  color: string,
): Promise<string | null> {
  if (!config.teamId) return null;

  try {
    // Check existing labels
    const data = await linearGraphQL<{
      team: { labels: { nodes: { id: string; name: string }[] } };
    }>(
      config,
      `query($teamId: String!) {
        team(id: $teamId) {
          labels { nodes { id name } }
        }
      }`,
      { teamId: config.teamId },
    );

    const existing = data.team.labels.nodes.find(
      (l) => l.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) return existing.id;

    // Create new label
    const created = await linearGraphQL<{
      issueLabelCreate: {
        success: boolean;
        issueLabel: { id: string };
      };
    }>(
      config,
      `mutation($input: IssueLabelCreateInput!) {
        issueLabelCreate(input: $input) {
          success
          issueLabel { id }
        }
      }`,
      {
        input: {
          name,
          color,
          teamId: config.teamId,
        },
      },
    );

    return created.issueLabelCreate.success ? created.issueLabelCreate.issueLabel.id : null;
  } catch {
    return null;
  }
}
