import { Router, type Request, type Response, type NextFunction } from 'express';
import { jiraService } from '../services/jira.service';
import { settingsService } from '../services/settings.service';
import { activityService } from '../services/activity.service';
import { validate } from '../middleware/validate';
import { jiraConfigSchema } from '../schemas/jira.schema';
import { AppError } from '../lib/errors';

const router = Router();

// ─── Configuration ────────────────────────────────────────

/**
 * PUT /api/jira/config
 * Save Jira configuration (host, email, API token, project, issue type).
 */
router.put(
  '/config',
  validate(jiraConfigSchema, 'body'),
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
 * POST /api/jira/test
 * Test the Jira connection with current credentials.
 */
router.post('/test', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await jiraService.testConnection();
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/jira/projects
 * List available Jira projects.
 */
router.get('/projects', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const projects = await jiraService.listProjects();
    res.json({ data: projects });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/jira/issue-types
 * List issue types for the configured Jira project.
 */
router.get('/issue-types', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const types = await jiraService.listIssueTypes();
    res.json({ data: types });
  } catch (err) {
    next(err);
  }
});

// ─── Export & Sync ────────────────────────────────────────

/**
 * POST /api/jira/export/:proposalId
 * Export a proposal to Jira as a new issue.
 */
router.post('/export/:proposalId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await jiraService.exportProposal(req.params.proposalId);

    await activityService.log({
      type: 'jira_export',
      description: `Exported proposal to Jira as ${result.jiraKey}`,
      metadata: { proposalId: req.params.proposalId, jiraKey: result.jiraKey },
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
 * POST /api/jira/sync/:proposalId
 * Sync the Jira issue status back to the local record.
 */
router.post('/sync/:proposalId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await jiraService.syncStatus(req.params.proposalId);
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
 * GET /api/jira/issues
 * List all exported Jira issues.
 */
router.get('/issues', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const issues = await jiraService.listExported();
    res.json({ data: issues });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/jira/issues/:proposalId
 * Get the Jira issue linked to a specific proposal.
 */
router.get('/issues/:proposalId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const issue = await jiraService.getByProposal(req.params.proposalId);
    res.json({ data: issue });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/jira/issues/:proposalId
 * Unlink a Jira issue from a proposal (does not delete the Jira issue itself).
 */
router.delete('/issues/:proposalId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await jiraService.unlink(req.params.proposalId);
    res.status(204).send();
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

// ─── Theme → Epic Bulk Export ─────────────────────────────

/**
 * POST /api/jira/export-theme/:themeId
 * Export a theme as a Jira Epic with all its proposals as child Stories.
 */
router.post('/export-theme/:themeId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await jiraService.exportThemeAsEpic(req.params.themeId);

    await activityService.log({
      type: 'jira_export',
      description: `Exported theme as Epic ${result.epicKey} with ${result.storiesCreated} stories`,
      metadata: {
        themeId: req.params.themeId,
        epicKey: result.epicKey,
        storiesCreated: result.storiesCreated,
        storiesSkipped: result.storiesSkipped,
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
 * POST /api/jira/attach-spec/:proposalId
 * Attach the generated PRD spec as a comment on the linked Jira issue.
 */
router.post('/attach-spec/:proposalId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await jiraService.attachSpec(req.params.proposalId);
    res.json({ data: result });
  } catch (err) {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    next(err);
  }
});

// ─── Feedback Import from Jira ────────────────────────────

/**
 * POST /api/jira/import-feedback
 * Import issues from configured Jira project as feedback items.
 */
router.post('/import-feedback', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { jql, maxResults } = req.body as { jql?: string; maxResults?: number };
    const result = await jiraService.importFeedbackFromJira({ jql, maxResults });

    await activityService.log({
      type: 'import',
      description: `Imported ${result.imported} items from Jira (${result.skipped} skipped)`,
      metadata: { source: 'jira', imported: result.imported, skipped: result.skipped },
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

// ─── Bulk Sync ────────────────────────────────────────────

/**
 * POST /api/jira/sync-all
 * Sync status for all linked Jira issues. Auto-ships proposals
 * when Jira issue status reaches "Done".
 */
router.post('/sync-all', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await jiraService.syncAllStatuses();

    if (result.autoShipped > 0) {
      await activityService.log({
        type: 'jira_export',
        description: `Jira sync: ${result.synced} synced, ${result.autoShipped} auto-shipped`,
        metadata: result,
      });
    }

    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// ─── Jira Webhook Receiver ───────────────────────────────

/**
 * POST /api/jira/webhook
 * Receive Jira webhook events for real-time status sync.
 * Configure in Jira: Settings → System → Webhooks
 */
router.post('/webhook', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await jiraService.handleWebhook(req.body);
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// ─── Dashboard Summary ───────────────────────────────────

/**
 * GET /api/jira/dashboard
 * Get Jira integration summary for the dashboard widget.
 */
router.get('/dashboard', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const summary = await jiraService.getDashboardSummary();
    res.json({ data: summary });
  } catch (err) {
    next(err);
  }
});

export default router;
