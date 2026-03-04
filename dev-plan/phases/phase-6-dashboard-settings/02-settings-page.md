# 02 -- Settings Page

## Objective

Build the complete settings page with five sections: AI Configuration (API key management, model selection, connection testing), Synthesis Settings (similarity threshold, minimum cluster size), Data Management (full export, destructive delete-all), Webhook Management (URL display, API key generation), and About (version, links). Settings are persisted in a key-value `Setting` table and loaded/saved via dedicated API endpoints. The page provides full control over ShipScope's behavior without requiring environment variable changes or restarts.

## Dependencies

- Phase 1: Frontend scaffold (Shell, Sidebar, PageContainer, UI primitives)
- Phase 2: Webhook API (webhook URL and API key concepts already exist)
- Phase 3: OpenAI client and AI configuration (used for test connection)
- `packages/api/prisma/schema.prisma`: `Setting` model (created in this task)
- `packages/api/src/lib/openai.ts`: OpenAI client singleton (for test connection)

## Files to Create

| File                                                                | Purpose                                        |
| ------------------------------------------------------------------- | ---------------------------------------------- |
| `packages/api/src/routes/settings.ts`                               | Settings route handlers                        |
| `packages/api/src/services/settings.service.ts`                     | Settings CRUD, AI test, data export, data wipe |
| `packages/web/src/pages/SettingsPage.tsx`                           | Main settings page (replace placeholder)       |
| `packages/web/src/components/settings/AIConfigSection.tsx`          | API key input, model dropdown, test connection |
| `packages/web/src/components/settings/SynthesisSettingsSection.tsx` | Threshold slider, cluster size input           |
| `packages/web/src/components/settings/DataManagementSection.tsx`    | Export button, delete-all with confirmation    |
| `packages/web/src/components/settings/WebhookSection.tsx`           | Webhook URL display, API key management        |
| `packages/web/src/components/settings/AboutSection.tsx`             | Version, GitHub link, docs link                |
| `packages/web/src/hooks/useSettings.ts`                             | React Query hooks for settings                 |

## Files to Modify

| File                                | Changes                                                    |
| ----------------------------------- | ---------------------------------------------------------- |
| `packages/api/prisma/schema.prisma` | Add `Setting` model                                        |
| `packages/api/src/index.ts`         | Import and mount settings routes                           |
| `packages/web/src/lib/api.ts`       | Add settings API functions                                 |
| `packages/api/src/lib/openai.ts`    | Add `testConnection()` method or expose client for testing |

## Detailed Sub-Tasks

### 1. Add Setting model to Prisma schema

The key-value pattern avoids schema migrations for every new setting. Keys are typed in the service layer.

```prisma
// packages/api/prisma/schema.prisma

model Setting {
  key       String   @id
  value     String   // JSON-encoded value
  updatedAt DateTime @updatedAt

  @@map("settings")
}
```

Run migration:

```bash
cd packages/api && npx prisma migrate dev --name add_settings
```

### 2. Define settings keys and defaults (`packages/api/src/services/settings.service.ts`)

The service layer provides typed access to settings with compile-time safe keys and runtime defaults. This means a fresh install with zero rows in the `settings` table still works correctly.

