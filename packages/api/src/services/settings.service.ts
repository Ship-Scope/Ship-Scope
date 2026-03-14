import { prisma } from '../lib/prisma';
import { openai } from '../lib/openai';

export const SETTING_KEYS = {
  OPENAI_API_KEY: 'openai_api_key',
  AI_MODEL: 'ai_model',
  SIMILARITY_THRESHOLD: 'similarity_threshold',
  MIN_CLUSTER_SIZE: 'min_cluster_size',
} as const;

export const SETTING_DEFAULTS: Record<string, string> = {
  [SETTING_KEYS.AI_MODEL]: 'gpt-4o-mini',
  [SETTING_KEYS.SIMILARITY_THRESHOLD]: '0.78',
  [SETTING_KEYS.MIN_CLUSTER_SIZE]: '3',
};

export const settingsService = {
  async get(key: string): Promise<string | null> {
    const setting = await prisma.setting.findUnique({ where: { key } });
    return setting?.value ?? SETTING_DEFAULTS[key] ?? null;
  },

  async getAll(): Promise<Record<string, string>> {
    const settings = await prisma.setting.findMany();
    const result: Record<string, string> = { ...SETTING_DEFAULTS };
    for (const s of settings) {
      result[s.key] = s.value;
    }
    // Mask the API key
    if (result[SETTING_KEYS.OPENAI_API_KEY]) {
      const key = result[SETTING_KEYS.OPENAI_API_KEY];
      result[SETTING_KEYS.OPENAI_API_KEY] = key.slice(0, 7) + '...' + key.slice(-4);
    }
    // Mask the Jira API token
    if (result['jira_api_token']) {
      const token = result['jira_api_token'];
      result['jira_api_token'] = token.slice(0, 4) + '...' + token.slice(-4);
    }
    return result;
  },

  async set(key: string, value: string): Promise<void> {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  },

  async bulkSet(settings: Record<string, string>): Promise<void> {
    const ops = Object.entries(settings).map(([key, value]) =>
      prisma.setting.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      }),
    );
    await prisma.$transaction(ops);
  },

  async delete(key: string): Promise<void> {
    await prisma.setting.deleteMany({ where: { key } });
  },

  async testAIConnection(): Promise<{ success: boolean; model: string; message: string }> {
    try {
      const apiKey = await settingsService.getRaw(SETTING_KEYS.OPENAI_API_KEY);
      const model =
        (await settingsService.get(SETTING_KEYS.AI_MODEL)) ||
        SETTING_DEFAULTS[SETTING_KEYS.AI_MODEL];

      const client = apiKey
        ? new (await import('openai')).default({ apiKey, maxRetries: 1, timeout: 10_000 })
        : openai;

      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: 'Say "ok" in one word.' }],
        max_tokens: 5,
      });

      const content = response.choices[0]?.message?.content?.trim() || '';
      return { success: true, model, message: `Connection successful. Response: "${content}"` };
    } catch (err) {
      return {
        success: false,
        model: '',
        message: err instanceof Error ? err.message : 'Unknown error',
      };
    }
  },

  async exportAllData() {
    const [feedback, themes, proposals, specs] = await Promise.all([
      prisma.feedbackItem.findMany({
        include: { source: { select: { name: true, type: true } } },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.theme.findMany({ orderBy: { opportunityScore: 'desc' } }),
      prisma.proposal.findMany({
        include: { theme: { select: { name: true } } },
        orderBy: { riceScore: 'desc' },
      }),
      prisma.spec.findMany({
        include: { proposal: { select: { title: true } } },
        orderBy: { updatedAt: 'desc' },
      }),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      counts: {
        feedback: feedback.length,
        themes: themes.length,
        proposals: proposals.length,
        specs: specs.length,
      },
      feedback,
      themes,
      proposals,
      specs,
    };
  },

  async deleteAllData(): Promise<{ deleted: Record<string, number> }> {
    const [
      evidenceResult,
      specsResult,
      proposalsResult,
      linksResult,
      themesResult,
      feedbackResult,
      sourcesResult,
    ] = await prisma.$transaction([
      prisma.proposalEvidence.deleteMany(),
      prisma.spec.deleteMany(),
      prisma.proposal.deleteMany(),
      prisma.feedbackThemeLink.deleteMany(),
      prisma.theme.deleteMany(),
      prisma.feedbackItem.deleteMany(),
      prisma.feedbackSource.deleteMany(),
    ]);

    return {
      deleted: {
        evidence: evidenceResult.count,
        specs: specsResult.count,
        proposals: proposalsResult.count,
        themeLinks: linksResult.count,
        themes: themesResult.count,
        feedback: feedbackResult.count,
        sources: sourcesResult.count,
      },
    };
  },

  /** Get raw value without masking (internal use only) */
  async getRaw(key: string): Promise<string | null> {
    const setting = await prisma.setting.findUnique({ where: { key } });
    return setting?.value ?? null;
  },
};
