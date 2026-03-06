# 03 -- Spec Viewer UI

## Objective

Build the frontend spec viewer page and supporting components. The spec viewer is the culmination of the ShipScope pipeline: users land here after approving a proposal, click "Generate Spec," and see a full PRD rendered as rich markdown alongside an exportable agent-ready prompt. The page includes two tabs (PRD and Agent Prompt), markdown rendering with syntax highlighting, a format toggle for Cursor vs Claude Code, clipboard copy, markdown file download, and a regenerate action. The design follows the established dark theme design system (bg #07080A, surface #0D0F12, accent blue #3B82F6, text #E8ECF1).

## Dependencies

- 01 (PRD Generation) -- needs POST /api/specs/generate/:proposalId and GET /api/specs/:id
- 02 (Agent Prompt Export) -- needs GET /api/specs/:id/agent-prompt?format=cursor|claude-code
- Phase 1: Frontend scaffold (layout shell, sidebar, routing)
- Phase 4: Proposals page (proposal detail view with "Generate Spec" trigger)

## Files to Create

| File                                                     | Purpose                                 |
| -------------------------------------------------------- | --------------------------------------- |
| `packages/web/src/pages/SpecsPage.tsx`                   | Route-level page component for /specs   |
| `packages/web/src/components/specs/SpecViewer.tsx`       | Main spec viewer container with tabs    |
| `packages/web/src/components/specs/PRDPreview.tsx`       | Markdown renderer for PRD content       |
| `packages/web/src/components/specs/AgentPromptBlock.tsx` | Agent prompt display with format toggle |
| `packages/web/src/components/specs/SpecActions.tsx`      | Copy, download, regenerate action bar   |
| `packages/web/src/components/specs/SpecCard.tsx`         | Card for specs list view                |
| `packages/web/src/components/specs/FormatToggle.tsx`     | Cursor/Claude Code toggle component     |
| `packages/web/src/hooks/useSpecs.ts`                     | React Query hooks for spec API calls    |

## Files to Modify

| File                          | Changes                                                        |
| ----------------------------- | -------------------------------------------------------------- |
| `packages/web/src/lib/api.ts` | Add spec API functions (generateSpec, getSpec, getAgentPrompt) |
| `packages/web/src/App.tsx`    | Add /specs and /specs/:id routes (if not already present)      |

## Detailed Sub-Tasks

### 1. Build the spec API client functions (`packages/web/src/lib/api.ts`)

Add typed API functions for all spec endpoints.

```typescript
// Add to packages/web/src/lib/api.ts

import type {
  SpecResponse,
  SpecGenerationResult,
  AgentPromptFormat,
} from '@shipscope/core/types/spec';

export const specApi = {
  /** Generate a spec from an approved proposal */
  generateSpec: (proposalId: string): Promise<SpecGenerationResult> =>
    api.post(`/specs/generate/${proposalId}`).then((r) => r.data),

  /** Get a spec by ID */
  getSpec: (specId: string): Promise<SpecResponse> =>
    api.get(`/specs/${specId}`).then((r) => r.data),

  /** Get a spec by proposal ID */
  getSpecByProposal: (proposalId: string): Promise<SpecResponse> =>
    api.get(`/specs/by-proposal/${proposalId}`).then((r) => r.data),

  /** Get PRD markdown only */
  getPRD: (specId: string): Promise<string> => api.get(`/specs/${specId}/prd`).then((r) => r.data),

  /** Get agent prompt in specified format */
  getAgentPrompt: (specId: string, format: AgentPromptFormat = 'cursor'): Promise<string> =>
    api.get(`/specs/${specId}/agent-prompt`, { params: { format } }).then((r) => r.data),
};
```

### 2. Build the React Query hooks (`packages/web/src/hooks/useSpecs.ts`)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { specApi } from '../lib/api';
import type { AgentPromptFormat } from '@shipscope/core/types/spec';

export function useSpec(specId: string | undefined) {
  return useQuery({
    queryKey: ['specs', specId],
    queryFn: () => specApi.getSpec(specId!),
    enabled: !!specId,
  });
}

export function useSpecByProposal(proposalId: string | undefined) {
  return useQuery({
    queryKey: ['specs', 'by-proposal', proposalId],
    queryFn: () => specApi.getSpecByProposal(proposalId!),
    enabled: !!proposalId,
    retry: false, // 404 is expected if no spec exists yet
  });
}

export function useAgentPrompt(specId: string | undefined, format: AgentPromptFormat) {
  return useQuery({
    queryKey: ['specs', specId, 'agent-prompt', format],
    queryFn: () => specApi.getAgentPrompt(specId!, format),
    enabled: !!specId,
  });
}

export function useGenerateSpec() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (proposalId: string) => specApi.generateSpec(proposalId),
    onSuccess: (data) => {
      // Invalidate spec queries so the viewer refreshes
      qc.invalidateQueries({ queryKey: ['specs'] });
      // Also invalidate proposal queries (spec may change proposal state)
      qc.invalidateQueries({ queryKey: ['proposals'] });
    },
  });
}
```

### 3. Build the SpecsPage (`packages/web/src/pages/SpecsPage.tsx`)

The top-level page shows a list of generated specs (linked to their proposals) or navigates to a specific spec viewer. Uses React Router for /specs (list) and /specs/:id (detail).

```typescript
import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FileText, Plus } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { SpecViewer } from '../components/specs/SpecViewer';
import { SpecCard } from '../components/specs/SpecCard';