```typescript
import { prisma } from '../lib/prisma';
import { randomBytes } from 'crypto';

/**
 * Known setting keys with their types and default values.
 * Adding a new setting requires only adding it here — no migration needed.
 */
const SETTING_DEFAULTS: Record<string, unknown> = {
  'ai.apiKey': '',
  'ai.model': 'gpt-4o-mini',
  'ai.baseUrl': 'https://api.openai.com/v1',
  'synthesis.similarityThreshold': 0.82,
  'synthesis.minClusterSize': 3,
  'webhook.apiKey': '',
};

export const settingsService = {
  /**
   * Get all settings as a flat object, merging DB values over defaults.
   */
  async getAll(): Promise<Record<string, unknown>> {
    const rows = await prisma.setting.findMany();
    const stored: Record<string, unknown> = {};

    for (const row of rows) {
      try {
        stored[row.key] = JSON.parse(row.value);
      } catch {
        stored[row.key] = row.value;
      }
    }

    // Merge defaults with stored values (stored wins)
    return { ...SETTING_DEFAULTS, ...stored };
  },

  /**
   * Get a single setting value by key, falling back to default.
   */
  async get<T = unknown>(key: string): Promise<T> {
    const row = await prisma.setting.findUnique({ where: { key } });
    if (row) {
      try {
        return JSON.parse(row.value) as T;
      } catch {
        return row.value as T;
      }
    }
    return (SETTING_DEFAULTS[key] ?? null) as T;
  },

  /**
   * Update one or more settings. Uses upsert to create if missing.
   * Validates known keys against expected types.
   */
  async update(settings: Record<string, unknown>): Promise<Record<string, unknown>> {
    const validKeys = Object.keys(SETTING_DEFAULTS);
    const updates: { key: string; value: string }[] = [];

    for (const [key, value] of Object.entries(settings)) {
      if (!validKeys.includes(key)) {
        throw new AppError(400, `Unknown setting key: ${key}`);
      }
      // Validate specific settings
      if (key === 'synthesis.similarityThreshold') {
        const num = Number(value);
        if (isNaN(num) || num < 0.7 || num > 0.95) {
          throw new AppError(400, 'Similarity threshold must be between 0.70 and 0.95');
        }
      }
      if (key === 'synthesis.minClusterSize') {
        const num = Number(value);
        if (!Number.isInteger(num) || num < 2 || num > 50) {
          throw new AppError(400, 'Minimum cluster size must be an integer between 2 and 50');
        }
      }
      if (key === 'ai.model') {
        const allowed = ['gpt-4o-mini', 'gpt-4o', 'gpt-4-turbo', 'gpt-3.5-turbo'];
        if (!allowed.includes(String(value))) {
          throw new AppError(400, `Model must be one of: ${allowed.join(', ')}`);
        }
      }
      updates.push({ key, value: JSON.stringify(value) });
    }

    // Upsert all in a transaction
    await prisma.$transaction(
      updates.map(({ key, value }) =>
        prisma.setting.upsert({
          where: { key },
          update: { value },
          create: { key, value },
        }),
      ),
    );

    return this.getAll();
  },

  /**
   * Test AI connection by sending a minimal request to the configured model.
   * Returns latency and model info on success, throws on failure.
   */
  async testAIConnection(): Promise<{ success: boolean; latencyMs: number; model: string }> {
    const apiKey = await this.get<string>('ai.apiKey');
    const model = await this.get<string>('ai.model');

    if (!apiKey) {
      throw new AppError(400, 'No API key configured. Set your OpenAI API key first.');
    }

    const start = Date.now();
    try {
      // Use the OpenAI client directly with a minimal prompt
      const { OpenAI } = await import('openai');
      const client = new OpenAI({ apiKey });
      const response = await client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: 'Reply with "ok"' }],
        max_tokens: 5,
      });
      const latencyMs = Date.now() - start;
      return {
        success: true,
        latencyMs,
        model: response.model,
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new AppError(502, `AI connection failed (${latencyMs}ms): ${message}`);
    }
  },

  /**
   * Generate a new webhook API key (32-byte hex string).
   * Overwrites any existing key.
   */
  async generateWebhookApiKey(): Promise<string> {
    const key = randomBytes(32).toString('hex');
    await this.update({ 'webhook.apiKey': key });
    return key;
  },

  /**
   * Export all application data as a structured JSON object.
   * Returns a serializable object (caller handles streaming/download).
   */
  async exportAllData(): Promise<Record<string, unknown>> {
    const [feedback, themes, proposals, specs, settings] = await Promise.all([
      prisma.feedbackItem.findMany({
        include: {
          source: true,
          themes: {
            include: { theme: { select: { id: true, name: true } } },
          },
        },
      }),
      prisma.theme.findMany({
        include: {
          feedbackItems: {
            include: { feedback: { select: { id: true, content: true } } },
          },
        },
      }),
      prisma.proposal.findMany({
        include: {
          evidence: {
            include: { feedback: { select: { id: true, content: true } } },
          },
          theme: { select: { id: true, name: true } },
        },
      }),
      prisma.spec.findMany({
        include: {
          proposal: { select: { id: true, title: true } },
        },
      }),
      prisma.setting.findMany(),
    ]);

    return {
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
      data: {
        feedback,
        themes,
        proposals,
        specs,
        settings,
      },
    };
  },

  /**
   * Delete ALL application data. This is irreversible.
   * Deletes in correct FK order to avoid constraint violations.
   */
  async deleteAllData(): Promise<{ deleted: Record<string, number> }> {
    const result = await prisma.$transaction(async (tx) => {
      // Delete in reverse dependency order
      const specCount = await tx.spec.count();
      await tx.spec.deleteMany();

      const evidenceCount = await tx.proposalEvidence.count();
      await tx.proposalEvidence.deleteMany();

      const proposalCount = await tx.proposal.count();
      await tx.proposal.deleteMany();

      const linkCount = await tx.feedbackThemeLink.count();
      await tx.feedbackThemeLink.deleteMany();

      const themeCount = await tx.theme.count();
      await tx.theme.deleteMany();

      const feedbackCount = await tx.feedbackItem.count();
      await tx.feedbackItem.deleteMany();

      const sourceCount = await tx.feedbackSource.count();
      await tx.feedbackSource.deleteMany();

      const activityCount = await tx.activityLog.count();
      await tx.activityLog.deleteMany();

      // Do NOT delete settings — user should keep their config

      return {
        specs: specCount,
        proposalEvidence: evidenceCount,
        proposals: proposalCount,
        feedbackThemeLinks: linkCount,
        themes: themeCount,
        feedbackItems: feedbackCount,
        feedbackSources: sourceCount,
        activityLogs: activityCount,
      };
    });

    return { deleted: result };
  },
};
```

### 3. Build settings routes (`packages/api/src/routes/settings.ts`)

```typescript
import { Router } from 'express';
import { z } from 'zod';
import { settingsService } from '../services/settings.service';
import { validate } from '../middleware/validate';

const router = Router();

// GET /api/settings — Retrieve all settings
router.get('/', async (_req, res, next) => {
  try {
    const settings = await settingsService.getAll();
    // Mask the API key before sending to client
    const masked = { ...settings };
    if (typeof masked['ai.apiKey'] === 'string' && masked['ai.apiKey'].length > 4) {
      const key = masked['ai.apiKey'] as string;
      masked['ai.apiKey'] = '••••••••' + key.slice(-4);
    }
    // Never expose webhook API key in full via GET
    if (typeof masked['webhook.apiKey'] === 'string' && masked['webhook.apiKey'].length > 0) {
      masked['webhook.apiKey'] = '••••••••••••';
    }
    res.json({ data: masked });
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings — Update one or more settings
const updateSettingsSchema = z.object({
  settings: z.record(z.string(), z.unknown()),
});
router.put('/', validate(updateSettingsSchema), async (req, res, next) => {
  try {
    const updated = await settingsService.update(req.body.settings);
    res.json({ data: updated });
  } catch (err) {
    next(err);
  }
});

// POST /api/settings/test-ai — Test AI connection
router.post('/test-ai', async (_req, res, next) => {
  try {
    const result = await settingsService.testAIConnection();
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/settings/export — Export all data as JSON
router.post('/export', async (_req, res, next) => {
  try {
    const data = await settingsService.exportAllData();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="shipscope-export-${Date.now()}.json"`,
    );
    res.json(data);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/settings/data — Delete all data (requires confirmation token)
