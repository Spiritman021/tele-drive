import { useState, useEffect, useCallback, useRef } from 'react';
import { X, Download, Loader2, ZoomIn, ZoomOut, RotateCw, Music, FileText, FileCode, Info, Eye, Share2 } from 'lucide-react';
import filesService from '../services/files';
import { renderAsync } from 'docx-preview';

const MAX_PREVIEW_SIZE = 15 * 1024 * 1024; // 15 MB max for preview download
const MAX_TEXT_RENDER_SIZE = 100 * 1024; // 100 KB max for rendering in a <pre> tag

export default function FilePreview({ file, channelId, folders, initialShowDetails = false, onClose, onShare }) {
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(initialShowDetails);
  const [progress, setProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [error, setError] = useState(null);
  const [textContent, setTextContent] = useState('');
  const [isSwReady, setIsSwReady] = useState(!!(navigator.serviceWorker && navigator.serviceWorker.controller));
  
  const docxContainerRef = useRef(null);
  const isCancelled = useRef(false);

  useEffect(() => {
    if (!navigator.serviceWorker) return;
    if (navigator.serviceWorker.controller) {
      setIsSwReady(true);
      return;
    }
    
    navigator.serviceWorker.ready.then(() => {
      if (navigator.serviceWorker.controller) {
        setIsSwReady(true);
      }
    });

    const handleControllerChange = () => {
      setIsSwReady(!!navigator.serviceWorker.controller);
    };
    navigator.serviceWorker.addEventListener('controllerchange', handleControllerChange);
    return () => {
      navigator.serviceWorker.removeEventListener('controllerchange', handleControllerChange);
    };
  }, []);

  const getExtension = (filename) => {
    if (!filename) return '';
    const idx = filename.lastIndexOf('.');
    return idx === -1 ? '' : filename.substring(idx + 1).toLowerCase();
  };

  const ext = getExtension(file?.name);
  
  const isImage = file?.mimeType?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(ext);
  const isVideo = file?.mimeType?.startsWith('video/') || ['mp4', 'webm', 'ogg', 'mov'].includes(ext);
  const isAudio = file?.mimeType?.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac'].includes(ext);
  const isPdf = file?.mimeType === 'application/pdf' || ext === 'pdf';
  const isDocx = ext === 'docx';
  
  const textExtensions = ['txt', 'md', 'js', 'jsx', 'ts', 'tsx', 'json', 'css', 'html', 'xml', 'py', 'sh', 'yml', 'yaml', 'csv', 'sql', 'ini', 'env', 'conf'];
  const isText = file?.mimeType?.startsWith('text/') || textExtensions.includes(ext);
  const isPreviewable = isImage || isVideo || isAudio || isPdf || isDocx || isText;

  useEffect(() => {
    isCancelled.current = false;
    
    if (!file) {
      setLoading(false);
      return;
    }

    if (!isPreviewable) {
      setLoading(false);
      return;
    }

    // Video & Audio Streaming: bypass size limit and use the Service Worker range stream URL
    if (isVideo || isAudio) {
      if (!isSwReady) {
        setLoading(true);
        return;
      }
      const mimeMapped = (file.mimeType || (isVideo ? 'video/mp4' : 'audio/mpeg')).replace('/', '~');
      const streamUrl = `/stream/${channelId}/${file.messageId}/${file.size}/${mimeMapped}/${encodeURIComponent(file.name)}`;
      setPreviewUrl(streamUrl);
      setLoading(false);
      setError(null);
      return;
    }

    if (file.size > MAX_PREVIEW_SIZE) {
      setError(`File is too large to preview (${(file.size / (1024 * 1024)).toFixed(1)} MB). Please download it instead.`);
      setLoading(false);
      return;
    }

    let objectUrl = null;

    const loadPreview = async () => {
      try {
        setLoading(true);
        setError(null);
        setProgress(0);
        const blob = await filesService.downloadFile(channelId, file.messageId, (p) => {
          if (!isCancelled.current) {
            setProgress(p);
          }
        });
        
        if (isCancelled.current) {
          return;
        }

        objectUrl = URL.createObjectURL(blob);
        setPreviewUrl(objectUrl);
        
        if (isText) {
          const isTruncated = blob.size > MAX_TEXT_RENDER_SIZE;
          const textBlob = isTruncated ? blob.slice(0, MAX_TEXT_RENDER_SIZE) : blob;
          let text = await textBlob.text();
          if (isTruncated) {
            text += "\n\n... [Preview Truncated. Please download the file to view the full content] ...";
          }
          if (!isCancelled.current) {
            setTextContent(text);
          }
        }
      } catch (err) {
        if (!isCancelled.current) {
          setError('Failed to load preview. Please download the file directly.');
          console.error(err);
        }
      } finally {
        if (!isCancelled.current && !isDocx) {
          setLoading(false);
        }
      }
    };

    loadPreview();

    return () => {
      isCancelled.current = true;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [file, channelId, isSwReady, isVideo, isAudio]);

  // Handle docx rendering
  useEffect(() => {
    if (isDocx && previewUrl && docxContainerRef.current) {
      const renderDocxFile = async () => {
        try {
          setLoading(true);
          const response = await fetch(previewUrl);
          const blob = await response.blob();
          if (isCancelled.current) return;
          if (docxContainerRef.current) {
            docxContainerRef.current.innerHTML = '';
            await renderAsync(blob, docxContainerRef.current, null, {
              className: "docx-document",
              inWrapper: false,
              ignoreWidth: false,
              ignoreHeight: false,
              ignoreFonts: false,
              breakPages: true,
              experimental: false,
              useHtmlPxValues: true,
            });
          }
        } catch (err) {
          if (!isCancelled.current) {
            console.error('Failed to render DOCX:', err);
            setError('Failed to render Word document. You can still download it.');
          }
        } finally {
          if (!isCancelled.current) {
            setLoading(false);
          }
        }
      };
      renderDocxFile();
    }
  }, [isDocx, previewUrl]);

  const handleDownload = async () => {
    try {
      setDownloading(true);
      const blob = await filesService.downloadFile(channelId, file.messageId);
      filesService.saveBlobAsFile(blob, file.name);
    } catch (err) {
      console.error('Download failed:', err);
    } finally {
      setDownloading(false);
    }
  };

  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'Escape') onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [handleKeyDown]);

  if (!file) return null;

  const formatSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
      return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  };

  const formatFileDate = (timestamp) => {
    if (!timestamp) return 'Unknown';
    const date = new Date(timestamp * 1000);
    return date.toLocaleString();
  };

  const parentFolder = folders?.find((f) => f.id === file?.folderId);
  const folderName = parentFolder ? parentFolder.name : 'My Drive';

  return (
    <div className="preview-modal-overlay" onClick={onClose}>
      <div
        className={`preview-modal ${showDetails ? 'with-details' : ''}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="preview-header">
          <div className="preview-file-info">
            <h3 className="preview-filename">{file.name}</h3>
            <span className="preview-filesize">{formatSize(file.size)}</span>
          </div>

          <div className="preview-actions">
            {isImage && !loading && !error && (
              <div className="preview-zoom-controls">
                <button
                  className="btn btn-icon"
                  onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
                  title="Zoom out"
                >
                  <ZoomOut size={18} />
                </button>
                <span className="preview-zoom-label">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  className="btn btn-icon"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                  title="Zoom in"
                >
                  <ZoomIn size={18} />
                </button>
                <button
                  className="btn btn-icon"
                  onClick={() => setZoom(1)}
                  title="Reset zoom"
                >
                  <RotateCw size={18} />
                </button>
              </div>
            )}

            <button
              className="btn btn-primary btn-sm btn-download"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading ? (
                <Loader2 size={16} className="spin" />
              ) : (
                <Download size={16} />
              )}
              <span>Download</span>
            </button>

            <button
              className="btn btn-icon"
              onClick={() => onShare(file)}
              title="Share"
            >
              <Share2 size={18} />
            </button>

            <button
              className={`btn btn-icon ${showDetails ? 'active' : ''}`}
              onClick={() => setShowDetails(!showDetails)}
              title={showDetails ? 'Hide details' : 'View details'}
            >
              <Info size={18} />
            </button>

            <button className="btn btn-icon btn-close" onClick={onClose} title="Close (Esc)">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Body Wrapper */}
        <div className="preview-body-container">
          {/* Content */}
          <div className="preview-content">
            {loading && (
              <div className="preview-loading">
                <Loader2 size={40} className="spin" />
                <p>Loading preview... {progress > 0 ? `${progress}%` : ''}</p>
              </div>
            )}

            {error && !loading && (
              <div className="preview-error">
                <div className="preview-error-icon">⚠️</div>
                <h3>Unable to preview</h3>
                <p>{error}</p>
                <button
                  className="btn btn-primary btn-download-error"
                  onClick={handleDownload}
                  disabled={downloading}
                >
                  {downloading ? (
                    <Loader2 size={16} className="spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  <span>Download File</span>
                </button>
              </div>
            )}

            {!loading && !error && isImage && previewUrl && (
              <div className="preview-image-container">
                <img
                  src={previewUrl}
                  alt={file.name}
                  className="preview-image"
                  style={{ transform: `scale(${zoom})` }}
                />
              </div>
            )}

            {!loading && !error && isVideo && previewUrl && (
              <div className="preview-video-container">
                <video
                  src={previewUrl}
                  controls
                  autoPlay
                  className="preview-video"
                />
              </div>
            )}

            {!loading && !error && isAudio && previewUrl && (
              <div className="preview-audio-container">
                <div className="audio-card">
                  <div className="audio-icon-wrapper">
                    <Music size={56} className="audio-glow-icon" />
                  </div>
                  <div className="audio-info">
                    <h4 className="audio-title">{file.name}</h4>
                    <p className="audio-subtitle">Audio File • {formatSize(file.size)}</p>
                  </div>
                  <audio src={previewUrl} controls className="preview-audio-element" autoPlay />
                </div>
              </div>
            )}

            {!loading && !error && isPdf && previewUrl && (
              <div className="preview-pdf-container">
                <iframe
                  src={previewUrl}
                  title={file.name}
                  className="preview-pdf-iframe"
                />
              </div>
            )}

            {!error && isDocx && previewUrl && (
              <div className="preview-docx-container" style={{ display: loading ? 'none' : 'block' }}>
                <div ref={docxContainerRef} className="docx-render-target" />
              </div>
            )}

            {!loading && !error && isText && textContent !== null && (
              <div className="preview-text-container">
                <pre className="preview-text-content">
                  <code>{textContent}</code>
                </pre>
              </div>
            )}

            {!isPreviewable && !loading && !error && (
              <div className="preview-unsupported">
                <div className="preview-unsupported-icon">
                  📄
                </div>
                <h3>Preview not available</h3>
                <p>
                  This file type ({file.mimeType || ext || 'unknown'}) cannot be previewed.
                  <br />
                  Click download to save it to your device.
                </p>
                <button
                  className="btn btn-primary"
                  onClick={handleDownload}
                  disabled={downloading}
                >
                  {downloading ? (
                    <Loader2 size={16} className="spin" />
                  ) : (
                    <Download size={16} />
                  )}
                  <span>Download File</span>
                </button>
              </div>
            )}
          </div>

          {/* Details Panel */}
          {showDetails && (
            <div className="preview-details-panel">
              <div className="preview-details-header">
                <Info size={18} />
                <span className="preview-details-title">File details</span>
              </div>
              <div className="preview-details-content">
                <div className="preview-details-grid">
                  <div className="preview-details-row">
                    <span className="preview-details-label">Name</span>
                    <span className="preview-details-value">{file.name}</span>
                  </div>
                  <div className="preview-details-row">
                    <span className="preview-details-label">Type</span>
                    <span className="preview-details-value">{file.mimeType || `${ext.toUpperCase()} File`}</span>
                  </div>
                  <div className="preview-details-row">
                    <span className="preview-details-label">Size</span>
                    <span className="preview-details-value">{formatSize(file.size)}</span>
                  </div>
                  <div className="preview-details-row">
                    <span className="preview-details-label">Location</span>
                    <span className="preview-details-value">{folderName}</span>
                  </div>
                  <div className="preview-details-row">
                    <span className="preview-details-label">Created</span>
                    <span className="preview-details-value">{formatFileDate(file.createdAt)}</span>
                  </div>
                  <div className="preview-details-row">
                    <span className="preview-details-label">Views</span>
                    <span className="preview-details-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Eye size={14} style={{ opacity: 0.8 }} />
                      <span>{file.views || 0}</span>
                    </span>
                  </div>
                  <div className="preview-details-row">
                    <span className="preview-details-label">Starred</span>
                    <span className={`preview-details-value badge ${file.starred ? 'yes' : 'no'}`}>
                      {file.starred ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="preview-details-row">
                    <span className="preview-details-label">Pinned</span>
                    <span className={`preview-details-value badge ${file.pinned ? 'yes' : 'no'}`}>
                      {file.pinned ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="preview-details-row">
                    <span className="preview-details-label">Telegram Message ID</span>
                    <span className="preview-details-value">{file.messageId}</span>
                  </div>
                  <div className="preview-details-row">
                    <span className="preview-details-label">Channel/Chat ID</span>
                    <span className="preview-details-value">{file.channelId}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
