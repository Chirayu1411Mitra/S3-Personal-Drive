import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { X, Download } from 'lucide-react';
import { useDrive } from '../contexts/DriveContext';

export default function ImagePreview({ item, onClose }) {
  const { getSignedUrl, handleDownload } = useDrive();
  const fileName = item.name;
  // Use displayPath (web-optimized preview) if available, else fall back to original
  const previewFile = item.displayPath || item.name;
  const [loaded, setLoaded] = useState(false);
  const [url, setUrl] = useState(null);
  const [hasError, setHasError] = useState(false);
  const [retried, setRetried] = useState(false);

  useEffect(() => {
    let ignore = false;
    getSignedUrl(previewFile, retried)
      .then(signedUrl => {
        if (!ignore) {
          setUrl(signedUrl);
          setHasError(false);
        }
      })
      .catch(err => console.error("Failed to load image:", err));
    return () => { ignore = true; };
  }, [previewFile, getSignedUrl, retried]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <motion.div
      className="image-preview-overlay"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="image-preview-toolbar">
        <h3 style={{ color: '#fff', fontSize: '0.9375rem', fontWeight: 500, opacity: 0.9 }}>{fileName}</h3>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-sm btn-ghost" style={{ color: '#fff', borderColor: 'rgba(255,255,255,0.15)' }}
            onClick={() => handleDownload(fileName)}>
            <Download size={16} /> Download
          </button>
          <button onClick={onClose} style={{
            background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: 'var(--radius-full)',
            width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
            cursor: 'pointer', color: '#fff',
          }}>
            <X size={20} />
          </button>
        </div>
      </div>
      <div className="image-preview-body" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
        {!loaded && !hasError && <div className="spinner" style={{ width: 40, height: 40, position: 'absolute' }} />}
        {url && !hasError && (
          <motion.img
            src={url}
            alt={fileName}
            onLoad={() => setLoaded(true)}
            onError={() => {
              if (!retried) {
                console.log("Image load failed, retrying with fresh URL to bypass cache...");
                setRetried(true);
              } else {
                setHasError(true);
              }
            }}
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: loaded ? 1 : 0.9, opacity: loaded ? 1 : 0 }}
            transition={{ duration: 0.3 }}
          />
        )}
        {hasError && (
          <div style={{ color: 'white', textAlign: 'center', background: 'rgba(0,0,0,0.5)', padding: '16px 24px', borderRadius: '8px' }}>
            <p style={{ margin: '0 0 8px 0', fontWeight: 'bold' }}>Image is corrupted or cannot be loaded.</p>
            <p style={{ margin: 0, fontSize: '0.875rem', opacity: 0.8 }}>Try downloading it directly to verify the original file.</p>
          </div>
        )}
      </div>
    </motion.div>
  );
}
