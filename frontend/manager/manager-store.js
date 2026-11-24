import { backendURL } from '../backend-config.js';
import { firebaseConfig, APP_CHECK_SITE_KEY } from '../firebase-config.js';
import { encodeImage, prepareHdUploadFile } from '../image-data.js';

const MAX_FREEIMAGE_BYTES = 20 * 1024 * 1024;
let sdkPromise = null;
let sdk = null;

export async function managerFirebase() {
  if (!sdkPromise) {
    sdkPromise = Promise.all([
      import('https://www.gstatic.com/firebasejs/12.3.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.3.0/firebase-auth.js')
    ]).then(async ([appAPI, authAPI]) => {
      const app = appAPI.getApps().length ? appAPI.getApp() : appAPI.initializeApp(firebaseConfig);
      const auth = authAPI.getAuth(app);
      if (authAPI.browserLocalPersistence && typeof authAPI.setPersistence === 'function') {
        await authAPI.setPersistence(auth, authAPI.browserLocalPersistence).catch(() => {});
      }
      sdk = { app, auth, a: authAPI };
      return sdk;
    }).catch(err => {
      sdkPromise = null;
      throw err;
    });
  }
  return sdkPromise;
}

export function isGoogleSession(user) {
  if (!user || user.isAnonymous) return false;
  return (user.providerData || []).some(p => p?.providerId === 'google.com');
}

export async function observeGoogleAuth(callback) {
  const { a, auth } = await managerFirebase();
  try {
    await a.getRedirectResult(auth);
  } catch {}
  return a.onAuthStateChanged(auth, user => {
    callback(isGoogleSession(user) ? user : null, user);
  });
}

export async function signInWithGoogle({ redirect = false } = {}) {
  const { a, auth } = sdk || await managerFirebase();
  const provider = new a.GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  if (redirect) {
    return a.signInWithRedirect(auth, provider);
  }
  const startedAt = Date.now();
  try {
    return await a.signInWithPopup(auth, provider);
  } catch (error) {
    const blocked = error?.code === 'auth/popup-blocked'
      || error?.code === 'auth/operation-not-supported-in-this-environment'
      || error?.code === 'auth/cancelled-popup-request'
      || (error?.code === 'auth/popup-closed-by-user' && Date.now() - startedAt < 1800);
    if (blocked) return a.signInWithRedirect(auth, provider);
    throw error;
  }
}

export async function signOutManager() {
  const { a, auth } = sdk || await managerFirebase();
  await a.signOut(auth);
}

async function buildAuthHeaders(contentType, forceRefresh = false) {
  const { auth, app } = sdk || await managerFirebase();
  await auth.authStateReady();
  const current = auth.currentUser;
  if (!isGoogleSession(current)) {
    throw new Error('Sign in with a verified Google account to continue.');
  }
  const token = await current.getIdToken(forceRefresh);
  const headers = {
    'Content-Type': contentType,
    'X-Firebase-Project': firebaseConfig.projectId,
    Authorization: `Bearer ${token}`
  };
  if (APP_CHECK_SITE_KEY) {
    const check = await import('https://www.gstatic.com/firebasejs/12.3.0/firebase-app-check.js');
    let instance;
    try {
      instance = check.getAppCheck(app);
    } catch {
      instance = check.initializeAppCheck(app, {
        provider: new check.ReCaptchaEnterpriseProvider(APP_CHECK_SITE_KEY),
        isTokenAutoRefreshEnabled: true
      });
    }
    headers['X-Firebase-AppCheck'] = (await check.getToken(instance)).token;
  }
  return headers;
}

export async function callManager(action, data = {}) {
  const url = `${backendURL()}/api/${encodeURIComponent(action)}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const headers = await buildAuthHeaders('application/json', attempt === 1);
    let response;
    try {
      response = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify(data),
        signal: AbortSignal.timeout(45000)
      });
    } catch {
      throw new Error('Could not reach the studio service. Check your connection and try again.');
    }
    const result = await response.json().catch(() => ({}));
    if (response.status === 401 && attempt === 0) continue;
    if (!response.ok) {
      const err = new Error(result?.error?.message || 'Request failed.');
      err.code = result?.error?.code;
      err.status = response.status;
      throw err;
    }
    return result.data;
  }
}

export async function uploadManagerImage(file) {
  if (!file || !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || !file.size || file.size > MAX_FREEIMAGE_BYTES) {
    throw new Error('Choose a JPG, PNG, or WebP photo under 20 MB.');
  }
  const url = `${backendURL()}/api/managerUploadImage`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const headers = await buildAuthHeaders(file.type, attempt === 1);
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: file,
      signal: AbortSignal.timeout(120000)
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401 && attempt === 0) continue;
    if (!response.ok) {
      const err = new Error(result?.error?.message || 'Freeimage.host upload failed.');
      err.code = result?.error?.code;
      throw err;
    }
    return result?.data?.url || '';
  }
}

/**
 * Dual-storage upload:
 * 1. Uploads full-resolution original image to Freeimage.host (https://iili.io/...)
 * 2. Generates a bounded Firebase Base64 backup copy for automatic redundancy fallback.
 * If Freeimage.host is unreachable or FREEIMAGE_API_KEY is missing, falls back to Base64 automatically.
 */
export async function uploadArtworkFiles(fileList, onProgress = () => {}) {
  const files = [...(fileList || [])].slice(0, 4);
  if (!files.length) return { images: [], backupImages: [], hostedCount: 0, fallbackUsed: false };
  onProgress(`Preparing & uploading ${files.length} photo${files.length === 1 ? '' : 's'} (HD + Firebase backup)…`);
  let hostedCount = 0;
  let fallbackUsed = false;
  const results = await Promise.all(files.map(async rawFile => {
    const hdFile = await prepareHdUploadFile(rawFile);
    const [base64Backup, primaryUrl] = await Promise.all([
      encodeImage(hdFile),
      uploadManagerImage(hdFile).catch(() => {
        fallbackUsed = true;
        return '';
      })
    ]);
    if (primaryUrl) hostedCount += 1;
    return { primary: primaryUrl || base64Backup, backup: base64Backup };
  }));
  onProgress('');
  return {
    images: results.map(r => r.primary),
    backupImages: results.map(r => r.backup),
    hostedCount,
    fallbackUsed
  };
}

export const compressArtworkFiles = uploadArtworkFiles;
