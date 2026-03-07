import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  Search,
  BarChart3,
  MessageSquare,
  Brain,
  Lightbulb,
  FileText,
  Settings,
  Upload,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  action: () => void;
  keywords?: string[];
}

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const go = useCallback(
    (path: string) => {
      navigate(path);
      setOpen(false);
    },
    [navigate],
  );

  const commands: CommandItem[] = [
    {
      id: 'nav-dashboard',
      label: 'Dashboard',
      description: 'Overview and analytics',
      icon: BarChart3,
      action: () => go('/dashboard'),
      keywords: ['home', 'stats', 'overview'],
    },
    {
      id: 'nav-feedback',
      label: 'Feedback',
      description: 'View and manage feedback',
      icon: MessageSquare,
      action: () => go('/feedback'),
      keywords: ['reviews', 'comments', 'items'],
    },
    {
      id: 'nav-themes',
      label: 'Themes',
      description: 'Discovered feedback themes',
      icon: Brain,
      action: () => go('/themes'),
      keywords: ['topics', 'clusters', 'synthesis'],
    },
    {
      id: 'nav-proposals',
      label: 'Proposals',
      description: 'Feature proposals with RICE scoring',
      icon: Lightbulb,
      action: () => go('/proposals'),
      keywords: ['features', 'ideas', 'suggestions', 'rice'],
    },
    {
      id: 'nav-specs',
      label: 'Specs',
      description: 'PRDs and agent prompts',
      icon: FileText,
      action: () => go('/specs'),
      keywords: ['prd', 'documents', 'prompts'],
    },
    {
      id: 'nav-settings',
      label: 'Settings',
      description: 'API keys and configuration',
      icon: Settings,
      action: () => go('/settings'),
      keywords: ['config', 'api', 'openai', 'preferences'],
    },
    {
      id: 'action-import',
      label: 'Import Feedback',
      description: 'Upload CSV or JSON feedback',
      icon: Upload,
      action: () => go('/feedback'),
      keywords: ['upload', 'csv', 'json', 'file'],
    },
    {
      id: 'action-synthesis',
      label: 'Run Synthesis',
      description: 'Analyze feedback into themes',
      icon: Zap,
      action: () => go('/themes'),
      keywords: ['analyze', 'process', 'ai'],
    },
  ];

  const filtered = query.trim()
    ? commands.filter((cmd) => {
        const q = query.toLowerCase();
        return (
          cmd.label.toLowerCase().includes(q) ||
          cmd.description?.toLowerCase().includes(q) ||
          cmd.keywords?.some((k) => k.includes(q))
        );
      })
    : commands;

  // Open/close with Cmd+K
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen((prev) => {
          if (!prev) {
            requestAnimationFrame(() => {
              setQuery('');
              setActiveIndex(0);
              inputRef.current?.focus();
            });
          }
          return !prev;
        });
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActiveIndex((prev) => (prev + 1) % filtered.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActiveIndex((prev) => (prev - 1 + filtered.length) % filtered.length);
      } else if (e.key === 'Enter' && filtered[activeIndex]) {
        e.preventDefault();
        filtered[activeIndex].action();
      } else if (e.key === 'Escape') {
        setOpen(false);
      }
    },
    [filtered, activeIndex],
  );

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIndex]);

  if (!open) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0 z-[100] bg-black/50"
        onClick={() => setOpen(false)}
        aria-hidden
      />
      <div className="fixed inset-x-0 top-[20%] z-[101] flex justify-center px-4">
        <div
          className="w-full max-w-lg bg-bg-surface border border-border rounded-xl shadow-lg overflow-hidden animate-fade-up"
          role="dialog"
          aria-modal="true"
          aria-label="Command palette"
        >
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
            <Search size={18} className="text-text-muted flex-shrink-0" />
            <input
              ref={inputRef}
              type="text"
              placeholder="Search pages, actions..."
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveIndex(0);
              }}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted outline-none"
            />
            <kbd className="text-[10px] text-text-muted bg-bg-surface-2 border border-border rounded px-1.5 py-0.5 font-mono">
              ESC
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-[320px] overflow-y-auto py-2">
            {filtered.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-text-muted">No results found</div>
            ) : (
              filtered.map((cmd, i) => {
                const Icon = cmd.icon;
                return (
                  <button
                    key={cmd.id}
                    onClick={() => cmd.action()}
                    onMouseEnter={() => setActiveIndex(i)}
                    className={cn(
                      'w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors',
                      i === activeIndex
                        ? 'bg-accent-blue-dim text-accent-blue'
                        : 'text-text-secondary hover:bg-bg-surface-2',
                    )}
                  >
                    <Icon size={16} className="flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-text-primary block">
                        {cmd.label}
                      </span>
                      {cmd.description && (
                        <span className="text-xs text-text-muted block">{cmd.description}</span>
                      )}
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer hints */}
          <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border text-[10px] text-text-muted">
            <span>
              <kbd className="bg-bg-surface-2 border border-border rounded px-1 py-0.5 font-mono mr-1">
                ↑↓
              </kbd>
              Navigate
            </span>
            <span>
              <kbd className="bg-bg-surface-2 border border-border rounded px-1 py-0.5 font-mono mr-1">
                ↵
              </kbd>
              Select
            </span>
            <span>
              <kbd className="bg-bg-surface-2 border border-border rounded px-1 py-0.5 font-mono mr-1">
                esc
              </kbd>
              Close
            </span>
          </div>
        </div>
      </div>
    </>,
    document.body,
  );
}
