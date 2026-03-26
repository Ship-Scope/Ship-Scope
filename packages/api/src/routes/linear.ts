import { Router, type Request, type Response, type NextFunction } from 'express';
import express from 'express';
import {
  linearService,
  verifyWebhookSignature,
  LINEAR_SETTING_KEYS,
} from '../services/linear.service';
import { settingsService } from '../services/settings.service';
import { activityService } from '../services/activity.service';
import { validate } from '../middleware/validate';
import { linearConfigSchema, linearImportSchema } from '../schemas/linear.schema';
import { AppError } from '../lib/errors';
import { logger } from '../lib/logger';

const router = Router();

// ─── Configuration ────────────────────────────────────────

/**
 * PUT /api/linear/config
 * Save Linear configuration (API key, team, project, cycle, labels).
 */
router.put(
  '/config',
  validate(linearConfigSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const settings = req.body as Record<string, string>;
      await settingsService.bulkSet(settings);
      res.json({ data: { saved: true } });
    } catch (err) {
      next(err);
    }
  },
);

/**
 * POST /api/linear/test
 * Test the Linear connection with current credentials.
 */
router.post('/test', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await linearService.testConnection();
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/linear/teams
 * List Linear teams for the authenticated user.
 */
router.get('/teams', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const teams = await linearService.listTeams();
    res.json({ data: teams });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/linear/projects
 * List projects for the configured team.
 */
router.get('/projects', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const projects = await linearService.listProjects();
    res.json({ data: projects });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/linear/labels
 * List labels for the configured team.
 */
router.get('/labels', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const labels = await linearService.listLabels();
    res.json({ data: labels });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/linear/states
 * List workflow states for the configured team.
 */
router.get('/states', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const states = await linearService.listStates();
    res.json({ data: states });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/linear/cycles
 * List active cycles (sprints) for the configured team.
 */
router.get('/cycles', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const cycles = await linearService.listCycles();
    res.json({ data: cycles });
  } catch (err) {
    next(err);
  }
});

// ─── Export & Sync ────────────────────────────────────────

/**
 * POST /api/linear/export/:proposalId
 * Export a proposal to Linear as a new issue.
 */
router.post('/export/:proposalId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await linearService.exportProposal(req.params.proposalId);

    await activityService.log({
      type: 'linear_export',
      description: `Exported proposal to Linear issue ${result.identifier}`,
      metadata: { proposalId: req.params.proposalId, identifier: result.identifier },
    });

    res.status(201).json({ data: result });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

/**
 * POST /api/linear/sync/:proposalId
 * Sync the Linear issue status back to the local record.
 */
router.post('/sync/:proposalId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await linearService.syncStatus(req.params.proposalId);
    res.json({ data: result });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

/**
 * GET /api/linear/issues
 * List all exported Linear issues.
 */
router.get('/issues', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const issues = await linearService.listExported();
    res.json({ data: issues });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/linear/issues/:proposalId
 * Get the Linear issue linked to a specific proposal.
 */
router.get('/issues/:proposalId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const issue = await linearService.getByProposal(req.params.proposalId);
    res.json({ data: issue });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/linear/issues/:proposalId
 * Unlink a Linear issue from a proposal (does not delete the Linear issue itself).
 */
router.delete('/issues/:proposalId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await linearService.unlink(req.params.proposalId);
    res.status(204).send();
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

// ─── Theme → Project Bulk Export ──────────────────────────

/**
 * POST /api/linear/export-theme/:themeId
 * Export a theme as a Linear project with all proposals as issues.
 */
router.post('/export-theme/:themeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await linearService.exportThemeAsProject(req.params.themeId);

    await activityService.log({
      type: 'linear_export',
      description: `Exported theme as Linear project "${result.projectName}" with ${result.issuesCreated} issues`,
      metadata: {
        themeId: req.params.themeId,
        projectName: result.projectName,
        issuesCreated: result.issuesCreated,
        issuesSkipped: result.issuesSkipped,
      },
    });

    res.status(201).json({ data: result });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

// ─── Spec Attachment ──────────────────────────────────────

/**
 * POST /api/linear/attach-spec/:proposalId
 * Attach the generated PRD spec as a comment on the linked Linear issue.
 */
router.post('/attach-spec/:proposalId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await linearService.attachSpec(req.params.proposalId);
    res.json({ data: result });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

// ─── Feedback Import from Linear ──────────────────────────

/**
 * POST /api/linear/import-feedback
 * Import issues from a Linear team/project as feedback items.
 */
router.post(
  '/import-feedback',
  validate(linearImportSchema, 'body'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { projectId, stateType, maxResults } = req.body as {
        projectId?: string;
        stateType?: string;
        maxResults?: number;
      };
      const result = await linearService.importFeedbackFromLinear({
        projectId,
        stateType,
        maxResults,
      });

      await activityService.log({
        type: 'import',
        description: `Imported ${result.imported} items from Linear (${result.skipped} skipped)`,
        metadata: { source: 'linear', imported: result.imported, skipped: result.skipped },
      });

      res.status(201).json({ data: result });
    } catch (err) {
      if (err instanceof AppError) {
        res.status(err.statusCode).json({ error: err.message, code: err.code });
        return;
      }
      next(err);
    }
  },
);

// ─── Bulk Sync ────────────────────────────────────────────

/**
 * POST /api/linear/sync-all
 * Sync status for all linked Linear issues. Auto-ships proposals
 * when Linear issue moves to a "completed" state.
 */
router.post('/sync-all', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await linearService.syncAllStatuses();

    if (result.autoShipped > 0) {
      await activityService.log({
        type: 'linear_export',
        description: `Linear sync: ${result.synced} synced, ${result.autoShipped} auto-shipped`,
        metadata: result,
      });
    }

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// ─── Linear Webhook Receiver ─────────────────────────────

/**
 * POST /api/linear/webhook
 * Receive Linear webhook events for real-time issue status sync.
 * Verifies HMAC-SHA256 signature when a webhook secret is configured.
 */
router.post(
  '/webhook',
  express.raw({ type: 'application/json' }),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Parse the raw body
      const rawBody = Buffer.isBuffer(req.body) ? req.body : Buffer.from(JSON.stringify(req.body));
      const payload = Buffer.isBuffer(req.body) ? JSON.parse(rawBody.toString('utf-8')) : req.body;

      // Verify signature if webhook secret is configured
      const webhookSecret = await settingsService.getRaw(LINEAR_SETTING_KEYS.LINEAR_WEBHOOK_SECRET);
      if (webhookSecret) {
        const signature = req.headers['linear-signature'] as string | undefined;
        if (!signature || !verifyWebhookSignature(rawBody, signature, webhookSecret)) {
          logger.warn('Linear webhook rejected: invalid signature');
          res.status(401).json({ error: 'Invalid webhook signature' });
          return;
        }

        // Replay protection: reject timestamps older than 60 seconds
        if (payload.webhookTimestamp) {
          const age = Date.now() - payload.webhookTimestamp;
          if (age > 60_000) {
            logger.warn(`Linear webhook rejected: timestamp too old (${age}ms)`);
            res.status(401).json({ error: 'Webhook timestamp expired' });
            return;
          }
        }
      }

      const result = await linearService.handleWebhook(payload);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  },
);

// ─── Attachment ───────────────────────────────────────────

/**
 * POST /api/linear/attach/:proposalId
 * Create a rich ShipScope attachment on the linked Linear issue.
 */
router.post('/attach/:proposalId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const appBaseUrl =
      (req.body as { appBaseUrl?: string })?.appBaseUrl ||
      `${req.protocol}://${req.get('host') || 'localhost'}`;
    const result = await linearService.createAttachment(req.params.proposalId, appBaseUrl);
    res.status(201).json({ data: result });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

// ─── Webhook Registration ─────────────────────────────────

/**
 * POST /api/linear/register-webhook
 * Programmatically register a Linear webhook for real-time sync.
 */
router.post('/register-webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { callbackUrl } = req.body as { callbackUrl: string };
    if (!callbackUrl) {
      res.status(400).json({ error: 'callbackUrl is required' });
      return;
    }
    const result = await linearService.registerWebhook(callbackUrl);

    await activityService.log({
      type: 'linear_export',
      description: `Registered Linear webhook for real-time sync`,
      metadata: { webhookId: result.webhookId },
    });

    res.status(201).json({ data: result });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

/**
 * DELETE /api/linear/register-webhook
 * Unregister the currently registered Linear webhook.
 */
router.delete('/register-webhook', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    await linearService.unregisterWebhook();

    await activityService.log({
      type: 'linear_export',
      description: `Unregistered Linear webhook`,
    });

    res.status(204).send();
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

// ─── Dashboard Summary ───────────────────────────────────

/**
 * GET /api/linear/dashboard
 * Get Linear integration summary for the dashboard widget.
 */
router.get('/dashboard', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await linearService.getDashboardSummary();
    res.json({ data: summary });
  } catch (err) {
    next(err);
  }
});

export default router;
