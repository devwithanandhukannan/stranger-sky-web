'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getConfig } from '@/lib/api';
import { authMessage, getToken, logOut, onAuth, refreshUser, resendVerification, resetPassword, signIn, signInGoogle, signUp, setIncognitoSession, type AuthState } from '@/lib/auth';
import { resetThemeCss } from '@/lib/sky/themes';
import { IcoUser, IcoLock, IcoEye, IcoEyeOff, IcoIncognito, IcoGoogle } from '@/components/sky/icons';

export default function Login() {
  const router = useRouter();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [err, setErr] = useState('');
  const [info, setInfo] = useState('');
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [guestAlias, setGuestAlias] = useState('');
  const [showGuestInput, setShowGuestInput] = useState(false);
  const [auth, setAuth] = useState<AuthState>(null);
  const [ready, setReady] = useState(false);
  const [name, setName] = useState('Untold');

  const route = async () => {
    const t = await getToken(true);
    if (!t) return;
    try {
      const r = await api<{ profile: unknown }>('GET', '/me', t);
      router.replace(r.profile ? '/sky' : '/welcome');
    } catch (e) {
      const m = (e as Error).message;
      if (m === 'email_not_verified') return;
      if (m.startsWith('account_')) {
        setErr('This account has been restricted.');
        await logOut();
        return;
      }
      setErr('Could not reach the server. Please try again.');
    }
  };

  useEffect(() => {
    resetThemeCss();
    let off = () => {};
    let dead = false;
    getConfig().then((c) => setName(c.appName)).catch(() => {});
    onAuth((s) => {
      if (dead) return;
      setAuth(s);
      setReady(true);
      if (s?.verified) void route();
    })
      .then((u) => { off = u; })
      .catch(() => { setReady(true); });
    return () => { dead = true; off(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (fn: () => Promise<void>) => {
    setErr('');
    setInfo('');
    setBusy(true);
    try {
      await fn();
    } catch (e) {
      setErr(authMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (mode === 'up') {
        await signUp(email.trim(), pw);
        setInfo('We sent a verification link to your email. Please check it.');
      } else {
        await signIn(email.trim(), pw);
      }
    });
  };

  const handleEnterGuest = () => {
    setIncognitoSession(guestAlias.trim() || 'Drifting Stranger');
    router.replace('/sky');
  };

  if (!ready) {
    return (
      <div className="login-loading">
        <div className="login-spinner" />
      </div>
    );
  }

  if (auth && !auth.verified) {
    return (
      <div className="login-split">
        <div className="login-left" style={{ justifyContent: 'center' }}>
          <div className="login-form-container">
            <Link href="/" className="login-brand-logo">untold<span>.</span></Link>
            <h1 className="login-h1" style={{ marginTop: 24 }}>Check your email</h1>
            <p className="login-sub">
              We sent a verification link to <b>{auth.email}</b>. Open it, then click the button below.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                className="login-submit-btn"
                disabled={busy}
                onClick={() => run(async () => {
                  const u = await refreshUser();
                  if (u?.verified) await route();
                  else setErr('Not verified yet. Please click the link in your email first.');
                })}
              >
                I verified my email
              </button>
              <button
                type="button"
                className="login-pill-btn"
                disabled={busy}
                onClick={() => run(async () => {
                  await resendVerification();
                  setInfo('Verification email resent. Check spam folder too.');
                })}
              >
                Resend verification email
              </button>
              <button
                type="button"
                className="login-mode-btn"
                style={{ marginTop: 12, textAlign: 'center' }}
                onClick={() => void logOut()}
              >
                Use a different account
              </button>
              {err && <div className="login-error-text">{err}</div>}
              {info && <div className="login-info-text">{info}</div>}
            </div>
          </div>
        </div>

        <div className="login-right">
          <div className="login-hero-card">
            <img
              src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80"
              alt="Untold connection"
              className="login-hero-img"
            />
            <div className="login-hero-overlay">
              <h2 className="login-hero-title">Untold is where minds meet quietly.</h2>
              <p className="login-hero-desc">
                One peaceful space for authentic thoughts. Drift without pressure, connect without noise.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="login-split">
      {/* ── Left Column: Clean Minimalist Form ── */}
      <div className="login-left">
        <header className="login-top-bar">
          <Link href="/" className="login-brand-logo">
            untold<span>.</span>
          </Link>
          <Link href="/sky" className="login-top-link">
            Explore the sky &rarr;
          </Link>
        </header>

        <div className="login-form-container">
          <h1 className="login-h1">{mode === 'in' ? 'Log in' : 'Create account'}</h1>
          <p className="login-sub">
            {mode === 'in' ? 'Sign in to drift quietly into the sky.' : 'Join Untold. Strictly 18 and older.'}
          </p>

          {/* Social OAuth Buttons */}
          <div className="login-social-group">
            <button
              type="button"
              className="login-pill-btn"
              disabled={busy}
              onClick={() => run(signInGoogle)}
            >
              <IcoGoogle size={18} />
              <span>Continue with Google</span>
            </button>

            {!showGuestInput ? (
              <button
                type="button"
                className="login-pill-btn"
                onClick={() => setShowGuestInput(true)}
              >
                <IcoIncognito size={17} />
                <span>Continue as Guest</span>
              </button>
            ) : (
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="login-input"
                  style={{ height: 48, fontSize: 14 }}
                  placeholder="Guest pseudonym (optional)"
                  value={guestAlias}
                  maxLength={24}
                  onChange={(e) => setGuestAlias(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleEnterGuest();
                    }
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  className="login-submit-btn"
                  style={{ width: 'auto', padding: '0 20px', whiteSpace: 'nowrap' }}
                  onClick={handleEnterGuest}
                >
                  Enter
                </button>
              </div>
            )}
          </div>

          <div className="login-divider">
            <span>or</span>
          </div>

          {/* Email / Password Form */}
          <form onSubmit={submit}>
            <div className="login-input-group">
              <div className="login-input-wrap">
                <input
                  id="email"
                  className="login-input"
                  type="email"
                  autoComplete="email"
                  placeholder="Email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div className="login-input-wrap">
                <input
                  id="password"
                  className="login-input"
                  type={showPw ? 'text' : 'password'}
                  autoComplete={mode === 'in' ? 'current-password' : 'new-password'}
                  placeholder="Password"
                  required
                  minLength={6}
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  style={{ paddingRight: 48 }}
                />
                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() => setShowPw(!showPw)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPw ? <IcoEyeOff size={18} /> : <IcoEye size={18} />}
                </button>
              </div>
            </div>

            <button className="login-submit-btn" disabled={busy}>
              {mode === 'in' ? 'Continue with Email' : 'Create account'}
            </button>

            {err && <div className="login-error-text" role="alert">{err}</div>}
            {info && <div className="login-info-text" role="status">{info}</div>}

            <div className="login-footer-links">
              <button
                type="button"
                className="login-mode-btn"
                onClick={() => {
                  setMode(mode === 'in' ? 'up' : 'in');
                  setErr('');
                  setInfo('');
                }}
              >
                {mode === 'in' ? 'New to Untold? Create an account' : 'Already have an account? Log in'}
              </button>

              {mode === 'in' && (
                <button
                  type="button"
                  className="login-forgot-btn"
                  onClick={() => run(async () => {
                    if (!email) {
                      setErr('Please enter your email above to reset password.');
                      return;
                    }
                    await resetPassword(email.trim());
                    setInfo('If that email exists, a password reset link has been sent.');
                  })}
                >
                  Forgot password?
                </button>
              )}
            </div>
          </form>

          {/* Have an account highlight card (Matching Picky reference!) */}
          <div className="login-info-card">
            <h4>100% Ephemeral & Private</h4>
            <p>
              Untold leaves zero digital footprints. No chats or transcripts are saved on servers, and identity remains protected.
            </p>
          </div>

          <p className="login-terms">
            By continuing, you agree to our <Link href="/rules">Terms</Link> and <Link href="/privacy">Privacy Policy</Link>.
          </p>
        </div>
      </div>

      {/* ── Right Column: Aesthetic Editorial Portrait Card (Matching Picky Reference!) ── */}
      <div className="login-right">
        <div className="login-hero-card">
          <img
            src="https://images.unsplash.com/photo-1529156069898-49953e39b3ac?auto=format&fit=crop&w=1200&q=80"
            alt="Untold connection"
            className="login-hero-img"
          />
          <div className="login-hero-overlay">
            <h2 className="login-hero-title">Untold is where minds meet quietly.</h2>
            <p className="login-hero-desc">
              One peaceful space for authentic thoughts. Drift without pressure, connect without noise.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
