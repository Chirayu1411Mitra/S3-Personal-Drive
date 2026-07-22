import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import AWS from 'aws-sdk';
import { initializeApp, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Initialize Firebase Admin
// Expects FIREBASE_SERVICE_ACCOUNT_KEY in environment as a stringified JSON object
try {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    initializeApp({
      credential: cert(serviceAccount)
    });
  } else {
    // Fallback or warning if missing, useful for local dev if they provide a local key file
    console.warn("⚠️ FIREBASE_SERVICE_ACCOUNT_KEY not found in environment. Authentication verification may fail.");
    initializeApp(); // Will attempt to use application default credentials
  }
} catch (error) {
  console.error("Failed to initialize Firebase Admin:", error);
}
const db = getFirestore();

// Initialize AWS S3
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});
const s3 = new AWS.S3({ apiVersion: '2006-03-01' });
const BUCKET_NAME = process.env.AWS_BUCKET_NAME;

// Middleware to verify Firebase Auth Token
const requireAuth = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    req.user = decodedToken;

    try {
      const userDoc = await db.collection("users").doc(decodedToken.uid).get();
      if (userDoc.exists) {
        req.user.s3_folder_id = userDoc.data().s3_folder_id;
      }
    } catch (dbErr) {
      console.error('Error fetching user from Firestore:', dbErr);
    }

    next();
  } catch (error) {
    console.error('Error verifying Firebase token:', error);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};

app.use('/api/s3', requireAuth);

const getFullS3Path = (user, currentPath, key = '') => {
  const rootFolder = user.s3_folder_id || user.uid;
  return `${rootFolder}/${currentPath || ''}${key}`;
};

// 1. List files and folders
app.get('/api/s3/list', async (req, res) => {
  try {
    const { path: currentPath = '' } = req.query;
    const prefix = getFullS3Path(req.user, currentPath);

    const params = {
      Bucket: BUCKET_NAME,
      Prefix: prefix,
      Delimiter: '/'
    };

    const data = await s3.listObjectsV2(params).promise();
    const contents = data.Contents || [];
    const folders = [];
    const files = [];
    const thumbnailMap = new Map();
    const previewMap = new Map();
    const variantNames = new Set(); // all -thumb and -preview filenames to exclude from listing

    // First pass: collect all variant files
    contents.forEach(file => {
      const fileName = file.Key.replace(prefix, '');
      if (/-thumb\.\.?[a-zA-Z0-9]+$/.test(fileName) || fileName.endsWith('-preview.webp')) {
        variantNames.add(fileName);
        if (fileName.endsWith('-preview.webp')) {
          // e.g. "photo-preview.webp" -> baseName = "photo"
          const baseName = fileName.replace(/-preview\.webp$/, '');
          previewMap.set(baseName, fileName);
        }
        if (/-thumb\.\.?[a-zA-Z0-9]+$/.test(fileName)) {
          let original = fileName.replace(/-thumb(\.[^.]+)$/, "$1");
          original = original.replace(/-thumb(\.\.[^.]+)$/, (match, ext) => ext.substring(1));
          thumbnailMap.set(original, fileName);
        }
      }
    });

    if (data.CommonPrefixes) {
      data.CommonPrefixes.forEach(p => {
        const folderName = p.Prefix.replace(prefix, '').replace('/', '');
        folders.push({ name: folderName, isFolder: true });
      });
    }

    // Second pass: build file list, excluding all variants
    contents.forEach(file => {
      const fileName = file.Key.replace(prefix, '');
      if (!fileName || fileName.endsWith('/')) return;
      // Skip thumbnails and preview files
      if (fileName.endsWith('-preview.webp')) return;
      if (/-thumb\./.test(fileName)) return;

      const previewPath = thumbnailMap.get(fileName) || (file.Size < 500 * 1024 ? fileName : null);
      const fileBaseName = fileName.replace(/\.[^/.]+$/, '');
      const displayPath = previewMap.get(fileBaseName) || null;

      files.push({
        name: fileName,
        isFolder: false,
        size: file.Size,
        lastModified: file.LastModified,
        previewPath,
        displayPath
      });
    });

    res.set('Cache-Control', 'no-store');
    res.json({ folders, files });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list objects' });
  }
});

