import { backendURL } from '../backend-config.js';
import { firebaseConfig, APP_CHECK_SITE_KEY } from '../firebase-config.js';
import { encodeImage } from '../image-data.js';

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

export async function callManager(action, data = {}) {
  const { auth, app } = sdk || await managerFirebase();
  await auth.authStateReady();
  const current = auth.currentUser;
  if (!isGoogleSession(current)) {
    throw new Error('Sign in with a verified Google account to continue.');
  }
  const url = `${backendURL()}/api/${encodeURIComponent(action)}`;
  for (let attempt = 0; attempt < 2; attempt++) {
    const token = await current.getIdToken(attempt === 1);
    const headers = {
      'Content-Type': 'application/json',
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
      throw err;
    }
    return result.data;
  }
}

export async function compressArtworkFiles(fileList) {
  const files = [...(fileList || [])].slice(0, 4);
  const out = [];
  for (const file of files) {
    out.push(await encodeImage(file));
  }
  return out;
}
