interface RICEScoreDisplayProps {
  reach: number | null;
  impact: number | null;
  confidence: number | null;
  effort: number | null;
  riceScore: number | null;
  compact?: boolean;
}

function ScoreBar({
  label,
  value,
  max = 10,
}: {
  label: string;
  value: number | null;
  max?: number;
}) {
  const pct = value ? (value / max) * 100 : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-text-muted">{label}</span>
        <span className="text-text-primary font-medium">{value ?? '-'}</span>
      </div>
      <div className="w-full h-1.5 bg-bg-surface-2 rounded-full overflow-hidden">
        <div
          className="h-full bg-accent-blue rounded-full transition-all"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function RICEScoreDisplay({
  reach,
  impact,
  confidence,
  effort,
  riceScore,
  compact,
}: RICEScoreDisplayProps) {
  if (compact) {
    return (
      <div className="flex items-center gap-1.5">
        <span className="text-xs font-medium text-accent-blue">
          RICE: {riceScore !== null ? riceScore.toFixed(1) : '-'}
        </span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-text-muted uppercase tracking-wider">
          RICE Score
        </span>
        <span className="text-lg font-bold text-accent-blue">
          {riceScore !== null ? riceScore.toFixed(1) : '-'}
        </span>
      </div>
      <ScoreBar label="Reach" value={reach} />
      <ScoreBar label="Impact" value={impact} />
      <ScoreBar label="Confidence" value={confidence} />
      <ScoreBar label="Effort" value={effort} />
    </div>
  );
}
