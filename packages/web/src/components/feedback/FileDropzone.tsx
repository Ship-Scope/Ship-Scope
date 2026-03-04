import { useDropzone } from 'react-dropzone';
import { Upload, File, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FileDropzoneProps {
  onFile: (file: File) => void;
  file: File | null;
  error?: string;
}

export function FileDropzone({ onFile, file, error }: FileDropzoneProps) {
  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    accept: {
      'text/csv': ['.csv'],
      'application/json': ['.json'],
      'application/x-ndjson': ['.jsonl'],
    },
    maxSize: 50 * 1024 * 1024,
    multiple: false,
    onDropAccepted: (files) => onFile(files[0]),
  });

  const rejection = fileRejections[0]?.errors[0];
  const errorMsg =
    error ||
    (rejection?.code === 'file-too-large'
      ? 'File exceeds 50MB limit'
      : rejection?.code === 'file-invalid-type'
        ? 'Only .csv, .json, and .jsonl files are supported'
        : rejection?.message);

  if (file) {
    return (
      <div className="border border-border rounded-xl p-6 flex items-center gap-4">
        <div className="w-10 h-10 rounded-lg bg-accent-blue-dim flex items-center justify-center">
          <File size={20} className="text-accent-blue" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-text-primary truncate">{file.name}</p>
          <p className="text-xs text-text-secondary">{(file.size / 1024).toFixed(1)} KB</p>
        </div>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onFile(null as unknown as File);
          }}
          className="text-xs text-accent-blue hover:underline"
        >
          Change
        </button>
      </div>
    );
  }

  return (
    <div>
      <div
        {...getRootProps()}
        className={cn(
          'border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-colors',
          isDragActive
            ? 'border-accent-blue bg-accent-blue-dim'
            : errorMsg
              ? 'border-danger'
              : 'border-border hover:border-border-hover',
        )}
      >
        <input {...getInputProps()} />
        <Upload
          size={32}
          className={cn('mx-auto mb-3', isDragActive ? 'text-accent-blue' : 'text-text-muted')}
        />
        <p className="text-sm text-text-primary font-medium mb-1">
          {isDragActive ? 'Drop your file here' : 'Drag & drop your file here'}
        </p>
        <p className="text-xs text-text-secondary">or click to browse</p>
        <p className="text-xs text-text-muted mt-3">Supports: .csv, .json, .jsonl — Max: 50MB</p>
      </div>
      {errorMsg && (
        <div className="flex items-center gap-2 mt-3 text-sm text-danger">
          <AlertCircle size={14} />
          {errorMsg}
        </div>
      )}
    </div>
  );
}
