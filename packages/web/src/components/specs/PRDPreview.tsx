import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import type { Components } from 'react-markdown';

interface PRDPreviewProps {
  markdown: string;
}

const components: Components = {
  h1: ({ children }) => (
    <h1 className="text-xl font-bold text-text-primary mb-4 pb-2 border-b border-border">
      {children}
    </h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-semibold text-text-primary mt-6 mb-3">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-sm font-semibold text-text-primary mt-4 mb-2">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-sm text-text-secondary mb-3 leading-relaxed">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="list-disc list-inside text-sm text-text-secondary mb-3 space-y-1">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="list-decimal list-inside text-sm text-text-secondary mb-3 space-y-1">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="text-sm text-text-secondary">{children}</li>,
  code: ({ className, children }) => {
    const isInline = !className;
    if (isInline) {
      return (
        <code className="px-1.5 py-0.5 text-xs bg-bg-surface-2 text-accent-blue rounded font-mono">
          {children}
        </code>
      );
    }
    return <code className={`${className || ''} text-xs`}>{children}</code>;
  },
  pre: ({ children }) => (
    <pre className="bg-bg-surface-2 rounded-lg p-3 mb-3 overflow-x-auto text-xs font-mono">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-3">
      <table className="w-full text-sm text-text-secondary border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="text-left text-xs font-medium text-text-muted uppercase tracking-wider px-3 py-2 border-b border-border">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="px-3 py-2 text-sm text-text-secondary border-b border-border/50">{children}</td>
  ),
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-accent-blue pl-4 my-3 text-sm text-text-muted italic">
      {children}
    </blockquote>
  ),
  strong: ({ children }) => <strong className="text-text-primary font-semibold">{children}</strong>,
  em: ({ children }) => <em className="text-text-muted">{children}</em>,
  hr: () => <hr className="border-border my-4" />,
};

export function PRDPreview({ markdown }: PRDPreviewProps) {
  return (
    <div className="spec-markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={components}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