const deleteDataSchema = z.object({
  confirmation: z.literal('DELETE ALL DATA'),
});
router.delete('/data', validate(deleteDataSchema), async (req, res, next) => {
  try {
    const result = await settingsService.deleteAllData();
    res.json({ data: result });
  } catch (err) {
    next(err);
  }
});

// POST /api/settings/webhook-key — Generate a new webhook API key
router.post('/webhook-key', async (_req, res, next) => {
  try {
    const key = await settingsService.generateWebhookApiKey();
    // Return the full key ONCE — subsequent GETs will be masked
    res.json({ data: { apiKey: key } });
  } catch (err) {
    next(err);
  }
});

export { router as settingsRouter };
```

Mount in `packages/api/src/index.ts`:

```typescript
import { settingsRouter } from './routes/settings';
app.use('/api/settings', settingsRouter);
```

### 4. Build frontend API functions and hooks

**API functions (`packages/web/src/lib/api.ts`):**

```typescript
export const settingsApi = {
  getAll: () => api.get<{ data: Record<string, unknown> }>('/settings').then((r) => r.data.data),

  update: (settings: Record<string, unknown>) =>
    api.put<{ data: Record<string, unknown> }>('/settings', { settings }).then((r) => r.data.data),

  testAI: () =>
    api
      .post<{ data: { success: boolean; latencyMs: number; model: string } }>('/settings/test-ai')
      .then((r) => r.data.data),

  exportData: () => api.post('/settings/export', {}, { responseType: 'blob' }),

  deleteAllData: (confirmation: string) =>
    api
      .delete<{ data: { deleted: Record<string, number> } }>('/settings/data', {
        data: { confirmation },
      })
      .then((r) => r.data.data),

  generateWebhookKey: () =>
    api.post<{ data: { apiKey: string } }>('/settings/webhook-key').then((r) => r.data.data),
};
```

**React Query hooks (`packages/web/src/hooks/useSettings.ts`):**

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '../lib/api';

export function useSettings() {
  return useQuery({
    queryKey: ['settings'],
    queryFn: () => settingsApi.getAll(),
    staleTime: 60_000,
  });
}

export function useUpdateSettings() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (settings: Record<string, unknown>) => settingsApi.update(settings),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}

export function useTestAIConnection() {
  return useMutation({
    mutationFn: () => settingsApi.testAI(),
  });
}

export function useExportData() {
  return useMutation({
    mutationFn: async () => {
      const response = await settingsApi.exportData();
      // Trigger browser download
      const blob = new Blob([response.data], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `shipscope-export-${Date.now()}.json`;
      a.click();
      URL.revokeObjectURL(url);
    },
  });
}

export function useDeleteAllData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (confirmation: string) => settingsApi.deleteAllData(confirmation),
    onSuccess: () => {
      // Invalidate everything — all data is gone
      qc.invalidateQueries();
    },
  });
}

export function useGenerateWebhookKey() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => settingsApi.generateWebhookKey(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['settings'] });
    },
  });
}
```

### 5. Build AIConfigSection component (`packages/web/src/components/settings/AIConfigSection.tsx`)

```
┌──────────────────────────────────────────────────────────────────┐
│  AI Configuration                                                 │
│──────────────────────────────────────────────────────────────────│
│                                                                   │
│  OpenAI API Key                                                   │
│  ┌──────────────────────────────────────────┐  [Show/Hide]       │
│  │ ••••••••sk-1234                           │                    │
│  └──────────────────────────────────────────┘                    │
│                                                                   │
│  Model                                                            │
│  ┌──────────────────────────────────────────┐                    │
│  │ gpt-4o-mini                          ▼   │                    │
│  └──────────────────────────────────────────┘                    │
│                                                                   │
│  [Test Connection]   ✓ Connected (234ms, gpt-4o-mini-2024-07)    │
│                                                                   │
│  [Save Changes]                                                   │
└──────────────────────────────────────────────────────────────────┘
```

