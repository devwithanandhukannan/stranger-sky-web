'use client';
import { useEffect, useState } from 'react';
import { initPwaListener, isPwaInstalled, isIosDevice, promptPwaInstall } from '@/lib/pwa';

export default function PwaPrompt() {
  const [visible, setVisible] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    initPwaListener();

    // Check if already installed
    if (isPwaInstalled()) {
      setIsInstalled(true);
      return;
    }

    // Check if dismissed recently (7 days)
    try {
      const dismissed = localStorage.getItem('untold_pwa_dismissed');
      if (dismissed) {
        const time = parseInt(dismissed, 10);
        if (Date.now() - time < 7 * 24 * 60 * 60 * 1000) {
          return;
        }
      }
    } catch {
      /* ignore */
    }

    // Show after a gentle 2.5s delay
    const timer = setTimeout(() => {
      if (!isPwaInstalled()) {
        setVisible(true);
      }
    }, 2500);

    const onInstalled = () => {
      setIsInstalled(true);
      setVisible(false);
    };

    window.addEventListener('untold-pwa-installed', onInstalled);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('untold-pwa-installed', onInstalled);
    };
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem('untold_pwa_dismissed', Date.now().toString());
    } catch {
      /* ignore */
    }
  };

  const handleInstall = async () => {
    const res = await promptPwaInstall();
    if (res.outcome === 'accepted') {
      setVisible(false);
      setIsInstalled(true);
    } else if (res.outcome === 'manual') {
      // Show iOS / manual instructions
      setShowIosGuide(true);
    }
  };

  if (isInstalled) return null;

  return (
    <>
      {/* ── Slide-up Install Notification Banner ── */}
      {visible && (
        <aside
          className="pwa-toast-banner"
          role="dialog"
          aria-label="Install Untold App"
        >
          <div className="pwa-toast-card">
            <div className="pwa-toast-icon">
              <img
                src="/web-app-manifest-192x192.png"
                alt="Untold App"
                width={44}
                height={44}
                className="pwa-toast-img"
              />
            </div>

            <div className="pwa-toast-content">
              <h4 className="pwa-toast-title">Download Untold App</h4>
              <p className="pwa-toast-desc">
                Install for a full-screen, quiet and distraction-free experience.
              </p>

              <div className="pwa-toast-actions">
                <button
                  type="button"
                  className="pwa-btn-install"
                  onClick={handleInstall}
                >
                  Download App
                </button>
                <button
                  type="button"
                  className="pwa-btn-dismiss"
                  onClick={handleDismiss}
                >
                  Not now
                </button>
              </div>
            </div>

            <button
              type="button"
              className="pwa-toast-close"
              onClick={handleDismiss}
              aria-label="Close"
            >
              &times;
            </button>
          </div>
        </aside>
      )}

      {/* ── iOS / Manual Add to Home Screen Modal ── */}
      {showIosGuide && (
        <div className="pwa-modal-backdrop" onClick={() => setShowIosGuide(false)}>
          <div className="pwa-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="pwa-modal-header">
              <img
                src="/web-app-manifest-192x192.png"
                alt="Untold"
                width={48}
                height={48}
                className="pwa-modal-icon"
              />
              <h3 className="pwa-modal-title">Install Untold on your device</h3>
            </div>

            {isIosDevice() ? (
              <div className="pwa-modal-steps">
                <div className="pwa-step-item">
                  <span className="pwa-step-num">1</span>
                  <span>
                    Tap the <b>Share</b> button{' '}
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{ display: 'inline-block', verticalAlign: 'middle', margin: '0 2px' }}
                    >
                      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
                      <polyline points="16 6 12 2 8 6" />
                      <line x1="12" y1="2" x2="12" y2="15" />
                    </svg>{' '}
                    in your Safari browser toolbar.
                  </span>
                </div>
                <div className="pwa-step-item">
                  <span className="pwa-step-num">2</span>
                  <span>
                    Scroll down and tap <b>Add to Home Screen</b>.
                  </span>
                </div>
                <div className="pwa-step-item">
                  <span className="pwa-step-num">3</span>
                  <span>
                    Tap <b>Add</b> in the top-right corner to finish.
                  </span>
                </div>
              </div>
            ) : (
              <div className="pwa-modal-steps">
                <div className="pwa-step-item">
                  <span className="pwa-step-num">1</span>
                  <span>Click your browser menu (<b>&vellip;</b> or <b>&hellip;</b>) in the top right.</span>
                </div>
                <div className="pwa-step-item">
                  <span className="pwa-step-num">2</span>
                  <span>Select <b>Install Untold</b> or <b>Add to desktop</b>.</span>
                </div>
              </div>
            )}

            <button
              type="button"
              className="pwa-btn-done"
              onClick={() => {
                setShowIosGuide(false);
                setVisible(false);
              }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

