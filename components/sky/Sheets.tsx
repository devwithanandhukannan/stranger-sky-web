'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useUI, MOOD_COLORS, MOOD_NAMES, F_ECHO, F_NEW, F_VET, F_BUSY, type NearItem } from '@/lib/sky/store';
import { useSky } from './ctx';
import { setSound, sfx, speakMessage } from '@/lib/sky/audio';
import { api, API } from '@/lib/api';
import { IcoPin, IcoCalendar, IcoAge, IcoBond, IcoChat, IcoChime, IcoCrystal, IcoBell, IcoClock, IcoSun, IcoSunset, IcoMoon, IcoCheck, IcoSparkle, IcoIncognito, IcoShieldAlert, IcoX, IcoGlobe, IcoRadar, IcoPhoneCall, IcoTrash, IcoBan } from './icons';

import { resolveTheme, getTimeBasedThemeId, applyThemeCss, getThemeScheduleDescription } from '@/lib/sky/themes';
import { isPwaInstalled, promptPwaInstall, isIosDevice } from '@/lib/pwa';

export function Sheet({
  title,
  onClose,
  children,
  tall,
  className,
  headerExtra,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
  tall?: boolean;
  className?: string;
  headerExtra?: ReactNode;
}) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className={`modal${className ? ` modal-${className}` : ''}`} data-ui onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className={`sheet${tall ? ' tall' : ''}${className ? ` ${className}` : ''}`} role="dialog" aria-label={title}>
        <div className="sheet-handle" />
        <header className="sheet-h">
          <h2>{title}</h2>
          <div className="sheet-h-right">
            {headerExtra}
            <button className="icon" onClick={onClose} aria-label="Close"><IcoX size={15} /></button>
          </div>
        </header>
        {children}
      </section>
    </div>
  );
}

const ERR: Record<string, string> = {
  not_allowed: 'Links and blocked words are not allowed here.', slow_down: 'Slow down a little.', offline: 'You are offline.', timeout: 'That took too long. Try again.',
};

export const REASONS: [string, string][] = [['harassment', 'Harassment or bullying'], ['sexual_content', 'Sexual content'], ['nudity', 'Nudity'], ['underage', 'Seems under 18'], ['spam', 'Spam'], ['scam', 'Scam or money'], ['hate', 'Hate'], ['other', 'Something else']];