```typescript
import { useState } from 'react';
import { Eye, EyeOff, Zap, Check, X, Loader2 } from 'lucide-react';
import { useSettings, useUpdateSettings, useTestAIConnection } from '../../hooks/useSettings';

const AVAILABLE_MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini (recommended)' },
  { value: 'gpt-4o', label: 'GPT-4o' },
  { value: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
  { value: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' },
];

export function AIConfigSection() {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();
  const testConnection = useTestAIConnection();

  const [apiKey, setApiKey] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [model, setModel] = useState('');
  const [isDirty, setIsDirty] = useState(false);

  // Initialize local state from server when settings load
  // (apiKey from server is masked, so we keep a separate local state)

  const handleSave = async () => {
    const updates: Record<string, unknown> = {};
    if (apiKey && !apiKey.startsWith('••')) {
      updates['ai.apiKey'] = apiKey;
    }
    if (model) {
      updates['ai.model'] = model;
    }
    await updateSettings.mutateAsync(updates);
    setIsDirty(false);
  };

  const handleTestConnection = () => {
    testConnection.mutate();
  };

  return (
    <section className="bg-[#0D0F12] border border-[#1C2028] rounded-xl p-6">
      <h2 className="text-lg font-semibold text-[#E8ECF1] mb-1">AI Configuration</h2>
      <p className="text-sm text-[#5A6478] mb-6">
        Configure your OpenAI API key and model preferences.
      </p>

      {/* API Key Input */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-[#8B95A5] mb-1.5">
          OpenAI API Key
        </label>
        <div className="relative">
          <input
            type={showKey ? 'text' : 'password'}
            value={apiKey || (settings?.['ai.apiKey'] as string) || ''}
            onChange={(e) => { setApiKey(e.target.value); setIsDirty(true); }}
            placeholder="sk-..."
            className="w-full bg-[#0D0F12] border border-[#1C2028] rounded-lg px-3 py-2
                       text-sm text-[#E8ECF1] font-mono placeholder:text-[#5A6478]
                       focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] outline-none
                       pr-10"
          />
          <button
            type="button"
            onClick={() => setShowKey(!showKey)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[#5A6478]
                       hover:text-[#8B95A5] transition-colors"
          >
            {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>
      </div>

      {/* Model Dropdown */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-[#8B95A5] mb-1.5">Model</label>
        <select
          value={model || (settings?.['ai.model'] as string) || 'gpt-4o-mini'}
          onChange={(e) => { setModel(e.target.value); setIsDirty(true); }}
          className="w-full bg-[#0D0F12] border border-[#1C2028] rounded-lg px-3 py-2
                     text-sm text-[#E8ECF1]
                     focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] outline-none"
        >
          {AVAILABLE_MODELS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </select>
      </div>

      {/* Test Connection */}
      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={handleTestConnection}
          disabled={testConnection.isPending}
          className="flex items-center gap-2 bg-[#0D0F12] border border-[#1C2028]
                     rounded-lg px-4 py-2 text-sm text-[#E8ECF1] font-medium
                     hover:border-[#2A303C] transition-all duration-200
                     disabled:opacity-40"
        >
          {testConnection.isPending ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Zap size={16} />
          )}
          Test Connection
        </button>
        {testConnection.isSuccess && (
          <span className="flex items-center gap-1.5 text-sm text-[#34D399]">
            <Check size={14} />
            Connected ({testConnection.data.latencyMs}ms, {testConnection.data.model})
          </span>
        )}
        {testConnection.isError && (
          <span className="flex items-center gap-1.5 text-sm text-[#FB7185]">
            <X size={14} />
            {(testConnection.error as Error).message}
          </span>
        )}
      </div>

      {/* Save Button */}
      <button
        onClick={handleSave}
        disabled={!isDirty || updateSettings.isPending}
        className="bg-white text-[#07080A] rounded-lg px-4 py-2 text-sm font-medium
                   hover:shadow-lg transition-all duration-200
                   disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
      </button>
    </section>
  );
}
```

### 6. Build SynthesisSettingsSection component (`packages/web/src/components/settings/SynthesisSettingsSection.tsx`)

```
┌──────────────────────────────────────────────────────────────────┐
│  Synthesis Settings                                               │
│──────────────────────────────────────────────────────────────────│
│                                                                   │
│  Similarity Threshold                                 0.82        │
│  ═══════════════════════════●══════════                           │
│  0.70                                           0.95             │
│  Lower = more themes (broad grouping)                             │
│  Higher = fewer themes (strict grouping)                          │
│                                                                   │
│  Minimum Cluster Size                                             │
│  ┌──────┐                                                        │
│  │  3   │  feedback items required to form a theme               │
│  └──────┘                                                        │
│                                                                   │
│  [Save Changes]                                                   │
└──────────────────────────────────────────────────────────────────┘
```

```typescript
import { useState, useEffect } from 'react';
import { useSettings, useUpdateSettings } from '../../hooks/useSettings';

export function SynthesisSettingsSection() {
  const { data: settings } = useSettings();
  const updateSettings = useUpdateSettings();

  const [threshold, setThreshold] = useState(0.82);
  const [clusterSize, setClusterSize] = useState(3);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      setThreshold(Number(settings['synthesis.similarityThreshold']) || 0.82);
      setClusterSize(Number(settings['synthesis.minClusterSize']) || 3);
    }
  }, [settings]);

  const handleSave = async () => {
    await updateSettings.mutateAsync({
      'synthesis.similarityThreshold': threshold,
      'synthesis.minClusterSize': clusterSize,
    });
    setIsDirty(false);
  };

  return (
    <section className="bg-[#0D0F12] border border-[#1C2028] rounded-xl p-6">
      <h2 className="text-lg font-semibold text-[#E8ECF1] mb-1">Synthesis Settings</h2>
      <p className="text-sm text-[#5A6478] mb-6">
        Control how feedback is grouped into themes during synthesis.
      </p>

      {/* Similarity Threshold Slider */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-[#8B95A5]">
            Similarity Threshold
          </label>
          <span className="text-sm font-mono text-[#3B82F6] font-medium">
            {threshold.toFixed(2)}
          </span>
        </div>
        <input
          type="range"
          min="0.70"
          max="0.95"
          step="0.01"
          value={threshold}
          onChange={(e) => { setThreshold(parseFloat(e.target.value)); setIsDirty(true); }}
          className="w-full h-2 bg-[#13161B] rounded-full appearance-none cursor-pointer
                     [&::-webkit-slider-thumb]:appearance-none
                     [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4
                     [&::-webkit-slider-thumb]:rounded-full
                     [&::-webkit-slider-thumb]:bg-[#3B82F6]
                     [&::-webkit-slider-thumb]:cursor-pointer
                     [&::-webkit-slider-thumb]:shadow-md"
        />
        <div className="flex justify-between text-xs text-[#5A6478] mt-1">
          <span>0.70 (broad)</span>
          <span>0.95 (strict)</span>
        </div>
        <p className="text-xs text-[#5A6478] mt-2">
          Lower values create more themes with broader grouping.
          Higher values create fewer, more tightly focused themes.
        </p>
      </div>

      {/* Minimum Cluster Size */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-[#8B95A5] mb-1.5">
          Minimum Cluster Size
        </label>
        <div className="flex items-center gap-3">
          <input
            type="number"
            min={2}
            max={50}
            value={clusterSize}
            onChange={(e) => {
              setClusterSize(Math.max(2, Math.min(50, parseInt(e.target.value) || 2)));
              setIsDirty(true);
            }}
            className="w-20 bg-[#0D0F12] border border-[#1C2028] rounded-lg px-3 py-2
                       text-sm text-[#E8ECF1] font-mono text-center
                       focus:border-[#3B82F6] focus:ring-1 focus:ring-[#3B82F6] outline-none"
          />
          <span className="text-sm text-[#5A6478]">
            feedback items required to form a theme
          </span>
        </div>
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        disabled={!isDirty || updateSettings.isPending}
        className="bg-white text-[#07080A] rounded-lg px-4 py-2 text-sm font-medium
                   hover:shadow-lg transition-all duration-200
                   disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {updateSettings.isPending ? 'Saving...' : 'Save Changes'}
      </button>
    </section>
  );
}
```

