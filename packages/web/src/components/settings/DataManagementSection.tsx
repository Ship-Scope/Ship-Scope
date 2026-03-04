import { useState } from 'react';
import { Download, Trash2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useExportData, useDeleteAllData } from '@/hooks/useSettings';

export function DataManagementSection() {
  const [confirmDelete, setConfirmDelete] = useState(false);
  const exportMutation = useExportData();
  const deleteMutation = useDeleteAllData();

  const handleExport = async () => {
    const data = await exportMutation.mutateAsync();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `shipscope-export-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    await deleteMutation.mutateAsync();
    setConfirmDelete(false);
  };

  return (
    <div className="space-y-5">
      <div>
        <h4 className="text-sm font-medium text-text-primary mb-1">Export Data</h4>
        <p className="text-xs text-text-muted mb-3">
          Download all feedback, themes, proposals, and specs as a JSON file.
        </p>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleExport}
          loading={exportMutation.isPending}
        >
          <Download size={14} />
          Export All Data
        </Button>
      </div>

      <div className="pt-4 border-t border-border">
        <h4 className="text-sm font-medium text-danger mb-1">Danger Zone</h4>
        <p className="text-xs text-text-muted mb-3">
          Permanently delete all feedback, themes, proposals, and specs. This action cannot be
          undone.
        </p>
        {confirmDelete ? (
          <div className="flex items-center gap-2">
            <Button
              variant="danger"
              size="sm"
              onClick={handleDelete}
              loading={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Trash2 size={14} />
              )}
              Yes, Delete Everything
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="danger" size="sm" onClick={handleDelete}>
            <Trash2 size={14} />
            Delete All Data
          </Button>
        )}
        {deleteMutation.isSuccess && (
          <p className="text-xs text-success mt-2">All data has been deleted.</p>
        )}
      </div>
    </div>
  );
}
