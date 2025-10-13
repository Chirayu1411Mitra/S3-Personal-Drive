firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

let s3;
let currentUser = null;
let currentPath = '';

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
        listFiles();
    } else {
        currentUser = null;
        document.getElementById('auth-container').classList.remove('hidden');
        document.getElementById('app-container').classList.add('hidden');
        document.getElementById('user-info').classList.add('hidden');
        document.getElementById('file-list').innerHTML = '';
        currentPath = '';
         // Restore sign-in button state when user logs out
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

    // Update button to show loading state
    btn.disabled = true;
    btn.innerHTML = `
        <svg class="animate-spin -ml-1 mr-3 h-5 w-5 text-gray-700" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>Signing in...</span>
    `;

    auth.signInWithPopup(provider)
        .catch(error => {
            console.error("Google Sign-In Error:", error);
            showToast(`Error: ${error.message}`, true);
            // Restore button on error
            btn.disabled = false;
            btn.innerHTML = originalContent;
        });
}

function logout() {
    auth.signOut();
}

// --- S3 Initialization ---
function initializeS3() {
    if (awsConfig && !awsConfig.bucketName.startsWith('YOUR_')) {
        AWS.config.update({
            region: awsConfig.region,
            credentials: new AWS.Credentials(awsConfig.accessKeyId, awsConfig.secretAccessKey),
        });
        s3 = new AWS.S3({
            apiVersion: '2006-03-01',
            params: { Bucket: awsConfig.bucketName }
        });
    } else {
        showToast("Configuration not loaded. Please check config.js.", true);
    }
}

// --- S3 & UI Logic (unchanged) ---
function getFullS3Path(key = '') {
    if (!currentUser) return '';
    return `${currentUser.uid}/${currentPath}${key}`;
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

function listFiles() {
    if (!s3 || !currentUser) return;
    document.getElementById('loader').classList.remove('hidden');
    document.getElementById('file-list').classList.add('hidden');
    renderBreadcrumbs();
    const params = {
        Bucket: awsConfig.bucketName,
        Prefix: getFullS3Path(),
        Delimiter: '/'
    };
    s3.listObjectsV2(params, (err, data) => {
        document.getElementById('loader').classList.add('hidden');
        document.getElementById('file-list').classList.remove('hidden');
        if (err) {
            console.error("Error listing files:", err);
            showToast(`Error: ${err.message}`, true);
            return;
        }
        const fileList = document.getElementById('file-list');
        fileList.innerHTML = '';
        const userPrefix = `${currentUser.uid}/`;
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
    });
}

function createFileItem(name, isFolder, size) {
    const safeName = name.replace(/'/g, "\\'");
    const clickAction = isFolder ? `openFolder('${safeName}')` : `downloadFile('${safeName}')`;
    const downloadAction = !isFolder ? `<a href="#" onclick="downloadFile('${safeName}')" class="text-blue-500 hover:text-blue-700" title="Download"><svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path></svg></a>` : '';
    return `
        <div class="file-item bg-white p-3 rounded-lg shadow-sm text-center cursor-pointer transition-shadow hover:shadow-md relative" ondblclick="${clickAction}">
            <div class="flex justify-center items-center h-20">
                ${getFileIcon(isFolder, name)}
            </div>
            <p class="text-sm font-medium text-gray-700 truncate mt-2" title="${name}">${name}</p>
            ${!isFolder ? `<p class="text-xs text-gray-500">${formatBytes(size)}</p>` : '<p class="text-xs text-gray-500">-</p>'}
            <div class="file-actions absolute top-2 right-2 flex space-x-2 opacity-0 transition-opacity">
                 ${downloadAction}
                 <button onclick="deleteFile('${safeName}', ${isFolder})" class="text-red-500 hover:text-red-700" title="Delete">
                    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
            </div>
        </div>
    `;
}

function openFolder(folderName) {
    currentPath += folderName + '/';
    listFiles();
}

function createFolder() {
    const folderName = prompt("Enter folder name:");
    if (folderName && folderName.trim()) {
        const params = {
            Bucket: awsConfig.bucketName,
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
    Array.from(files).forEach(file => {
        const params = {
            Bucket: awsConfig.bucketName,
            Key: getFullS3Path(file.name),
            Body: file,
            ContentType: file.type
        };
        const upload = new AWS.S3.ManagedUpload({ params });
        upload.on('httpUploadProgress', evt => showToast(`Uploading ${file.name}: ${parseInt((evt.loaded * 100) / evt.total)}%`));
        upload.promise().then(
            data => {
                showToast(`Successfully uploaded ${file.name}.`);
                listFiles();
            },
            err => showToast(`Error uploading ${file.name}: ${err.message}`, true)
        );
    });
    document.getElementById('upload-input').value = ''; 
}

function downloadFile(fileName) {
    const params = {
        Bucket: awsConfig.bucketName,
        Key: getFullS3Path(fileName),
        Expires: 60 
    };
    s3.getSignedUrl('getObject', params, (err, url) => {
        if (err) showToast(`Could not get download link: ${err.message}`, true);
        else {
            const a = document.createElement('a');
            a.href = url;
            a.download = fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
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

function deleteSingleObject(fileName){
     const params = { Bucket: awsConfig.bucketName, Key: getFullS3Path(fileName) };
    s3.deleteObject(params, (err, data) => {
        if (err) showToast(`Error deleting file: ${err.message}`, true);
        else {
            showToast(`File '${fileName}' deleted successfully.`);
            listFiles();
        }
    });
}

function deleteFolder(folderName) {
    const prefix = getFullS3Path(folderName + '/');
    s3.listObjectsV2({ Bucket: awsConfig.bucketName, Prefix: prefix }, (err, data) => {
        if (err) return showToast(`Error listing folder contents: ${err.message}`, true);
        if (data.Contents.length === 0) {
            deleteSingleObject(folderName + '/');
            return;
        }
        const objectsToDelete = data.Contents.map(item => ({ Key: item.Key }));
        s3.deleteObjects({ Bucket: awsConfig.bucketName, Delete: { Objects: objectsToDelete } }, (err, data) => {
            if (err) showToast(`Error deleting folder contents: ${err.message}`, true);
            else {
                showToast(`Folder '${folderName}' deleted successfully.`);
                listFiles();
            }
        });
    });
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
