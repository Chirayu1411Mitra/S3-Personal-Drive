import { useState } from 'react';
import { motion } from 'framer-motion';
import { Cloud, Shield, Zap } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    setLoading(true);
    setError('');
    try {
      await login();
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <motion.div
        className="login-card"
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
      >
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
          style={{
            width: 56, height: 56, borderRadius: 16,
            background: 'linear-gradient(135deg, var(--accent), #6d28d9)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            margin: '0 auto 24px', boxShadow: 'var(--shadow-glow)',
          }}
        >
          <Cloud size={28} color="#fff" />
        </motion.div>

        <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: 8, letterSpacing: '-0.02em' }}>
          S3 Drive
        </h1>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 36, fontSize: '0.9375rem', lineHeight: 1.5 }}>
          Your personal cloud storage, powered by AWS S3.
        </p>

        <button
          className="google-btn"
          onClick={handleLogin}
          disabled={loading}
        >
          {loading ? (
            <div className="spinner" style={{ borderColor: 'rgba(0,0,0,0.1)', borderTopColor: '#333' }} />
          ) : (
            <svg width="20" height="20" viewBox="0 0 48 48">
              <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
              <path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z" />
              <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.223 0-9.641-3.657-11.283-8.438l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
              <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.021 35.826 44 30.551 44 24c0-1.341-.138-2.65-.389-3.917z" />
            </svg>
          )}
          <span>{loading ? 'Signing in...' : 'Sign in with Google'}</span>
        </button>

        {error && (
          <p style={{ color: 'var(--danger)', marginTop: 16, fontSize: '0.8125rem' }}>{error}</p>
        )}

        <div style={{
          display: 'flex', justifyContent: 'center', gap: 32,
          marginTop: 40, paddingTop: 24,
          borderTop: '1px solid var(--border)'
        }}>
          {[
            { icon: Shield, text: 'Secure' },
            { icon: Zap, text: 'Fast' },
            { icon: Cloud, text: 'Reliable' },
          ].map(({ icon: Icon, text }, i) => (
            <motion.div
              key={text}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 + i * 0.1 }}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
                color: 'var(--text-muted)', fontSize: '0.75rem',
              }}
            >
              <Icon size={18} />
              <span>{text}</span>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
