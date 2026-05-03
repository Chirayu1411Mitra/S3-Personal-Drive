import { motion } from 'framer-motion';
import { Upload } from 'lucide-react';

export default function UploadModal({ fileName, percent }) {
  return (
    <div className="modal-overlay">
      <motion.div
        className="modal-card"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Upload size={20} color="var(--accent)" />
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Uploading</h3>
        </div>
        <p style={{
          color: 'var(--text-secondary)', fontSize: '0.8125rem', marginBottom: 16,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {fileName}
        </p>
        <div className="progress-bar-track" style={{ marginBottom: 8 }}>
          <div className="progress-bar-fill" style={{ width: `${percent}%` }} />
        </div>
        <p style={{ textAlign: 'center', fontSize: '0.875rem', fontWeight: 600, color: 'var(--accent)' }}>
          {percent}%
        </p>
      </motion.div>
    </div>
  );
}
