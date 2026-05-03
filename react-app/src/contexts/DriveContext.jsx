import { createContext, useContext, useState, useCallback, useRef, useEffect } from 'react';
import * as s3Service from '../services/s3';
import { useAuth } from './AuthContext';
import { getUserStorageLimit } from '../services/auth';

const DEFAULT_STORAGE_LIMIT = Number(import.meta.env.VITE_STORAGE_LIMIT) || 2147483648; // 2 GB fallback

const DriveContext = createContext(null);

export function DriveProvider({ children }) {
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);
  const [currentPath, setCurrentPath] = useState('');
  const [selectedItems, setSelectedItems] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeSection, setActiveSection] = useState('my-files'); // 'my-files' | 'images' | 'trash'
  const [toasts, setToasts] = useState([]);
  const [storageUsed, setStorageUsed] = useState(0);
  const [dynamicStorageLimit, setDynamicStorageLimit] = useState(DEFAULT_STORAGE_LIMIT);

  const { currentUser } = useAuth();

  useEffect(() => {
    if (currentUser) {
      getUserStorageLimit(currentUser.uid).then(limit => {
        if (limit) {
          setDynamicStorageLimit(limit);
        }
      });
    }
  }, [currentUser]);

  // Upload state
  const [uploadProgress, setUploadProgress] = useState(null); // { fileName, percent }
  // Zip state
  const [zipProgress, setZipProgress] = useState(null); // { percent }
  // Delete modal
  const [deleteTarget, setDeleteTarget] = useState(null); // { items: [...], onConfirm }

  const renderIdRef = useRef(0);

  const showToast = useCallback((message, isError = false) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, isError }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3500);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const refreshStorageUsage = useCallback(async () => {
    try {
      const usage = await s3Service.getStorageUsage();
      setStorageUsed(usage);
    } catch (err) {
      console.error('Failed to fetch storage usage:', err);
    }
  }, []);

  const refreshFiles = useCallback(async () => {
    setIsLoading(true);
    renderIdRef.current++;
    const thisRenderId = renderIdRef.current;

    try {
      if (activeSection === 'images') {
        // List all files recursively and filter images
        const allFiles = await s3Service.listAllFiles('');
        if (thisRenderId !== renderIdRef.current) return;
        const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp', 'bmp'];
        const imageFiles = allFiles.filter(f => {
          const ext = f.name.split('.').pop().toLowerCase();
          return imageExtensions.includes(ext);
        });
        setFolders([]);
        setFiles(imageFiles);
      } else {
        const result = await s3Service.listFiles(currentPath);
        if (thisRenderId !== renderIdRef.current) return;
        setFolders(result.folders);
        setFiles(result.files);
      }
    } catch (err) {
      showToast(`Error loading files: ${err.message}`, true);
    } finally {
      if (thisRenderId === renderIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [currentPath, activeSection, showToast]);

  const navigateTo = useCallback((path) => {
    setCurrentPath(path);
    setSelectedItems([]);
    setActiveSection('my-files');
  }, []);

  const openFolder = useCallback((folderName) => {
    setCurrentPath(prev => prev + folderName + '/');
    setSelectedItems([]);
  }, []);

  const toggleSelection = useCallback((name, isFolder) => {
    setSelectedItems(prev => {
      const exists = prev.findIndex(item => item.name === name && item.isFolder === isFolder);
      if (exists > -1) {
        return prev.filter((_, i) => i !== exists);
      }
      return [...prev, { name, isFolder }];
    });
  }, []);

  const selectAll = useCallback(() => {
    const all = [
      ...folders.map(f => ({ name: f.name, isFolder: true })),
      ...files.map(f => ({ name: f.name, isFolder: false }))
    ];
    setSelectedItems(all);
  }, [folders, files]);

  const deselectAll = useCallback(() => {
    setSelectedItems([]);
  }, []);

  const handleUpload = useCallback(async (fileList) => {
    // Calculate total size of all files to upload
    let totalUploadSize = 0;
    for (const file of fileList) {
      totalUploadSize += file.size;
    }

    // Check against storage limit
    if (storageUsed + totalUploadSize > dynamicStorageLimit) {
      const remaining = dynamicStorageLimit - storageUsed;
      const remainingMB = (remaining / (1024 * 1024)).toFixed(1);
      showToast(`Storage limit exceeded! Only ${remainingMB} MB remaining.`, true);
      return;
    }

    for (const file of fileList) {
      setUploadProgress({ fileName: file.name, percent: 0 });
      try {
        await s3Service.uploadFile(currentPath, file, (percent) => {
          setUploadProgress({ fileName: file.name, percent });
        });
        showToast(`Uploaded ${file.name}`);
      } catch (err) {
        showToast(`Error uploading ${file.name}: ${err.message}`, true);
      }
      setUploadProgress(null);
    }
    refreshFiles();
    refreshStorageUsage();
  }, [currentPath, showToast, refreshFiles, storageUsed, refreshStorageUsage]);

  const handleCreateFolder = useCallback(async (folderName) => {
    try {
      await s3Service.createFolder(currentPath, folderName);
      showToast(`Folder '${folderName}' created`);
      refreshFiles();
    } catch (err) {
      showToast(`Error creating folder: ${err.message}`, true);
    }
  }, [currentPath, showToast, refreshFiles]);

  const handleDelete = useCallback((items) => {
    setDeleteTarget({
      items,
      onConfirm: async () => {
        for (const item of items) {
          try {
            if (item.isFolder) {
              await s3Service.deleteFolder(currentPath, item.name);
            } else {
              await s3Service.deleteSingleFile(currentPath, item.name);
            }
          } catch (err) {
            showToast(`Error deleting ${item.name}: ${err.message}`, true);
          }
        }
        setSelectedItems([]);
        setDeleteTarget(null);
        showToast(`${items.length} item(s) deleted`);
        refreshFiles();
        refreshStorageUsage();
      }
    });
  }, [currentPath, showToast, refreshFiles]);

  const handleDownload = useCallback(async (fileName) => {
    try {
      await s3Service.downloadFile(currentPath, fileName);
    } catch (err) {
      showToast(`Error downloading: ${err.message}`, true);
    }
  }, [currentPath, showToast]);

  const handleView = useCallback(async (fileName) => {
    try {
      await s3Service.viewFile(currentPath, fileName);
    } catch (err) {
      showToast(`Error opening file: ${err.message}`, true);
    }
  }, [currentPath, showToast]);

  const handleDownloadSelected = useCallback(async () => {
    if (selectedItems.length === 0) {
      showToast('No items selected', true);
      return;
    }
    if (selectedItems.length === 1 && !selectedItems[0].isFolder) {
      await handleDownload(selectedItems[0].name);
      return;
    }
    setZipProgress({ percent: 0 });
    try {
      await s3Service.downloadAsZip(currentPath, selectedItems, (percent) => {
        setZipProgress({ percent });
      });
      showToast('ZIP download completed');
    } catch (err) {
      showToast(`Error creating ZIP: ${err.message}`, true);
    }
    setZipProgress(null);
  }, [selectedItems, currentPath, showToast, handleDownload]);

  const getSignedUrl = useCallback((fileName) => {
    return s3Service.getSignedUrl(currentPath, fileName);
  }, [currentPath]);

  const switchSection = useCallback((section) => {
    setActiveSection(section);
    if (section === 'my-files') {
      setCurrentPath('');
    }
    setSelectedItems([]);
  }, []);

  return (
    <DriveContext.Provider value={{
      files, folders, currentPath, selectedItems, isLoading,
      activeSection, toasts, uploadProgress, zipProgress, deleteTarget,
      storageUsed, storageLimit: dynamicStorageLimit,
      refreshFiles, navigateTo, openFolder,
      toggleSelection, selectAll, deselectAll,
      handleUpload, handleCreateFolder, handleDelete,
      handleDownload, handleView, handleDownloadSelected,
      getSignedUrl, showToast, removeToast, setDeleteTarget,
      switchSection, refreshStorageUsage,
    }}>
      {children}
    </DriveContext.Provider>
  );
}

export function useDrive() {
  const context = useContext(DriveContext);
  if (!context) throw new Error('useDrive must be used within a DriveProvider');
  return context;
}