### 7. Build DataManagementSection component (`packages/web/src/components/settings/DataManagementSection.tsx`)

The delete-all action requires a double confirmation: first a modal appears, then the user must type "DELETE ALL DATA" to enable the confirmation button.

```
┌──────────────────────────────────────────────────────────────────┐
│  Data Management                                                  │
│──────────────────────────────────────────────────────────────────│
│                                                                   │
│  Export Data                                                      │
│  Download all feedback, themes, proposals, and specs as JSON.     │
│  [Download Export]                                                │
│                                                                   │
│  ──────────────────────────────────────────                      │
│                                                                   │
│  Danger Zone                                                      │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │ Delete All Data                                             │  │
│  │ Permanently remove all feedback, themes, proposals,         │  │
│  │ specs, and activity logs. Settings are preserved.           │  │
│  │                                            [Delete All]     │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘

Confirmation modal:
┌──────────────────────────────────────────┐
│  ⚠️  Delete All Data                     │
│                                           │
│  This action is irreversible. All         │
│  feedback, themes, proposals, specs,      │
│  and activity logs will be permanently    │
│  deleted. Your settings will be           │
│  preserved.                               │
│                                           │
│  Type "DELETE ALL DATA" to confirm:       │
│  ┌────────────────────────────────────┐  │
│  │                                     │  │
│  └────────────────────────────────────┘  │
│                                           │
│       [Cancel]    [Delete Everything]     │
└──────────────────────────────────────────┘
```

```typescript
import { useState } from 'react';
import { Download, Trash2, AlertTriangle } from 'lucide-react';
import { useExportData, useDeleteAllData } from '../../hooks/useSettings';

export function DataManagementSection() {
  const exportData = useExportData();
  const deleteAll = useDeleteAllData();
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [confirmText, setConfirmText] = useState('');

  const handleDelete = async () => {
    await deleteAll.mutateAsync('DELETE ALL DATA');
    setShowDeleteModal(false);
    setConfirmText('');
  };

  return (
    <section className="bg-[#0D0F12] border border-[#1C2028] rounded-xl p-6">
      <h2 className="text-lg font-semibold text-[#E8ECF1] mb-1">Data Management</h2>
      <p className="text-sm text-[#5A6478] mb-6">Export or delete your application data.</p>

      {/* Export */}
      <div className="mb-6">
        <h3 className="text-sm font-medium text-[#8B95A5] mb-2">Export Data</h3>
        <p className="text-sm text-[#5A6478] mb-3">
          Download all feedback, themes, proposals, and specs as a single JSON file.
        </p>
        <button
          onClick={() => exportData.mutate()}
          disabled={exportData.isPending}
          className="flex items-center gap-2 bg-[#0D0F12] border border-[#1C2028]
                     rounded-lg px-4 py-2 text-sm text-[#E8ECF1] font-medium
                     hover:border-[#2A303C] transition-all duration-200
                     disabled:opacity-40"
        >
          <Download size={16} />
          {exportData.isPending ? 'Exporting...' : 'Download Export'}
        </button>
      </div>

      {/* Divider */}
      <div className="border-t border-[#1C2028] my-6" />

      {/* Danger Zone */}
      <div className="border border-[#FB718540] rounded-lg p-4">
        <h3 className="text-sm font-medium text-[#FB7185] mb-2 flex items-center gap-2">
          <AlertTriangle size={16} />
          Danger Zone
        </h3>
        <p className="text-sm text-[#5A6478] mb-3">
          Permanently remove all feedback, themes, proposals, specs, and activity logs.
          Your settings will be preserved.
        </p>
        <button
          onClick={() => setShowDeleteModal(true)}
          className="flex items-center gap-2 bg-[#FB718520] text-[#FB7185]
                     rounded-lg px-4 py-2 text-sm font-medium
                     hover:bg-[#FB718530] transition-all duration-200"
        >
          <Trash2 size={16} />
          Delete All Data
        </button>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="bg-[#0D0F12] border border-[#1C2028] rounded-xl p-6 w-full max-w-md mx-4">
            <h3 className="text-lg font-semibold text-[#E8ECF1] mb-3 flex items-center gap-2">
              <AlertTriangle size={20} className="text-[#FB7185]" />
              Delete All Data
            </h3>
            <p className="text-sm text-[#8B95A5] mb-4">
              This action is <strong className="text-[#FB7185]">irreversible</strong>.
              All feedback, themes, proposals, specs, and activity logs will be permanently
              deleted. Your settings will be preserved.
            </p>
            <label className="block text-sm font-medium text-[#8B95A5] mb-1.5">
              Type <code className="font-mono text-[#FB7185]">DELETE ALL DATA</code> to confirm:
            </label>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              className="w-full bg-[#13161B] border border-[#1C2028] rounded-lg px-3 py-2
                         text-sm text-[#E8ECF1] font-mono
                         focus:border-[#FB7185] focus:ring-1 focus:ring-[#FB7185] outline-none
                         mb-4"
              placeholder="DELETE ALL DATA"
              autoFocus
            />
            <div className="flex justify-end gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setConfirmText(''); }}
                className="px-4 py-2 rounded-lg text-sm text-[#8B95A5]
                           hover:text-[#E8ECF1] hover:bg-[#13161B] transition-all"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={confirmText !== 'DELETE ALL DATA' || deleteAll.isPending}
                className="flex items-center gap-2 bg-[#FB7185] text-white
                           rounded-lg px-4 py-2 text-sm font-medium
                           hover:bg-[#F43F5E] transition-all duration-200
                           disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Trash2 size={14} />
                {deleteAll.isPending ? 'Deleting...' : 'Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
```

