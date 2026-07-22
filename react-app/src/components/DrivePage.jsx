import { useEffect, useRef, useState, useCallback } from 'react';
import Sidebar from './Sidebar';
import Toolbar from './Toolbar';
import FileList from './FileList';
import Toast from './Toast';
import ImagePreview from './ImagePreview';
import DeleteModal from './modals/DeleteModal';
import UploadModal from './modals/UploadModal';
import ZipModal from './modals/ZipModal';
import { useDrive } from '../contexts/DriveContext';
import { Upload } from 'lucide-react';

export default function DrivePage() {
  const { refreshFiles, handleUpload, uploadProgress, zipProgress, deleteTarget, refreshStorageUsage } = useDrive();
  const [imagePreview, setImagePreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const dragCounter = useRef(0);

  useEffect(() => {
    refreshFiles();
    refreshStorageUsage();
  }, [refreshFiles, refreshStorageUsage]);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e) => { e.preventDefault(); }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) {
      handleUpload(Array.from(e.dataTransfer.files));
    }
  }, [handleUpload]);

  return (
    <div
      className="app-layout"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      <Sidebar fileInputRef={fileInputRef} />

      <div className="main-content">
        <Toolbar fileInputRef={fileInputRef} />
        <FileList onPreviewImage={setImagePreview} />
      </div>

      <input
        type="file"
        ref={fileInputRef}
        style={{ display: 'none' }}
        multiple
        onChange={(e) => {
          if (e.target.files.length > 0) {
            handleUpload(Array.from(e.target.files));
            e.target.value = '';
          }
        }}
      />

      {isDragging && (
        <div className="drop-overlay">
          <div style={{ textAlign: 'center', color: 'var(--accent)' }}>
            <Upload size={48} style={{ marginBottom: 12 }} />
            <p style={{ fontSize: '1.125rem', fontWeight: 600 }}>Drop files here to upload</p>
          </div>
        </div>
      )}

      {imagePreview && (
        <ImagePreview item={imagePreview} onClose={() => setImagePreview(null)} />
      )}

      {uploadProgress && <UploadModal {...uploadProgress} />}
      {zipProgress && <ZipModal {...zipProgress} />}
      {deleteTarget && <DeleteModal />}

      <Toast />
    </div>
  );
}