function SpecsPage() {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();

  // If we have an ID, show the spec viewer
  if (id) {
    return <SpecViewer specId={id} />;
  }

  // Otherwise, show the specs list
  return <SpecsList />;
}

function SpecsList() {
  // Fetch all specs (could be a dedicated list endpoint, or fetch via proposals)
  // For V1, specs are accessed through the proposal detail view
  // The specs list shows all proposals that have generated specs

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#E8ECF1]">Specs</h1>
          <p className="text-sm text-[#8B95A5] mt-1">
            Generated PRDs and agent-ready prompts from approved proposals
          </p>
        </div>
      </div>

      {/* Specs grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Map over specs and render SpecCards */}
        {/* Empty state when no specs exist */}
      </div>

      {/* Empty state */}
      {/* Show when no specs have been generated yet */}
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="w-12 h-12 rounded-xl bg-[#3B82F620] flex items-center justify-center mb-4">
          <FileText size={24} className="text-[#3B82F6]" />
        </div>
        <h3 className="text-lg font-medium text-[#E8ECF1] mb-2">
          No specs generated yet
        </h3>
        <p className="text-sm text-[#8B95A5] max-w-md">
          Approve a proposal first, then generate a spec to create a full PRD
          and agent-ready development prompt.
        </p>
      </div>
    </div>
  );
}

export { SpecsPage };
```

### 4. Build the SpecViewer container (`packages/web/src/components/specs/SpecViewer.tsx`)

The main viewer component with tab switching between PRD and Agent Prompt views.

```typescript
import { useState } from 'react';
import { FileText, Terminal, RefreshCw, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSpec, useGenerateSpec } from '../../hooks/useSpecs';
import { PRDPreview } from './PRDPreview';
import { AgentPromptBlock } from './AgentPromptBlock';
import { SpecActions } from './SpecActions';
import type { AgentPromptFormat } from '@shipscope/core/types/spec';

type Tab = 'prd' | 'agent-prompt';

interface SpecViewerProps {
  specId: string;
}

