import { useState } from 'react';
import { motion } from 'framer-motion';
import { Cloud, FolderOpen, Image, Trash2, Upload, FolderPlus, LogOut, HardDrive } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useDrive } from '../contexts/DriveContext';

export default function Sidebar({ fileInputRef }) {
  const { currentUser, logout } = useAuth();
  const { activeSection, switchSection, handleCreateFolder, showToast, storageUsed, storageLimit } = useDrive();
  const [showFolderInput, setShowFolderInput] = useState(false);
  const [folderName, setFolderName] = useState('');

  // Format bytes to human-readable
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return (bytes / Math.pow(1024, i)).toFixed(i >= 2 ? 1 : 0) + ' ' + units[i];
  };

  const usagePercent = storageLimit > 0 ? Math.min((storageUsed / storageLimit) * 100, 100) : 0;
  const isNearLimit = usagePercent > 80;

  const handleNewFolder = () => {
    if (showFolderInput) {
      if (folderName.trim()) {
        handleCreateFolder(folderName.trim());
        setFolderName('');
        setShowFolderInput(false);
      } else {
        showToast('Folder name cannot be empty', true);
      }
    } else {
      setShowFolderInput(true);
    }
  };

  const handleFolderKeyDown = (e) => {
    if (e.key === 'Enter') handleNewFolder();
    if (e.key === 'Escape') { setShowFolderInput(false); setFolderName(''); }
  };

  const navItems = [
    { id: 'my-files', icon: FolderOpen, label: 'My Files' },
    { id: 'images', icon: Image, label: 'Images' },
  ];

  const initial = currentUser?.displayName?.charAt(0)?.toUpperCase() || currentUser?.email?.charAt(0)?.toUpperCase() || '?';

  return (
    <motion.aside
      className="sidebar"
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, padding: '0 8px' }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: 'linear-gradient(135deg, var(--accent), #6d28d9)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: 'var(--shadow-glow)',
        }}>
          <Cloud size={20} color="#fff" />
        </div>
        <span style={{ fontSize: '1.125rem', fontWeight: 700, letterSpacing: '-0.02em' }}>S3 Drive</span>
      </div>

      {/* User */}
      <div className="user-section">
        <div className="user-avatar">
          {currentUser?.photoURL ? (
            <img src={currentUser.photoURL} alt="" referrerPolicy="no-referrer" />
          ) : initial}
        </div>
        <div className="user-info">
          <div className="name">{currentUser?.displayName || 'User'}</div>
          <div className="email">{currentUser?.email}</div>
        </div>
      </div>

      {/* Actions */}
      <button className="btn btn-primary" style={{ width: '100%', marginBottom: 8 }}
        onClick={() => fileInputRef.current?.click()}>
        <Upload size={18} /> Upload Files
      </button>

      <button className="btn btn-ghost" style={{ width: '100%', marginBottom: 8 }}
        onClick={handleNewFolder}>
        <FolderPlus size={18} /> New Folder
      </button>

      {showFolderInput && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
          style={{ marginBottom: 8 }}>
          <input className="input" placeholder="Folder name..."
            value={folderName} onChange={e => setFolderName(e.target.value)}
            onKeyDown={handleFolderKeyDown} autoFocus />
        </motion.div>
      )}

      {/* Nav */}
      <div style={{ marginTop: 20 }}>
        <p style={{
          fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase',
          letterSpacing: '0.08em', color: 'var(--text-muted)', padding: '0 14px', marginBottom: 8,
        }}>Navigation</p>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          {navItems.map(({ id, icon: Icon, label }) => (
            <button key={id}
              className={`nav-item ${activeSection === id ? 'active' : ''}`}
              onClick={() => switchSection(id)}>
              <Icon size={18} />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Storage */}
      <div className="storage-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <HardDrive size={16} color={isNearLimit ? 'var(--danger)' : 'var(--text-muted)'} />
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Storage</span>
        </div>
        <div className="progress-bar-track" style={{ marginBottom: 8 }}>
          <div className="progress-bar-fill" style={{
            width: `${usagePercent}%`,
            background: isNearLimit
              ? 'linear-gradient(90deg, #ef4444, #f97316)'
              : undefined
          }} />
        </div>
        <p style={{ fontSize: '0.75rem', color: isNearLimit ? 'var(--danger)' : 'var(--text-muted)' }}>
          {formatBytes(storageUsed)} of {formatBytes(storageLimit)} used
        </p>
      </div>

      {/* Logout */}
      <button className="nav-item" style={{ marginTop: 16, color: 'var(--danger)' }}
        onClick={logout}>
        <LogOut size={18} />
        Sign Out
      </button>
    </motion.aside>
  );
}
