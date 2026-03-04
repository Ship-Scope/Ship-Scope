import { type Proposal } from './proposal';

export type AgentPromptFormat = 'cursor' | 'claude_code';

export interface Spec {
  id: string;
  proposalId: string;
  prdMarkdown: string;
  agentPrompt: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface SpecWithProposal extends Spec {
  proposal: Proposal;
}

export interface GenerateSpecInput {
  proposalId: string;
}

export interface SpecGenerationResult {
  spec: SpecWithProposal;
  isRegeneration: boolean;
  previousVersion: number | null;
}
