import { useState, useRef, useEffect } from 'react';
import {
  File,
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Archive,
  FileCode,
  Sheet,
  Presentation,
  Download,
  Trash2,
  MoreVertical,
  Eye,
  Loader2,
  FileQuestion,
  Star,
  Pin,
  Info,
  Share2,
  Edit2,
} from 'lucide-react';
import { formatBytes, formatDate, getFileIcon, truncateFileName } from '../utils/helpers';
import filesService from '../services/files';

const ICON_MAP = {
  Image: ImageIcon,
  Video,
  Music,
  FileText,
  Archive,
  FileCode,
  Sheet,
  Presentation,
  File,
};

function FileThumbnail({ file, fallbackIcon: IconComponent, iconColor, size = 'large' }) {
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const isMounted = useRef(true);

  useEffect(() => {
    isMounted.current = true;
    const ext = file.name ? file.name.split('.').pop().toLowerCase() : '';
    const isImage = file.mimeType?.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg', 'bmp'].includes(ext);

    if (isImage || file.isPhoto) {
      setLoading(true);
      filesService.getThumbnail(file.channelId, file.messageId)
        .then((url) => {
          if (isMounted.current && url) {
            setThumbnailUrl(url);
          }
        })
        .catch((err) => console.error('Error loading thumbnail:', err))
        .finally(() => {
          if (isMounted.current) setLoading(false);
        });
    }

    return () => {
      isMounted.current = false;
    };
  }, [file.id, file.channelId, file.messageId]);

  if (thumbnailUrl) {
    return (
      <img
        src={thumbnailUrl}
        alt={file.name}
        className="gd-file-thumbnail"
        style={{
          width: size === 'large' ? '100%' : '18px',
          height: size === 'large' ? '100%' : '18px',
          objectFit: 'cover',
          borderRadius: size === 'large' ? '0' : '2px',
          display: 'block'
        }}
      />
    );
  }

  if (loading) {
    return <Loader2 size={size === 'large' ? 24 : 14} className="spin text-muted" />;
  }

  return <IconComponent size={size === 'large' ? 40 : 18} style={{ color: iconColor }} />;
}