export function ReportForm({ onSubmit, onCancel, busy }: { onSubmit: (reason: string, details: string) => void; onCancel: () => void; busy?: boolean }) {
  const [r, setR] = useState('harassment'), [d, setD] = useState('');
  return (
    <div className="stack" style={{ marginTop: 6 }}>
      {REASONS.map(([k, l]) => (<label key={k} className="opt"><input type="radio" name="reason" checked={r === k} onChange={() => setR(k)} /> {l}</label>))}
      <textarea className="field" rows={2} maxLength={300} placeholder="Anything we should know? (optional)" value={d} onChange={(e) => setD(e.target.value)} />
      <div style={{ background: 'rgba(255, 60, 90, 0.12)', borderRadius: 14, padding: '10px 14px', margin: '4px 0' }}>
        <p className="tiny" style={{ color: '#ff9fb0', margin: 0, fontWeight: 550, lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
          <span style={{ display: 'inline-flex', flexShrink: 0, marginTop: 1 }}><IcoShieldAlert size={14} /></span>
          <span><b>Zero-Tolerance Enforcement:</b> Reports immediately issue an automated temporary suspension and instantly sever connections to protect the space.</span>
        </p>
      </div>

      <div className="row"><button className="btn ghost" onClick={onCancel}>Cancel</button><button className="btn danger" style={{ flex: 1 }} disabled={busy} onClick={() => onSubmit(r, d)}>Submit report & ban</button></div>
    </div>
  );
}

export function ReportSheet() {
  const { ui, world } = useSky();
  const sid = useUI(ui, (s) => s.reportSid);
  const [busy, setBusy] = useState(false);
  const close = () => ui.set({ panel: null, reportSid: null });
  if (!sid) return null;
  return (
    <Sheet title="Report" onClose={close}>
      <ReportForm busy={busy} onCancel={close} onSubmit={async (r, d) => { setBusy(true); await world.report(sid, r, d); setBusy(false); ui.set({ selected: null }); close(); }} />
    </Sheet>
  );
}
export function BondsSheet() {
  const { ui, world, getToken } = useSky();
  const bonds = useUI(ui, (s) => s.bonds);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') ui.set({ panel: null });
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui]);

  const remove = async (id: string, block: boolean) => {
    const target = bonds.find((b) => b.id === id);
    const name = target?.name || 'this person';
    setBusyId(id);
    try {
      const t = await getToken();
      if (t) {
        await api(block ? 'POST' : 'DELETE', block ? '/blocks' : `/bonds/${id}`, t, block ? { id } : undefined);
      }
      ui.set({
        bonds: ui.get().bonds.filter((b) => b.id !== id),
        toast: block
          ? `Blocked ${name}. They will not be able to reach you.`
          : `Removed connection with ${name}`,
      });
    } catch {
      ui.set({ toast: 'Could not complete that action. Please try again.' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div
      className="sky-drawer-backdrop"
      data-ui
      role="dialog"
      aria-label="Chats"
      onClick={(e) => {
        if (e.target === e.currentTarget) ui.set({ panel: null });
      }}
    >
      <aside className="sky-drawer">
        <header className="sky-drawer-header">
          <h2 className="sky-drawer-title">Chats</h2>
          <button
            type="button"
            className="sky-drawer-close"
            onClick={() => ui.set({ panel: null })}
            aria-label="Close Chats"
          >
            Close
          </button>
        </header>

        <div className="sky-drawer-body">
          {bonds.length === 0 ? (
            <p className="chats-empty-hint">No chats yet. Tap a light and say hello.</p>
          ) : (
            <div className="chats-list-wrap">
              {bonds.map((b) => (
                <div
                  key={b.id}
                  className="chats-item-row"
                  onClick={() => {
                    world.callBond(b.id);
                    ui.set({ panel: null });
                  }}
                >
                  <div className="chats-item-main">
                    <div className="chats-item-name-line">
                      <span className="chats-item-name">{b.name}</span>
                      {b.online && <span className="chats-status-dot" title="In the sky now" />}
                    </div>
                    <span className="chats-item-status">
                      {b.online ? 'In the sky now' : 'Away'}
                    </span>
                  </div>
                  <div className="chats-item-actions" onClick={(e) => e.stopPropagation()}>
                    <button
                      type="button"
                      className="chats-btn-action"
                      disabled={busyId === b.id}
                      onClick={() => void remove(b.id, false)}
                      title="Remove connection"
                      aria-label={`Remove ${b.name}`}
                    >
                      Remove
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

export function SettingsSheet() {
  const { ui, world, getToken, onSignOut, onDeleted } = useSky();
  const s = useUI(ui, (x) => x);
  const [confirmDel, setConfirmDel] = useState('');
  const [err, setErr] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [profile, setProfile] = useState<{ email?: string; age?: number; createdAt?: string } | null>(null);
  const [installed, setInstalled] = useState(false);
  const [showIosGuide, setShowIosGuide] = useState(false);
  const [showDel, setShowDel] = useState(false);

  useEffect(() => {
    setInstalled(isPwaInstalled());
    const onInstalled = () => setInstalled(true);
    window.addEventListener('untold-pwa-installed', onInstalled);
    return () => window.removeEventListener('untold-pwa-installed', onInstalled);
  }, []);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const { getCurrentUser } = await import('@/lib/auth');
        const [u, t] = await Promise.all([getCurrentUser(), getToken()]);
        let p: { email?: string; age?: number; createdAt?: string } = {};
        if (t) {
          const r = await api<{ profile: { age?: number; createdAt?: string } }>('GET', '/me', t);
          if (r?.profile) p = { ...r.profile };
        }
        if (u?.email) p.email = u.email;
        if (!dead) setProfile(p);
      } catch { /* ignore */ }
    })();
    return () => { dead = true; };
  }, [getToken]);

  const save = (k: string, v: boolean) => {
    try { localStorage.setItem(k, v ? '1' : '0'); } catch { /* ignore */ }
  };

  const del = async () => {
    setErr('');
    try {
      const t = await getToken();
      if (t) await api('DELETE', '/me', t);
      const { deleteLogin } = await import('@/lib/auth');
      try { await deleteLogin(); } catch { /* ignore */ }
      onDeleted();
    } catch {
      setErr('Could not delete right now. Sign in again and retry.');
    }
  };

  const exportData = async () => {
    const t = await getToken(); if (!t) return;
    const r = await fetch(`${API}/api/me/export`, { headers: { authorization: `Bearer ${t}` } });
    const b = await r.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'my-data.json'; a.click(); URL.revokeObjectURL(a.href);
  };

  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
    : 'Oct 2026';

  const isNearbyOnly = s.galaxy === 'neighbours';

  const handleToggleNearby = () => {
    if (isNearbyOnly) {
      void world.travel('night');
      ui.set({ toast: 'Entered One Sky' });
    } else {
      if (typeof window !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            await world.setLocation(pos.coords.latitude, pos.coords.longitude);
            void world.travel('neighbours');
            ui.set({ locationGranted: true, toast: 'Nearby mode active (≤ 100 km)' });
          },
          () => {
            void world.travel('neighbours');
            ui.set({ toast: 'Switched to Neighbours' });
          },
          { timeout: 8000 }
        );
      } else {
        void world.travel('neighbours');
      }
    }
  };

  const cycleAppearance = () => {
    const themes = ['midnight', 'day', 'auto'];
    const cur = s.skyTheme;
    const nextIdx = (themes.indexOf(cur) + 1) % themes.length;
    const next = themes[nextIdx];
    ui.set({ skyTheme: next });
    try {
      localStorage.setItem('skyTheme', next);
      localStorage.setItem('skyThemeLocked', next === 'auto' ? 'false' : 'true');
    } catch {}
    applyThemeCss(resolveTheme(next));
  };

  const appearanceLabel = s.skyTheme === 'day' ? 'Light' : s.skyTheme === 'auto' ? 'Auto' : 'Dark';

  return (
    <div
      className="sky-drawer-backdrop"
      data-ui
      role="dialog"
      aria-label="You Settings"
      onClick={(e) => {
        if (e.target === e.currentTarget) ui.set({ panel: null });
      }}
    >
      <aside className="sky-drawer">
        <header className="sky-drawer-header">
          <h2 className="sky-drawer-title">You</h2>
          <button
            type="button"
            className="sky-drawer-close"
            onClick={() => ui.set({ panel: null })}
            aria-label="Close You Settings"
          >
            Close
          </button>
        </header>

        <div className="sky-drawer-body">
          <div className="you-rows-list">
            {/* Row 1: Sound */}
            <div className="you-row">
              <span className="you-row-title">Sound</span>
              <label className="sky-incognito-wrap">
                <input
                  type="checkbox"
                  className="sky-switch-input"
                  checked={s.sound}
                  onChange={(e) => {
                    const next = e.target.checked;
                    ui.set({ sound: next });
                    setSound(next);
                    save('sound', next);
                  }}
                  aria-label="Toggle Sound"
                />
                <span className="sky-switch-track">
                  <span className="sky-switch-thumb" />
                </span>
              </label>
            </div>

            {/* Row 1b: Voice over */}
            <div className="you-row">
              <div className="you-row-group">
                <span className="you-row-title">Voice over</span>
                <span className="you-row-sub">Reads incoming chat messages aloud.</span>
              </div>
              <label className="sky-incognito-wrap">
                <input
                  type="checkbox"
                  className="sky-switch-input"
                  checked={s.voiceReader}
                  onChange={(e) => {
                    const next = e.target.checked;
                    ui.set({ voiceReader: next });
                    if (!next && typeof window !== 'undefined' && window.speechSynthesis) {
                      window.speechSynthesis.cancel();
                    }
                    save('voiceReader', next);
                  }}
                  aria-label="Toggle Voice over"
                />
                <span className="sky-switch-track">
                  <span className="sky-switch-thumb" />
                </span>
              </label>
            </div>

            {/* Row 2: Nearby only */}
            <div className="you-row">
              <div className="you-row-group">
                <span className="you-row-title">Nearby only</span>
                <span className="you-row-sub">Within about 100 km, location blurred to 1 km.</span>
              </div>
              <label className="sky-incognito-wrap">
                <input
                  type="checkbox"
                  className="sky-switch-input"
                  checked={isNearbyOnly}
                  onChange={handleToggleNearby}
                  aria-label="Toggle Nearby only"
                />
                <span className="sky-switch-track">
                  <span className="sky-switch-thumb" />
                </span>
              </label>
            </div>

            {/* Row 3: Appearance */}
            <div className="you-row">
              <span className="you-row-title">Appearance</span>
              <button
                type="button"
                className="you-appearance-toggle"
                onClick={cycleAppearance}
                title="Click to toggle Light, Dark, or Auto"
                aria-label="Appearance Mode"
              >
                {appearanceLabel}
              </button>
            </div>

            {/* Row 4: Account */}
            <div className="you-row">
              <div className="you-row-group">
                <span className="you-row-title">Account</span>
                <span className="you-row-sub">{s.name || 'Drifting Stranger'}, here since {memberSince}</span>
              </div>
            </div>
          </div>

          {/* Bottom Footer Links */}
          <div className="you-footer-links">
            <button type="button" className="you-footer-link" onClick={onSignOut}>
              Sign out
            </button>
            <button type="button" className="you-footer-link" onClick={exportData}>
              Download data
            </button>
            <button type="button" className="you-footer-link danger" onClick={() => setShowDel(!showDel)}>
              Delete account
            </button>
          </div>

          {showDel && (
            <div style={{ marginTop: 20, padding: 16, border: '1px solid var(--line)', borderRadius: 12 }}>
              <p className="tiny muted" style={{ margin: '0 0 10px 0' }}>
                This removes your account permanently. Type DELETE to confirm:
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  className="sky-composer-input"
                  style={{ fontSize: 14, borderBottom: '1px solid var(--line-strong)', padding: '4px 0' }}
                  value={confirmDel}
                  onChange={(e) => setConfirmDel(e.target.value)}
                  placeholder="DELETE"
                  aria-label="Confirm DELETE"
                />
                <button
                  type="button"
                  className="btn danger sm"
                  disabled={confirmDel !== 'DELETE'}
                  onClick={del}
                >
                  Delete
                </button>
              </div>
              {err && <div className="err" style={{ marginTop: 6, fontSize: 12 }}>{err}</div>}
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}
