import { Brain, Play, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { DemoTooltip } from '@/components/ui/DemoTooltip';
import { useSynthesisStatus, useRunSynthesis } from '@/hooks/useSynthesis';

export function SynthesisStatus() {
  const { data: status } = useSynthesisStatus();
  const runMutation = useRunSynthesis();

  if (!status) return null;

  const isActive = !['idle', 'completed', 'failed'].includes(status.status);

  return (
    <Card className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 min-w-0">
        <div className="w-9 h-9 rounded-lg bg-accent-blue-dim flex items-center justify-center flex-shrink-0">
          {isActive ? (
            <Loader2 size={18} className="text-accent-blue animate-spin" />
          ) : status.status === 'failed' ? (
            <AlertCircle size={18} className="text-danger" />
          ) : status.status === 'completed' ? (
            <CheckCircle2 size={18} className="text-success" />
          ) : (
            <Brain size={18} className="text-accent-blue" />
          )}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">
            {isActive
              ? status.stage
              : status.status === 'failed'
                ? 'Synthesis failed'
                : status.status === 'completed'
                  ? `Synthesis complete — ${status.themesFound} themes found`
                  : 'AI Synthesis'}
          </p>
          {isActive && (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="w-32 h-1.5 bg-bg-surface-2 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-blue rounded-full transition-all duration-300"
                  style={{ width: `${status.progress}%` }}
                />
              </div>
              <span className="text-xs text-text-secondary">{status.progress}%</span>
            </div>
          )}
          {status.status === 'failed' && status.error && (
            <p className="text-xs text-danger mt-0.5 truncate">{status.error}</p>
          )}
        </div>
      </div>
      <DemoTooltip>
        <Button
          variant={isActive ? 'secondary' : 'primary'}
          size="sm"
          onClick={() => runMutation.mutate()}
          loading={runMutation.isPending}
          disabled={isActive}
        >
          <Play size={14} />
          {isActive ? 'Running...' : 'Run Synthesis'}
        </Button>
      </DemoTooltip>
    </Card>
  );
}