export default function FileGrid({
  files,
  loading,
  viewMode,
  onPreview,
  onDownload,
  onDelete,
  onToggleStar,
  onTogglePin,
  onShareFile,
  onRename,
  onSelectTag,
  readOnly = false,
  isGlobalSearch = false,
}) {
  const [contextMenu, setContextMenu] = useState(null);
  const [downloadingId, setDownloadingId] = useState(null);
  const contextMenuRef = useRef(null);

  useEffect(() => {
    const handleClick = () => setContextMenu(null);
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleContextMenu = (e, file) => {
    e.preventDefault();
    e.stopPropagation();
    
    const menuWidth = 200;
    const menuHeight = 220; // Safe approximation of menu height
    
    let x = e.clientX;
    let y = e.clientY;
    
    // Bounds check to prevent cutting off at bottom or right
    if (x + menuWidth > window.innerWidth) {
      x = window.innerWidth - menuWidth - 10;
    }
    if (x < 10) x = 10;
    
    if (y + menuHeight > window.innerHeight) {
      y = window.innerHeight - menuHeight - 10;
    }
    if (y < 10) y = 10;
    
    setContextMenu({ x, y, file });
  };

  const handleDownload = async (file) => {
    setContextMenu(null);
    try {
      setDownloadingId(file.id);
      await onDownload(file);
    } finally {
      setDownloadingId(null);
    }
  };

  const handleDelete = (file) => {
    setContextMenu(null);
    if (window.confirm(`Delete "${file.name}"?`)) {
      onDelete(file);
    }
  };

  const getIcon = (mimeType) => {
    const iconName = getFileIcon(mimeType);
    return ICON_MAP[iconName] || File;
  };

  const getIconColor = (mimeType) => {
    if (mimeType?.startsWith('image/')) return '#ea4335'; // Red for images/photos
    if (mimeType?.startsWith('video/')) return '#fbbc05'; // Yellow for videos
    if (mimeType?.startsWith('audio/')) return '#8b5cf6'; // Purple for audio
    if (mimeType?.includes('pdf')) return '#ea4335'; // Red for PDFs
    if (mimeType?.includes('zip') || mimeType?.includes('rar')) return '#ff6d00'; // Orange for archives
    if (mimeType?.includes('sheet') || mimeType?.includes('excel')) return '#0f9d58'; // Green for spreadsheets
    if (mimeType?.includes('word') || mimeType?.includes('document')) return '#4285f4'; // Blue for documents
    return '#757575'; // Gray default
  };

  if (loading) {
    return (
      <div className="gd-file-grid-container">
        {viewMode === 'grid' ? (
          <div className="gd-file-grid">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="gd-file-card skeleton-card">
                <div className="skeleton gd-skeleton-preview" />
                <div className="gd-skeleton-footer">
                  <div className="skeleton gd-skeleton-avatar" />
                  <div className="skeleton gd-skeleton-text" style={{ width: '60%' }} />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="gd-file-list-skeleton">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="gd-list-skeleton-row">
                <div className="skeleton gd-skeleton-icon" />
                <div className="skeleton gd-skeleton-text" style={{ width: '40%' }} />
                <div className="skeleton gd-skeleton-text" style={{ width: '15%' }} />
                <div className="skeleton gd-skeleton-text" style={{ width: '15%' }} />
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (files.length === 0) {
    return (
      <div className="gd-empty-state">
        <div className="gd-empty-icon-wrapper">
          <FileQuestion size={48} />
        </div>
        <h3>No files in this folder</h3>
        <p>Drag files into this pane or use the "+ New" button to upload documents.</p>
      </div>
    );
  }

  const pinnedFiles = files.filter((f) => f.pinned === 1);
  const regularFiles = files.filter((f) => f.pinned !== 1);

  const sortedFiles = [...files].sort((a, b) => {
    const aPinned = a.pinned ? 1 : 0;
    const bPinned = b.pinned ? 1 : 0;
    if (aPinned !== bPinned) {
      return bPinned - aPinned;
    }
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  const renderFileCard = (file) => {
    const IconComponent = getIcon(file.mimeType);
    const iconColor = getIconColor(file.mimeType);

    return (
      <div
        key={file.id}
        className="gd-file-card"
        onClick={() => onPreview(file)}
        onContextMenu={(e) => handleContextMenu(e, file)}
      >
        {/* 1. Large Preview Container */}
        <div className="gd-file-card-preview-box" style={{ position: 'relative' }}>
          {file.pinned === 1 && (
            <div className="gd-file-card-pin-badge" title="Pinned file">
              <Pin size={12} fill="#4285f4" stroke="#4285f4" />
            </div>
          )}
          <FileThumbnail file={file} fallbackIcon={IconComponent} iconColor={iconColor} size="large" />
        </div>

        {/* 2. Footer Details Bar */}
        <div className="gd-file-card-details">
          <div className="gd-file-card-left">
            <IconComponent size={16} style={{ color: iconColor }} className="gd-file-type-icon" />
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, width: '100%' }}>
              <span className="gd-file-name" title={file.name}>
                {truncateFileName(file.name, 22)}
              </span>
              {file.tags && file.tags.length > 0 && (
                <div className="gd-file-card-tags">
                  {file.tags.map((tag) => (
                    <span
                      key={tag}
                      className="gd-tag-badge clickable"
                      onClick={(e) => {
                        e.stopPropagation();
                        onSelectTag(tag);
                      }}
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {isGlobalSearch && file.folderName && (
                <div className="gd-file-card-location" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#1a73e8', marginTop: '4px' }} title={`Located in: ${file.folderName}`}>
                  <span>📂</span>
                  <span style={{ fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.folderName}</span>
                </div>
              )}
            </div>
          </div>

          <div className="gd-file-card-actions">
            {/* Pin Toggle */}
            {!readOnly && (
              <button
                className={`gd-pin-btn ${file.pinned ? 'pinned' : ''}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onTogglePin(file, !file.pinned);
                }}
                title={file.pinned ? 'Unpin from folder' : 'Pin to folder'}
              >
                <Pin
                  size={14}
                  fill={file.pinned ? '#4285f4' : 'none'}
                  stroke={file.pinned ? '#4285f4' : 'currentColor'}
                />
              </button>
            )}

            {/* Star Toggle */}
            <button
              className={`gd-star-btn ${file.starred ? 'starred' : ''}`}
              onClick={(e) => {
                e.stopPropagation();
                onToggleStar(file, !file.starred);
              }}
              title={file.starred ? 'Unstar' : 'Star'}
            >
              <Star
                size={14}
                fill={file.starred ? '#fbbc05' : 'none'}
                stroke={file.starred ? '#fbbc05' : 'currentColor'}
              />
            </button>

            {/* Download Indicator or Button */}
            {downloadingId === file.id ? (
              <Loader2 size={14} className="spin" />
            ) : (
              <button
                className="gd-card-icon-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(file);
                }}
                title="Download"
              >
                <Download size={14} />
              </button>
            )}

            {/* Share Button */}
            <button
              className="gd-card-icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                onShareFile(file);
              }}
              title="Share"
            >
              <Share2 size={14} />
            </button>

            {/* Menu Button */}
            <button
              className="gd-card-icon-btn"
              onClick={(e) => {
                e.stopPropagation();
                handleContextMenu(e, file);
              }}
            >
              <MoreVertical size={14} />
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="gd-file-grid-container">
      {viewMode === 'grid' ? (
        <div className="gd-file-grid-sections">
          {pinnedFiles.length > 0 && (
            <div className="gd-file-section gd-pinned-section">
              <h4 className="gd-section-header">Pinned files</h4>
              <div className="gd-file-grid" style={{ marginBottom: '24px' }}>
                {pinnedFiles.map(renderFileCard)}
              </div>
            </div>
          )}
          <div className="gd-file-section gd-regular-section">
            {pinnedFiles.length > 0 && <h4 className="gd-section-header">Files</h4>}
            <div className="gd-file-grid">
              {regularFiles.map(renderFileCard)}
            </div>
          </div>
        </div>
      ) : (
        /* List Mode - Google Drive Style Table */
        <div className="gd-file-list-table-container">
          <table className="gd-file-list-table">
            <thead>
              <tr>
                <th className="gd-th-name">Name</th>
                <th className="gd-th-owner">{isGlobalSearch ? 'Location' : 'Owner'}</th>
                <th className="gd-th-views" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <Eye size={14} style={{ opacity: 0.8 }} />
                  <span>Views</span>
                </th>
                <th className="gd-th-date">Last modified</th>
                <th className="gd-th-size">File size</th>
                <th className="gd-th-actions"></th>
              </tr>
            </thead>
            <tbody>
              {sortedFiles.map((file) => {
                const IconComponent = getIcon(file.mimeType);
                const iconColor = getIconColor(file.mimeType);

                return (
                  <tr
                    key={file.id}
                    className={`gd-table-row ${file.pinned ? 'pinned-row' : ''}`}
                    onClick={() => onPreview(file)}
                    onContextMenu={(e) => handleContextMenu(e, file)}
                  >
                    {/* Name column */}
                    <td className="gd-td-name">
                      <div className="gd-td-name-cell">
                        <FileThumbnail file={file} fallbackIcon={IconComponent} iconColor={iconColor} size="small" />
                        <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                          <span className="gd-table-file-name" title={file.name}>
                            {file.name}
                          </span>
                          {file.tags && file.tags.length > 0 && (
                            <div className="gd-table-file-tags">
                              {file.tags.map((tag) => (
                                <span
                                  key={tag}
                                  className="gd-tag-badge clickable"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onSelectTag(tag);
                                  }}
                                >
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        
                        <div className="gd-table-hover-actions">
                          {/* Hover Star Button */}
                          <button
                            className={`gd-table-star-btn ${file.starred ? 'starred' : ''}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              onToggleStar(file, !file.starred);
                            }}
                            title={file.starred ? 'Unstar' : 'Star'}
                          >
                            <Star
                              size={14}
                              fill={file.starred ? '#fbbc05' : 'none'}
                              stroke={file.starred ? '#fbbc05' : 'currentColor'}
                            />
                          </button>

                          {/* Hover/Pinned Pin Button */}
                          {!readOnly && (
                            <button
                              className={`gd-table-pin-btn ${file.pinned ? 'pinned' : ''}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                onTogglePin(file, !file.pinned);
                              }}
                              title={file.pinned ? 'Unpin from folder' : 'Pin to folder'}
                            >
                              <Pin
                                size={14}
                                fill={file.pinned ? '#4285f4' : 'none'}
                                stroke={file.pinned ? '#4285f4' : 'currentColor'}
                              />
                            </button>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Owner or Location column */}
                    <td className="gd-td-owner">
                      {isGlobalSearch ? (
                        <div className="gd-location-badge-container" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1a73e8', fontSize: '13px' }}>
                          <span style={{ fontSize: '14px' }}>📂</span>
                          <span style={{ fontWeight: 500 }} title={file.folderName}>{file.folderName || 'Unknown'}</span>
                        </div>
                      ) : (
                        <div className="gd-owner-badge-container">
                          <div className="gd-owner-avatar">me</div>
                          <span className="gd-owner-text">me</span>
                        </div>
                      )}
                    </td>

                    {/* Views column */}
                    <td className="gd-td-views">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                        <Eye size={14} style={{ opacity: 0.8 }} />
                        <span>{file.views || 0}</span>
                      </div>
                    </td>

                    {/* Date modified column */}
                    <td className="gd-td-date">
                      {formatDate(file.createdAt)}
                    </td>

                    {/* File size column */}
                    <td className="gd-td-size">
                      {formatBytes(file.size)}
                    </td>

                    {/* Actions column */}
                    <td className="gd-td-actions" onClick={(e) => e.stopPropagation()}>
                      <div className="gd-table-actions-container">
                        {downloadingId === file.id ? (
                          <Loader2 size={16} className="spin" />
                        ) : (
                          <button
                            className="gd-table-action-btn"
                            onClick={() => handleDownload(file)}
                            title="Download"
                          >
                            <Download size={16} />
                          </button>
                        )}
                        <button
                          className="gd-table-action-btn"
                          onClick={() => onShareFile(file)}
                          title="Share"
                        >
                          <Share2 size={16} />
                        </button>
                        <button
                          className="gd-table-action-btn"
                          onClick={(e) => handleContextMenu(e, file)}
                        >
                          <MoreVertical size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && (
        <div
          ref={contextMenuRef}
          className="context-menu shadow-md"
          style={{ top: contextMenu.y, left: contextMenu.x }}
        >
          <button
            className="context-menu-item"
            onClick={() => {
              onPreview(contextMenu.file);
              setContextMenu(null);
            }}
          >
            <Eye size={16} />
            <span>Preview</span>
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              onShareFile(contextMenu.file);
              setContextMenu(null);
            }}
          >
            <Share2 size={16} />
            <span>Share</span>
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              onPreview(contextMenu.file, true);
              setContextMenu(null);
            }}
          >
            <Info size={16} />
            <span>View details</span>
          </button>
          <button
            className="context-menu-item"
            onClick={() => handleDownload(contextMenu.file)}
          >
            <Download size={16} />
            <span>Download</span>
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              onRename(contextMenu.file);
              setContextMenu(null);
            }}
          >
            <Edit2 size={16} />
            <span>Rename</span>
          </button>
          <button
            className="context-menu-item"
            onClick={() => {
              onToggleStar(contextMenu.file, !contextMenu.file.starred);
              setContextMenu(null);
            }}
          >
            <Star size={16} fill={contextMenu.file.starred ? '#fbbc05' : 'none'} />
            <span>{contextMenu.file.starred ? 'Unstar' : 'Star'}</span>
          </button>
          {!readOnly && (
            <>
              <button
                className="context-menu-item"
                onClick={() => {
                  onTogglePin(contextMenu.file, !contextMenu.file.pinned);
                  setContextMenu(null);
                }}
              >
                <Pin size={16} fill={contextMenu.file.pinned ? '#4285f4' : 'none'} style={{ color: contextMenu.file.pinned ? '#4285f4' : 'currentColor' }} />
                <span>{contextMenu.file.pinned ? 'Unpin from folder' : 'Pin to folder'}</span>
              </button>
              <div className="context-menu-divider" />
              <button
                className="context-menu-item context-menu-item-danger"
                onClick={() => handleDelete(contextMenu.file)}
              >
                <Trash2 size={16} />
                <span>Delete</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
