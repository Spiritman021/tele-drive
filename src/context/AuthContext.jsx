import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import telegramService from '../services/telegram';

const AuthContext = createContext(null);

const API_STORAGE_KEY = 'teledrive_api_config';

function getStoredApiConfig() {
  try {
    const stored = localStorage.getItem(API_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed.apiId && parsed.apiHash) return parsed;
    }
  } catch {}
  return null;
}

function storeApiConfig(apiId, apiHash) {
  localStorage.setItem(API_STORAGE_KEY, JSON.stringify({ apiId, apiHash }));
}

function clearApiConfig() {
  localStorage.removeItem(API_STORAGE_KEY);
}

export function AuthProvider({ children }) {
  const [status, setStatus] = useState('loading');
  // status: 'loading' | 'needsConfig' | 'unauthenticated' | 'awaitingCode' | 'awaiting2FA' | 'authenticated'
  const [user, setUser] = useState(null);
  const [phoneCodeHash, setPhoneCodeHash] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      const config = getStoredApiConfig();

      if (!config) {
        if (!cancelled) setStatus('needsConfig');
        return;
      }

      try {
        await telegramService.init(config.apiId, config.apiHash);

        const loggedIn = await telegramService.isLoggedIn();
        if (cancelled) return;

        if (loggedIn) {
          const me = await telegramService.getMe();
          if (cancelled) return;

          setUser({
            id: me.id,
            firstName: me.firstName || '',
            lastName: me.lastName || '',
            username: me.username || '',
            phone: me.phone || '',
            photo: me.photo || null,
          });
          setStatus('authenticated');
        } else {
          setStatus('unauthenticated');
        }
      } catch (err) {
        if (!cancelled) {
          console.error('Auth initialization failed:', err);
          setError(err.message || 'Failed to initialize');
          setStatus('unauthenticated');
        }
      }
    }

    initialize();

    return () => {
      cancelled = true;
    };
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const saveConfig = useCallback(async (apiId, apiHash) => {
    try {
      setError(null);
      storeApiConfig(apiId, apiHash);
      await telegramService.init(apiId, apiHash);
      setStatus('unauthenticated');
    } catch (err) {
      console.error('Config failed:', err);
      clearApiConfig();
      setError(err.message || 'Failed to connect with these API credentials');
    }
  }, []);

  const resetConfig = useCallback(() => {
    clearApiConfig();
    localStorage.removeItem('teledrive_session');
    setUser(null);
    setStatus('needsConfig');
    setError(null);
  }, []);

  const sendCode = useCallback(async (phone) => {
    try {
      setError(null);
      const phoneCodeHashResult = await telegramService.sendCode(phone);
      setPhoneNumber(phone);
      setPhoneCodeHash(phoneCodeHashResult);
      setStatus('awaitingCode');
    } catch (err) {
      console.error('sendCode failed:', err);
      setError(err.message || 'Failed to send verification code');
    }
  }, []);

  const verifyCode = useCallback(async (code) => {
    try {
      setError(null);
      await telegramService.signIn(phoneNumber, phoneCodeHash, code);

      const me = await telegramService.getMe();
      setUser({
        id: me.id,
        firstName: me.firstName || '',
        lastName: me.lastName || '',
        username: me.username || '',
        phone: me.phone || '',
        photo: me.photo || null,
      });
      setPhoneCodeHash(null);
      setPhoneNumber(null);
      setStatus('authenticated');
    } catch (err) {
      if (err.message === 'SESSION_PASSWORD_NEEDED' || err.errorMessage === 'SESSION_PASSWORD_NEEDED') {
        setStatus('awaiting2FA');
      } else {
        console.error('verifyCode failed:', err);
        setError(err.message || 'Invalid verification code');
      }
    }
  }, [phoneNumber, phoneCodeHash]);

  const verify2FA = useCallback(async (password) => {
    try {
      setError(null);
      await telegramService.signInWith2FA(password);

      const me = await telegramService.getMe();
      setUser({
        id: me.id,
        firstName: me.firstName || '',
        lastName: me.lastName || '',
        username: me.username || '',
        phone: me.phone || '',
        photo: me.photo || null,
      });
      setPhoneCodeHash(null);
      setPhoneNumber(null);
      setStatus('authenticated');
    } catch (err) {
      console.error('verify2FA failed:', err);
      setError(err.message || 'Invalid 2FA password');
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      setError(null);
      await telegramService.logout();
      setUser(null);
      setPhoneCodeHash(null);
      setPhoneNumber(null);
      setStatus('unauthenticated');
    } catch (err) {
      console.error('logout failed:', err);
      setError(err.message || 'Failed to log out');
    }
  }, []);

  const value = {
    status,
    user,
    error,
    saveConfig,
    resetConfig,
    sendCode,
    verifyCode,
    verify2FA,
    logout,
    clearError,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export default AuthContext;