### 8. Build WebhookSection component (`packages/web/src/components/settings/WebhookSection.tsx`)

```
┌──────────────────────────────────────────────────────────────────┐
│  Webhook Integration                                              │
│──────────────────────────────────────────────────────────────────│
│                                                                   │
│  Webhook URL                                                      │
│  ┌──────────────────────────────────────────────────┐  [Copy]    │
│  │ https://your-host.com/api/feedback/webhook        │            │
│  └──────────────────────────────────────────────────┘            │
│                                                                   │
│  API Key                                                          │
│  ┌──────────────────────────────────────────────────┐  [Copy]    │
│  │ ••••••••••••                                      │            │
│  └──────────────────────────────────────────────────┘            │
│                                                                   │
│  [Generate New Key]   [Revoke Key]                                │
│                                                                   │
│  ⚠️ Include the API key in the X-API-Key header when sending     │
│  webhook requests.                                                │
└──────────────────────────────────────────────────────────────────┘
```

```typescript
import { useState } from 'react';
import { Copy, Check, RefreshCw, Key, Trash2 } from 'lucide-react';
import { useSettings, useGenerateWebhookKey, useUpdateSettings } from '../../hooks/useSettings';

export function WebhookSection() {
  const { data: settings } = useSettings();
  const generateKey = useGenerateWebhookKey();
  const updateSettings = useUpdateSettings();
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);

  const webhookUrl = `${window.location.origin}/api/feedback/webhook`;
  const hasKey = Boolean(settings?.['webhook.apiKey'] && settings['webhook.apiKey'] !== '');

  const copyToClipboard = async (text: string, setCopied: (v: boolean) => void) => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerate = async () => {
    const result = await generateKey.mutateAsync();
    setNewKey(result.apiKey);
  };

  const handleRevoke = async () => {
    await updateSettings.mutateAsync({ 'webhook.apiKey': '' });
    setNewKey(null);
  };

  return (
    <section className="bg-[#0D0F12] border border-[#1C2028] rounded-xl p-6">
      <h2 className="text-lg font-semibold text-[#E8ECF1] mb-1">Webhook Integration</h2>
      <p className="text-sm text-[#5A6478] mb-6">
        Push feedback from external systems via webhook.
      </p>

      {/* Webhook URL */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-[#8B95A5] mb-1.5">Webhook URL</label>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-[#13161B] border border-[#1C2028] rounded-lg px-3 py-2
                          text-sm text-[#E8ECF1] font-mono truncate">
            {webhookUrl}
          </div>
          <button
            onClick={() => copyToClipboard(webhookUrl, setCopiedUrl)}
            className="flex-shrink-0 p-2 rounded-lg border border-[#1C2028]
                       hover:border-[#2A303C] transition-colors text-[#8B95A5]
                       hover:text-[#E8ECF1]"
          >
            {copiedUrl ? <Check size={16} className="text-[#34D399]" /> : <Copy size={16} />}
          </button>
        </div>
      </div>

      {/* API Key */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-[#8B95A5] mb-1.5">API Key</label>
        <div className="flex items-center gap-2">
          <div className="flex-1 bg-[#13161B] border border-[#1C2028] rounded-lg px-3 py-2
                          text-sm font-mono truncate">
            {newKey ? (
              <span className="text-[#34D399]">{newKey}</span>
            ) : hasKey ? (
              <span className="text-[#5A6478]">{settings?.['webhook.apiKey'] as string}</span>
            ) : (
              <span className="text-[#5A6478] italic">No API key generated</span>
            )}
          </div>
          {(newKey || hasKey) && (
            <button
              onClick={() => copyToClipboard(newKey || '', setCopiedKey)}
              disabled={!newKey}
              className="flex-shrink-0 p-2 rounded-lg border border-[#1C2028]
                         hover:border-[#2A303C] transition-colors text-[#8B95A5]
                         hover:text-[#E8ECF1] disabled:opacity-40"
              title={newKey ? 'Copy key' : 'Key is masked — generate a new one to copy'}
            >
              {copiedKey ? <Check size={16} className="text-[#34D399]" /> : <Copy size={16} />}
            </button>
          )}
        </div>
        {newKey && (
          <p className="text-xs text-[#FBBF24] mt-1.5">
            Save this key now. It will not be shown again after leaving this page.
          </p>
        )}
      </div>

      {/* Key Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleGenerate}
          disabled={generateKey.isPending}
          className="flex items-center gap-2 bg-[#0D0F12] border border-[#1C2028]
                     rounded-lg px-4 py-2 text-sm text-[#E8ECF1] font-medium
                     hover:border-[#2A303C] transition-all duration-200
                     disabled:opacity-40"
        >
          {hasKey ? <RefreshCw size={16} /> : <Key size={16} />}
          {hasKey ? 'Regenerate Key' : 'Generate Key'}
        </button>
        {hasKey && (
          <button
            onClick={handleRevoke}
            disabled={updateSettings.isPending}
            className="flex items-center gap-2 bg-[#FB718520] text-[#FB7185]
                       rounded-lg px-4 py-2 text-sm font-medium
                       hover:bg-[#FB718530] transition-all duration-200
                       disabled:opacity-40"
          >
            <Trash2 size={16} />
            Revoke Key
          </button>
        )}
      </div>

      {/* Usage hint */}
      <div className="mt-4 p-3 rounded-lg bg-[#13161B] border border-[#1C2028]">
        <p className="text-xs text-[#5A6478]">
          Include the API key in the <code className="font-mono text-[#3B82F6]">X-API-Key</code>{' '}
          header when sending webhook requests:
        </p>
        <pre className="text-xs font-mono text-[#8B95A5] mt-2 overflow-x-auto">
{`curl -X POST ${webhookUrl} \\
  -H "Content-Type: application/json" \\
  -H "X-API-Key: YOUR_API_KEY" \\
  -d '{"content": "User feedback text", "author": "John"}'`}
        </pre>
      </div>
    </section>
  );
}
```

