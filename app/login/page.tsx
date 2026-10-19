'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, getConfig } from '@/lib/api';
import { authMessage, getToken, logOut, onAuth, refreshUser, resendVerification, resetPassword, signIn, signInGoogle, signUp, setIncognitoSession, type AuthState } from '@/lib/auth';
import { IcoUser, IcoLock, IcoEye, IcoEyeOff, IcoIncognito, IcoGoogle } from '@/components/sky/icons';

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState(''), [pw, setPw] = useState(''), [err, setErr] = useState(''), [info, setInfo] = useState(''), [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [guestAlias, setGuestAlias] = useState('');
  const [auth, setAuth] = useState<AuthState>(null), [ready, setReady] = useState(false), [name, setName] = useState('Lumen');

  const route = async () => {
    const t = await getToken(true); if (!t) return;
    try {
      const r = await api<{ profile: unknown }>('GET', '/me', t);
      router.replace(r.profile ? '/sky' : '/welcome');
    } catch (e) {
      const m = (e as Error).message;
      if (m === 'email_not_verified') return;
      if (m.startsWith('account_')) { setErr('This account has been restricted.'); await logOut(); return; }
      setErr('Could not reach the server. Please try again.');
    }
  };

  useEffect(() => {
    let off = () => {}; let dead = false;
    getConfig().then((c) => setName(c.appName)).catch(() => {});
    onAuth((s) => { if (dead) return; setAuth(s); setReady(true); if (s?.verified) void route(); }).then((u) => { off = u; }).catch(() => { setReady(true); setErr('Could not reach the server.'); });
    return () => { dead = true; off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (fn: () => Promise<void>) => { setErr(''); setInfo(''); setBusy(true); try { await fn(); } catch (e) { setErr(authMessage(e)); } finally { setBusy(false); } };
  const submit = (e: React.FormEvent) => { e.preventDefault(); void run(async () => { if (mode === 'up') { await signUp(email.trim(), pw); setInfo('We sent a link to your email. Open it, then come back here.'); } else await signIn(email.trim(), pw); }); };

  const handleEnterGuest = () => {
    setIncognitoSession(guestAlias.trim() || 'Drifting Stranger');
    router.replace('/sky');
  };

  if (!ready) return <main className="page"><div className="logo" /></main>;

  if (auth && !auth.verified) {
    return (
      <main className="page">
        <div className="card center">
          <div className="logo" />
          <h1>Check your email</h1>
          <p className="muted">We sent a verification link to <b>{auth.email}</b>. Open it, then tap the button below.</p>
          <div className="stack">
            <button className="btn" disabled={busy} onClick={() => run(async () => { const u = await refreshUser(); if (u?.verified) await route(); else setErr('Not verified yet. Open the link in the email first.'); })}>I verified my email</button>
            <button className="btn ghost" disabled={busy} onClick={() => run(async () => { await resendVerification(); setInfo('Sent again. Check spam too.'); })}>Resend the email</button>
            <button className="btn ghost" onClick={() => void logOut()}>Use a different account</button>
            <div className="err" role="alert">{err}</div>
            <div className="tiny">{info}</div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <div className="card center">
        <div className="logo" />
        <h1 className="center">{mode === 'in' ? `Welcome back to ${name}` : `Join ${name}`}</h1>
        <p className="muted center" style={{ margin: '6px 0 0' }}>{mode === 'in' ? 'Sign in to enter the sky.' : 'You must be 18 or older.'}</p>

        <form onSubmit={submit} className="stack" style={{ textAlign: 'left', marginTop: 24 }}>
          {/* Email input with leading User icon */}
          <div className="input-box">
            <span className="input-icon-left"><IcoUser size={18} /></span>
            <input
              id="em"
              className="input-inner"
              type="email"
              autoComplete="email"
              placeholder="Email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          {/* Password input with leading Lock icon and trailing Eye toggle */}
          <div className="input-box">
            <span className="input-icon-left"><IcoLock size={18} /></span>
            <input
              id="pw"
              className="input-inner"
              type={showPw ? 'text' : 'password'}
              autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
              placeholder="Password"
              required
              minLength={6}
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
            <button
              type="button"
              className="input-btn-right"
              onClick={() => setShowPw(!showPw)}
              aria-label={showPw ? 'Hide password' : 'Show password'}
              tabIndex={-1}
            >
              {showPw ? <IcoEyeOff size={18} /> : <IcoEye size={18} />}
            </button>
          </div>

          {/* Primary Action Button (Electric Blue) */}
          <button className="btn" disabled={busy}>
            {mode === 'in' ? 'Continue' : 'Create account'}
          </button>

          {/* Google Sign-in */}
          <button type="button" className="btn ghost" disabled={busy} onClick={() => run(signInGoogle)}>
            <IcoGoogle size={17} />
            <span>Continue with Google</span>
          </button>

          <div className="err" role="alert">{err}</div>
          <div className="tiny" role="status">{info}</div>

          <div className="row" style={{ justifyContent: 'space-between', marginTop: 2 }}>
            <button
              type="button"
              className="tiny"
              style={{ background: 'none', border: 0, color: 'var(--ink2)', cursor: 'pointer' }}
              onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setErr(''); }}
            >
              {mode === 'in' ? 'Create an account' : 'I have an account'}
            </button>
            {mode === 'in' && (
              <button
                type="button"
                className="tiny"
                style={{ background: 'none', border: 0, color: 'var(--ink3)', cursor: 'pointer' }}
                onClick={() => run(async () => {
                  if (!email) throw Object.assign(new Error(), { code: 'auth/invalid-email' });
                  await resetPassword(email.trim());
                  setInfo('If that email has an account, a reset link is on its way.');
                })}
              >
                Forgot password?
              </button>
            )}
          </div>
        </form>

        {/* Minimal Ignoto / Incognito Guest Entry (No Emojis, No Cluttered Text) */}
        <div className="guest-divider">
          <span>or guest access</span>
        </div>

        <div className="guest-box">
          <div className="input-box" style={{ height: 44 }}>
            <span className="input-icon-left"><IcoIncognito size={16} /></span>
            <input
              className="input-inner"
              style={{ fontSize: 14 }}
              placeholder="Guest pseudonym (optional)"
              value={guestAlias}
              maxLength={20}
              onChange={(e) => setGuestAlias(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleEnterGuest();
                }
              }}
            />
          </div>
          <button
            type="button"
            className="btn ghost guest-btn"
            style={{ height: 44, minHeight: 44, fontSize: 14 }}
            onClick={handleEnterGuest}
          >
            <IcoIncognito size={16} />
            <span>Enter as Guest</span>
          </button>
        </div>
      </div>
    </main>
  );
}
