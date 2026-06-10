import { useState, useCallback } from 'react';
import { Upload } from 'lucide-react';

export default function UploadZone({ onUploadFiles }) {
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files);
      if (files.length > 0) {
        onUploadFiles(files);
      }
    },
    [onUploadFiles]
  );

  const handleFileSelect = useCallback(
    (e) => {
      const files = Array.from(e.target.files);
      if (files.length > 0) {
        onUploadFiles(files);
      }
      e.target.value = '';
    },
    [onUploadFiles]
  );

  return (
    <div
      className={`upload-zone ${isDragOver ? 'dragover' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => document.getElementById('file-input').click()}
    >
      <input
        id="file-input"
        type="file"
        multiple
        onChange={handleFileSelect}
        style={{ display: 'none' }}
      />
      <Upload size={18} style={{ color: 'var(--accent)', flexShrink: 0 }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
        <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>
          {isDragOver ? 'Drop files here to upload' : 'Drag & drop files or click to browse'}
        </span>
        <span style={{ fontSize: '11px', color: 'var(--text-tertiary)' }}>
          (Up to 2 GB files supported)
        </span>
      </div>
    </div>
  );
}
