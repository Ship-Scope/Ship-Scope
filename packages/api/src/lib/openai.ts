import OpenAI from 'openai';

if (!process.env.OPENAI_API_KEY) {
  // eslint-disable-next-line no-console
  console.warn('OPENAI_API_KEY not set — AI features will be unavailable');
}

export const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || '',
  maxRetries: 3,
  timeout: 60_000,
});

export const AI_CONFIG = {
  chatModel: process.env.AI_MODEL || 'gpt-4o-mini',
  embeddingModel: process.env.EMBEDDING_MODEL || 'text-embedding-3-small',
  embeddingDimensions: 1536,
  maxTokens: 4096,
} as const;
