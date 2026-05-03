import { saveIdentityIdToFirestore } from './auth';
import JSZip from 'jszip';

const awsConfig = {
  bucketName: import.meta.env.VITE_AWS_BUCKET_NAME,
  region: import.meta.env.VITE_AWS_REGION,
  identityPoolId: import.meta.env.VITE_AWS_IDENTITY_POOL_ID,
  firebaseProjectName: import.meta.env.VITE_FIREBASE_PROJECT_NAME,
};

const AWS = window.AWS;
const BUCKET_NAME = awsConfig.bucketName;

let s3 = null;
let cognitoIdentityId = null;
let signedUrlCache = {};

export function getS3() { return s3; }
export function getCognitoId() { return cognitoIdentityId; }

export function initializeS3(currentUser) {
  return new Promise((resolve, reject) => {
    if (!currentUser) {
      reject(new Error("User not logged in"));
      return;
    }

    currentUser.getIdToken(true).then(idToken => {
      AWS.config.region = awsConfig.region;
      AWS.config.credentials = null;
      AWS.config.credentials = new AWS.CognitoIdentityCredentials({
        IdentityPoolId: awsConfig.identityPoolId,
        Logins: {
          [`securetoken.google.com/${awsConfig.firebaseProjectName}`]: idToken
        }
      });

      AWS.config.credentials.refresh(error => {
        if (error) {
          console.error("Cognito credentials error:", error);
          reject(error);
        } else {
          cognitoIdentityId = AWS.config.credentials.identityId;
          saveIdentityIdToFirestore(currentUser.uid, cognitoIdentityId, currentUser.email)
            .catch(err => console.warn("Failed to save identity:", err));
          s3 = new AWS.S3({ apiVersion: '2006-03-01' });
          resolve(s3);
        }
      });
    }).catch(reject);
  });
}

export function resetS3() {
  s3 = null;
  cognitoIdentityId = null;
  signedUrlCache = {};
}

function getFullS3Path(currentPath, key = '') {
  if (!cognitoIdentityId) return '';
  return `${cognitoIdentityId}/${currentPath}${key}`;
}

export async function listFiles(currentPath = '') {
  if (!s3 || !cognitoIdentityId) return { folders: [], files: [] };

  const params = {
    Bucket: BUCKET_NAME,
    Prefix: getFullS3Path(currentPath),
    Delimiter: '/'
  };

  return new Promise((resolve, reject) => {
    s3.listObjectsV2(params, (err, data) => {
      if (err) { reject(err); return; }

      const folders = [];
      const files = [];
      const thumbnailMap = new Map();

      // Build thumbnail map
      if (data.Contents) {
        data.Contents.forEach(file => {
          const fileName = file.Key.replace(getFullS3Path(currentPath), '');
          if (/-thumb\.\.?[a-zA-Z0-9]+$/.test(fileName)) {
            let original = fileName.replace(/-thumb(\.[^.]+)$/, "$1");
            original = original.replace(/-thumb(\.\.[^.]+)$/, (match, ext) => ext.substring(1));
            thumbnailMap.set(original, fileName);
          }
        });
      }

      if (data.CommonPrefixes) {
        data.CommonPrefixes.forEach(prefix => {
          const folderName = prefix.Prefix.replace(getFullS3Path(currentPath), '').replace('/', '');
          folders.push({ name: folderName, isFolder: true });
        });
      }

      if (data.Contents) {
        data.Contents.forEach(file => {
          const fileName = file.Key.replace(getFullS3Path(currentPath), '');
          const isThumbnail = /-thumb\.\.?[a-zA-Z0-9]+$/.test(fileName);
          if (fileName && !fileName.endsWith('/') && !isThumbnail) {
            const previewPath = thumbnailMap.get(fileName) || fileName;
            files.push({
              name: fileName,
              isFolder: false,
              size: file.Size,
              lastModified: file.LastModified,
              previewPath
            });
          }
        });
      }

      resolve({ folders, files });
    });
  });
}

export function getSignedUrl(currentPath, fileName, expiresIn = 3600) {
  const cacheKey = getFullS3Path(currentPath, fileName);
  const now = Date.now();

  if (signedUrlCache[cacheKey] && signedUrlCache[cacheKey].expires > now + 300000) {
    return signedUrlCache[cacheKey].url;
  }

  const params = {
    Bucket: BUCKET_NAME,
    Key: cacheKey,
    Expires: expiresIn
  };
  const url = s3.getSignedUrl('getObject', params);
  signedUrlCache[cacheKey] = { url, expires: now + (expiresIn * 1000) };
  return url;
}

export function uploadFile(currentPath, file, onProgress) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: getFullS3Path(currentPath, file.name),
    Body: file,
    ContentType: file.type
  };

  const upload = new AWS.S3.ManagedUpload({ s3, params });
  upload.on('httpUploadProgress', evt => {
    const percent = parseInt((evt.loaded * 100) / evt.total);
    if (onProgress) onProgress(percent);
  });

  return upload.promise().then(async () => {
    const extension = file.name.split('.').pop().toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(extension);
    if (isImage) {
      const thumbnailBlob = await generateThumbnail(file);
      const thumbName = file.name.replace(/\.[^/.]+$/, "-thumb$&");
      const thumbParams = {
        Bucket: BUCKET_NAME,
        Key: getFullS3Path(currentPath, thumbName),
        Body: thumbnailBlob,
        ContentType: file.type
      };
      await s3.upload(thumbParams).promise();
    }
  });
}

