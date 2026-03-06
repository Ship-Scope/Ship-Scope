# 01 — OpenAI Client & Configuration

## Objective

Enhance the OpenAI client singleton with robust retry logic, rate limit handling with exponential backoff, token usage tracking, cost calculation, and a unified AI service layer that abstracts all LLM interactions behind typed functions.

## Dependencies

- Phase 1: OpenAI client singleton (basic setup)
- Phase 2: Complete (feedback data exists to process)

## Files to Create

| File                                      | Purpose                               |
| ----------------------------------------- | ------------------------------------- |
| `packages/api/src/services/ai.service.ts` | Unified AI service with typed methods |
| `packages/api/src/lib/token-tracker.ts`   | Token usage and cost tracking utility |

## Files to Modify

| File                             | Changes                                    |
| -------------------------------- | ------------------------------------------ |
| `packages/api/src/lib/openai.ts` | Add retry interceptor, rate limit handling |

## Detailed Sub-Tasks

### 1. Build token tracker (`packages/api/src/lib/token-tracker.ts`)

```typescript
interface TokenUsage {
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;  // USD
}

interface SessionUsage {
  totalCalls: number;
  totalTokens: number;
  totalCost: number;
  breakdown: TokenUsage[];
}

// Cost per 1K tokens (approximate, as of 2024)
const COST_TABLE = {
  'gpt-4o-mini': { prompt: 0.00015, completion: 0.0006 },
  'text-embedding-3-small': { prompt: 0.00002, completion: 0 },
};

export class TokenTracker {
  private usage: TokenUsage[] = [];

  track(model: string, promptTokens: number, completionTokens: number): void { ... }
  getSessionUsage(): SessionUsage { ... }
  reset(): void { ... }
}

export const tokenTracker = new TokenTracker();
```

### 2. Enhance OpenAI client with rate limit handling

```typescript
// Wrapper that handles 429 (rate limit) responses
export async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 1000,
): Promise<T> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (err.status === 429 && attempt < maxRetries) {
        const retryAfter = err.headers?.['retry-after']
          ? parseInt(err.headers['retry-after']) * 1000
          : baseDelay * Math.pow(2, attempt);
        await sleep(retryAfter);
        continue;
      }
      throw err;
    }
  }
  throw new Error('Max retries exceeded');
}
```

### 3. Build AI service layer (`packages/api/src/services/ai.service.ts`)

```typescript
export const aiService = {
  /**
   * Generate embeddings for a batch of texts
   * @param texts Array of strings to embed
   * @returns Array of 1536-dimensional vectors
   */
  async generateEmbeddings(texts: string[]): Promise<number[][]> {
    const response = await withRetry(() =>
      openai.embeddings.create({
        model: AI_CONFIG.embeddingModel,
        input: texts,
        dimensions: AI_CONFIG.embeddingDimensions,
      }),
    );
    tokenTracker.track(AI_CONFIG.embeddingModel, response.usage.prompt_tokens, 0);
    return response.data.map((d) => d.embedding);
  },

  /**
   * Send a chat completion request and parse JSON response
   * @param prompt System + user prompt
   * @returns Parsed JSON object
   */
  async chatJSON<T>(prompt: string, systemPrompt?: string): Promise<T> {
    const response = await withRetry(() =>
      openai.chat.completions.create({
        model: AI_CONFIG.chatModel,
        messages: [
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          { role: 'user' as const, content: prompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: AI_CONFIG.maxTokens,
      }),
    );

    tokenTracker.track(
      AI_CONFIG.chatModel,
      response.usage?.prompt_tokens || 0,
      response.usage?.completion_tokens || 0,
    );

    const content = response.choices[0]?.message?.content;
    if (!content) throw new AppError(502, 'Empty AI response');

    try {
      return JSON.parse(content) as T;
    } catch {
      throw new AppError(502, 'AI returned invalid JSON', 'AI_PARSE_ERROR', { raw: content });
    }
  },

  /**
   * Send a chat completion for free-form text (PRDs, etc.)
   */
  async chatText(prompt: string, systemPrompt?: string): Promise<string> {
    const response = await withRetry(() =>
      openai.chat.completions.create({
        model: AI_CONFIG.chatModel,
        messages: [
          ...(systemPrompt ? [{ role: 'system' as const, content: systemPrompt }] : []),
          { role: 'user' as const, content: prompt },
        ],
        temperature: 0.5,
        max_tokens: AI_CONFIG.maxTokens,
      }),
    );

    tokenTracker.track(
      AI_CONFIG.chatModel,
      response.usage?.prompt_tokens || 0,
      response.usage?.completion_tokens || 0,
    );

    return response.choices[0]?.message?.content || '';
  },

  /**
   * Get current session token usage and cost
   */
  getUsage(): SessionUsage {
    return tokenTracker.getSessionUsage();
  },

  /**
   * Check if AI is configured and reachable
   */
  async healthCheck(): Promise<{ connected: boolean; model: string }> {
    try {
      await openai.models.retrieve(AI_CONFIG.chatModel);
      return { connected: true, model: AI_CONFIG.chatModel };
    } catch {
      return { connected: false, model: AI_CONFIG.chatModel };
    }
  },
};
```

### 4. Add AI health check to health endpoint

Update `GET /api/health` to include AI status:

```json
{
  "status": "ok",
  "db": "connected",
  "redis": "connected",
  "ai": "connected",
  "model": "gpt-4o-mini"
}
```

## Acceptance Criteria

- [ ] `aiService.generateEmbeddings()` returns 1536-dim vectors for input texts
- [ ] `aiService.chatJSON()` returns parsed JSON from LLM response
- [ ] `aiService.chatJSON()` throws AppError(502) on malformed JSON response
- [ ] `aiService.chatText()` returns plain text string from LLM
- [ ] Rate limit (429) triggers exponential backoff retry (up to 3 attempts)
- [ ] Token usage tracked per call with model, prompt tokens, completion tokens
- [ ] Cost estimated correctly per model pricing table
- [ ] `aiService.getUsage()` returns cumulative session usage
- [ ] `aiService.healthCheck()` returns connected status when API key valid
- [ ] `aiService.healthCheck()` returns disconnected when API key missing/invalid
- [ ] Health endpoint includes AI status

## Complexity Estimate

**M (Medium)** — The OpenAI SDK handles most complexity. Main work is retry logic, JSON parsing safety, token tracking, and creating a clean service interface.

## Risk Factors & Mitigations

| Risk                                          | Impact                           | Mitigation                                                                             |
| --------------------------------------------- | -------------------------------- | -------------------------------------------------------------------------------------- |
| OpenAI API key not set                        | High — all AI features fail      | `healthCheck()` returns clear status; UI shows "AI not configured" warning             |
| Rate limiting on embedding API                | Medium — batch processing stalls | Exponential backoff with retry-after header; batch size tunable                        |
| JSON parsing failure from LLM                 | Medium — pipeline errors         | `response_format: json_object` ensures valid JSON; fallback parsing with error logging |
| Cost runaway on large datasets                | Medium — unexpected API bill     | Token tracker logs every call; expose estimated cost before triggering synthesis       |
| Model not available (gpt-4o-mini deprecation) | Low — AI calls fail              | Model name in env var, easily changed; healthCheck verifies model availability         |
