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
  Download,
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
  isSidebarCollapsed = false,
}) {
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showFoldersList, setShowFoldersList] = useState(true);
  const [showTagsList, setShowTagsList] = useState(true);
  const newMenuRef = useRef(null);

  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowInstallBtn(false);
      console.log('[PWA] App was installed successfully');
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`[PWA] Install prompt outcome: ${outcome}`);
    setDeferredPrompt(null);
    setShowInstallBtn(false);
  };

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

  const displayFoldersList = showFoldersList && !isSidebarCollapsed;
  const displayTagsList = showTagsList && !isSidebarCollapsed;

  return (
    <aside className={`gd-sidebar ${isSidebarCollapsed ? 'collapsed' : ''}`}>
      {/* 1. + New Floating Button */}
      <div className="gd-new-btn-container" ref={newMenuRef}>
        <button
          className={`gd-new-btn shadow-md ${readOnly ? 'gd-new-btn-disabled' : ''} ${isSidebarCollapsed ? 'collapsed' : ''}`}
          onClick={handleNewClick}
          disabled={readOnly}
          title={isSidebarCollapsed ? "New" : (readOnly ? 'Drive is read-only' : 'New')}
        >
          <Plus size={24} className="gd-new-icon" />
          {!isSidebarCollapsed && <span>New</span>}
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
          title={isSidebarCollapsed ? "Home" : ""}
        >
          <Home size={18} />
          {!isSidebarCollapsed && <span>Home</span>}
        </button>

        {/* My Drive (With collapsible folders) */}
        <div className="gd-sidebar-item-group">
          <div
            className={`gd-sidebar-item ${
              activeTab === 'my-drive' && !currentFolder ? 'active' : ''
            }`}
            title={isSidebarCollapsed ? "My Drive" : ""}
          >
            {!isSidebarCollapsed && (
              <button
                className="gd-chevron-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFoldersList(!showFoldersList);
                }}
              >
                {showFoldersList ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>
            )}
            <div className="gd-sidebar-item-click" onClick={() => selectTab('my-drive')}>
              <HardDrive size={18} />
              {!isSidebarCollapsed && <span>My Drive</span>}
            </div>
          </div>

          {/* Nested Folders */}
          {displayFoldersList && folders.length > 0 && (
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
          title={isSidebarCollapsed ? "Recent" : ""}
        >
          <Clock size={18} />
          {!isSidebarCollapsed && <span>Recent</span>}
        </button>

        {/* Starred */}
        <button
          className={`gd-sidebar-item ${activeTab === 'starred' ? 'active' : ''}`}
          onClick={() => selectTab('starred')}
          title={isSidebarCollapsed ? "Starred" : ""}
        >
          <Star size={18} />
          {!isSidebarCollapsed && <span>Starred</span>}
        </button>

        {/* Storage */}
        <button
          className={`gd-sidebar-item ${activeTab === 'storage' ? 'active' : ''}`}
          onClick={() => selectTab('storage')}
          title={isSidebarCollapsed ? "Storage" : ""}
        >
          <Cloud size={18} />
          {!isSidebarCollapsed && <span>Storage</span>}
        </button>

        {/* Tags Section */}
        <div className="gd-sidebar-item-group" style={{ marginTop: '12px' }}>
          <div className="gd-sidebar-item" title={isSidebarCollapsed ? "Tags" : ""}>
            {!isSidebarCollapsed && (
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
            )}
            <div className="gd-sidebar-item-click" style={{ cursor: 'default' }} onClick={() => isSidebarCollapsed && selectTab('tags-list-root')}>
              <Hash size={18} />
              {!isSidebarCollapsed && <span>Tags</span>}
            </div>
          </div>

          {displayTagsList && (
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
      {!isSidebarCollapsed && (
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
      )}

      {/* 4. Install App Button (Expanded) */}
      {showInstallBtn && !isSidebarCollapsed && (
        <div className="gd-install-app-section" style={{ padding: '0 16px 16px 16px', marginTop: 'auto' }}>
          <button
            onClick={handleInstallClick}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 14px',
              borderRadius: '12px',
              fontSize: '13px',
              fontWeight: 600,
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            <Download size={16} />
            <span>Install App</span>
          </button>
        </div>
      )}

      {/* Install App Button (Collapsed) */}
      {showInstallBtn && isSidebarCollapsed && (
        <div className="gd-install-app-collapsed" style={{ display: 'flex', justifyContent: 'center', padding: '16px 0', marginTop: 'auto' }}>
          <button
            onClick={handleInstallClick}
            title="Install App"
            style={{
              padding: '10px',
              borderRadius: '12px',
              backgroundColor: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: 'var(--text-primary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.2s ease',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.12)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.1)';
            }}
          >
            <Download size={18} />
          </button>
        </div>
      )}
    </aside>
  );
}