### 9. Build AboutSection component (`packages/web/src/components/settings/AboutSection.tsx`)

```
┌──────────────────────────────────────────────────────────────────┐
│  About ShipScope                                                  │
│──────────────────────────────────────────────────────────────────│
│                                                                   │
│  Version        0.1.0                                             │
│  License        AGPL-3.0                                          │
│                                                                   │
│  [GitHub Repository ↗]    [Documentation ↗]                      │
│                                                                   │
│  "Know what to build, not just how"                               │
└──────────────────────────────────────────────────────────────────┘
```

```typescript
import { ExternalLink, Github, BookOpen } from 'lucide-react';

// Version is injected at build time or read from package.json
const APP_VERSION = import.meta.env.VITE_APP_VERSION || '0.1.0';
const GITHUB_URL = 'https://github.com/Ship-Scope/Ship-Scope';
const DOCS_URL = 'https://shipscope.dev/docs';

export function AboutSection() {
  return (
    <section className="bg-[#0D0F12] border border-[#1C2028] rounded-xl p-6">
      <h2 className="text-lg font-semibold text-[#E8ECF1] mb-1">About ShipScope</h2>
      <p className="text-sm text-[#5A6478] mb-6">
        AI-powered product feedback intelligence tool.
      </p>

      {/* Version Info */}
      <div className="grid grid-cols-2 gap-2 mb-6 max-w-xs">
        <span className="text-sm text-[#5A6478]">Version</span>
        <span className="text-sm font-mono text-[#E8ECF1]">{APP_VERSION}</span>
        <span className="text-sm text-[#5A6478]">License</span>
        <span className="text-sm text-[#E8ECF1]">AGPL-3.0</span>
      </div>

      {/* Links */}
      <div className="flex items-center gap-3">
        <a
          href={GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-[#0D0F12] border border-[#1C2028]
                     rounded-lg px-4 py-2 text-sm text-[#E8ECF1] font-medium
                     hover:border-[#2A303C] transition-all duration-200"
        >
          <Github size={16} />
          GitHub Repository
          <ExternalLink size={12} className="text-[#5A6478]" />
        </a>
        <a
          href={DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 bg-[#0D0F12] border border-[#1C2028]
                     rounded-lg px-4 py-2 text-sm text-[#E8ECF1] font-medium
                     hover:border-[#2A303C] transition-all duration-200"
        >
          <BookOpen size={16} />
          Documentation
          <ExternalLink size={12} className="text-[#5A6478]" />
        </a>
      </div>

      {/* Tagline */}
      <p className="mt-6 text-sm italic text-[#5A6478]">
        "Know what to build, not just how"
      </p>
    </section>
  );
}
```

### 10. Assemble SettingsPage (`packages/web/src/pages/SettingsPage.tsx`)

The settings page stacks all five sections vertically with consistent spacing.

```
┌─────────────────────────────────────────────────────────────────────┐
│ Topbar: "Settings"                                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ ┌─ AI Configuration ──────────────────────────────────────────────┐ │
│ │ API key, model dropdown, test connection                         │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ ┌─ Synthesis Settings ────────────────────────────────────────────┐ │
│ │ Similarity threshold slider, min cluster size                    │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ ┌─ Data Management ───────────────────────────────────────────────┐ │
│ │ Export JSON, danger zone delete all                               │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ ┌─ Webhook Integration ──────────────────────────────────────────-┐ │
│ │ URL, API key, generate/revoke                                    │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│ ┌─ About ─────────────────────────────────────────────────────────┐ │
│ │ Version, license, links                                          │ │
│ └─────────────────────────────────────────────────────────────────┘ │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

```typescript
import { AIConfigSection } from '../components/settings/AIConfigSection';
import { SynthesisSettingsSection } from '../components/settings/SynthesisSettingsSection';
import { DataManagementSection } from '../components/settings/DataManagementSection';
import { WebhookSection } from '../components/settings/WebhookSection';
import { AboutSection } from '../components/settings/AboutSection';

export default function SettingsPage() {
  return (
    <div className="max-w-3xl space-y-6">
      <AIConfigSection />
      <SynthesisSettingsSection />
      <DataManagementSection />
      <WebhookSection />
      <AboutSection />
    </div>
  );
}
```

### 11. Add Zod validation schemas for settings routes

Define validation schemas in the route file (or a separate validators file) to ensure all inputs are validated server-side.

```typescript
import { z } from 'zod';

