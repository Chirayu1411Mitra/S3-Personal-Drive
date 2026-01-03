// --- Global Configuration ---
// Added a constant for the bucket name for consistency and easier maintenance.
const BUCKET_NAME = 'chirayu-personal-drive';

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

let s3;
let currentUser = null;
let currentPath = '';
let cognitoIdentityId = null;
let selectedItems = [];

// --- Authentication ---
auth.onAuthStateChanged(user => {
    if (user) {
        currentUser = user;
        document.getElementById('auth-container').classList.add('hidden');
        document.getElementById('app-container').classList.remove('hidden');
        const userInfo = document.getElementById('user-info');
        userInfo.classList.remove('hidden');
        userInfo.classList.add('flex');
        document.getElementById('user-email').textContent = user.email;
        initializeS3();
    } else {
        currentUser = null;
        cognitoIdentityId = null; // Clear the cognito ID on logout
        s3 = null; // Clear the s3 object
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('user-info').classList.add('hidden');
        document.getElementById('file-list').innerHTML = '';
        currentPath = '';
        const btn = document.getElementById('google-signin-btn');
        btn.disabled = false;
        btn.innerHTML = `
            <svg class="w-5 h-5 mr-3" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"></path><path fill="#FF3D00" d="m6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C16.318 4 9.656 8.337 6.306 14.691z"></path><path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.223 0-9.641-3.657-11.283-8.438l-6.522 5.025C9.505 39.556 16.227 44 24 44z"></path><path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l6.19 5.238C42.021 35.826 44 30.551 44 24c0-1.341-.138-2.65-.389-3.917z"></path></svg>
            <span>Sign in with Google</span>
        `;
    }
});
function signInWithGoogle() {
    const provider = new firebase.auth.GoogleAuthProvider();
    const btn = document.getElementById('google-signin-btn');
    const originalContent = btn.innerHTML;

    btn.disabled = true;
    btn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Signing in...</span>
    `;

    auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
        .then(() => {
            return auth.signInWithPopup(provider);
        })
        .catch(error => {
            console.error("Authentication Error:", error);
            showToast(`Error: ${error.message}`, true);
            btn.disabled = false;
            btn.innerHTML = originalContent;
        });
}

function logout() {
    auth.signOut();
}

// --- S3 Initialization ---
function initializeS3() {
    if (!currentUser) {
        console.error("User not logged in, cannot initialize S3.");
        return;
    }

    currentUser.getIdToken(true).then(function (idToken) {
        const identityPoolId = 'us-east-1:f1937ba0-e382-43c4-ae97-36dec2203549';
        const bucketRegion = 'us-east-1';
        const firebaseProjectName = 's3-personal-drive';

        AWS.config.region = bucketRegion;
        AWS.config.credentials = new AWS.CognitoIdentityCredentials({
            IdentityPoolId: identityPoolId,
            Logins: {
                [`securetoken.google.com/${firebaseProjectName}`]: idToken
            }
        });

        AWS.config.credentials.refresh((error) => {
            if (error) {
                console.error("Cognito credentials error:", error);
                showToast("Error setting up S3 credentials.", true);
            } else {
                console.log("Cognito credentials obtained successfully.");
                cognitoIdentityId = AWS.config.credentials.identityId;
                // FIX: Removed the default bucket param. We'll add it to each call instead.
                s3 = new AWS.S3({
                    apiVersion: '2006-03-01'
                });
                listFiles();
            }
        });
    }).catch(function (error) {
        console.error("Firebase ID Token error:", error);
        showToast("Could not get user token for S3 access.", true);
    });
}
// --- S3 & UI Logic ---

function getFullS3Path(key = '') {
    if (!cognitoIdentityId) return '';
    return `${cognitoIdentityId}/${currentPath}${key}`;
}

function showToast(message, isError = false) {
    const toast = document.getElementById('toast');
    const toastMessage = document.getElementById('toast-message');
    toastMessage.textContent = message;
    toast.className = `fixed bottom-5 right-5 text-white px-6 py-3 rounded-lg shadow-lg transition-transform duration-300 ${isError ? 'bg-red-600' : 'bg-green-600'} translate-x-0`;
    setTimeout(() => {
        toast.classList.add('translate-x-full');
    }, 3000);
}

function renderBreadcrumbs() {
    const pathContainer = document.getElementById('folder-path');
    pathContainer.innerHTML = '';
    const parts = currentPath.split('/').filter(p => p);
    const rootLink = document.createElement('a');
    rootLink.href = '#';
    rootLink.textContent = 'My Drive';
    rootLink.className = 'font-semibold text-blue-600 hover:underline';
    rootLink.onclick = (e) => {
        e.preventDefault();
        currentPath = '';
        listFiles();
    };
    pathContainer.appendChild(rootLink);
    let path = '';
    parts.forEach(part => {
        path += part + '/';
        const separator = document.createElement('span');
        separator.textContent = ' / ';
        separator.className = 'mx-1 text-gray-500';
        pathContainer.appendChild(separator);
        const partLink = document.createElement('a');
        partLink.href = '#';
        partLink.textContent = part;
        partLink.className = 'font-semibold text-blue-600 hover:underline';
        const capturedPath = path;
        partLink.onclick = (e) => {
            e.preventDefault();
            currentPath = capturedPath;
            listFiles();
        };
        pathContainer.appendChild(partLink);
    });
}

// Global render ID to prevent race conditions
let lastRenderId = 0;

function listFiles() {
    if (!s3 || !cognitoIdentityId) return;

    // Increment render ID for this new request
    lastRenderId++;
    const currentRenderId = lastRenderId;

    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('file-list').classList.add('hidden');
    renderBreadcrumbs();

    const params = {
        Bucket: BUCKET_NAME,
        Prefix: getFullS3Path(),
        Delimiter: '/'
    };

    s3.listObjectsV2(params, (err, data) => {
        // If a newer request has started, ignore this result
        if (currentRenderId !== lastRenderId) {
            console.log('Ignoring stale listFiles result');
            return;
        }

        document.getElementById('loader').classList.add('hidden');
        document.getElementById('file-list').classList.remove('hidden');
        if (err) {
            console.error("Error listing files:", err);
            showToast(`Error: ${err.message}`, true);
            return;
        }

        const fileList = document.getElementById('file-list');
        fileList.innerHTML = '';

        if (data.CommonPrefixes) {
            data.CommonPrefixes.forEach(prefix => {
                const folderName = prefix.Prefix.replace(getFullS3Path(), '').replace('/', '');
                fileList.innerHTML += createFileItem(folderName, true);
            });
        }
        if (data.Contents) {
            data.Contents.forEach(file => {
                const fileName = file.Key.replace(getFullS3Path(), '');
                if (fileName && !fileName.endsWith('/')) {
                    fileList.innerHTML += createFileItem(fileName, false, file.Size, file.LastModified);
                }
            });
        }

        // --- START: Optimized Lazy Loading Logic with URL Caching ---

        const lazyImages = document.querySelectorAll('.lazy-image');

        // Use global cache if available, or initialize
        if (!window.signedUrlCache) window.signedUrlCache = {};
        const urlCache = window.signedUrlCache;
        const now = Date.now();

        // Pre-generate or retrieve signed URLs
        lazyImages.forEach(img => {
            const fileName = img.dataset.src;
            const cacheKey = getFullS3Path(fileName);

            // Check if we have a valid cached URL (buffer of 5 minutes before actual expiry)
            if (urlCache[cacheKey] && urlCache[cacheKey].expires > now + 300000) {
                // Use cached URL
                // We don't need to do anything here as we'll set it in the observer
            } else {
                // Generate new URL
                const params = {
                    Bucket: BUCKET_NAME,
                    Key: cacheKey,
                    Expires: 3600  // 1 hour
                };
                const url = s3.getSignedUrl('getObject', params);
                urlCache[cacheKey] = {
                    url: url,
                    expires: now + (3600 * 1000) // Store expiration time
                };
            }
        });

        const imageObserver = new IntersectionObserver((entries, observer) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const img = entry.target;
                    const fileName = img.dataset.src;
                    const cacheKey = getFullS3Path(fileName);

                    if (urlCache[cacheKey]) {
                        img.src = urlCache[cacheKey].url;
                    }

                    img.classList.remove('lazy-image');
                    observer.unobserve(img);
                }
            });
        });

        lazyImages.forEach(img => {
            imageObserver.observe(img);
        });
        // --- END: Optimized Lazy Loading Logic for Full Quality Previews ---
    });
}
function createFileItem(name, isFolder, size) {
    const safeName = name.replace(/'/g, "\\'");
    const extension = isFolder ? null : name.split('.').pop().toLowerCase();
    const isImage = ['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(extension);

    // MODIFICATION: Use openImagePreview for images
    const clickAction = isFolder ? `openFolder('${safeName}')` : (isImage ? `openImagePreview('${safeName}')` : `viewFile(event, '${safeName}')`);
    const isSelected = selectedItems.some(item => item.name === name && item.isFolder === isFolder);

    let iconOrPreview;

    if (isImage) {
        // ... (lazy image logic remains the same) ...
        iconOrPreview = `<img class="lazy-image w-16 h-16 object-cover bg-gray-200 rounded-md" data-src="${safeName}" alt="${name}" src="data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==">`;
    } else {
        iconOrPreview = getFileIcon(isFolder, name);
    }

    // ...

    let actions = `
        <button onclick="deleteFile('${safeName}', ${isFolder})" class="p-2 rounded-full bg-white/90 text-red-500 hover:bg-red-50 hover:text-red-600 shadow-sm transition-all duration-200 hover:scale-110" title="Delete">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
        </button>
    `;
    if (!isFolder) {
        // MODIFICATION: Update 'View' button action as well
        const viewAction = isImage ? `openImagePreview('${safeName}')` : `viewFile(event, '${safeName}')`;
        actions = `
            <button onclick="${viewAction}" class="p-2 rounded-full bg-white/90 text-primary-500 hover:bg-primary-50 hover:text-primary-600 shadow-sm transition-all duration-200 hover:scale-110" title="View">
                <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"></path></svg>
            </button>
            <button onclick="downloadFile(event, '${safeName}')" class="p-2 rounded-full bg-white/90 text-blue-500 hover:bg-blue-50 hover:text-blue-600 shadow-sm transition-all duration-200 hover:scale-110" title="Download">
                 <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg>
            </button>
        ` + actions;
    }
    return `
        <div class="file-item group bg-white p-4 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative border border-slate-100 fade-in-up ${isSelected ? 'ring-2 ring-primary-500 bg-primary-50' : ''}" 
             data-name="${safeName}" 
             data-isfolder="${isFolder}" 
             ondblclick="${clickAction}" 
             onclick="if(event.target.type !== 'checkbox') toggleSelection('${safeName}', ${isFolder})">
            
            <div class="absolute top-3 left-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 ${isSelected ? 'opacity-100' : ''}">
                 <input type="checkbox" class="w-5 h-5 text-primary-600 bg-gray-100 border-gray-300 rounded focus:ring-primary-500 transition-all duration-300 cursor-pointer" ${isSelected ? 'checked' : ''} onchange="event.stopPropagation(); toggleSelection('${safeName}', ${isFolder})">
            </div>

            <div class="flex flex-col items-center justify-center space-y-3 py-2 cursor-pointer">
                <div class="transform group-hover:scale-110 transition-transform duration-300 drop-shadow-sm">
                    ${iconOrPreview}
                </div>
                <div class="text-center w-full">
                    <p class="text-sm font-semibold text-slate-700 truncate px-2" title="${name}">${name}</p>
                    ${!isFolder ? `<p class="text-xs text-slate-400 mt-1 font-medium bg-slate-50 inline-block px-2 py-0.5 rounded-full border border-slate-100">${formatBytes(size)}</p>` : '<p class="text-xs text-slate-300 mt-1">-</p>'}
                </div>
            </div>

            <div class="file-actions absolute top-2 right-2 flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-x-2 group-hover:translate-x-0">
                ${actions}
            </div>
        </div>
    `;
}

function loadPreviews(imageFiles) {
    imageFiles.forEach(fileName => {
        const params = {
            Bucket: BUCKET_NAME,
            Key: getFullS3Path(fileName),
            Expires: 60 // URL will be valid for 60 seconds
        };

        // Generate a temporary, secure URL for the image
        s3.getSignedUrl('getObject', params, (err, url) => {
            if (url) {
                // Find the correct image tag by its unique ID and set the source
                const previewId = `preview-${fileName.replace(/[^a-zA-Z0-9]/g, '')}`;
                const imgElement = document.getElementById(previewId);
                if (imgElement) {
                    imgElement.src = url;
                }
            }
        });
    });
}

function toggleSelection(name, isFolder) {
    const index = selectedItems.findIndex(item => item.name === name && item.isFolder === isFolder);
    if (index > -1) {
        selectedItems.splice(index, 1);
    } else {
        selectedItems.push({ name, isFolder });
    }
    // Update UI directly without reloading files
    updateSelectionUI(name, isFolder);
}

function updateSelectionUI(name, isFolder) {
    const fileItems = document.querySelectorAll('.file-item');
    fileItems.forEach(item => {
        const itemName = item.dataset.name;
        const itemIsFolder = item.dataset.isfolder === 'true';
        if (itemName === name && itemIsFolder === isFolder) {
            const checkbox = item.querySelector('input[type="checkbox"]');
            const isSelected = selectedItems.some(sel => sel.name === name && sel.isFolder === isFolder);
            checkbox.checked = isSelected;
            item.classList.toggle('ring-2', isSelected);
            item.classList.toggle('ring-blue-500', isSelected);
        }
    });
}

function selectAll() {
    selectedItems = [];
    const fileList = document.getElementById('file-list');
    const items = fileList.querySelectorAll('.file-item');
    items.forEach(item => {
        const checkbox = item.querySelector('input[type="checkbox"]');
        if (checkbox) {
            checkbox.checked = true;
            const name = item.dataset.name;
            const isFolder = item.dataset.isfolder === 'true';
            selectedItems.push({ name, isFolder });
            // Update UI directly
            item.classList.add('ring-2', 'ring-blue-500');
        }
    });
}

function downloadSelected() {
    if (selectedItems.length === 1 && !selectedItems[0].isFolder) {
        // Single file: download normally
        downloadFile(new Event('click'), selectedItems[0].name);
    } else {
        // Multiple items or any folder: download as ZIP
        downloadAsZip();
    }
}

async function downloadAsZip() {
    if (selectedItems.length === 0) {
        showToast('No items selected for ZIP download.', true);
        return;
    }

    // Show the ZIP progress modal
    const modal = document.getElementById('zip-progress-modal');
    const fileNameSpan = document.getElementById('zip-filename');
    const progressBar = document.getElementById('zip-progress-bar');
    const progressText = document.getElementById('zip-progress-text');

    fileNameSpan.textContent = 'selected-files.zip';
    progressBar.style.width = '0%';
    progressText.textContent = '0%';
    modal.classList.remove('hidden');

    const zip = new JSZip();
    let hasFiles = false;
    let totalItems = selectedItems.length;
    let processedItems = 0;

    for (const item of selectedItems) {
        if (item.isFolder) {
            // Recursively add folder contents
            await addFolderToZip(zip, item.name);
        } else {
            // Add file
            const params = {
                Bucket: BUCKET_NAME,
                Key: getFullS3Path(item.name)
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
        const percent = Math.round((processedItems / totalItems) * 100);
        progressBar.style.width = percent + '%';
        progressText.textContent = percent + '%';
    }

    if (!hasFiles) {
        modal.classList.add('hidden');
        showToast('No files to download.', true);
        return;
    }

    // Update progress to 100% before generating ZIP
    progressBar.style.width = '100%';
    progressText.textContent = '100%';

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(zipBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'selected-files.zip';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    // Hide the modal after download
    modal.classList.add('hidden');
    showToast('ZIP download completed.');
}

async function addFolderToZip(zip, folderName) {
    const prefix = getFullS3Path(folderName + '/');
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
function openFolder(folderName) {
    currentPath += folderName + '/';
    listFiles();
}

function createFolder() {
    const folderName = prompt("Enter folder name:");
    if (folderName && folderName.trim()) {
        const params = {
            Bucket: BUCKET_NAME, // <-- FIX: Explicitly add Bucket name
            Key: getFullS3Path(folderName + '/')
        };
        s3.putObject(params, (err, data) => {
            if (err) showToast(`Error creating folder: ${err.message}`, true);
            else {
                showToast(`Folder '${folderName}' created successfully.`);
                listFiles();
            }
        });
    }
}

function uploadFile() {
    const files = document.getElementById('upload-input').files;
    if (files.length === 0) return;

    // Get references to our new modal elements
    const modal = document.getElementById('upload-progress-modal');
    const fileNameSpan = document.getElementById('upload-filename');
    const progressBar = document.getElementById('upload-progress-bar');
    const progressText = document.getElementById('upload-progress-text');

    Array.from(files).forEach(async file => {
        // --- Show and reset the modal for each file ---
        fileNameSpan.textContent = file.name;
        progressBar.style.width = '0%';
        progressText.textContent = '0%';
        modal.classList.remove('hidden');

        const extension = file.name.split('.').pop().toLowerCase();
        const isImage = ['jpg', 'jpeg', 'png', 'gif'].includes(extension);

        // Upload the original file
        const params = {
            Bucket: BUCKET_NAME,
            Key: getFullS3Path(file.name),
            Body: file,
            ContentType: file.type
        };

        const upload = new AWS.S3.ManagedUpload({ s3: s3, params: params });

        // --- Update the progress bar inside the modal ---
        upload.on('httpUploadProgress', evt => {
            const percent = parseInt((evt.loaded * 100) / evt.total);
            progressBar.style.width = percent + '%';
            progressText.textContent = percent + '%';
        });

        try {
            await upload.promise();

            // If it's an image, generate and upload a thumbnail
            if (isImage) {
                const thumbnailBlob = await generateThumbnail(file);
                const thumbName = file.name.replace(/\.[^/.]+$/, "-thumb.$&");
                const thumbParams = {
                    Bucket: BUCKET_NAME,
                    Key: getFullS3Path(thumbName),
                    Body: thumbnailBlob,
                    ContentType: file.type
                };
                await s3.upload(thumbParams).promise();
            }

            // --- On success: hide the modal and show a success toast ---
            modal.classList.add('hidden');
            showToast(`Successfully uploaded ${file.name}.`);
            listFiles();
        } catch (err) {
            // --- On error: hide the modal and show an error toast ---
            modal.classList.add('hidden');
            showToast(`Error uploading ${file.name}: ${err.message}`, true);
        }
    });

    // Clear the input so the user can upload the same file again if needed
    document.getElementById('upload-input').value = '';
}

// Function to generate a thumbnail using canvas
async function generateThumbnail(file) {
    return new Promise((resolve) => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();

        img.onload = () => {
            // Set thumbnail size to 200x200, maintaining aspect ratio
            const maxSize = 200;
            let { width, height } = img;

            if (width > height) {
                if (width > maxSize) {
                    height = (height * maxSize) / width;
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width = (width * maxSize) / height;
                    height = maxSize;
                }
            }

            canvas.width = width;
            canvas.height = height;

            ctx.drawImage(img, 0, 0, width, height);

            canvas.toBlob(resolve, file.type, 0.8); // 80% quality for smaller size
        };

        img.src = URL.createObjectURL(file);
    });
}
function downloadFile(event, fileName) {
    event.preventDefault();
    const params = {
        Bucket: BUCKET_NAME, // <-- FIX: Explicitly add Bucket name
        Key: getFullS3Path(fileName),
        Expires: 300,
        ResponseContentDisposition: `attachment; filename="${fileName}"`
    };
    s3.getSignedUrl('getObject', params, (err, url) => {
        if (err) {
            showToast(`Could not get download link: ${err.message}`, true);
            return;
        }
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });
}

function viewFile(event, fileName) {
    event.preventDefault();
    const params = {
        Bucket: BUCKET_NAME, // <-- FIX: Explicitly add Bucket name
        Key: getFullS3Path(fileName),
        Expires: 60
    };
    s3.getSignedUrl('getObject', params, (err, url) => {
        if (err) {
            showToast(`Could not get view link: ${err.message}`, true);
        } else {
            window.open(url, '_blank');
        }
    });
}

function deleteFile(name, isFolder) {
    const modal = document.getElementById('delete-modal');
    modal.classList.remove('hidden');
    const confirmBtn = document.getElementById('confirm-delete-btn');
    const cancelBtn = document.getElementById('cancel-delete-btn');
    const cleanup = () => {
        confirmBtn.removeEventListener('click', confirmHandler);
        cancelBtn.removeEventListener('click', cancelHandler);
    };
    const confirmHandler = () => {
        modal.classList.add('hidden');
        if (isFolder) deleteFolder(name);
        else deleteSingleObject(name);
        cleanup();
    };
    const cancelHandler = () => {
        modal.classList.add('hidden');
        cleanup();
    };
    confirmBtn.addEventListener('click', confirmHandler);
    cancelBtn.addEventListener('click', cancelHandler);
}

function deleteSingleObject(fileName) {
    const params = {
        Bucket: BUCKET_NAME, // <-- FIX: Explicitly add Bucket name
        Key: getFullS3Path(fileName)
    };
    s3.deleteObject(params, (err, data) => {
        if (err) showToast(`Error deleting file: ${err.message}`, true);
        else {
            showToast(`File '${fileName}' deleted successfully.`);
            listFiles();
        }
    });
}

// UPGRADE: Replaced with a more robust async function.
// This handles folders with more than 1,000 items and ensures the folder marker is also deleted.
async function deleteFolder(folderName) {
    const prefix = getFullS3Path(folderName + '/');
    let continuationToken;

    do {
        try {
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

        } catch (err) {
            showToast(`Error deleting folder contents: ${err.message}`, true);
            return;
        }
    } while (continuationToken);

    try {
        await s3.deleteObject({ Bucket: BUCKET_NAME, Key: prefix }).promise();
        showToast(`Folder '${folderName}' deleted successfully.`);
        listFiles();
    } catch (err) {
        showToast(`Error finalizing folder deletion: ${err.message}`, true);
    }
}

function getFileIcon(isFolder, fileName = '') {
    if (isFolder) return `<svg class="w-16 h-16 text-yellow-500" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h5l2 2h5a2 2 0 012 2v6a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path></svg>`;
    const extension = fileName.split('.').pop().toLowerCase();
    switch (extension) {
        case 'jpg': case 'jpeg': case 'png': case 'gif': case 'svg':
            return `<svg class="w-16 h-16 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>`;
        case 'pdf': return `<svg class="w-16 h-16 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 21h7a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v11m0 5l4.879-4.879m0 0a3 3 0 104.242 0 3 3 0 00-4.242 0z"></path></svg>`;
        case 'doc': case 'docx': return `<svg class="w-16 h-16 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>`;
        default: return `<svg class="w-16 h-16 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>`;
    }
}
function formatBytes(bytes, decimals = 2) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

