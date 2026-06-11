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
  Share2,
  MessageSquare,
} from 'lucide-react';
import { formatBytes } from '../utils/helpers';

const getMobileOS = () => {
  const ua = navigator.userAgent;
  if (/android/i.test(ua)) return 'android';
  if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return 'ios';
  return 'desktop';
};

const getBrowser = () => {
  const ua = navigator.userAgent;
  if (/chrome|crios/i.test(ua) && !/edge|edg/i.test(ua) && !/opr/i.test(ua)) return 'chrome';
  if (/safari/i.test(ua) && !/chrome|crios/i.test(ua)) return 'safari';
  if (/firefox|fxios/i.test(ua)) return 'firefox';
  if (/edge|edg/i.test(ua)) return 'edge';
  return 'other';
};

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
  chatOpen = false,
  onToggleChat,
}) {
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showFoldersList, setShowFoldersList] = useState(true);
  const [showTagsList, setShowTagsList] = useState(true);
  const newMenuRef = useRef(null);

  const [deferredPrompt, setDeferredPrompt] = useState(window.deferredPrompt || null);
  const [isStandalone, setIsStandalone] = useState(
    !!(window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone)
  );
  const [showInstructions, setShowInstructions] = useState(false);

  const os = getMobileOS();
  const browser = getBrowser();

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
    };

    const handlePromptAvailable = () => {
      setDeferredPrompt(window.deferredPrompt);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('pwa-prompt-available', handlePromptAvailable);

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setIsStandalone(true);
      window.deferredPrompt = null;
      console.log('[PWA] App was installed successfully');
    };
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('pwa-prompt-available', handlePromptAvailable);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    const promptEvent = deferredPrompt || window.deferredPrompt;
    if (promptEvent) {
      promptEvent.prompt();
      const { outcome } = await promptEvent.userChoice;
      console.log(`[PWA] Install prompt outcome: ${outcome}`);
      setDeferredPrompt(null);
      window.deferredPrompt = null;
    } else {
      setShowInstructions(true);
    }
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

        {/* Chat */}
        <button
          className={`gd-sidebar-item ${chatOpen ? 'active' : ''}`}
          onClick={onToggleChat}
          title={isSidebarCollapsed ? "Chat" : ""}
        >
          <MessageSquare size={18} style={{ color: chatOpen ? '#1a73e8' : 'inherit' }} />
          {!isSidebarCollapsed && <span>Chat</span>}
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
      {!isStandalone && !isSidebarCollapsed && (
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
      {!isStandalone && isSidebarCollapsed && (
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

      {/* PWA Instructions Modal */}
      {showInstructions && (
        <div
          onClick={() => setShowInstructions(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100vw',
            height: '100vh',
            backgroundColor: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(8px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
            padding: '16px',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: '440px',
              backgroundColor: '#1e293b',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '20px',
              padding: '24px',
              color: 'var(--text-primary)',
              boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, margin: 0 }}>Install TeleDrive</h3>
              <button
                onClick={() => setShowInstructions(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-secondary)',
                  cursor: 'pointer',
                  padding: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Plus size={20} style={{ transform: 'rotate(45deg)' }} />
              </button>
            </div>
            
            <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
              Install TeleDrive on your device for quick access, standalone window mode, offline support, and system integration.
            </p>

            <div
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '12px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '12px',
                fontSize: '14px',
                lineHeight: 1.6,
                color: '#cbd5e1',
              }}
            >
              {os === 'ios' && (
                <>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>Instructions for iOS Safari:</div>
                  <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li>Tap the <strong>Share</strong> button <Share2 size={16} style={{ display: 'inline', verticalAlign: 'text-bottom', margin: '0 2px' }} /> at the bottom of Safari.</li>
                    <li>Scroll down the share sheet and select <strong>Add to Home Screen</strong>.</li>
                    <li>Tap <strong>Add</strong> in the top right to complete installation.</li>
                  </ol>
                </>
              )}
              
              {os === 'android' && (
                <>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>Instructions for Android Chrome:</div>
                  <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li>Tap the <strong>Menu</strong> button (three dots) in Chrome's top right.</li>
                    <li>Select <strong>Add to Home screen</strong> or <strong>Install app</strong>.</li>
                    <li>Confirm by clicking <strong>Install</strong>.</li>
                  </ol>
                </>
              )}

              {os === 'desktop' && browser === 'safari' && (
                <>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>Instructions for macOS Safari:</div>
                  <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li>Click the <strong>Share</strong> button in Safari's toolbar.</li>
                    <li>Select <strong>Add to Dock...</strong> from the dropdown.</li>
                    <li>Click <strong>Add</strong> to create the standalone app.</li>
                  </ol>
                </>
              )}

              {os === 'desktop' && browser !== 'safari' && (
                <>
                  <div style={{ fontWeight: 600, color: '#ffffff' }}>Instructions for Desktop:</div>
                  <ol style={{ margin: 0, paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <li>Look for the <strong>Install</strong> icon <Download size={14} style={{ display: 'inline', verticalAlign: 'middle' }} /> in the browser address bar.</li>
                    <li>Click it to install the standalone application.</li>
                    <li>Alternatively, open the browser menu (three dots) and select <strong>Install TeleDrive</strong> or <strong>Save and share</strong> &rarr; <strong>Install page</strong>.</li>
                  </ol>
                </>
              )}
            </div>

            <button
              onClick={() => setShowInstructions(false)}
              style={{
                backgroundColor: '#3b82f6',
                color: '#ffffff',
                border: 'none',
                borderRadius: '12px',
                padding: '12px',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'background 0.2s',
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#2563eb'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#3b82f6'}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </aside>
  );
}