function SpecViewer({ specId }: SpecViewerProps) {
  const [activeTab, setActiveTab] = useState<Tab>('prd');
  const [agentFormat, setAgentFormat] = useState<AgentPromptFormat>('cursor');
  const navigate = useNavigate();

  const { data: spec, isLoading, error } = useSpec(specId);
  const regenerate = useGenerateSpec();

  const handleRegenerate = () => {
    if (!spec) return;
    regenerate.mutate(spec.proposalId);
  };

  if (isLoading) {
    return <SpecViewerSkeleton />;
  }

  if (error || !spec) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <p className="text-[#FB7185]">Failed to load spec.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/specs')}
          className="p-2 rounded-lg text-[#8B95A5] hover:text-[#E8ECF1] hover:bg-[#13161B] transition-all duration-200"
        >
          <ArrowLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold text-[#E8ECF1]">
            {spec.proposal.title}
          </h1>
          <p className="text-sm text-[#8B95A5] mt-1">
            Version {spec.version} -- Generated {new Date(spec.updatedAt).toLocaleDateString()}
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-[#1C2028] pb-px">
        <TabButton
          active={activeTab === 'prd'}
          onClick={() => setActiveTab('prd')}
          icon={<FileText size={16} />}
          label="PRD"
        />
        <TabButton
          active={activeTab === 'agent-prompt'}
          onClick={() => setActiveTab('agent-prompt')}
          icon={<Terminal size={16} />}
          label="Agent Prompt"
        />
      </div>

      {/* Action bar */}
      <SpecActions
        specId={specId}
        activeTab={activeTab}
        agentFormat={agentFormat}
        prdContent={spec.prd}
        onRegenerate={handleRegenerate}
        isRegenerating={regenerate.isPending}
      />

      {/* Content */}
      <div className="bg-[#0D0F12] border border-[#1C2028] rounded-xl overflow-hidden">
        {activeTab === 'prd' && (
          <PRDPreview markdown={spec.prd || ''} />
        )}
        {activeTab === 'agent-prompt' && (
          <AgentPromptBlock
            specId={specId}
            format={agentFormat}
            onFormatChange={setAgentFormat}
          />
        )}
      </div>
    </div>
  );
}

// Tab button sub-component
function TabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-t-lg
        transition-all duration-200 border-b-2
        ${active
          ? 'text-[#3B82F6] border-[#3B82F6] bg-[#3B82F610]'
          : 'text-[#8B95A5] border-transparent hover:text-[#E8ECF1] hover:bg-[#13161B]'
        }
      `}
    >
      {icon}
      {label}
    </button>
  );
}

// Loading skeleton
function SpecViewerSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-64 bg-[#13161B] rounded" />
      <div className="h-4 w-40 bg-[#13161B] rounded" />
      <div className="flex gap-4">
        <div className="h-10 w-24 bg-[#13161B] rounded" />
        <div className="h-10 w-32 bg-[#13161B] rounded" />
      </div>
      <div className="h-96 bg-[#0D0F12] border border-[#1C2028] rounded-xl" />
    </div>
  );
}

export { SpecViewer };
```

### 5. Build the PRDPreview component (`packages/web/src/components/specs/PRDPreview.tsx`)

Renders PRD markdown as styled HTML with syntax highlighting for code blocks. Uses `react-markdown` with `rehype-highlight` for code highlighting and `remark-gfm` for GitHub-flavored markdown (tables, strikethrough, task lists).

```typescript
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';

interface PRDPreviewProps {
  markdown: string;
}

function PRDPreview({ markdown }: PRDPreviewProps) {
  if (!markdown) {
    return (
      <div className="p-8 text-center text-[#5A6478]">
        No PRD content available. Click "Generate" to create one.
      </div>
    );
  }

  return (
    <div className="p-6 md:p-8 prose prose-invert prose-sm max-w-none spec-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Custom heading styles
          h1: ({ children }) => (
            <h1 className="text-2xl font-semibold text-[#E8ECF1] border-b border-[#1C2028] pb-3 mb-6">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold text-[#E8ECF1] mt-8 mb-4 flex items-center gap-2">
              <span className="w-1 h-5 bg-[#3B82F6] rounded-full" />
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-base font-medium text-[#E8ECF1] mt-6 mb-3">
              {children}
            </h3>
          ),
          // Styled paragraphs
          p: ({ children }) => (
            <p className="text-sm text-[#8B95A5] leading-relaxed mb-4">{children}</p>
          ),
          // Styled lists
          ul: ({ children }) => (
            <ul className="text-sm text-[#8B95A5] space-y-2 mb-4 list-disc list-inside">
              {children}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="text-sm text-[#8B95A5] space-y-2 mb-4 list-decimal list-inside">
              {children}
            </ol>
          ),
          li: ({ children }) => (
            <li className="text-sm text-[#8B95A5]">{children}</li>
          ),
          // Code blocks
          code: ({ inline, className, children, ...props }: any) => {
            if (inline) {
              return (
                <code
                  className="bg-[#13161B] text-[#38BDF8] px-1.5 py-0.5 rounded text-xs font-mono"
                  {...props}
                >
                  {children}
                </code>
              );
            }
            return (
              <code className={`${className} text-xs`} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => (
            <pre className="bg-[#13161B] border border-[#1C2028] rounded-lg p-4 overflow-x-auto mb-4 text-xs">
              {children}
            </pre>
          ),
          // Styled blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-[#3B82F6] pl-4 py-1 text-sm text-[#8B95A5] italic mb-4">
              {children}
            </blockquote>
          ),
          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto mb-4">
              <table className="w-full text-sm border-collapse border border-[#1C2028] rounded-lg">
                {children}
              </table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-[#13161B]">{children}</thead>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2 text-left text-xs text-[#5A6478] font-medium uppercase tracking-wider border border-[#1C2028]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2 text-sm text-[#8B95A5] border border-[#1C2028]">
              {children}
            </td>
          ),
          // Horizontal rules
          hr: () => <hr className="border-[#1C2028] my-8" />,
          // Strong emphasis
          strong: ({ children }) => (
            <strong className="text-[#E8ECF1] font-semibold">{children}</strong>
          ),
        }}
      />
    </div>
  );
}

export { PRDPreview };
```

**Required npm packages:**

```bash
cd packages/web
npm install react-markdown rehype-highlight remark-gfm
npm install -D @types/react-markdown  # if needed
```

**Required CSS for syntax highlighting (add to globals.css):**

```css
/* packages/web/src/styles/globals.css -- append */

/* Syntax highlighting theme (One Dark inspired, matching ShipScope dark theme) */
.spec-markdown pre code.hljs {
  background: transparent;
  color: #8b95a5;
}
.spec-markdown .hljs-keyword {
  color: #c084fc;
}
.spec-markdown .hljs-string {
  color: #34d399;
}
.spec-markdown .hljs-number {
  color: #fbbf24;
}
.spec-markdown .hljs-comment {
  color: #5a6478;
  font-style: italic;
}
.spec-markdown .hljs-function {
  color: #3b82f6;
}
.spec-markdown .hljs-title {
  color: #818cf8;
}
.spec-markdown .hljs-type {
  color: #38bdf8;
}
.spec-markdown .hljs-built_in {
  color: #38bdf8;
}
.spec-markdown .hljs-attr {
  color: #fb7185;
}
.spec-markdown .hljs-variable {
  color: #e8ecf1;
}
.spec-markdown .hljs-punctuation {
  color: #8b95a5;
}
```

### 6. Build the AgentPromptBlock component (`packages/web/src/components/specs/AgentPromptBlock.tsx`)

Displays the agent-ready prompt with a format toggle at the top. The prompt is rendered as a preformatted text block (not as markdown -- it should look like something the user will copy/paste).

```typescript
import { useState, useEffect } from 'react';
import { useAgentPrompt } from '../../hooks/useSpecs';
import { FormatToggle } from './FormatToggle';
import type { AgentPromptFormat } from '@shipscope/core/types/spec';

interface AgentPromptBlockProps {
  specId: string;
  format: AgentPromptFormat;
  onFormatChange: (format: AgentPromptFormat) => void;
}

function AgentPromptBlock({ specId, format, onFormatChange }: AgentPromptBlockProps) {
  const { data: prompt, isLoading, error } = useAgentPrompt(specId, format);

  if (isLoading) {
    return (
      <div className="p-8 animate-pulse">
        <div className="h-4 w-48 bg-[#13161B] rounded mb-6" />
        <div className="space-y-3">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="h-3 bg-[#13161B] rounded" style={{ width: `${60 + Math.random() * 40}%` }} />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center text-[#FB7185]">
        Failed to load agent prompt. Try regenerating the spec.
      </div>
    );
  }

  return (
    <div>
      {/* Format toggle bar */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-[#1C2028] bg-[#0D0F12]">
        <span className="text-xs text-[#5A6478] uppercase tracking-wider font-medium">
          Agent Format
        </span>
        <FormatToggle value={format} onChange={onFormatChange} />
      </div>

      {/* Prompt content */}
      <div className="p-6 md:p-8">
        <pre className="text-sm text-[#8B95A5] font-mono leading-relaxed whitespace-pre-wrap break-words">
          {prompt}
        </pre>
      </div>
    </div>
  );
}

export { AgentPromptBlock };
```

### 7. Build the FormatToggle component (`packages/web/src/components/specs/FormatToggle.tsx`)

A segmented control toggling between Cursor and Claude Code formats.

```typescript
import type { AgentPromptFormat } from '@shipscope/core/types/spec';

interface FormatToggleProps {
  value: AgentPromptFormat;
  onChange: (format: AgentPromptFormat) => void;
}

function FormatToggle({ value, onChange }: FormatToggleProps) {
  const options: { value: AgentPromptFormat; label: string }[] = [
    { value: 'cursor', label: 'Cursor' },
    { value: 'claude-code', label: 'Claude Code' },
  ];

  return (
    <div className="flex items-center bg-[#13161B] rounded-lg p-0.5">
      {options.map(option => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`
            px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200
            ${value === option.value
              ? 'bg-[#3B82F6] text-white shadow-sm'
              : 'text-[#8B95A5] hover:text-[#E8ECF1]'
            }
          `}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export { FormatToggle };
```

### 8. Build the SpecActions component (`packages/web/src/components/specs/SpecActions.tsx`)

Action bar with Copy, Download, and Regenerate buttons.

```typescript
import { useState } from 'react';
import { Copy, Download, RefreshCw, Check } from 'lucide-react';
import type { AgentPromptFormat } from '@shipscope/core/types/spec';
import { specApi } from '../../lib/api';

interface SpecActionsProps {
  specId: string;
  activeTab: 'prd' | 'agent-prompt';
  agentFormat: AgentPromptFormat;
  prdContent: string | null;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

function SpecActions({
  specId,
  activeTab,
  agentFormat,
  prdContent,
  onRegenerate,
  isRegenerating,
}: SpecActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      let content: string;

      if (activeTab === 'prd') {
        content = prdContent || '';
      } else {
        content = await specApi.getAgentPrompt(specId, agentFormat);
      }

      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy to clipboard:', err);
    }
  };

  const handleDownload = async () => {
    try {
      let content: string;
      let filename: string;

      if (activeTab === 'prd') {
        content = prdContent || '';
        filename = `prd-${specId}.md`;
      } else {
        content = await specApi.getAgentPrompt(specId, agentFormat);
        filename = `agent-prompt-${agentFormat}-${specId}.md`;
      }

      const blob = new Blob([content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to download:', err);
    }
  };

  return (
    <div className="flex items-center gap-2">
      {/* Copy to clipboard */}
      <button
        onClick={handleCopy}
        className="flex items-center gap-2 px-3 py-2 text-sm text-[#8B95A5]
          bg-[#0D0F12] border border-[#1C2028] rounded-lg
          hover:border-[#2A303C] hover:text-[#E8ECF1]
          transition-all duration-200"
      >
        {copied ? (
          <>
            <Check size={16} className="text-[#34D399]" />
            <span className="text-[#34D399]">Copied!</span>
          </>
        ) : (
          <>
            <Copy size={16} />
            <span>Copy {activeTab === 'prd' ? 'PRD' : 'Prompt'}</span>
          </>
        )}
      </button>

      {/* Download as .md */}
      <button
        onClick={handleDownload}
        className="flex items-center gap-2 px-3 py-2 text-sm text-[#8B95A5]
          bg-[#0D0F12] border border-[#1C2028] rounded-lg
          hover:border-[#2A303C] hover:text-[#E8ECF1]
          transition-all duration-200"
      >
        <Download size={16} />
        <span>Download .md</span>
      </button>

      {/* Regenerate */}
      <button
        onClick={onRegenerate}
        disabled={isRegenerating}
        className="flex items-center gap-2 px-3 py-2 text-sm
          bg-white text-[#07080A] rounded-lg font-medium
          hover:shadow-lg transition-all duration-200
          disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw size={16} className={isRegenerating ? 'animate-spin' : ''} />
        <span>{isRegenerating ? 'Generating...' : 'Regenerate'}</span>
      </button>
    </div>
  );
}

export { SpecActions };
```

### 9. Build the SpecCard component (`packages/web/src/components/specs/SpecCard.tsx`)

Card for the specs list view showing proposal title, generation date, and version.

```typescript
import { FileText, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import type { SpecResponse } from '@shipscope/core/types/spec';

interface SpecCardProps {
  spec: SpecResponse;
}

function SpecCard({ spec }: SpecCardProps) {
  const navigate = useNavigate();

  return (
    <button
      onClick={() => navigate(`/specs/${spec.id}`)}
      className="w-full text-left bg-[#0D0F12] border border-[#1C2028] rounded-xl p-5
        hover:border-[#2A303C] transition-all duration-200 group"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[#3B82F620] flex items-center justify-center flex-shrink-0">
            <FileText size={18} className="text-[#3B82F6]" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-medium text-[#E8ECF1] truncate">
              {spec.proposal.title}
            </h3>
            <p className="text-xs text-[#5A6478] mt-1">
              v{spec.version} -- {new Date(spec.updatedAt).toLocaleDateString()}
            </p>
          </div>
        </div>
        <ChevronRight
          size={16}
          className="text-[#5A6478] group-hover:text-[#8B95A5] transition-colors flex-shrink-0 mt-1"
        />
      </div>

      {/* RICE score badge */}
      {spec.proposal.riceScore && (
        <div className="mt-3 flex items-center gap-2">
          <span className="text-xs font-mono text-[#FBBF24] bg-[#FBBF2420] px-2 py-0.5 rounded">
            RICE {spec.proposal.riceScore.toFixed(1)}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded ${
            spec.proposal.status === 'approved'
              ? 'bg-[#34D39920] text-[#34D399]'
              : 'bg-[#3B82F620] text-[#3B82F6]'
          }`}>
            {spec.proposal.status}
          </span>
        </div>
      )}
    </button>
  );
}

