export function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-accent" />
        <p className="text-sm text-text-muted">Loading...</p>
      </div>
    </div>
  );
}
