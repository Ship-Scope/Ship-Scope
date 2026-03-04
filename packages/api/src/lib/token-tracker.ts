import { logger } from './logger';

interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

interface CostEntry {
  model: string;
  operation: 'chat' | 'embedding';
  usage: TokenUsage;
  cost: number;
  timestamp: Date;
}

// Pricing per 1M tokens (as of 2024)
const PRICING: Record<string, { input: number; output: number }> = {
  'gpt-4o-mini': { input: 0.15, output: 0.6 },
  'gpt-4o': { input: 2.5, output: 10 },
  'text-embedding-3-small': { input: 0.02, output: 0 },
  'text-embedding-3-large': { input: 0.13, output: 0 },
};

class TokenTracker {
  private entries: CostEntry[] = [];
  private sessionStart = new Date();

  track(model: string, operation: 'chat' | 'embedding', usage: TokenUsage): CostEntry {
    const pricing = PRICING[model] || { input: 0, output: 0 };
    const cost =
      (usage.promptTokens / 1_000_000) * pricing.input +
      (usage.completionTokens / 1_000_000) * pricing.output;

    const entry: CostEntry = {
      model,
      operation,
      usage,
      cost,
      timestamp: new Date(),
    };

    this.entries.push(entry);

    logger.info('Token usage tracked', {
      model,
      operation,
      promptTokens: usage.promptTokens,
      completionTokens: usage.completionTokens,
      cost: `$${cost.toFixed(6)}`,
    });

    return entry;
  }

  getSessionStats() {
    const totalCost = this.entries.reduce((sum, e) => sum + e.cost, 0);
    const totalPromptTokens = this.entries.reduce((sum, e) => sum + e.usage.promptTokens, 0);
    const totalCompletionTokens = this.entries.reduce(
      (sum, e) => sum + e.usage.completionTokens,
      0,
    );
    const totalTokens = this.entries.reduce((sum, e) => sum + e.usage.totalTokens, 0);

    return {
      sessionStart: this.sessionStart,
      totalCalls: this.entries.length,
      totalPromptTokens,
      totalCompletionTokens,
      totalTokens,
      totalCost,
      byModel: this.groupByModel(),
    };
  }

  private groupByModel() {
    const groups: Record<string, { calls: number; tokens: number; cost: number }> = {};
    for (const entry of this.entries) {
      if (!groups[entry.model]) {
        groups[entry.model] = { calls: 0, tokens: 0, cost: 0 };
      }
      groups[entry.model].calls++;
      groups[entry.model].tokens += entry.usage.totalTokens;
      groups[entry.model].cost += entry.cost;
    }
    return groups;
  }

  reset() {
    this.entries = [];
    this.sessionStart = new Date();
  }
}

export const tokenTracker = new TokenTracker();
export type { TokenUsage, CostEntry };
