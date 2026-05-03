import { motion } from 'framer-motion';
import { Archive } from 'lucide-react';

export default function ZipModal({ percent }) {
  return (
    <div className="modal-overlay">
      <motion.div
        className="modal-card"
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
          <Archive size={20} color="var(--accent)" />
          <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Creating ZIP</h3>
        </div>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginBottom: 16 }}>
          selected-files.zip
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
