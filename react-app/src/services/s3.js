import JSZip from 'jszip';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Helper to get Firebase token
const getAuthHeaders = () => {
  const user = window.firebase?.auth().currentUser;
  if (!user) throw new Error("Not logged in");
  return user.getIdToken(false).then(token => ({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  }));
};

export async function listFiles(currentPath = '') {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/s3/list?path=${encodeURIComponent(currentPath)}`, { headers });
  if (!res.ok) throw new Error('Failed to list files');
  return res.json();
}

export async function listAllFiles(currentPath = '') {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/s3/list-all?path=${encodeURIComponent(currentPath)}`, { headers });
  if (!res.ok) throw new Error('Failed to list all files');
  const data = await res.json();
  return data.files;
}

export async function getStorageUsage() {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/s3/storage-usage`, { headers });
  if (!res.ok) throw new Error('Failed to get storage usage');
  const data = await res.json();
  return data.totalBytes;
}

export async function getSignedUrl(currentPath, fileName, expiresIn = 3600) {
  // We can just ask backend for a view URL
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/s3/presigned-url`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'view', path: currentPath, fileName })
  });
  if (!res.ok) throw new Error('Failed to get signed URL');
  const data = await res.json();
  return data.url;
}

export async function uploadFile(currentPath, file, onProgress) {
  const headers = await getAuthHeaders();
  
  // 1. Get presigned URL
  const res = await fetch(`${API_URL}/s3/presigned-url`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'upload', path: currentPath, fileName: file.name, contentType: file.type })
  });
  if (!res.ok) {
    const errData = await res.json();
    throw new Error(errData.error || 'Failed to get upload URL');
  }
  const { url } = await res.json();

  // 2. Upload directly to S3 using XMLHttpRequest for progress
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url, true);
    xhr.setRequestHeader('Content-Type', file.type);
    
    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable && onProgress) {
        const percent = Math.round((evt.loaded / evt.total) * 100);
        onProgress(percent);
      }
    };
    
    xhr.onload = async () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        // After success, if it's an image, create and upload thumbnail
        const extension = file.name.split('.').pop().toLowerCase();
        const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(extension);
        if (isImage) {
          try {
            await uploadImageVariants(currentPath, file, headers);
          } catch (e) {
             console.error("Variant upload failed:", e);
          }
        }
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    };
    
    xhr.onerror = () => reject(new Error('Network error during upload'));
    xhr.send(file);
  });
}

async function uploadImageVariants(currentPath, originalFile, headers) {
  // 1. Generate and upload thumbnail (200px, keep original format)
  const thumbnailBlob = await generateImageVariant(originalFile, 200, 0.8, originalFile.type);
  const thumbName = originalFile.name.replace(/\.[^/.]+$/, "-thumb$&");
  
  // 2. Generate and upload preview (1920px, highly compressed WebP)
  const previewBlob = await generateImageVariant(originalFile, 1920, 0.8, 'image/webp');
  const previewName = originalFile.name.replace(/\.[^/.]+$/, "-preview.webp");
  
  // Upload both concurrently
  await Promise.all([
    uploadBlobToS3(currentPath, thumbName, thumbnailBlob, originalFile.type, headers),
    uploadBlobToS3(currentPath, previewName, previewBlob, 'image/webp', headers)
  ]);
}

async function uploadBlobToS3(currentPath, fileName, blob, contentType, headers) {
  const res = await fetch(`${API_URL}/s3/presigned-url`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'upload', path: currentPath, fileName, contentType })
  });
  if (!res.ok) throw new Error(`Failed to get upload URL for ${fileName}`);
  const { url } = await res.json();
  
  await fetch(url, {
    method: 'PUT',
    headers: { 'Content-Type': contentType },
    body: blob
  });
}

async function generateImageVariant(file, maxSize, quality = 0.8, type = 'image/webp') {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > height) {
        if (width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
      } else {
        if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
      }
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(resolve, type, quality);
    };
    img.src = URL.createObjectURL(file);
  });
}

export async function downloadFile(currentPath, fileName) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/s3/presigned-url`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'download', path: currentPath, fileName })
  });
  if (!res.ok) throw new Error('Failed to get download URL');
  const { url } = await res.json();
  
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export async function viewFile(currentPath, fileName) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/s3/presigned-url`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ action: 'view', path: currentPath, fileName })
  });
  if (!res.ok) throw new Error('Failed to get view URL');
  const { url } = await res.json();
  window.open(url, '_blank');
}

export async function createFolder(currentPath, folderName) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/s3/folder`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ path: currentPath, folderName })
  });
  if (!res.ok) throw new Error('Failed to create folder');
}

export async function deleteSingleFile(currentPath, fileName) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/s3/delete-file`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ path: currentPath, fileName })
  });
  if (!res.ok) throw new Error('Failed to delete file');
}

export async function deleteFolder(currentPath, folderName) {
  const headers = await getAuthHeaders();
  const res = await fetch(`${API_URL}/s3/delete-folder`, {
    method: 'DELETE',
    headers,
    body: JSON.stringify({ path: currentPath, folderName })
  });
  if (!res.ok) throw new Error('Failed to delete folder');
}

export async function downloadAsZip(currentPath, selectedItems, onProgress) {
  const zip = new JSZip();
  let hasFiles = false;
  const totalItems = selectedItems.length;
  let processedItems = 0;
  
  const headers = await getAuthHeaders();

  for (const item of selectedItems) {
    if (item.isFolder) {
      await addFolderToZip(zip, currentPath, item.name, headers);
      hasFiles = true;
    } else {
      try {
        const res = await fetch(`${API_URL}/s3/presigned-url`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ action: 'download', path: currentPath, fileName: item.name })
        });
        const { url } = await res.json();
        
        const fileRes = await fetch(url);
        const blob = await fileRes.blob();
        zip.file(item.name, blob);
        hasFiles = true;
      } catch (err) {
        console.error(`Error fetching ${item.name}:`, err);
      }
    }
    processedItems++;
    if (onProgress) onProgress(Math.round((processedItems / totalItems) * 100));
  }

  if (!hasFiles) throw new Error('No files to download');

  const zipBlob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(zipBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'selected-files.zip';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

async function addFolderToZip(zip, currentPath, folderName, headers) {
  // To avoid rewriting entire backend logic to return a zip, we list files then fetch them one by one.
  const path = currentPath ? `${currentPath}${folderName}/` : `${folderName}/`;
  const res = await fetch(`${API_URL}/s3/list-all?path=${encodeURIComponent(path)}`, { headers });
  if (!res.ok) return;
  const data = await res.json();
  
  for (const file of data.files) {
    try {
      const urlRes = await fetch(`${API_URL}/s3/presigned-url`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ action: 'download', path: '', fileName: file.fullKey.split('/').slice(1).join('/') }) 
      });
      const { url } = await urlRes.json();
      
      const fileRes = await fetch(url);
      const blob = await fileRes.blob();
      zip.file(`${folderName}/${file.name}`, blob);
    } catch (e) {
      console.error(e);
    }
  }
}