const updateSettingsSchema = z.object({
  settings: z
    .record(z.string(), z.unknown())
    .refine((obj) => Object.keys(obj).length > 0, {
      message: 'At least one setting must be provided',
    }),
});

const deleteDataSchema = z.object({
  confirmation: z.literal('DELETE ALL DATA'),
});
```

### 12. Handle settings consumption in existing services

After settings are stored in the database, existing services (synthesis orchestrator, AI service, webhook handler) must read from the settings service instead of relying solely on environment variables. This is a gradual migration:

```typescript
// In ai.service.ts — before making an OpenAI call:
const apiKey = (await settingsService.get<string>('ai.apiKey')) || process.env.OPENAI_API_KEY;
const model = (await settingsService.get<string>('ai.model')) || 'gpt-4o-mini';

// In synthesis orchestrator — before clustering:
const threshold = (await settingsService.get<number>('synthesis.similarityThreshold')) || 0.82;
const minClusterSize = (await settingsService.get<number>('synthesis.minClusterSize')) || 3;

// In webhook route — for API key validation:
const webhookApiKey = await settingsService.get<string>('webhook.apiKey');
if (webhookApiKey && req.headers['x-api-key'] !== webhookApiKey) {
  return res.status(401).json({ error: 'Invalid API key' });
}
```

The pattern is: check settings service first, fall back to environment variable, then fall back to hardcoded default. This ensures backwards compatibility with existing `.env`-based configurations.

## Acceptance Criteria

- [ ] `GET /api/settings` returns all settings with AI API key masked (last 4 chars only)
- [ ] `GET /api/settings` returns defaults for keys that have no database row
- [ ] `PUT /api/settings` upserts one or more settings and returns the full settings object
- [ ] `PUT /api/settings` validates similarity threshold is between 0.70 and 0.95
- [ ] `PUT /api/settings` validates min cluster size is an integer between 2 and 50
- [ ] `PUT /api/settings` validates model is one of the allowed models
- [ ] `PUT /api/settings` rejects unknown setting keys with 400
- [ ] `POST /api/settings/test-ai` sends a test request and returns latency + model info
- [ ] `POST /api/settings/test-ai` returns 400 if no API key is configured
- [ ] `POST /api/settings/test-ai` returns 502 if the OpenAI connection fails
- [ ] `POST /api/settings/export` returns a downloadable JSON file with all entity data
- [ ] Export includes feedback, themes, proposals, specs, and settings
- [ ] Export file has Content-Disposition header for browser download
- [ ] `DELETE /api/settings/data` requires `confirmation: "DELETE ALL DATA"` in request body
- [ ] `DELETE /api/settings/data` deletes all entities in correct FK order
- [ ] `DELETE /api/settings/data` preserves settings table rows
- [ ] `DELETE /api/settings/data` returns counts of deleted records per table
- [ ] `POST /api/settings/webhook-key` generates a 32-byte hex API key
- [ ] Generated webhook key is returned in full once, subsequent GETs show masked version
- [ ] Settings page renders 5 sections: AI Config, Synthesis, Data, Webhook, About
- [ ] API key input is masked by default with show/hide toggle
- [ ] Model dropdown lists 4 models, persists selection on save
- [ ] Test connection button shows loading spinner, then success (green) or error (red) status
- [ ] Similarity threshold slider moves in 0.01 increments between 0.70 and 0.95
- [ ] Current slider value displayed as font-mono number next to label
- [ ] Min cluster size accepts integer input, validates range 2-50
- [ ] Export button triggers browser file download of JSON
- [ ] Delete all button opens confirmation modal with text input
- [ ] Delete is disabled until user types exact confirmation string
- [ ] After deletion, all React Query caches are invalidated
- [ ] Webhook URL displays the current host URL dynamically
- [ ] API key can be generated, copied, and revoked
- [ ] New key warning displayed: "Save this key now, it will not be shown again"
- [ ] About section shows version and working GitHub/docs links
- [ ] All settings persist across page reloads
- [ ] Prisma migration for Setting model applied successfully

## Complexity Estimate

**L (Large)** -- New Prisma model, comprehensive service layer with 6 operations (getAll, get, update, testAI, export, deleteAll), 5 API endpoints, 5 frontend section components with varied input types (masked input, slider, dropdown, confirmation modal, copy-to-clipboard), React Query state management, integration with existing services for settings consumption.

## Risk Factors & Mitigations

| Risk                                                           | Impact                                    | Mitigation                                                                                                 |
| -------------------------------------------------------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| API key stored in plaintext in DB                              | High -- security concern                  | V1 accepts this for simplicity; encrypt with AES-256 in V2; document that DB access = key access           |
| Delete all data leaves orphan records if FK constraints change | Medium -- data integrity                  | Run deletes in explicit order matching FK graph; wrap in transaction; add integration test                 |
| Export of large dataset causes OOM                             | Medium -- server crash for large installs | Stream JSON response instead of building in memory; add `limit` option in V2; typical V1 data is <10MB     |
| Settings cache stale if changed by another process             | Low -- wrong config used                  | Settings are read on each request (no in-memory cache); add Redis cache in V2 if reads become a bottleneck |
| Slider input inconsistent across browsers                      | Low -- styling issues                     | Use custom Tailwind styling for slider thumb; test on Chrome, Firefox, Safari                              |
| Test connection exposes timing attack on API key validity      | Low -- minimal security risk              | Test endpoint is not rate-limited in V1; add rate limiting if public-facing deployment is needed           |
