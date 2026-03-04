import { openai, AI_CONFIG } from '../lib/openai';
import { tokenTracker, type TokenUsage } from '../lib/token-tracker';
import { logger } from '../lib/logger';

/** Generate embeddings for a batch of texts. Returns array of float vectors. */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];

  const response = await openai.embeddings.create({
    model: AI_CONFIG.embeddingModel,
    input: texts,
    dimensions: AI_CONFIG.embeddingDimensions,
  });

  const usage: TokenUsage = {
    promptTokens: response.usage.prompt_tokens,
    completionTokens: 0,
    totalTokens: response.usage.total_tokens,
  };
  tokenTracker.track(AI_CONFIG.embeddingModel, 'embedding', usage);

  // Sort by index to preserve order
  return response.data.sort((a, b) => a.index - b.index).map((d) => d.embedding);
}

/** Send a chat completion request and return parsed JSON. */
export async function chatCompletion<T = unknown>(
  systemPrompt: string,
  userPrompt: string,
): Promise<T> {
  const response = await openai.chat.completions.create({
    model: AI_CONFIG.chatModel,
    temperature: 0.3,
    max_tokens: AI_CONFIG.maxTokens,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from AI model');
  }

  if (response.usage) {
    const usage: TokenUsage = {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    };
    tokenTracker.track(AI_CONFIG.chatModel, 'chat', usage);
  }

  try {
    return JSON.parse(content) as T;
  } catch {
    logger.error('Failed to parse AI JSON response', { content: content.slice(0, 500) });
    throw new Error('AI returned invalid JSON');
  }
}

/** Send a chat completion request and return raw text (for markdown/free-form output). */
export async function chatCompletionText(
  systemPrompt: string,
  userPrompt: string,
): Promise<string> {
  const response = await openai.chat.completions.create({
    model: AI_CONFIG.chatModel,
    temperature: 0.3,
    max_tokens: 8192,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error('Empty response from AI model');
  }

  if (response.usage) {
    const usage: TokenUsage = {
      promptTokens: response.usage.prompt_tokens,
      completionTokens: response.usage.completion_tokens,
      totalTokens: response.usage.total_tokens,
    };
    tokenTracker.track(AI_CONFIG.chatModel, 'chat', usage);
  }

  return content;
}

/** Get current token usage stats for the session. */
export function getTokenStats() {
  return tokenTracker.getSessionStats();
}
