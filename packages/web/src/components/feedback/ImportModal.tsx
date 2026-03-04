import { useState, useCallback } from 'react';
import { X } from 'lucide-react';
import { FileDropzone } from './FileDropzone';
import { ColumnMapper } from './ColumnMapper';
import { ImportProgress } from './ImportProgress';
import { Button } from '@/components/ui/Button';
import { useImportPreview, useImportCSV, useImportJSON } from '@/hooks/useImport';

interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type Step = 'upload' | 'preview' | 'progress';

export function ImportModal({ isOpen, onClose }: ImportModalProps) {
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [suggestedMapping, setSuggestedMapping] = useState<Record<string, string | undefined>>({});
  const [jobId, setJobId] = useState<string | null>(null);
  const [syncResult, setSyncResult] = useState<{
    imported: number;
    skipped: number;
    errors: number;
  } | null>(null);
  const [error, setError] = useState<string>('');

  const previewMutation = useImportPreview();
  const csvMutation = useImportCSV();
  const jsonMutation = useImportJSON();

  const handleFile = useCallback(
    async (f: File) => {
      if (!f) {
        setFile(null);
        return;
      }
      setFile(f);
      setError('');

      try {
        const result = await previewMutation.mutateAsync(f);
        setHeaders(result.headers);
        setPreview(result.preview);
        setTotalRows(result.totalRows);

        const suggested = result.suggestedMapping;
        setSuggestedMapping(suggested);
        setMapping({
          content: suggested.content || '',
          author: suggested.author || '',
          email: suggested.email || '',
          channel: suggested.channel || '',
          date: suggested.date || '',
        });
        setStep('preview');
      } catch {
        setError('Failed to parse file. Please check the format and try again.');
      }
    },
    [previewMutation],
  );

  const handleImport = useCallback(async () => {
    if (!file || !mapping.content) return;
    setStep('progress');

    try {
      const isJSON = file.name.endsWith('.json') || file.name.endsWith('.jsonl');
      const result = isJSON
        ? await jsonMutation.mutateAsync(file)
        : await csvMutation.mutateAsync({ file, mapping });

      if ('jobId' in result) {
        setJobId(result.jobId);
      } else {
        setSyncResult(result);
      }
    } catch {
      setError('Import failed. Please try again.');
      setStep('preview');
    }
  }, [file, mapping, csvMutation, jsonMutation]);

  const handleMappingChange = useCallback((field: string, column: string) => {
    setMapping((prev) => ({ ...prev, [field]: column }));
  }, []);

  const handleClose = useCallback(() => {
    setStep('upload');
    setFile(null);
    setHeaders([]);
    setPreview([]);
    setTotalRows(0);
    setMapping({});
    setSuggestedMapping({});
    setJobId(null);
    setSyncResult(null);
    setError('');
    onClose();
  }, [onClose]);

  if (!isOpen) return null;

  const isComplete = syncResult || jobId;
  const stepTitle =
    step === 'upload'
      ? 'Import Feedback'
      : step === 'preview'
        ? 'Import Feedback — Map Columns'
        : 'Import Feedback — Importing...';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/60" onClick={handleClose} />
      <div className="relative bg-bg-surface border border-border rounded-2xl shadow-lg w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h3 className="text-lg font-semibold text-text-primary">{stepTitle}</h3>
          <button onClick={handleClose} className="text-text-muted hover:text-text-primary">
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-6">
          {step === 'upload' && <FileDropzone onFile={handleFile} file={file} error={error} />}

          {step === 'preview' && (
            <div className="space-y-6">
              <div className="flex items-center gap-3 text-sm text-text-secondary">
                <span className="font-medium text-text-primary">{file?.name}</span>
                <span>({totalRows} rows)</span>
              </div>

              <ColumnMapper
                headers={headers}
                mapping={mapping}
                suggestedMapping={suggestedMapping}
                onChange={handleMappingChange}
              />

              {/* Preview table */}
              {preview.length > 0 && (
                <div>
                  <p className="text-xs text-text-muted font-medium uppercase tracking-wider mb-2">
                    Preview (first {preview.length} rows)
                  </p>
                  <div className="overflow-x-auto border border-border rounded-lg">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-bg-surface-2 border-b border-border">
                          {headers.slice(0, 5).map((h) => (
                            <th key={h} className="px-3 py-2 text-left text-text-muted font-medium">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {preview.map((row, i) => (
                          <tr key={i} className="border-b border-border">
                            {headers.slice(0, 5).map((h) => (
                              <td
                                key={h}
                                className="px-3 py-2 text-text-primary max-w-[200px] truncate"
                              >
                                {row[h] || <span className="text-text-muted">(empty)</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {step === 'progress' && <ImportProgress jobId={jobId} syncResult={syncResult} />}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <div>
            {step === 'preview' && (
              <Button
                variant="ghost"
                onClick={() => {
                  setStep('upload');
                  setFile(null);
                }}
              >
                Back
              </Button>
            )}
          </div>
          <div className="flex items-center gap-3">
            {step !== 'progress' && (
              <Button variant="secondary" onClick={handleClose}>
                Cancel
              </Button>
            )}
            {step === 'preview' && (
              <Button
                onClick={handleImport}
                disabled={!mapping.content}
                loading={csvMutation.isPending || jsonMutation.isPending}
              >
                Import {totalRows} rows
              </Button>
            )}
            {step === 'progress' && isComplete && <Button onClick={handleClose}>Done</Button>}
          </div>
        </div>
      </div>
    </div>
  );
}
