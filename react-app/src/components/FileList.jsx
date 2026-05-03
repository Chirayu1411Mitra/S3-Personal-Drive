import { motion } from 'framer-motion';
import { FolderOpen } from 'lucide-react';
import { useDrive } from '../contexts/DriveContext';
import FileItem from './FileItem';
import SkeletonLoader from './SkeletonLoader';

export default function FileList({ onPreviewImage }) {
  const { folders, files, isLoading, selectedItems, selectAll, deselectAll } = useDrive();

  const allItems = [...folders, ...files];
  const allSelected = allItems.length > 0 && selectedItems.length === allItems.length;

  if (isLoading) return <SkeletonLoader />;

  if (allItems.length === 0) {
    return (
      <div className="file-list-container">
        <div className="empty-state">
          <FolderOpen size={56} strokeWidth={1} />
          <h3>No files here</h3>
          <p>Upload files or create a folder to get started.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="file-list-container" style={{ paddingTop: 8 }}>
      <table className="file-table">
        <thead>
          <tr>
            <th style={{ width: 44 }}>
              <input
                type="checkbox"
                className="checkbox"
                checked={allSelected}
                onChange={() => allSelected ? deselectAll() : selectAll()}
              />
            </th>
            <th>Name</th>
            <th className="col-date" style={{ width: 160 }}>Modified</th>
            <th className="col-size" style={{ width: 120 }}>Size</th>
            <th style={{ width: 44 }}></th>
          </tr>
        </thead>
        <tbody>
          {allItems.map((item, i) => (
            <FileItem
              key={item.name + (item.isFolder ? '-folder' : '')}
              item={item}
              index={i}
              onPreviewImage={onPreviewImage}
            />
          ))}
        </tbody>
      </table>
      <div style={{
        padding: '12px 16px', fontSize: '0.75rem',
        color: 'var(--text-muted)', borderTop: '1px solid var(--border)',
      }}>
        {folders.length} folder{folders.length !== 1 ? 's' : ''}, {files.length} file{files.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}
