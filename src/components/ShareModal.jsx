import { useState, useEffect, useRef } from 'react';
import {
  X,
  Share2,
  Link2,
  UserPlus,
  Copy,
  Check,
  Loader2,
  Lock,
  FileText,
  FolderClosed,
  ExternalLink,
  ShieldAlert
} from 'lucide-react';
import telegramService from '../services/telegram';

export default function ShareModal({ isOpen, onClose, item, type }) {
  const [username, setUsername] = useState('');
  const [inviting, setInviting] = useState(false);
  const [inviteStatus, setInviteStatus] = useState(null);
  
  const [inviteLink, setInviteLink] = useState('');
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkError, setLinkError] = useState(null);
  
  const [copied, setCopied] = useState(false);
  const [fileLinkCopied, setFileLinkCopied] = useState(false);

  useEffect(() => {
    if (isOpen && item?.channelId) {
      // Auto-load or generate invite link on mount for seamless experience
      loadInviteLink();
    }
    // Clean up state on open/close change
    return () => {
      setUsername('');
      setInviteStatus(null);
      setInviteLink('');
      setLinkError(null);
      setCopied(false);
      setFileLinkCopied(false);
    };
  }, [isOpen, item]);

  if (!isOpen || !item) return null;

  const loadInviteLink = async () => {
    setGeneratingLink(true);
    setLinkError(null);
    try {
      const link = await telegramService.generateInviteLink(item.channelId);
      setInviteLink(link);
    } catch (err) {
      console.error('Failed to auto-generate invite link:', err);
      // Don't show critical error alert on load, just let them click manual generate if needed
      setLinkError('Click generate to create a new invite link.');
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleManualGenerateLink = async () => {
    setGeneratingLink(true);
    setLinkError(null);
    try {
      const link = await telegramService.generateInviteLink(item.channelId);
      setInviteLink(link);
    } catch (err) {
      console.error('Manual generate link failed:', err);
      let errMsg = 'Failed to generate invite link.';
      if (err?.message?.includes('CHAT_ADMIN_REQUIRED')) {
        errMsg = 'Admin permissions are required to generate invite links.';
      }
      setLinkError(errMsg);
    } finally {
      setGeneratingLink(false);
    }
  };

  const handleInviteUser = async (e) => {
    e.preventDefault();
    if (!username.trim() || inviting) return;

    setInviting(true);
    setInviteStatus(null);

    const inputName = username.trim();

    try {
      const { user } = await telegramService.inviteUserToChannel(item.channelId, inputName);
      const displayName = user.firstName 
        ? `${user.firstName}${user.lastName ? ' ' + user.lastName : ''}`
        : inputName;

      setInviteStatus({
        type: 'success',
        message: `Successfully added ${displayName} (@${user.username || inputName}) to this channel.`
      });
      setUsername('');
    } catch (err) {
      console.error('Failed to invite user:', err);
      let message = 'Failed to invite user. Please try again.';

      // Robust Telegram MTProto error mapping
      const errStr = err.message || '';
      if (errStr.includes('USER_PRIVACY_RESTRICTED')) {
        message = "Privacy settings prevent adding this user directly. Please share the invite link with them.";
      } else if (errStr.includes('CHAT_ADMIN_REQUIRED')) {
        message = "Admin permissions are required to add members to this channel.";
      } else if (errStr.includes('USER_NOT_MUTUAL_CONTACT')) {
        message = "This user is not a mutual contact. Please share the invite link with them instead.";
      } else if (errStr.includes('USERNAME_NOT_OCCUPIED')) {
        message = `The username "${inputName}" does not exist. Check spelling.`;
      } else if (errStr.includes('USERNAME_INVALID')) {
        message = "Invalid username format. Usernames should look like @username.";
      } else if (errStr.includes('USER_KICKED') || errStr.includes('USER_BANNED_IN_CHANNEL')) {
        message = "This user has been banned or kicked from this folder's channel.";
      } else if (errStr.includes('USER_ALREADY_PARTICIPANT')) {
        message = "This user is already a member of this folder's channel!";
      }

      setInviteStatus({
        type: 'error',
        message
      });
    } finally {
      setInviting(false);
    }
  };

  const copyToClipboard = async (text, isFileLink = false) => {
    try {
      await navigator.clipboard.writeText(text);
      if (isFileLink) {
        setFileLinkCopied(true);
        setTimeout(() => setFileLinkCopied(false), 2000);
      } else {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy link:', err);
      // Fallback
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
        if (isFileLink) {
          setFileLinkCopied(true);
          setTimeout(() => setFileLinkCopied(false), 2000);
        } else {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }
      } catch (fErr) {
        console.error('Fallback copy failed:', fErr);
      }
      document.body.removeChild(textarea);
    }
  };

  // Get direct Telegram message link
  const getTelegramMessageLink = () => {
    if (type !== 'file' || !item.messageId) return '';
    const cleanId = String(item.channelId).replace(/^-100/, '');
    return `https://t.me/c/${cleanId}/${item.messageId}`;
  };

  const fileMessageLink = getTelegramMessageLink();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal share-modal" onClick={(e) => e.stopPropagation()}>
        
        {/* Modal Header */}
        <div className="modal-header">
          <div className="share-modal-title-container">
            <Share2 className="share-modal-header-icon" size={20} />
            <div>
              <h3>Share settings</h3>
              <p className="share-modal-subtitle">
                {type === 'folder' ? 'Folder sharing' : 'File sharing'}
              </p>
            </div>
          </div>
          <button className="btn-icon btn-close-modal" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body share-modal-body">
          
          {/* Item Info Card */}
          <div className="share-item-preview-card">
            {type === 'folder' ? (
              <FolderClosed size={24} style={{ color: item.color || '#3b82f6' }} />
            ) : (
              <FileText size={24} style={{ color: '#4285f4' }} />
            )}
            <div className="share-item-preview-details">
              <span className="share-item-name">{item.name}</span>
              <span className="share-item-desc">
                {type === 'folder' ? 'Telegram Channel Access' : 'Telegram File & Channel Access'}
              </span>
            </div>
          </div>

          {/* Section 1: Invite users directly */}
          <div className="share-section">
            <h4 className="share-section-title">
              <UserPlus size={16} />
              <span>Add people to Telegram channel</span>
            </h4>
            <p className="share-section-desc">
              Directly invite and add members to the Telegram channel containing these files.
            </p>
            
            <form onSubmit={handleInviteUser} className="share-invite-form">
              <div className="input-group">
                <input
                  type="text"
                  className="input share-username-input"
                  placeholder="Telegram Username (e.g. @john_doe)"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={inviting}
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary share-invite-btn"
                disabled={!username.trim() || inviting}
              >
                {inviting ? (
                  <Loader2 className="spin" size={16} />
                ) : (
                  <span>Add Member</span>
                )}
              </button>
            </form>

            {/* Invite Status Messages */}
            {inviteStatus && (
              <div className={`share-status-alert ${inviteStatus.type}`}>
                {inviteStatus.type === 'error' && <ShieldAlert size={16} className="alert-icon" />}
                <span>{inviteStatus.message}</span>
              </div>
            )}
          </div>

          <div className="share-divider" />

          {/* Section 2: General Access / Invite Link */}
          <div className="share-section">
            <h4 className="share-section-title">
              <Link2 size={16} />
              <span>Invite Link</span>
            </h4>
            <p className="share-section-desc">
              Generate a Telegram invite link that anyone can click to join the channel.
            </p>

            {inviteLink ? (
              <div className="share-link-copy-container">
                <input
                  type="text"
                  className="input share-link-display"
                  value={inviteLink}
                  readOnly
                  onClick={(e) => e.target.select()}
                />
                <button
                  className={`btn btn-secondary share-copy-btn ${copied ? 'copied' : ''}`}
                  onClick={() => copyToClipboard(inviteLink)}
                >
                  {copied ? <Check size={16} className="text-green" /> : <Copy size={16} />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
            ) : (
              <div className="share-link-placeholder-container">
                {generatingLink ? (
                  <div className="share-link-loading">
                    <Loader2 className="spin" size={18} />
                    <span>Generating Telegram invite link...</span>
                  </div>
                ) : (
                  <div className="share-link-generate-prompt">
                    <span className="text-muted text-sm">
                      {linkError || 'No invite link generated yet.'}
                    </span>
                    <button
                      className="btn btn-secondary btn-sm"
                      onClick={handleManualGenerateLink}
                    >
                      Generate Link
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Section 3: Direct File Message Link (Only if file) */}
          {type === 'file' && fileMessageLink && (
            <>
              <div className="share-divider" />
              <div className="share-section">
                <h4 className="share-section-title">
                  <ExternalLink size={16} />
                  <span>Telegram Message Link</span>
                </h4>
                <p className="share-section-desc">
                  Direct link to this file's specific message inside the Telegram channel.
                </p>
                <div className="share-link-copy-container">
                  <input
                    type="text"
                    className="input share-link-display"
                    value={fileMessageLink}
                    readOnly
                    onClick={(e) => e.target.select()}
                  />
                  <button
                    className={`btn btn-secondary share-copy-btn ${fileLinkCopied ? 'copied' : ''}`}
                    onClick={() => copyToClipboard(fileMessageLink, true)}
                  >
                    {fileLinkCopied ? <Check size={16} className="text-green" /> : <Copy size={16} />}
                    <span>{fileLinkCopied ? 'Copied' : 'Copy'}</span>
                  </button>
                </div>
              </div>
            </>
          )}

        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <div className="share-footer-left">
            <Lock size={14} className="text-muted" />
            <span className="text-muted text-xs">Channels are private by default</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Done
          </button>
        </div>

      </div>
    </div>
  );
}
