import { useState, useRef, useEffect } from 'react';
import { Search, Settings, HelpCircle, Grid, LogOut, Cloud, Menu, ChevronDown, Check, HardDrive, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export default function Header({
  searchQuery,
  onSearchChange,
  user,
  drives = [],
  activeDrive = null,
  onSwitchDrive,
  onToggleSidebar,
}) {
  const { logout } = useAuth();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const profileMenuRef = useRef(null);
  
  const [showSwitcher, setShowSwitcher] = useState(false);
  const switcherRef = useRef(null);

  useEffect(() => {
    const handleClick = (e) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setShowProfileMenu(false);
      }
      if (switcherRef.current && !switcherRef.current.contains(e.target)) {
        setShowSwitcher(false);
      }
    };
    document.addEventListener('click', handleClick);
    return () => document.removeEventListener('click', handleClick);
  }, []);

  return (
    <header className="gd-header">
      {/* Left: Logo & Drive Switcher */}
      <div className="gd-header-left">
        <button
          className="gd-header-menu-btn"
          onClick={onToggleSidebar}
          title="Main menu"
        >
          <Menu size={20} />
        </button>
        <div className="gd-logo-container">
          <div className="gd-logo-icon">
            <Cloud size={24} color="#0b57d0" strokeWidth={2.5} />
          </div>
          <span className="gd-logo-text">TeleDrive</span>
        </div>

        {drives && drives.length > 0 && (
          <div className="gd-drive-switcher-wrapper" ref={switcherRef}>
            <button
              className="gd-drive-switcher shadow-sm"
              onClick={() => setShowSwitcher(!showSwitcher)}
              title="Switch Drive"
            >
              <span className="gd-drive-switcher-title">
                {activeDrive?.title || 'My Drive'}
              </span>
              <ChevronDown size={16} className={`gd-drive-switcher-chevron ${showSwitcher ? 'rotate' : ''}`} />
            </button>

            {showSwitcher && (
              <div className="gd-drive-dropdown-menu shadow-lg">
                {drives.map((drive) => {
                  const isSelected = activeDrive?.id === drive.id;
                  return (
                    <button
                      key={drive.id}
                      className={`gd-drive-dropdown-item ${isSelected ? 'active' : ''}`}
                      onClick={() => {
                        onSwitchDrive(drive);
                        setShowSwitcher(false);
                      }}
                    >
                      <div className="gd-drive-item-icon">
                        {drive.id === 'personal' ? (
                          <HardDrive size={16} />
                        ) : (
                          <Users size={16} />
                        )}
                      </div>
                      <span className="gd-drive-item-title" title={drive.title}>
                        {drive.title}
                      </span>
                      {isSelected && <Check size={16} className="gd-drive-item-check" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Center: Search Bar */}
      <div className="gd-header-center">
        <div className="gd-search-container">
          <Search size={18} className="gd-search-icon" />
          <input
            type="text"
            className="gd-search-input"
            placeholder="Search in TeleDrive"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
      </div>

      {/* Right: Utilities & Profile */}
      <div className="gd-header-right">
        <button className="gd-icon-btn" title="Help">
          <HelpCircle size={20} />
        </button>
        <button className="gd-icon-btn" title="Settings">
          <Settings size={20} />
        </button>
        <button className="gd-icon-btn" title="Google apps menu">
          <Grid size={20} />
        </button>

        {/* Profile Avatar */}
        <div className="gd-profile-wrapper" ref={profileMenuRef}>
          <button
            className="gd-avatar"
            onClick={() => setShowProfileMenu(!showProfileMenu)}
            title="Account details"
          >
            {user?.firstName?.[0] || 'U'}
          </button>

          {showProfileMenu && (
            <div className="gd-profile-menu shadow-lg">
              <div className="gd-profile-menu-header">
                <div className="gd-avatar gd-avatar-large">
                  {user?.firstName?.[0] || 'U'}
                </div>
                <div className="gd-profile-info">
                  <span className="gd-profile-name">
                    {user?.firstName} {user?.lastName || ''}
                  </span>
                  <span className="gd-profile-handle">
                    {user?.username ? `@${user.username}` : user?.phone || ''}
                  </span>
                </div>
              </div>
              <div className="gd-profile-menu-divider" />
              <button className="gd-logout-btn" onClick={logout}>
                <LogOut size={16} />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