// 2. List all files recursively
app.get('/api/s3/list-all', async (req, res) => {
  try {
    const { path: currentPath = '' } = req.query;
    const prefix = getFullS3Path(req.user, currentPath);
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
          const isPreview = fileName.endsWith('-preview.webp');
          if (fileName && !fileName.endsWith('/') && !isThumbnail && !isPreview) {
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

    res.json({ files: allFiles });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to list all objects' });
  }
});

// 3. Get storage usage
app.get('/api/s3/storage-usage', async (req, res) => {
  try {
    const rootFolder = req.user.s3_folder_id || req.user.uid;
    const prefix = `${rootFolder}/`;
    let totalBytes = 0;
    let continuationToken;

    do {
      const params = { Bucket: BUCKET_NAME, Prefix: prefix, ContinuationToken: continuationToken };
      const data = await s3.listObjectsV2(params).promise();
      if (data.Contents) {
        data.Contents.forEach(obj => { totalBytes += obj.Size || 0; });
      }
      continuationToken = data.IsTruncated ? data.NextContinuationToken : null;
    } while (continuationToken);

    res.json({ totalBytes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to calculate storage' });
  }
});

// 4. Generate Presigned URL
app.post('/api/s3/presigned-url', async (req, res) => {
  try {
    const { action, path = '', fileName, contentType } = req.body;
    if (!action || !fileName) return res.status(400).json({ error: 'Missing action or fileName' });

    const key = getFullS3Path(req.user, path, fileName);
    let params = { Bucket: BUCKET_NAME, Key: key };
    let operation = '';

    if (action === 'upload') {
      operation = 'putObject';
      params.ContentType = contentType;
      params.Expires = 300; // 5 mins
      
      // OPTIONAL: Enforce Quota on upload
      // Here we could fetch the custom_storage_limit from Firestore for the user 
      // and block the presigned URL generation if they are over limit.
    } else if (action === 'download') {
      operation = 'getObject';
      params.Expires = 300;
      params.ResponseContentDisposition = `attachment; filename="${fileName}"`;
    } else if (action === 'view') {
      operation = 'getObject';
      params.Expires = 3600; // 1 hour
    } else {
      return res.status(400).json({ error: 'Invalid action' });
    }

    const url = await s3.getSignedUrlPromise(operation, params);
    res.json({ url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate URL' });
  }
});

// 5. Create folder
app.post('/api/s3/folder', async (req, res) => {
  try {
    const { path = '', folderName } = req.body;
    if (!folderName) return res.status(400).json({ error: 'Missing folderName' });
    
    const params = {
      Bucket: BUCKET_NAME,
      Key: getFullS3Path(req.user, path, folderName + '/')
    };
    await s3.putObject(params).promise();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create folder' });
  }
});

// 6. Delete file
app.delete('/api/s3/delete-file', async (req, res) => {
  try {
    const { path = '', fileName } = req.body;
    if (!fileName) return res.status(400).json({ error: 'Missing fileName' });
    
    await s3.deleteObject({ Bucket: BUCKET_NAME, Key: getFullS3Path(req.user, path, fileName) }).promise();
    
    // Also try to delete thumbnail and preview variants
    const extension = fileName.split('.').pop().toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(extension);
    if (isImage) {
      const thumbCorrect = fileName.replace(/\.[^/.]+$/, "-thumb$&");
      const thumbBugged = fileName.replace(/\.[^/.]+$/, "-thumb.$&");
      const previewName = fileName.replace(/\.[^/.]+$/, "-preview.webp");
      for (const variantKey of [thumbCorrect, thumbBugged, previewName]) {
        try {
          await s3.deleteObject({ Bucket: BUCKET_NAME, Key: getFullS3Path(req.user, path, variantKey) }).promise();
        } catch (e) { /* ignore */ }
      }
    }
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete file' });
  }
});

// 7. Delete folder
app.delete('/api/s3/delete-folder', async (req, res) => {
  try {
    const { path = '', folderName } = req.body;
    if (!folderName) return res.status(400).json({ error: 'Missing folderName' });
    
    const prefix = getFullS3Path(req.user, path, folderName + '/');
    let continuationToken;

    do {
      const listParams = { Bucket: BUCKET_NAME, Prefix: prefix, ContinuationToken: continuationToken };
      const listedObjects = await s3.listObjectsV2(listParams).promise();

      if (listedObjects.Contents.length === 0) break;

      const deleteParams = {
        Bucket: BUCKET_NAME,
        Delete: { Objects: listedObjects.Contents.map(({ Key }) => ({ Key })) }
      };
      await s3.deleteObjects(deleteParams).promise();

      continuationToken = listedObjects.IsTruncated ? listedObjects.NextContinuationToken : null;
    } while (continuationToken);

    await s3.deleteObject({ Bucket: BUCKET_NAME, Key: prefix }).promise();
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete folder' });
  }
});

const PORT = process.env.PORT || 3001;

// Only listen locally (Vercel sets the VERCEL environment variable)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
  });
}

// Export the Express API so Vercel can use it
export default app;
