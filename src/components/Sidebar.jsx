import { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Home,
  HardDrive,
  Clock,
  Star,
  Cloud,
  ChevronDown,
  ChevronRight,
  FolderClosed,
  FolderPlus,
  Upload,
  Hash,
} from 'lucide-react';
import { formatBytes } from '../utils/helpers';

export default function Sidebar({
  folders,
  currentFolder,
  activeTab,
  onSelectTab,
  onSelectFolder,
  onCreateFolderClick,
  onUploadFileClick,
  storageUsed = 0,
  tags = [],
  readOnly = false,
}) {
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showFoldersList, setShowFoldersList] = useState(true);
  const [showTagsList, setShowTagsList] = useState(true);
  const newMenuRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target)) {
        setShowNewMenu(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  const handleNewClick = () => {
    if (readOnly) return;
    setShowNewMenu(!showNewMenu);
  };

  const selectTab = (tabId) => {
    onSelectTab(tabId);
    setShowNewMenu(false);
  };

  return (
    <aside className="gd-sidebar">
      {/* 1. + New Floating Button */}
      <div className="gd-new-btn-container" ref={newMenuRef}>
        <button
          className={`gd-new-btn shadow-md ${readOnly ? 'gd-new-btn-disabled' : ''}`}
          onClick={handleNewClick}
          disabled={readOnly}
          title={readOnly ? 'Drive is read-only' : 'New'}
        >
          <Plus size={24} className="gd-new-icon" />
          <span>New</span>
        </button>

        {showNewMenu && (
          <div className="gd-new-dropdown shadow-lg">
            <button
              className="gd-new-dropdown-item"
              onClick={() => {
                onCreateFolderClick();
                setShowNewMenu(false);
              }}
            >
              <FolderPlus size={18} />
              <span>New folder</span>
            </button>
            <div className="gd-new-dropdown-divider" />
            <button
              className="gd-new-dropdown-item"
              onClick={() => {
                onUploadFileClick();
                setShowNewMenu(false);
              }}
            >
              <Upload size={18} />
              <span>File upload</span>
            </button>
          </div>
        )}
      </div>

      {/* 2. Navigation Items */}
      <nav className="gd-sidebar-nav">
        {/* Home */}
        <button
          className={`gd-sidebar-item ${activeTab === 'home' ? 'active' : ''}`}
          onClick={() => selectTab('home')}
        >
          <Home size={18} />
          <span>Home</span>
        </button>

        {/* My Drive (With collapsible folders) */}
        <div className="gd-sidebar-item-group">
          <div
            className={`gd-sidebar-item ${
              activeTab === 'my-drive' && !currentFolder ? 'active' : ''
            }`}
          >
            <button
              className="gd-chevron-btn"
              onClick={(e) => {
                e.stopPropagation();
                setShowFoldersList(!showFoldersList);
              }}
            >
              {showFoldersList ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            <div className="gd-sidebar-item-click" onClick={() => selectTab('my-drive')}>
              <HardDrive size={18} />
              <span>My Drive</span>
            </div>
          </div>

          {/* Nested Folders */}
          {showFoldersList && folders.length > 0 && (
            <div className="gd-sidebar-nested-folders">
              {folders.map((folder) => (
                <button
                  key={folder.id}
                  className={`gd-sidebar-subitem ${
                    currentFolder?.id === folder.id ? 'active' : ''
                  }`}
                  onClick={() => onSelectFolder(folder)}
                >
                  <FolderClosed
                    size={16}
                    style={{ color: folder.color || 'var(--text-secondary)' }}
                  />
                  <span className="gd-sidebar-subitem-text">{folder.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Recent */}
        <button
          className={`gd-sidebar-item ${activeTab === 'recent' ? 'active' : ''}`}
          onClick={() => selectTab('recent')}
        >
          <Clock size={18} />
          <span>Recent</span>
        </button>

        {/* Starred */}
        <button
          className={`gd-sidebar-item ${activeTab === 'starred' ? 'active' : ''}`}
          onClick={() => selectTab('starred')}
        >
          <Star size={18} />
          <span>Starred</span>
        </button>

        {/* Storage */}
        <button
          className={`gd-sidebar-item ${activeTab === 'storage' ? 'active' : ''}`}
          onClick={() => selectTab('storage')}
        >
          <Cloud size={18} />
          <span>Storage</span>
        </button>

        {/* Tags Section */}
        <div className="gd-sidebar-item-group" style={{ marginTop: '12px' }}>
          <div className="gd-sidebar-item">
            <button
              className="gd-chevron-btn"
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowTagsList(!showTagsList);
              }}
            >
              {showTagsList ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
            </button>
            <div className="gd-sidebar-item-click" style={{ cursor: 'default' }}>
              <Hash size={18} />
              <span>Tags</span>
            </div>
          </div>

          {showTagsList && (
            <div className="gd-sidebar-nested-folders">
              {tags.length > 0 ? (
                tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`gd-sidebar-subitem ${
                      activeTab === `tag-${tag}` ? 'active' : ''
                    }`}
                    onClick={() => selectTab(`tag-${tag}`)}
                  >
                    <span className="gd-sidebar-tag-symbol" style={{ width: '16px', display: 'inline-block', textAlign: 'center', opacity: 0.7, fontSize: '13px', fontWeight: 'bold' }}>#</span>
                    <span className="gd-sidebar-subitem-text">{tag.replace('#', '')}</span>
                  </button>
                ))
              ) : (
                <div className="gd-sidebar-empty-tags">
                  No tags yet. Add tags when uploading/renaming files.
                </div>
              )}
            </div>
          )}
        </div>
      </nav>

      {/* 3. Storage Meter */}
      <div className="gd-storage-meter-section">
        <div className="gd-storage-bar-container">
          <div
            className="gd-storage-bar-fill"
            style={{ width: '0%' }}
          />
        </div>
        <span className="gd-storage-text">
          {formatBytes(storageUsed)} of Unlimited used
        </span>
      </div>
    </aside>
  );
}