// --- Image Preview Modal Logic ---

function openImagePreview(fileName) {
    const modal = document.getElementById('image-preview-modal');
    const previewImage = document.getElementById('preview-image');
    const loader = document.getElementById('preview-loader');
    const filenameLabel = document.getElementById('preview-filename');
    const downloadBtn = document.getElementById('preview-download-btn');

    // Reset state
    previewImage.src = '';
    previewImage.classList.add('hidden');
    loader.classList.remove('hidden');
    filenameLabel.textContent = fileName;

    // Setup Download Button
    downloadBtn.onclick = (e) => {
        e.stopPropagation();
        downloadFile(new Event('click'), fileName);
    };

    // Show modal
    modal.classList.remove('hidden');
    // Small delay to allow transition
    setTimeout(() => {
        modal.classList.remove('opacity-0');
    }, 10);

    // Fetch URL (check cache first)
    const cacheKey = getFullS3Path(fileName);
    const now = Date.now();
    let url = '';

    if (window.signedUrlCache && window.signedUrlCache[cacheKey] && window.signedUrlCache[cacheKey].expires > now + 60000) {
        url = window.signedUrlCache[cacheKey].url;
        setImageSource(url);
    } else {
        const params = {
            Bucket: BUCKET_NAME,
            Key: cacheKey,
            Expires: 3600
        };
        // Get new signed URL
        url = s3.getSignedUrl('getObject', params);
        // Cache it
        if (!window.signedUrlCache) window.signedUrlCache = {};
        window.signedUrlCache[cacheKey] = {
            url: url,
            expires: now + (3600 * 1000)
        };
        setImageSource(url);
    }

    function setImageSource(src) {
        const img = new Image();
        img.onload = () => {
            previewImage.src = src;
            loader.classList.add('hidden');
            previewImage.classList.remove('hidden');
        };
        img.onerror = () => {
            loader.classList.add('hidden');
            showToast('Failed to load image preview', true);
        };
        img.src = src;
    }
}

function closeImagePreview() {
    const modal = document.getElementById('image-preview-modal');
    modal.classList.add('opacity-0');
    setTimeout(() => {
        modal.classList.add('hidden');
        document.getElementById('preview-image').src = '';
    }, 300);
}

// Close on Escape key
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const modal = document.getElementById('image-preview-modal');
        if (!modal.classList.contains('hidden')) {
            closeImagePreview();
        }
    }
});