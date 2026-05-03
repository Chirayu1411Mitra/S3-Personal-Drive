import { motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';
import { useDrive } from '../../contexts/DriveContext';

export default function DeleteModal() {
  const { deleteTarget, setDeleteTarget } = useDrive();
  if (!deleteTarget) return null;

  const count = deleteTarget.items.length;

  return (
    <div className="modal-overlay" onClick={() => setDeleteTarget(null)}>
      <motion.div
        className="modal-card"
        onClick={e => e.stopPropagation()}
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.2 }}
        style={{ textAlign: 'center' }}
      >
        <div style={{
          width: 48, height: 48, borderRadius: 'var(--radius-full)',
          background: 'rgba(239, 68, 68, 0.12)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px',
        }}>
          <AlertTriangle size={24} color="var(--danger)" />
        </div>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 8 }}>
          Delete {count} item{count > 1 ? 's' : ''}?
        </h3>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 24, lineHeight: 1.5 }}>
          This action cannot be undone. The selected items will be permanently removed.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
          <button className="btn btn-ghost" onClick={() => setDeleteTarget(null)}>Cancel</button>
          <button className="btn btn-danger" onClick={deleteTarget.onConfirm}>Delete</button>
        </div>
      </motion.div>
    </div>
  );
}
