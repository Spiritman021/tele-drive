import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Phone,
  Key,
  Lock,
  ArrowRight,
  Loader2,
  Send,
  Cloud,
  Shield,
  Zap,
  Settings,
  ExternalLink,
} from 'lucide-react';

export default function LoginPage() {
  const { status, error, saveConfig, sendCode, verifyCode, verify2FA, clearError } = useAuth();
  const [apiId, setApiId] = useState('');
  const [apiHash, setApiHash] = useState('');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [configLoading, setConfigLoading] = useState(false);

  const handleSaveConfig = async (e) => {
    e.preventDefault();
    if (!apiId.trim() || !apiHash.trim()) return;
    setConfigLoading(true);
    await saveConfig(apiId.trim(), apiHash.trim());
    setConfigLoading(false);
  };

  const handleSendCode = async (e) => {
    e.preventDefault();
    if (!phone.trim()) return;
    await sendCode(phone.trim());
  };

  const handleVerifyCode = async (e) => {
    e.preventDefault();
    if (!code.trim()) return;
    await verifyCode(code.trim());
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    if (!password.trim()) return;
    await verify2FA(password.trim());
  };

  const isConfigStep = status === 'needsConfig';
  const isPhoneStep = status === 'unauthenticated';
  const isCodeStep = status === 'awaitingCode';
  const is2FAStep = status === 'awaiting2FA';

  return (
    <div className="login-page">
      {/* Animated background blobs */}
      <div className="login-bg">
        <div className="login-blob login-blob-1"></div>
        <div className="login-blob login-blob-2"></div>
        <div className="login-blob login-blob-3"></div>
      </div>

      <div className="login-container">
        {/* Left side - Branding */}
        <div className="login-hero">
          <div className="login-logo">
            <div className="login-logo-icon">
              <Cloud size={36} />
            </div>
            <h1 className="login-logo-text">TeleDrive</h1>
          </div>
          <p className="login-tagline">
            Your files, stored securely in Telegram.
            <br />
            <span className="login-tagline-accent">Unlimited. Private. Free.</span>
          </p>

          <div className="login-features">
            <div className="login-feature">
              <div className="login-feature-icon">
                <Shield size={20} />
              </div>
              <div>
                <strong>End-to-end encrypted</strong>
                <p>Your files never touch our servers</p>
              </div>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon">
                <Zap size={20} />
              </div>
              <div>
                <strong>Up to 2 GB per file</strong>
                <p>Powered by Telegram's infrastructure</p>
              </div>
            </div>
            <div className="login-feature">
              <div className="login-feature-icon">
                <Send size={20} />
              </div>
              <div>
                <strong>Cross-device sync</strong>
                <p>Access your files from anywhere</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right side - Auth form */}
        <div className="login-card glass-card">
          {/* Step indicator */}
          <div className="login-steps">
            <div className={`login-step-dot ${isConfigStep ? 'active' : (!isConfigStep ? 'done' : '')}`} />
            <div className={`login-step-line ${!isConfigStep ? 'done' : ''}`} />
            <div className={`login-step-dot ${isPhoneStep ? 'active' : (isCodeStep || is2FAStep ? 'done' : '')}`} />
            <div className={`login-step-line ${isCodeStep || is2FAStep ? 'done' : ''}`} />
            <div className={`login-step-dot ${isCodeStep || is2FAStep ? 'active' : ''}`} />
          </div>

          <h2 className="login-card-title">
            {isConfigStep && 'Connect to Telegram API'}
            {isPhoneStep && 'Sign in with Telegram'}
            {isCodeStep && 'Enter verification code'}
            {is2FAStep && 'Two-factor authentication'}
          </h2>
          <p className="login-card-subtitle">
            {isConfigStep && 'Enter your Telegram API credentials to get started'}
            {isPhoneStep && 'Enter your phone number to sign in'}
            {isCodeStep && 'We sent a code to your Telegram app'}
            {is2FAStep && 'Enter your cloud password'}
          </p>

          {error && (
            <div className="login-error" onClick={clearError}>
              <span>{error}</span>
              <span className="login-error-dismiss">✕</span>
            </div>
          )}

          {/* Step 0: API Config */}
          {isConfigStep && (
            <form onSubmit={handleSaveConfig} className="login-form">
              <div className="login-api-help">
                <Settings size={16} />
                <span>
                  Get your API credentials from{' '}
                  <a
                    href="https://my.telegram.org"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="login-link"
                  >
                    my.telegram.org <ExternalLink size={12} />
                  </a>
                </span>
              </div>

              <div className="input-group">
                <Key size={18} className="input-icon" />
                <input
                  id="api-id-input"
                  type="text"
                  className="input"
                  placeholder="API ID (e.g. 12345678)"
                  value={apiId}
                  onChange={(e) => setApiId(e.target.value)}
                  autoFocus
                  inputMode="numeric"
                />
              </div>
              <div className="input-group">
                <Lock size={18} className="input-icon" />
                <input
                  id="api-hash-input"
                  type="text"
                  className="input"
                  placeholder="API Hash (e.g. a1b2c3d4e5f6...)"
                  value={apiHash}
                  onChange={(e) => setApiHash(e.target.value)}
                />
              </div>

              <p className="login-hint">
                Your credentials are stored only in your browser — never sent to any server.
              </p>

              <button
                type="submit"
                className="btn btn-primary btn-lg btn-full"
                disabled={!apiId.trim() || !apiHash.trim() || configLoading}
              >
                {configLoading ? (
                  <>
                    <Loader2 size={18} className="spin" />
                    <span>Connecting...</span>
                  </>
                ) : (
                  <>
                    <span>Connect</span>
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </form>
          )}

          {/* Step 1: Phone Number */}
          {isPhoneStep && (
            <form onSubmit={handleSendCode} className="login-form">
              <div className="input-group">
                <Phone size={18} className="input-icon" />
                <input
                  id="phone-input"
                  type="tel"
                  className="input"
                  placeholder="+1 234 567 8900"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoFocus
                  autoComplete="tel"
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-lg btn-full"
                disabled={!phone.trim()}
              >
                <span>Continue</span>
                <ArrowRight size={18} />
              </button>
            </form>
          )}

          {/* Step 2: OTP Code */}
          {isCodeStep && (
            <form onSubmit={handleVerifyCode} className="login-form">
              <div className="input-group">
                <Key size={18} className="input-icon" />
                <input
                  id="code-input"
                  type="text"
                  className="input"
                  placeholder="12345"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoFocus
                  maxLength={6}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-lg btn-full"
                disabled={!code.trim()}
              >
                <span>Verify Code</span>
                <ArrowRight size={18} />
              </button>
            </form>
          )}

          {/* Step 3: 2FA Password */}
          {is2FAStep && (
            <form onSubmit={handleVerify2FA} className="login-form">
              <div className="input-group">
                <Lock size={18} className="input-icon" />
                <input
                  id="password-input"
                  type="password"
                  className="input"
                  placeholder="Cloud password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoFocus
                  autoComplete="current-password"
                />
              </div>
              <button
                type="submit"
                className="btn btn-primary btn-lg btn-full"
                disabled={!password.trim()}
              >
                <span>Sign In</span>
                <ArrowRight size={18} />
              </button>
            </form>
          )}

          {status === 'loading' && (
            <div className="login-loading">
              <Loader2 size={32} className="spin" />
              <p>Connecting to Telegram...</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
