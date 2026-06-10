import { useState, useRef, useEffect } from 'react';
import {
  FolderClosed,
  MoreVertical,
  Pencil,
  Trash2,
  FolderPlus,
  Share2,
} from 'lucide-react';

export default function FolderView({
  folders,
  onOpenFolder,
  onDeleteFolder,
  onRenameFolder,
  onShareFolder,
  hideHeader = false,
  readOnly = false,
}) {
  const [contextMenu, setContextMenu] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [renameValue, setRenameValue] = useState('');
  const contextMenuRef = useRef(null);
  const renameInputRef = useRef(null);

  // Close context menu on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(e.target)) {
        setContextMenu(null);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  useEffect(() => {
    if (renaming && renameInputRef.current) {
      renameInputRef.current.focus();
      renameInputRef.current.select();
    }
  }, [renaming]);

  const handleContextMenu = (e, folder) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, folder });
  };

  const handleRename = (folder) => {
    setRenaming(folder.id);
    setRenameValue(folder.name);
    setContextMenu(null);
  };

  const handleRenameSubmit = async (folderId) => {
    if (renameValue.trim() && renameValue.trim() !== folders.find((f) => f.id === folderId)?.name) {
      await onRenameFolder(folderId, renameValue.trim());
    }
    setRenaming(null);
  };

  const handleDelete = async (folder) => {
    setContextMenu(null);
    if (window.confirm(`Delete "${folder.name}"? This will permanently remove all files in this folder.`)) {
      await onDeleteFolder(folder.id);
    }
  };

  return (
    <div className="gd-folder-view-container">
      {/* Section Header */}
      {!hideHeader && folders.length > 0 && (
        <div className="gd-section-header">
          <span className="gd-section-title">Folders</span>
        </div>
      )}

      {/* Empty State */}
      {folders.length === 0 && !hideHeader ? (
        <div className="gd-empty-state">
          <div className="gd-empty-icon-wrapper">
            <FolderPlus size={48} />
          </div>
          <h3>No folders yet</h3>
          <p>Create a folder to start organizing and storing files in the Telegram cloud.</p>
        </div>
      ) : (
        <div className="gd-folder-grid">
          {folders.map((folder) => (
            <div
              key={folder.id}
              className="gd-folder-card"
              onClick={() => onOpenFolder(folder)}
              onContextMenu={(e) => !readOnly && handleContextMenu(e, folder)}
            >
              <div className="gd-folder-left">
                <FolderClosed
                  size={20}
                  className="gd-folder-icon"
                  style={{ color: folder.color || '#5f6368' }}
                  fill={folder.color ? `${folder.color}30` : 'none'}
                />
                
                {renaming === folder.id ? (
                  <input
                    ref={renameInputRef}
                    className="gd-folder-rename-input"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onBlur={() => handleRenameSubmit(folder.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameSubmit(folder.id);
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  <span className="gd-folder-name" title={folder.name}>
                    {folder.name}
                  </span>
                )}
              </div>

              {!readOnly && (
                <button
                  className="gd-folder-menu-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleContextMenu(e, folder);
                  }}
                >
                  <MoreVertical size={16} />
                </button>
              )}
            </div>
          ))}
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
              onShareFolder(contextMenu.folder);
              setContextMenu(null);
            }}
          >
            <Share2 size={15} />
            <span>Share</span>
          </button>
          <div className="context-menu-divider" />
          <button
            className="context-menu-item"
            onClick={() => handleRename(contextMenu.folder)}
          >
            <Pencil size={15} />
            <span>Rename</span>
          </button>
          <div className="context-menu-divider" />
          <button
            className="context-menu-item context-menu-item-danger"
            onClick={() => handleDelete(contextMenu.folder)}
          >
            <Trash2 size={15} />
            <span>Delete</span>
          </button>
        </div>
      )}
    </div>
  );
}
