'use client';
import { getConfig } from './api';

// Firebase is loaded lazily and configured from the admin-editable settings served by the API.
type FB = typeof import('firebase/auth');
let ready: Promise<{ auth: import('firebase/auth').Auth; fb: FB }> | null = null;

function init() {
  if (!ready) {
    ready = (async () => {
      const [cfg, app, fb] = await Promise.all([getConfig(), import('firebase/app'), import('firebase/auth')]);
      const a = app.getApps().length ? app.getApp() : app.initializeApp(cfg.firebase);
      return { auth: fb.getAuth(a), fb };
    })().catch((e) => { ready = null; throw e; });
  }
  return ready;
}

if (typeof window !== 'undefined') {
  void init().catch(() => {});
}

export type AuthState = { email: string; verified: boolean } | null;

export type IncognitoSession = { isIncognito: boolean; alias: string };

export function getIncognitoSession(): IncognitoSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem('lumen_incognito');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setIncognitoSession(alias: string): IncognitoSession {
  const session: IncognitoSession = { isIncognito: true, alias: alias.trim() || 'Drifting Stranger' };
  try {
    sessionStorage.setItem('lumen_incognito', JSON.stringify(session));
  } catch { /* ignore */ }
  return session;
}

export function clearIncognitoSession() {
  try {
    sessionStorage.removeItem('lumen_incognito');
  } catch { /* ignore */ }
}

export async function onAuth(cb: (s: AuthState) => void) {
  const { auth, fb } = await init();
  return fb.onAuthStateChanged(auth, (u) => cb(u ? { email: u.email || '', verified: u.emailVerified } : null));
}
export async function getToken(force = false): Promise<string | null> {
  const { auth, fb } = await init();
  if (auth.currentUser) {
    try {
      return await auth.currentUser.getIdToken(force);
    } catch {
      return null;
    }
  }

  // If Firebase Auth is still restoring session from IndexedDB/localStorage, wait for it
  if (typeof (auth as any).authStateReady === 'function') {
    try {
      await (auth as any).authStateReady();
      const current = (auth as any).currentUser;
      if (current) {
        return await current.getIdToken(force);
      }
    } catch {}
  }

  // Fallback: wait up to 4s for initial onAuthStateChanged resolution
  return new Promise<string | null>((resolve) => {
    let unsub = () => {};
    const timer = setTimeout(() => {
      unsub();
      resolve(null);
    }, 4000);

    unsub = fb.onAuthStateChanged(auth, async (u) => {
      clearTimeout(timer);
      unsub();
      if (u) {
        try {
          resolve(await u.getIdToken(force));
        } catch {
          resolve(null);
        }
      } else {
        resolve(null);
      }
    });
  });
}
export async function getCurrentUser() {
  const { auth } = await init();
  return auth.currentUser ? { email: auth.currentUser.email || '', uid: auth.currentUser.uid } : null;
}
export function getActionCodeSettings(path = '/auth/action') {
  const origin = typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : 'http://localhost:3000';
  return {
    url: `${origin}${path}`,
    handleCodeInApp: true,
  };
}

export async function signUp(email: string, password: string) {
  const { auth, fb } = await init();
  const c = await fb.createUserWithEmailAndPassword(auth, email, password);
  try {
    await fb.sendEmailVerification(c.user, getActionCodeSettings('/auth/action'));
  } catch {
    await fb.sendEmailVerification(c.user);
  }
}
export async function signIn(email: string, password: string) {
  const { auth, fb } = await init();
  await fb.signInWithEmailAndPassword(auth, email, password);
}
export async function signInGoogle() {
  const { auth, fb } = await init();
  await fb.signInWithPopup(auth, new fb.GoogleAuthProvider());
}
export async function resendVerification() {
  const { auth, fb } = await init();
  if (auth.currentUser) {
    try {
      await fb.sendEmailVerification(auth.currentUser, getActionCodeSettings('/auth/action'));
    } catch {
      await fb.sendEmailVerification(auth.currentUser);
    }
  }
}
export async function refreshUser() {
  const { auth } = await init();
  if (!auth.currentUser) return null;
  await auth.currentUser.reload();
  await auth.currentUser.getIdToken(true); // new token carries email_verified = true
  return { email: auth.currentUser.email || '', verified: auth.currentUser.emailVerified };
}
export async function resetPassword(email: string) {
  const origin = typeof window !== 'undefined' && window.location.origin
    ? window.location.origin
    : 'https://stranger-sky-web.vercel.app';
  const continueUrl = `${origin}/auth/action`;

  // Call our same-origin Next.js SMTP API (Zero Firebase emails)
  const res = await fetch('/api/auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), continueUrl }),
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || 'Failed to send reset email. Please try again.');
  }
}
export async function verifyResetCode(oobCode: string): Promise<string> {
  const { auth, fb } = await init();
  return fb.verifyPasswordResetCode(auth, oobCode);
}
export async function confirmNewPassword(oobCode: string, newPw: string): Promise<void> {
  const { auth, fb } = await init();
  await fb.confirmPasswordReset(auth, oobCode, newPw);
}
export async function applyEmailVerification(oobCode: string): Promise<void> {
  const { auth, fb } = await init();
  await fb.applyActionCode(auth, oobCode);
}
export async function logOut() {
  const { auth, fb } = await init();
  await fb.signOut(auth);
}
export async function deleteLogin() {
  const { auth, fb } = await init();
  if (auth.currentUser) await fb.deleteUser(auth.currentUser);
}
export function authMessage(e: unknown) {
  const code = (e as { code?: string })?.code || '';
  const map: Record<string, string> = {
    'auth/invalid-credential': 'Email or password is not right.', 'auth/wrong-password': 'Email or password is not right.',
    'auth/user-not-found': 'Email or password is not right.', 'auth/email-already-in-use': 'That email already has an account. Try signing in.',
    'auth/weak-password': 'Use at least 6 characters.', 'auth/invalid-email': 'That email does not look right.',
    'auth/too-many-requests': 'Too many tries. Wait a minute and try again.', 'auth/popup-closed-by-user': '',
    'auth/popup-blocked': 'Allow pop-ups to sign in with Google.', 'auth/network-request-failed': 'Network problem. Check your connection.',
    'auth/requires-recent-login': 'For safety, sign in again and retry.',
    'auth/expired-action-code': 'This link has expired. Please request a new one.',
    'auth/invalid-action-code': 'This link is invalid or has already been used.',
    'auth/user-disabled': 'This account has been disabled.',
  };
  return code in map ? map[code] : 'Something went wrong. Please try again.';
}