async function generateThumbnail(file) {
  return new Promise(resolve => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      const maxSize = 200;
      let { width, height } = img;
      if (width > height) {
        if (width > maxSize) { height = (height * maxSize) / width; width = maxSize; }
      } else {
        if (height > maxSize) { width = (width * maxSize) / height; height = maxSize; }
      }
      canvas.width = width;
      canvas.height = height;
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(resolve, file.type, 0.8);
    };
    img.src = URL.createObjectURL(file);
  });
}

export function downloadFile(currentPath, fileName) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: getFullS3Path(currentPath, fileName),
    Expires: 300,
    ResponseContentDisposition: `attachment; filename="${fileName}"`
  };
  return new Promise((resolve, reject) => {
    s3.getSignedUrl('getObject', params, (err, url) => {
      if (err) { reject(err); return; }
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      resolve();
    });
  });
}

export function viewFile(currentPath, fileName) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: getFullS3Path(currentPath, fileName),
    Expires: 60
  };
  return new Promise((resolve, reject) => {
    s3.getSignedUrl('getObject', params, (err, url) => {
      if (err) { reject(err); return; }
      window.open(url, '_blank');
      resolve();
    });
  });
}

export function createFolder(currentPath, folderName) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: getFullS3Path(currentPath, folderName + '/')
  };
  return new Promise((resolve, reject) => {
    s3.putObject(params, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function deleteSingleFile(currentPath, fileName) {
  const params = {
    Bucket: BUCKET_NAME,
    Key: getFullS3Path(currentPath, fileName)
  };

  await s3.deleteObject(params).promise();

  // Also delete thumbnails
  const extension = fileName.split('.').pop().toLowerCase();
  const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(extension);
  if (isImage) {
    const thumbCorrect = fileName.replace(/\.[^/.]+$/, "-thumb$&");
    const thumbBugged = fileName.replace(/\.[^/.]+$/, "-thumb.$&");
    for (const thumbKey of [thumbCorrect, thumbBugged]) {
      try {
        await s3.deleteObject({ Bucket: BUCKET_NAME, Key: getFullS3Path(currentPath, thumbKey) }).promise();
      } catch (e) { /* ignore */ }
    }
  }
}

export async function deleteFolder(currentPath, folderName) {
  const prefix = getFullS3Path(currentPath, folderName + '/');
  let continuationToken;

  do {
    const listParams = {
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken
    };
    const listedObjects = await s3.listObjectsV2(listParams).promise();

    if (listedObjects.Contents.length === 0) break;

    const deleteParams = {
      Bucket: BUCKET_NAME,
      Delete: { Objects: listedObjects.Contents.map(({ Key }) => ({ Key })) }
    };
    await s3.deleteObjects(deleteParams).promise();

    if (!listedObjects.IsTruncated) break;
    continuationToken = listedObjects.NextContinuationToken;
  } while (continuationToken);

  await s3.deleteObject({ Bucket: BUCKET_NAME, Key: prefix }).promise();
}

export async function downloadAsZip(currentPath, selectedItems, onProgress) {
  const zip = new JSZip();
  let hasFiles = false;
  const totalItems = selectedItems.length;
  let processedItems = 0;

  for (const item of selectedItems) {
    if (item.isFolder) {
      await addFolderToZip(zip, currentPath, item.name);
      hasFiles = true;
    } else {
      const params = {
        Bucket: BUCKET_NAME,
        Key: getFullS3Path(currentPath, item.name)
      };
      try {
        const data = await s3.getObject(params).promise();
        zip.file(item.name, data.Body);
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

async function addFolderToZip(zip, currentPath, folderName) {
  const prefix = getFullS3Path(currentPath, folderName + '/');
  let continuationToken;

  do {
    const listParams = {
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken
    };
    const listedObjects = await s3.listObjectsV2(listParams).promise();

    for (const obj of listedObjects.Contents) {
      const relativePath = obj.Key.replace(prefix, '');
      if (relativePath) {
        const data = await s3.getObject({ Bucket: BUCKET_NAME, Key: obj.Key }).promise();
        zip.file(`${folderName}/${relativePath}`, data.Body);
      }
    }

    continuationToken = listedObjects.IsTruncated ? listedObjects.NextContinuationToken : null;
  } while (continuationToken);
}

// List ALL files recursively (for Images/Trash sections)
export async function listAllFiles(currentPath = '') {
  if (!s3 || !cognitoIdentityId) return [];

  const prefix = getFullS3Path(currentPath);
  let allFiles = [];
  let continuationToken;

  do {
    const params = {
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken
    };
    const data = await s3.listObjectsV2(params).promise();

    if (data.Contents) {
      data.Contents.forEach(file => {
        const fileName = file.Key.replace(prefix, '');
        const isThumbnail = /-thumb\.\.?[a-zA-Z0-9]+$/.test(fileName);
        if (fileName && !fileName.endsWith('/') && !isThumbnail) {
          allFiles.push({
            name: fileName,
            fullKey: file.Key,
            isFolder: false,
            size: file.Size,
            lastModified: file.LastModified,
          });
        }
      });
    }

    continuationToken = data.IsTruncated ? data.NextContinuationToken : null;
  } while (continuationToken);

  return allFiles;
}

// Calculate total storage usage (in bytes) for the current user
export async function getStorageUsage() {
  if (!s3 || !cognitoIdentityId) return 0;

  const prefix = `${cognitoIdentityId}/`;
  let totalBytes = 0;
  let continuationToken;

  do {
    const params = {
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      ContinuationToken: continuationToken
    };
    const data = await s3.listObjectsV2(params).promise();

    if (data.Contents) {
      data.Contents.forEach(obj => {
        totalBytes += obj.Size || 0;
      });
    }

    continuationToken = data.IsTruncated ? data.NextContinuationToken : null;
  } while (continuationToken);

  return totalBytes;
}
