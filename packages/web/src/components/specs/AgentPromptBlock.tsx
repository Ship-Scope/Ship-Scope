import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { FormatToggle } from './FormatToggle';
import { useAgentPrompt } from '@/hooks/useSpecs';

interface AgentPromptBlockProps {
  specId: string;
}

export function AgentPromptBlock({ specId }: AgentPromptBlockProps) {
  const [format, setFormat] = useState<'cursor' | 'claude_code'>('cursor');
  const { data: prompt, isLoading } = useAgentPrompt(specId, format);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">Format</span>
        <FormatToggle value={format} onChange={setFormat} />
      </div>
      {isLoading ? (
        <div className="flex items-center justify-center py-12 text-text-muted">
          <Loader2 className="w-5 h-5 animate-spin" />
        </div>
      ) : (
        <pre className="bg-bg-surface-2 rounded-lg p-4 text-xs text-text-secondary font-mono whitespace-pre-wrap overflow-x-auto max-h-[calc(100vh-320px)] overflow-y-auto">
          {prompt || 'No agent prompt available.'}
        </pre>
      )}
    </div>
  );
}

// Export a helper to get the prompt text for the actions bar
export { useAgentPrompt };
