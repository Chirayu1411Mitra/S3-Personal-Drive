import { useState, useRef, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import { Folder, FileText, Image, FileType, MoreVertical, Download, Trash2, Eye, File } from 'lucide-react';
import { useDrive } from '../contexts/DriveContext';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'];

function getExtension(name) {
  return name.split('.').pop().toLowerCase();
}

function FileIcon({ item }) {
  if (item.isFolder) return <div className="file-icon folder"><Folder size={32} /></div>;
  const ext = getExtension(item.name);
  if (IMAGE_EXTENSIONS.includes(ext)) return <div className="file-icon image"><Image size={32} /></div>;
  if (ext === 'pdf') return <div className="file-icon pdf"><FileText size={32} /></div>;
  if (['doc', 'docx'].includes(ext)) return <div className="file-icon doc"><FileType size={32} /></div>;
  return <div className="file-icon default"><File size={32} /></div>;
}

function formatBytes(bytes) {
  if (!bytes || bytes === 0) return '—';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function formatDate(dateString) {
  if (!dateString) return '—';
  const d = new Date(dateString);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function FileThumbnail({ item, getSignedUrl }) {
  const [src, setSrc] = useState(null);
  const imgRef = useRef(null);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        getSignedUrl(item.previewPath || item.name)
          .then(url => setSrc(url))
          .catch(err => console.error("Thumbnail load error:", err));
        observer.disconnect();
      }
    });
    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [item, getSignedUrl]);

  return (
    <img
      ref={imgRef}
      src={src || 'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=='}
      alt={item.name}
      loading="lazy"
    />
  );
}

const FileGridItem = memo(function FileGridItem({ item, index, onPreviewImage }) {
  const { toggleSelection, selectedItems, openFolder, handleDownload, handleView, handleDelete, getSignedUrl } = useDrive();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const isSelected = selectedItems.some(s => s.name === item.name && s.isFolder === item.isFolder);
  const ext = item.isFolder ? null : getExtension(item.name);
  const isImage = ext && IMAGE_EXTENSIONS.includes(ext);

  useEffect(() => {
    function handleClick(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    }
    if (menuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [menuOpen]);

  const handleCardClick = (e) => {
    if (e.target.type === 'checkbox' || e.target.closest('button') || e.target.closest('.context-menu')) return;
    if (item.isFolder) openFolder(item.name);
    else if (isImage) onPreviewImage(item);
    else handleView(item.name);
  };

  return (
    <motion.div
      className={`file-card ${isSelected ? 'selected' : ''}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: Math.min(index * 0.02, 0.3), duration: 0.2 }}
      onClick={handleCardClick}
    >
      <div className="file-card-actions">
        <input
          type="checkbox"
          className="checkbox"
          checked={isSelected}
          onChange={(e) => { e.stopPropagation(); toggleSelection(item.name, item.isFolder); }}
          style={{ cursor: 'pointer' }}
        />
        <div style={{ position: 'relative' }}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
            title="More actions"
          >
            <MoreVertical size={16} />
          </button>
          {menuOpen && (
            <div className="context-menu" ref={menuRef} style={{ top: '100%', right: 0, marginTop: 4 }}>
              {!item.isFolder && (
                <>
                  <button onClick={(e) => { e.stopPropagation(); handleDownload(item.name); setMenuOpen(false); }}>
                    <Download size={14} /> Download
                  </button>
                  {isImage && (
                    <button onClick={(e) => { e.stopPropagation(); onPreviewImage(item); setMenuOpen(false); }}>
                      <Eye size={14} /> Preview
                    </button>
                  )}
                  <button onClick={(e) => { e.stopPropagation(); handleView(item.name); setMenuOpen(false); }}>
                    <Eye size={14} /> Open in Tab
                  </button>
                </>
              )}
              <button className="danger" onClick={(e) => { e.stopPropagation(); handleDelete([item]); setMenuOpen(false); }}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="file-card-preview">
        {isImage && item.previewPath ? <FileThumbnail item={item} getSignedUrl={getSignedUrl} /> : <FileIcon item={item} />}
      </div>

      <div className="file-card-info">
        <div className="file-card-name" title={item.name}>{item.name}</div>
        <div className="file-card-meta">
          <span>{formatDate(item.lastModified)}</span>
          <span>{item.isFolder ? 'Folder' : formatBytes(item.size)}</span>
        </div>
      </div>
    </motion.div>
  );
});

export default FileGridItem;
