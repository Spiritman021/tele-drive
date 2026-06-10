import { AuthProvider, useAuth } from './context/AuthContext';
import LoginPage from './components/LoginPage';
import Dashboard from './components/Dashboard';
import { Loader2 } from 'lucide-react';

function AppContent() {
  const { status } = useAuth();

  if (status === 'authenticated') {
    return <Dashboard />;
  }

  if (status === 'loading') {
    return (
      <div className="app-loading">
        <div className="app-loading-inner">
          <Loader2 size={40} className="spin" />
          <h2>TeleDrive</h2>
          <p>Connecting to Telegram...</p>
        </div>
      </div>
    );
  }

  // needsConfig, unauthenticated, awaitingCode, awaiting2FA
  return <LoginPage />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
