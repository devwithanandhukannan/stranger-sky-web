'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  authMessage,
  verifyResetCode,
  confirmNewPassword,
  applyEmailVerification,
  resetPassword,
} from '@/lib/auth';
import { resetThemeCss } from '@/lib/sky/themes';
import { IcoEye, IcoEyeOff, IcoCheck } from '@/components/sky/icons';

function AuthActionContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const mode = searchParams.get('mode'); // 'resetPassword' | 'verifyEmail' | 'recoverEmail'
  const oobCode = searchParams.get('oobCode') || '';

  // Reset password states
  const [targetEmail, setTargetEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  // Status & error states
  const [verifying, setVerifying] = useState(true);
  const [codeValid, setCodeValid] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [success, setSuccess] = useState(false);

  // Recovery email state (if expired code)
  const [recoveryEmail, setRecoveryEmail] = useState('');
  const [resendSent, setResendSent] = useState(false);

  useEffect(() => {
    resetThemeCss();

    if (!oobCode) {
      setVerifying(false);
      setCodeValid(false);
      setError('No security verification code was found in this link.');
      return;
    }

    if (mode === 'resetPassword') {
      verifyResetCode(oobCode)
        .then((email) => {
          setTargetEmail(email);
          setRecoveryEmail(email);
          setCodeValid(true);
          setVerifying(false);
        })
        .catch((err) => {
          setError(authMessage(err));
          setCodeValid(false);
          setVerifying(false);
        });
    } else if (mode === 'verifyEmail') {
      applyEmailVerification(oobCode)
        .then(() => {
          setCodeValid(true);
          setSuccess(true);
          setVerifying(false);
        })
        .catch((err) => {
          setError(authMessage(err));
          setCodeValid(false);
          setVerifying(false);
        });
    } else {
      setVerifying(false);
      setError('Unknown or unsupported authentication action.');
    }
  }, [mode, oobCode]);

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (newPassword !== confirmPw) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setBusy(true);
    try {
      await confirmNewPassword(oobCode, newPassword);
      setSuccess(true);
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRequestNewReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recoveryEmail.trim()) {
      setError('Please enter your email address.');
      return;
    }
    setError('');
    setBusy(true);
    try {
      await resetPassword(recoveryEmail.trim());
      setResendSent(true);
      setInfo(`If an account exists for ${recoveryEmail.trim()}, a new reset link has been sent.`);
    } catch (err) {
      setError(authMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="login-split">
      {/* ── Left Column: Editorial Minimalism Form ── */}
      <div className="login-left">
        <header className="login-top-bar">
          <Link href="/" className="login-brand-logo">
            untold<span>.</span>
          </Link>
          <Link href="/login" className="login-top-link">
            Back to Sign In
          </Link>
        </header>

        <div className="login-form-container">
          {verifying ? (
            <div style={{ textAlign: 'center', padding: '60px 0' }}>
              <div className="login-spinner" style={{ margin: '0 auto 20px' }} />
              <h2 className="login-h1" style={{ fontSize: 24 }}>Verifying security token</h2>
              <p className="login-sub" style={{ marginTop: 8 }}>
                Establishing a secure connection with Untold...
              </p>
            </div>
          ) : mode === 'resetPassword' ? (
            success ? (
              /* Success State */
              <div style={{ textAlign: 'left' }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: '#111111',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 24,
                  }}
                >
                  <IcoCheck size={24} />
                </div>
                <h1 className="login-h1">Password updated.</h1>
                <p className="login-sub">
                  Your password for <b>{targetEmail}</b> has been securely reset. You can now log in to Untold with your new password.
                </p>
                <button
                  type="button"
                  className="login-submit-btn"
                  onClick={() => router.push('/login')}
                  style={{ marginTop: 12 }}
                >
                  Sign in with new password
                </button>
              </div>
            ) : codeValid ? (
              /* Active Form: Set New Password */
              <div>
                <h1 className="login-h1">Reset password</h1>
                <p className="login-sub">
                  Enter a new, secure password for <b>{targetEmail}</b>.
                </p>

                <form onSubmit={handleResetSubmit}>
                  <div className="login-input-group">
                    {/* New Password */}
                    <div className="login-input-wrap">
                      <input
                        id="new-password"
                        className="login-input"
                        type={showPw ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="New password (min 6 characters)"
                        required
                        minLength={6}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        style={{ paddingRight: 48 }}
                        autoFocus
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

                    {/* Confirm Password */}
                    <div className="login-input-wrap">
                      <input
                        id="confirm-password"
                        className="login-input"
                        type={showConfirmPw ? 'text' : 'password'}
                        autoComplete="new-password"
                        placeholder="Confirm new password"
                        required
                        minLength={6}
                        value={confirmPw}
                        onChange={(e) => setConfirmPw(e.target.value)}
                        style={{ paddingRight: 48 }}
                      />
                      <button
                        type="button"
                        className="login-password-toggle"
                        onClick={() => setShowConfirmPw(!showConfirmPw)}
                        aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
                        tabIndex={-1}
                      >
                        {showConfirmPw ? <IcoEyeOff size={18} /> : <IcoEye size={18} />}
                      </button>
                    </div>
                  </div>

                  {/* Realtime password hint */}
                  {newPassword && confirmPw && (
                    <div
                      style={{
                        fontSize: 13,
                        marginBottom: 16,
                        color: newPassword === confirmPw ? '#10b981' : '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 6,
                      }}
                    >
                      <span>{newPassword === confirmPw ? '✓ Passwords match' : '✕ Passwords do not match'}</span>
                    </div>
                  )}

                  <button className="login-submit-btn" disabled={busy}>
                    {busy ? 'Updating password...' : 'Save new password'}
                  </button>

                  {error && <div className="login-error-text" role="alert">{error}</div>}
                  {info && <div className="login-info-text" role="status">{info}</div>}
                </form>

                <div className="login-info-card" style={{ marginTop: 28 }}>
                  <h4>Zero-knowledge security</h4>
                  <p>
                    All passwords are cryptographically hashed and never stored in plain text. Saving your new password invalidates any prior active sessions.
                  </p>
                </div>
              </div>
            ) : (
              /* Expired or Invalid Code */
              <div>
                <h1 className="login-h1">Link expired</h1>
                <p className="login-sub">
                  For your safety, password reset links are single-use and expire quickly.
                </p>

                {error && <div className="login-error-text" style={{ marginBottom: 20 }}>{error}</div>}

                {!resendSent ? (
                  <form onSubmit={handleRequestNewReset}>
                    <div className="login-input-wrap" style={{ marginBottom: 12 }}>
                      <input
                        className="login-input"
                        type="email"
                        placeholder="Your email address"
                        required
                        value={recoveryEmail}
                        onChange={(e) => setRecoveryEmail(e.target.value)}
                      />
                    </div>
                    <button className="login-submit-btn" disabled={busy}>
                      {busy ? 'Sending...' : 'Send fresh reset link'}
                    </button>
                  </form>
                ) : (
                  <div className="login-info-text" style={{ marginBottom: 16 }}>
                    {info}
                  </div>
                )}

                <div style={{ marginTop: 24, textAlign: 'center' }}>
                  <Link href="/login" className="login-mode-btn">
                    Return to Log In
                  </Link>
                </div>
              </div>
            )
          ) : mode === 'verifyEmail' ? (
            /* Email Verification Mode */
            success ? (
              <div style={{ textAlign: 'left' }}>
                <div
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    background: '#111111',
                    color: '#ffffff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 24,
                  }}
                >
                  <IcoCheck size={24} />
                </div>
                <h1 className="login-h1">Email verified.</h1>
                <p className="login-sub">
                  Thank you for verifying your email. Your account is active and you can now drift into the sky.
                </p>
                <button
                  type="button"
                  className="login-submit-btn"
                  onClick={() => router.push('/sky')}
                  style={{ marginTop: 12 }}
                >
                  Enter the Sky
                </button>
              </div>
            ) : (
              <div>
                <h1 className="login-h1">Verification failed</h1>
                <p className="login-sub">
                  {error || 'This verification link is invalid or has already been used.'}
                </p>
                <button
                  type="button"
                  className="login-submit-btn"
                  onClick={() => router.push('/login')}
                  style={{ marginTop: 12 }}
                >
                  Go to Sign In
                </button>
              </div>
            )
          ) : (
            /* Fallback */
            <div>
              <h1 className="login-h1">Untold Authentication</h1>
              <p className="login-sub">
                {error || 'Please use the secure link provided in your email.'}
              </p>
              <button
                type="button"
                className="login-submit-btn"
                onClick={() => router.push('/login')}
                style={{ marginTop: 12 }}
              >
                Go to Sign In
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Right Column: Editorial Visual (Matching /login) ── */}
      <div className="login-right">
        <div className="login-hero-card">
          <img
            src="/assets/imagetwo.webp"
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

export default function AuthActionPage() {
  return (
    <Suspense
      fallback={
        <div className="login-loading">
          <div className="login-spinner" />
        </div>
      }
    >
      <AuthActionContent />
    </Suspense>
  );
}

