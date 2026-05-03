import { useAuth } from './contexts/AuthContext';
import LoginPage from './components/LoginPage';
import DrivePage from './components/DrivePage';
import { DriveProvider } from './contexts/DriveContext';

function AppContent() {
  const { isAuthenticated, isLoading, s3Ready } = useAuth();

  if (isLoading) {
    return (
      <div className="login-page">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <LoginPage />;

  if (!s3Ready) {
    return (
      <div className="login-page">
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <div className="spinner" style={{ width: 32, height: 32 }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Connecting to storage...</p>
        </div>
      </div>
    );
  }

  return (
    <DriveProvider>
      <DrivePage />
    </DriveProvider>
  );
}

export default function App() {
  return <AppContent />;
}
