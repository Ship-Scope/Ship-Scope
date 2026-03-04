import { Copy, Download, RefreshCw } from 'lucide-react';
import { useState } from 'react';

interface SpecActionsProps {
  content: string;
  filename: string;
  onRegenerate: () => void;
  isRegenerating: boolean;
}

export function SpecActions({ content, filename, onRegenerate, isRegenerating }: SpecActionsProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={handleCopy}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary bg-bg-surface-2 rounded-lg hover:bg-bg-surface-2/80 transition-colors"
      >
        <Copy className="w-3.5 h-3.5" />
        {copied ? 'Copied!' : 'Copy'}
      </button>
      <button
        onClick={handleDownload}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-text-secondary bg-bg-surface-2 rounded-lg hover:bg-bg-surface-2/80 transition-colors"
      >
        <Download className="w-3.5 h-3.5" />
        Download
      </button>
      <button
        onClick={onRegenerate}
        disabled={isRegenerating}
        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-accent-blue bg-accent-blue/10 rounded-lg hover:bg-accent-blue/20 transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
        {isRegenerating ? 'Regenerating...' : 'Regenerate'}
      </button>
    </div>
  );
}
