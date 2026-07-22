import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Download, Trash2, X, LayoutGrid, List } from 'lucide-react';
import { useDrive } from '../contexts/DriveContext';

export default function Toolbar({ fileInputRef }) {
  const {
    currentPath, navigateTo, selectedItems, deselectAll,
    handleDownloadSelected, handleDelete, activeSection,
    viewMode, setViewMode,
  } = useDrive();

  const pathParts = currentPath.split('/').filter(Boolean);

  return (
    <div>
      <div className="toolbar">
        {/* Breadcrumb */}
        <div className="breadcrumb">
          {activeSection === 'images' ? (
            <span className="breadcrumb-item current">All Images</span>
          ) : (
            <>
              <button className={`breadcrumb-item ${pathParts.length === 0 ? 'current' : ''}`}
                onClick={() => navigateTo('')}>
                My Drive
              </button>
              {pathParts.map((part, i) => {
                const path = pathParts.slice(0, i + 1).join('/') + '/';
                const isLast = i === pathParts.length - 1;
                return (
                  <span key={path} style={{ display: 'flex', alignItems: 'center' }}>
                    <ChevronRight size={14} className="breadcrumb-sep" />
                    <button className={`breadcrumb-item ${isLast ? 'current' : ''}`}
                      onClick={() => !isLast && navigateTo(path)}>
                      {part}
                    </button>
                  </span>
                );
              })}
            </>
          )}
        </div>
        
        {/* View Mode Toggle */}
        <div style={{ display: 'flex', gap: 4, background: 'var(--bg-tertiary)', padding: 4, borderRadius: 'var(--radius-md)' }}>
          <button 
            className={`btn-icon ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => setViewMode('list')}
            title="List View"
          >
            <List size={18} />
          </button>
          <button 
            className={`btn-icon ${viewMode === 'gallery' ? 'active' : ''}`}
            onClick={() => setViewMode('gallery')}
            title="Gallery View"
          >
            <LayoutGrid size={18} />
          </button>
        </div>
      </div>

      {/* Selection Bar */}
      <AnimatePresence>
        {selectedItems.length > 0 && (
          <motion.div
            className="selection-bar"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--accent)' }}>
                {selectedItems.length} selected
              </span>
              <button className="btn btn-sm btn-ghost" onClick={deselectAll}>
                <X size={14} /> Clear
              </button>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-sm btn-primary" onClick={handleDownloadSelected}>
                <Download size={14} /> Download
              </button>
              <button className="btn btn-sm btn-danger" onClick={() => handleDelete(selectedItems)}>
                <Trash2 size={14} /> Delete
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
