import { useState } from 'react';
import { X } from 'lucide-react';
import { PRDPreview } from './PRDPreview';
import { AgentPromptBlock } from './AgentPromptBlock';
import { SpecActions } from './SpecActions';
import { useGenerateSpec, useAgentPrompt } from '@/hooks/useSpecs';
import { type SpecItem } from '@/lib/api';

interface SpecDetailProps {
  spec: SpecItem;
  onClose: () => void;
}

type Tab = 'prd' | 'prompt';

export function SpecDetail({ spec, onClose }: SpecDetailProps) {
  const [activeTab, setActiveTab] = useState<Tab>('prd');
  const generateMutation = useGenerateSpec();
  const { data: promptText } = useAgentPrompt(activeTab === 'prompt' ? spec.id : null, 'cursor');

  const activeContent =
    activeTab === 'prd' ? spec.prdMarkdown || '' : promptText || spec.agentPrompt || '';

  const filename =
    activeTab === 'prd'
      ? `${spec.proposal.title.replace(/\s+/g, '-').toLowerCase()}-prd-v${spec.version}.md`
      : `${spec.proposal.title.replace(/\s+/g, '-').toLowerCase()}-cursor-prompt.md`;

  return (
    <div className="fixed top-0 right-0 h-full w-[480px] bg-bg-surface border-l border-border flex flex-col z-50">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <div className="flex-1 min-w-0 mr-3">
          <h2 className="text-sm font-semibold text-text-primary truncate">
            {spec.proposal.title}
          </h2>
          <p className="text-xs text-text-muted mt-0.5">
            Version {spec.version} &middot; {new Date(spec.updatedAt).toLocaleDateString()}
          </p>
        </div>
        <button onClick={onClose} className="p-1 rounded-lg hover:bg-bg-surface-2 text-text-muted">
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setActiveTab('prd')}
          className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
            activeTab === 'prd'
              ? 'text-accent-blue border-b-2 border-accent-blue'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          PRD
        </button>
        <button
          onClick={() => setActiveTab('prompt')}
          className={`flex-1 px-4 py-2.5 text-xs font-medium transition-colors ${
            activeTab === 'prompt'
              ? 'text-accent-blue border-b-2 border-accent-blue'
              : 'text-text-muted hover:text-text-secondary'
          }`}
        >
          Agent Prompt
        </button>
      </div>

      {/* Actions Bar */}
      <div className="px-4 py-2.5 border-b border-border">
        <SpecActions
          content={activeContent}
          filename={filename}
          onRegenerate={() => generateMutation.mutate(spec.proposalId)}
          isRegenerating={generateMutation.isPending}
        />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4">
        {activeTab === 'prd' ? (
          spec.prdMarkdown ? (
            <PRDPreview markdown={spec.prdMarkdown} />
          ) : (
            <p className="text-sm text-text-muted text-center py-8">
              No PRD content generated yet.
            </p>
          )
        ) : (
          <AgentPromptBlock specId={spec.id} />
        )}
      </div>
    </div>
  );
}
