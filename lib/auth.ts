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
export async function getToken(force = false) {
  const { auth } = await init();
  return auth.currentUser ? auth.currentUser.getIdToken(force) : null;
}
export async function getCurrentUser() {
  const { auth } = await init();
  return auth.currentUser ? { email: auth.currentUser.email || '', uid: auth.currentUser.uid } : null;
}
export async function signUp(email: string, password: string) {
  const { auth, fb } = await init();
  const c = await fb.createUserWithEmailAndPassword(auth, email, password);
  await fb.sendEmailVerification(c.user);
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
  if (auth.currentUser) await fb.sendEmailVerification(auth.currentUser);
}
export async function refreshUser() {
  const { auth } = await init();
  if (!auth.currentUser) return null;
  await auth.currentUser.reload();
  await auth.currentUser.getIdToken(true); // new token carries email_verified = true
  return { email: auth.currentUser.email || '', verified: auth.currentUser.emailVerified };
}
export async function resetPassword(email: string) {
  const { auth, fb } = await init();
  await fb.sendPasswordResetEmail(auth, email);
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
  };
  return code in map ? map[code] : 'Something went wrong. Please try again.';
}