export { SpecCard };
```

### 10. Add "Generate Spec" button to proposal detail view

Add a trigger in the proposals page that navigates to spec generation for approved proposals.

```typescript
// In packages/web/src/components/proposals/ProposalDetail.tsx
// Add this button when proposal.status === 'approved':

{proposal.status === 'approved' && (
  <button
    onClick={() => {
      generateSpec.mutate(proposal.id, {
        onSuccess: (result) => {
          navigate(`/specs/${result.spec.id}`);
        },
      });
    }}
    disabled={generateSpec.isPending}
    className="flex items-center gap-2 px-4 py-2 text-sm
      bg-white text-[#07080A] rounded-lg font-medium
      hover:shadow-lg transition-all duration-200
      disabled:opacity-50"
  >
    <FileText size={16} />
    {generateSpec.isPending ? 'Generating...' : 'Generate Spec'}
  </button>
)}
```

### 11. Add routes to App.tsx

Ensure the specs routes are registered in the application router.

```typescript
// packages/web/src/App.tsx -- add these routes inside the Router:

import { SpecsPage } from './pages/SpecsPage';

// Inside route configuration:
<Route path="/specs" element={<SpecsPage />} />
<Route path="/specs/:id" element={<SpecsPage />} />
```

## Acceptance Criteria

- [ ] SpecsPage renders at /specs with a list of generated specs as SpecCard components
- [ ] SpecsPage renders at /specs/:id with the SpecViewer component
- [ ] Empty state shown when no specs exist (icon, title, description)
- [ ] SpecViewer has two tabs: "PRD" and "Agent Prompt" with tab button styling
- [ ] PRD tab renders markdown with `react-markdown` + `rehype-highlight` + `remark-gfm`
- [ ] PRD headings styled with accent blue marker (h2)
- [ ] Code blocks have syntax highlighting matching the dark theme
- [ ] Tables render with proper borders and header styling
- [ ] Agent Prompt tab displays preformatted text (font-mono, whitespace-pre-wrap)
- [ ] FormatToggle switches between "Cursor" and "Claude Code" with segmented control UI
- [ ] Switching format re-fetches the agent prompt for the new format
- [ ] Copy button copies current tab content (PRD or agent prompt) to clipboard
- [ ] Copy button shows green "Copied!" feedback for 2 seconds
- [ ] Download button saves content as a .md file with descriptive filename
- [ ] Regenerate button calls POST /api/specs/generate/:proposalId
- [ ] Regenerate button shows spinner and "Generating..." text during generation
- [ ] After regeneration, the viewer refreshes to show the new content
- [ ] Version number displayed in the header (e.g., "Version 2")
- [ ] Loading state shows skeleton animation (not spinner)
- [ ] Error state shows a clear error message
- [ ] "Generate Spec" button appears on approved proposal detail view
- [ ] All components follow the design system (dark bg, surface cards, accent blue, proper text colors)
- [ ] All interactive elements have hover states with transition-all duration-200
- [ ] Responsive: works at 768px minimum width (tabs stack if needed)

## Complexity Estimate

**L (Large)** -- 8 new component files, 1 hooks file, API client additions, route configuration, markdown rendering with custom component overrides, syntax highlighting CSS, clipboard/download browser APIs, React Query integration with cache invalidation, loading/error states, and responsive layout.

## Risk Factors & Mitigations

| Risk                                                        | Impact                            | Mitigation                                                                                                        |
| ----------------------------------------------------------- | --------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| react-markdown bundle size bloats frontend                  | Medium -- slower page load        | Tree-shake unused plugins; only import rehype-highlight and remark-gfm; lazy-load PRDPreview                      |
| Syntax highlighting CSS conflicts with Tailwind             | Low -- code blocks look wrong     | Scope highlight CSS under `.spec-markdown` class; test with TypeScript, SQL, JSON code blocks                     |
| Clipboard API blocked in non-HTTPS contexts                 | Medium -- copy fails in dev       | Use `navigator.clipboard.writeText()` with try/catch; fall back to `document.execCommand('copy')` for HTTP        |
| Large PRDs cause performance issues in markdown renderer    | Low -- janky scroll               | PRDs are typically 2-4K tokens (~1-2 pages); react-markdown handles this fine; add virtualization only if needed  |
| Agent prompt fetch adds extra network request on tab switch | Low -- delay before content shows | React Query caches results; second fetch for same format is instant; show skeleton during first load              |
| Format toggle state lost on navigation                      | Low -- minor UX friction          | Format state lives in SpecViewer component; reset to 'cursor' default on mount; could persist in URL params later |
