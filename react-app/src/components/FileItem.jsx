import { useState, useRef, useEffect, memo } from 'react';
import { motion } from 'framer-motion';
import { Folder, FileText, Image, FileType, MoreVertical, Download, Trash2, Eye, File } from 'lucide-react';
import { useDrive } from '../contexts/DriveContext';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'];

function getExtension(name) {
  return name.split('.').pop().toLowerCase();
}

function FileIcon({ item }) {
  if (item.isFolder) return <div className="file-icon folder"><Folder size={20} /></div>;
  const ext = getExtension(item.name);
  if (IMAGE_EXTENSIONS.includes(ext)) return <div className="file-icon image"><Image size={20} /></div>;
  if (ext === 'pdf') return <div className="file-icon pdf"><FileText size={20} /></div>;
  if (['doc', 'docx'].includes(ext)) return <div className="file-icon doc"><FileType size={20} /></div>;
  return <div className="file-icon default"><File size={20} /></div>;
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
        const url = getSignedUrl(item.previewPath || item.name);
        setSrc(url);
        observer.disconnect();
      }
    });
    if (imgRef.current) observer.observe(imgRef.current);
    return () => observer.disconnect();
  }, [item, getSignedUrl]);

  return (
    <img
      ref={imgRef}
      className="file-thumbnail"
      src={src || 'data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw=='}
      alt={item.name}
      loading="lazy"
    />
  );
}

const FileItem = memo(function FileItem({ item, index, onPreviewImage }) {
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

  const handleRowClick = (e) => {
    // Ignore clicks on checkbox or menu button
    if (e.target.type === 'checkbox' || e.target.closest('button') || e.target.closest('.context-menu')) return;
    if (item.isFolder) openFolder(item.name);
    else if (isImage) onPreviewImage(item.name);
    else handleView(item.name);
  };

  return (
    <motion.tr
      className={`file-row ${isSelected ? 'selected' : ''}`}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.03, 0.5), duration: 0.25 }}
      onClick={handleRowClick}
    >
      <td>
        <input
          type="checkbox"
          className="checkbox"
          checked={isSelected}
          onChange={(e) => { e.stopPropagation(); toggleSelection(item.name, item.isFolder); }}
        />
      </td>
      <td>
        <div className="file-name">
          {isImage ? <FileThumbnail item={item} getSignedUrl={getSignedUrl} /> : <FileIcon item={item} />}
          <span title={item.name}>{item.name}</span>
        </div>
      </td>
      <td className="col-date" style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
        {formatDate(item.lastModified)}
      </td>
      <td className="col-size" style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
        {item.isFolder ? '—' : formatBytes(item.size)}
      </td>
      <td style={{ position: 'relative' }}>
        <button
          onClick={(e) => { e.stopPropagation(); setMenuOpen(!menuOpen); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            padding: 6, borderRadius: 'var(--radius-sm)', color: 'var(--text-muted)',
            opacity: 0.5, transition: 'opacity var(--transition)',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = 1}
          onMouseLeave={e => { if (!menuOpen) e.currentTarget.style.opacity = 0.5; }}
        >
          <MoreVertical size={16} />
        </button>

        {menuOpen && (
          <div className="context-menu" ref={menuRef} style={{ top: '100%', right: 0 }}>
            {!item.isFolder && (
              <>
                <button onClick={() => { handleDownload(item.name); setMenuOpen(false); }}>
                  <Download size={14} /> Download
                </button>
                {isImage && (
                  <button onClick={() => { onPreviewImage(item.name); setMenuOpen(false); }}>
                    <Eye size={14} /> Preview
                  </button>
                )}
                <button onClick={() => { handleView(item.name); setMenuOpen(false); }}>
                  <Eye size={14} /> Open in Tab
                </button>
              </>
            )}
            <button className="danger" onClick={() => { handleDelete([item]); setMenuOpen(false); }}>
              <Trash2 size={14} /> Delete
            </button>
          </div>
        )}
      </td>
    </motion.tr>
  );
});

export default FileItem;
