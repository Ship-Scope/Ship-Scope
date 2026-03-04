interface SynthesisSettingsSectionProps {
  settings: Record<string, string>;
  onUpdate: (key: string, value: string) => void;
}

export function SynthesisSettingsSection({ settings, onUpdate }: SynthesisSettingsSectionProps) {
  const threshold = parseFloat(settings['similarity_threshold'] || '0.78');
  const clusterSize = parseInt(settings['min_cluster_size'] || '3');

  return (
    <div className="space-y-5">
      <div>
        <label className="text-sm font-medium text-text-primary block mb-1.5">
          Similarity Threshold
        </label>
        <p className="text-xs text-text-muted mb-2">
          Minimum cosine similarity for grouping feedback items into clusters. Higher values create
          tighter, more specific themes.
        </p>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0.5"
            max="0.95"
            step="0.01"
            value={threshold}
            onChange={(e) => onUpdate('similarity_threshold', e.target.value)}
            className="flex-1 accent-accent-blue"
          />
          <span className="text-sm font-mono text-text-primary w-12 text-right">
            {threshold.toFixed(2)}
          </span>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-text-primary block mb-1.5">
          Minimum Cluster Size
        </label>
        <p className="text-xs text-text-muted mb-2">
          Minimum number of feedback items required to form a theme. Lower values discover more
          themes, higher values require more consensus.
        </p>
        <input
          type="number"
          min={2}
          max={20}
          value={clusterSize}
          onChange={(e) => onUpdate('min_cluster_size', e.target.value)}
          className="w-24 bg-bg-surface-2 border border-border rounded-lg px-3 py-2 text-sm text-text-primary"
        />
      </div>
    </div>
  );
}
