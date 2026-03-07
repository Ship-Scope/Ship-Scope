import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { useToast, type Toast } from '@/context/ToastContext';
import { cn } from '@/lib/utils';

const icons = {
  success: { icon: CheckCircle2, color: 'text-success', border: 'border-l-success' },
  error: { icon: AlertCircle, color: 'text-danger', border: 'border-l-danger' },
  info: { icon: Info, color: 'text-accent-blue', border: 'border-l-accent-blue' },
};

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: () => void }) {
  const { icon: Icon, color, border } = icons[toast.type];

  return (
    <div
      className={cn(
        'w-80 bg-bg-surface-2 border border-border rounded-lg shadow-lg p-3 flex items-start gap-3 border-l-[3px] animate-fade-up',
        border,
      )}
      role="alert"
    >
      <Icon size={16} className={cn('flex-shrink-0 mt-0.5', color)} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-text-primary">{toast.title}</p>
        {toast.description && (
          <p className="text-xs text-text-secondary mt-0.5 line-clamp-2">{toast.description}</p>
        )}
      </div>
      <button
        onClick={onDismiss}
        className="text-text-muted hover:text-text-primary p-0.5 flex-shrink-0"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const { toasts, dismiss } = useToast();

  if (toasts.length === 0) return null;

  return createPortal(
    <div className="fixed bottom-6 right-6 z-[999] flex flex-col gap-3" aria-live="polite">
      {toasts.map((t) => (
        <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
      ))}
    </div>,
    document.body,
  );
}
