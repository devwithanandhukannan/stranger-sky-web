'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import './sky.css';
import { createStore, initialUI, useUI } from '@/lib/sky/store';
import { WorldState } from '@/lib/sky/state';
import type { World } from '@/lib/sky/world';
import { NetWorld } from '@/lib/sky/net';
import { applyThemeCss, resolveTheme } from '@/lib/sky/themes';
import { setSound, unlock } from '@/lib/sky/audio';
import { Ctx, useSky, type SkyCtx } from './ctx';
import { Announcement, Dock, IncomingCall, MeteorCard, Toast, TopBar, Warp } from './Hud';
import { BondsSheet, LightSheet, MapSheet, ReportSheet, SettingsSheet, ThoughtSheet } from './Sheets';
import { PlanetSheet } from './Planet';
import { LanternSheet } from './Lanterns';
import { ListView } from './ListView';
import type { SkyEngine } from '@/lib/sky/engine';
import { IcoPin, IcoShield, IcoGlobe, IcoRadar, IcoShieldAlert, IcoX } from './icons';


const pref = (k: string, d: boolean) => { try { const v = localStorage.getItem(k); return v === null ? d : v === '1'; } catch { return d; } };
const hasWebGL = () => {
  try {
    if (typeof window === 'undefined') return true;
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl')));
  } catch {
    return false;
  }
};
const savedLoc = () => {
  try {
    const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('userLoc') : null;
    if (raw) {
      const p = JSON.parse(raw);
      if (typeof p?.lat === 'number' && typeof p?.lon === 'number') return p;
    }
  } catch { /* ignore */ }
  return null;
};

function NeighbourLocationPrompt() {
  const { ui, world } = useSky();
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const handleClose = () => {
    void world.travel('night');
  };

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const requestLocation = () => {
    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
      setErr('Geolocation is not supported by your browser.');
      return;
    }
    setLoading(true);
    setErr('');
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        setLoading(false);
        const ok = await world.setLocation(pos.coords.latitude, pos.coords.longitude);
        if (!ok) {
          setErr('Could not register location with server. Please try again.');
        }
      },
      (e) => {
        setLoading(false);
        if (e.code === e.PERMISSION_DENIED) {
          setErr('Location permission was denied. Please allow location access in your browser to discover nearby strangers.');
        } else if (e.code === e.POSITION_UNAVAILABLE) {
          setErr('Location information is unavailable. Please check your GPS/network settings.');
        } else if (e.code === e.TIMEOUT) {
          setErr('Request to get location timed out. Please try again.');
        } else {
          setErr('Unable to retrieve location. Please check browser permissions.');
        }
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
    );
  };

  return (
    <div
      className="location-prompt-overlay"
      data-ui
      role="dialog"
      aria-label="Location Permission Required"
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div className="location-prompt-card">
        <button
          type="button"
          className="location-prompt-close"
          onClick={handleClose}
          aria-label="Close"
          title="Close and return to One Sky"
        >
          <IcoX size={15} />
        </button>

        <div className="location-radar-wrap">
          <div className="location-radar-pulse" />
          <div className="location-radar-pulse outer" />
          <div className="location-radar-core"><IcoPin size={22} style={{ color: '#0071e3' }} /></div>
        </div>

        <h2 className="location-prompt-title">Discover Strangers Near You</h2>
        <p className="location-prompt-sub">
          The <strong>Neighbours</strong> galaxy connects you with wanderers within <strong>100 km</strong> in the physical world.
        </p>

        <div className="location-privacy-box">
          <div className="location-privacy-item">
            <span className="location-privacy-ico"><IcoShield size={17} style={{ color: '#ffffff' }} /></span>
            <div>
              <b>Zero Real-Time Tracking</b>
              <p className="tiny muted">Your exact coordinates are never shared with anyone.</p>
            </div>
          </div>
          <div className="location-privacy-item">
            <span className="location-privacy-ico"><IcoGlobe size={17} style={{ color: '#ffffff' }} /></span>
            <div>
              <b>Fuzzed Precision (~1.1 km)</b>
              <p className="tiny muted">Location is rounded for privacy. Others only see relative distance (e.g. <em>~14 km away</em>).</p>
            </div>
          </div>
          <div className="location-privacy-item">
            <span className="location-privacy-ico"><IcoRadar size={17} style={{ color: '#ffffff' }} /></span>
            <div>
              <b>Max 100 km Radius</b>
              <p className="tiny muted">Only people within 100 km who also enabled location will drift into your orbit.</p>
            </div>
          </div>
        </div>


        {err && <div className="err" style={{ marginBottom: 12, textAlign: 'center' }}>{err}</div>}

        <div className="location-prompt-actions">
          <button
            className="btn location-btn-primary"
            disabled={loading}
            onClick={requestLocation}
          >
            {loading ? 'Locating your position in orbit…' : <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}><IcoPin size={16} /> Enable Location (Within 100 km)</span>}
          </button>
          <button
            className="btn ghost location-btn-ghost"
            disabled={loading}
            onClick={() => ui.set({ panel: 'map' })}
          >
            Switch to Another Galaxy
          </button>
        </div>
      </div>
    </div>
  );
}

const initialSkyTheme = () => {
  try {
    if (typeof localStorage === 'undefined') return 'auto';
    const locked = localStorage.getItem('skyThemeLocked');
    const saved = localStorage.getItem('skyTheme');
    if (locked === 'true' && saved && ['auto', 'day', 'evening', 'midnight', 'white', 'dark'].includes(saved)) {
      return saved;
    }
  } catch {}
  return 'auto';
};

function BanScreen({
  banInfo,
  reason,
  onBackHome,
}: {
  banInfo: { bannedUntil?: number; reason?: string; displayReason?: string; message?: string } | null;
  reason: string;
  onBackHome: () => void;
}) {
  const [timeLeft, setTimeLeft] = useState(() => {
    const until = banInfo?.bannedUntil || Date.now() + 24 * 60 * 60 * 1000;
    return Math.max(0, Math.floor((until - Date.now()) / 1000));
  });

  useEffect(() => {
    const iv = setInterval(() => {
      const until = banInfo?.bannedUntil || Date.now() + 24 * 60 * 60 * 1000;
      const remaining = Math.max(0, Math.floor((until - Date.now()) / 1000));
      setTimeLeft(remaining);
    }, 1000);
    return () => clearInterval(iv);
  }, [banInfo]);

  const hours = Math.floor(timeLeft / 3600);
  const minutes = Math.floor((timeLeft % 3600) / 60);
  const seconds = timeLeft % 60;
  const timeFormatted = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const displayReason =
    banInfo?.displayReason ||
    banInfo?.message ||
    (reason === 'red_flag'
      ? 'Automated detection of prohibited terms or inappropriate solicitation'
      : 'Reported by other users for violating community guidelines');

  return (
    <div className="ban-page">
      <div className="ban-card">
        <div className="ban-badge">
          <IcoShieldAlert size={14} />
          <span>Immediate Ban</span>
          <span>·</span>
          <span>Zero Tolerance</span>
        </div>


        <h1 className="ban-title">You have been temporarily banned</h1>

        <p className="tiny muted" style={{ color: '#ffb3c1', margin: 0 }}>
          Your connection was immediately terminated.
        </p>

        <div className="ban-timer-box">
          <div className="ban-timer-label">Ban expires in</div>
          <div className="ban-countdown">{timeFormatted}</div>
        </div>

        <div style={{ background: 'rgba(0, 0, 0, 0.3)', borderRadius: 16, padding: '12px 16px', margin: '14px 0', textAlign: 'left' }}>
          <div className="tiny" style={{ color: '#ff9fb0', fontWeight: 650, marginBottom: 2 }}>Reason for suspension:</div>
          <div style={{ color: '#fff', fontSize: 13.5, lineHeight: 1.45 }}>{displayReason}</div>
        </div>

        <p className="ban-notice">
          Like Omegle and safe community apps, Lumen enforces an instant-ban policy for explicit content, harassment, prohibited words, or safety reports. You cannot reconnect until the timer runs out.
        </p>

        <div className="stack">
          <button className="btn" style={{ background: 'linear-gradient(135deg, #ff4b69 0%, #c81e46 100%)', color: '#fff' }} onClick={onBackHome}>
            Return to Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default function Sky({ getToken, onSignOut, onDeleted }: { getToken: () => Promise<string | null>; onSignOut: () => void; onDeleted: () => void }) {
  const router = useRouter();
  const [ui] = useState(() =>
    createStore({
      ...initialUI,
      sound: pref('sound', true),
      messageSound: pref('messageSound', true),
      messageTone: (typeof localStorage !== 'undefined' && localStorage.getItem('messageTone')) || 'pop',
      voiceReader: pref('voiceReader', false),
      haptics: pref('haptics', true),
      lite: pref('lite', false),
      listMode: pref('list', false) || !hasWebGL(),
      locationGranted: !!savedLoc(),
      userLocation: savedLoc(),
      skyTheme: initialSkyTheme(),
    })
  );
  const [state] = useState(() => new WorldState());
  const [world] = useState<World>(() => new NetWorld(state, ui));
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const status = useUI(ui, (s) => s.status);
  const denied = useUI(ui, (s) => s.denied);
  const banInfo = useUI(ui, (s) => s.banInfo);
  const panel = useUI(ui, (s) => s.panel);
  const planet = useUI(ui, (s) => !!s.planet);
  const listMode = useUI(ui, (s) => s.listMode);
  const lite = useUI(ui, (s) => s.lite || s.quality === 'low');
  const skyTheme = useUI(ui, (s) => s.skyTheme);
  const toast = useUI(ui, (s) => s.toast);
  const hasLight = useUI(ui, (s) => !!s.selected);
  const galaxy = useUI(ui, (s) => s.galaxy);
  const locationGranted = useUI(ui, (s) => s.locationGranted);

  const [activeTheme, setActiveTheme] = useState(() => resolveTheme(ui.get().skyTheme));

  // preferences + world lifecycle
  useEffect(() => {
    setSound(pref('sound', true));
    void world.start();
    const first = () => unlock();
    window.addEventListener('pointerdown', first, { once: true });
    return () => {
      world.stop();
      window.removeEventListener('pointerdown', first);
    };
  }, [world]);

  // theme lifecycle & clock synchronization for auto mode
  useEffect(() => {
    const update = () => {
      const resolved = resolveTheme(skyTheme);
      setActiveTheme(resolved);
      applyThemeCss(resolved);
    };
    update();
    const iv = setInterval(update, 20_000);
    return () => clearInterval(iv);
  }, [skyTheme]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => ui.set({ toast: null }), 3600); return () => clearTimeout(t); }, [toast, ui]);
  useEffect(() => {
    if (status === 'denied') { if (denied === 'email_not_verified') router.replace('/login'); else if (denied === 'no_profile') router.replace('/welcome'); }
  }, [status, denied, router]);

  // the Three.js engine is loaded on demand and only runs when the sky is visible
  useEffect(() => {
    if (listMode || !hostRef.current || !canvasRef.current) return;
    let engine: SkyEngine | null = null, dead = false;
    (async () => {
      const { SkyEngine } = await import('@/lib/sky/engine');
      if (dead || !hostRef.current || !canvasRef.current) return;
      try { engine = new SkyEngine(canvasRef.current, hostRef.current, state, ui, world); engine.start(); }
      catch { ui.set({ listMode: true, toast: 'Could not start the sky on this device. Showing the list view.' }); }
    })();
    return () => { dead = true; engine?.dispose(); };
  }, [listMode, state, ui, world]);

  const ctx: SkyCtx = { ui, world, state, getToken, onSignOut, onDeleted };

  const isBanned =
    (status === 'kicked' && (denied === 'banned' || denied === 'red_flag' || denied === 'account_banned' || denied === 'account_suspended')) ||
    (status === 'denied' && (denied === 'account_banned' || denied === 'account_suspended'));

  if (isBanned) {
    return <BanScreen banInfo={banInfo} reason={denied} onBackHome={() => router.replace('/')} />;
  }

  if (status === 'kicked' || status === 'full' || (status === 'denied' && denied.startsWith('account_'))) {
    return (
      <div className="page"><div className="card center">
        <div className="logo" />
        <h1>{status === 'full' ? 'The sky is full' : status === 'kicked' && denied === 'other_session' ? 'Opened somewhere else' : 'You are not in the sky'}</h1>
        <p className="muted">{status === 'full' ? 'Every galaxy is at capacity right now. Please try again in a little while.' : status === 'kicked' && denied === 'other_session' ? 'Lumen is open in another tab or device. Only one at a time.' : 'Your session ended.'}</p>
        <div className="stack"><button className="btn" onClick={() => location.reload()}>Try again</button></div>
      </div></div>
    );
  }

  return (
    <Ctx.Provider value={ctx}>
      <div className={`sky-root${lite ? ' lite' : ''}`} data-theme={activeTheme.mode}>
        {!listMode && <div ref={hostRef} className="stage"><canvas ref={canvasRef} aria-label="Night sky of lights. Use the list view for a text version." /></div>}
        {listMode && <ListView />}
        <TopBar />
        <Announcement />
        <Warp />
        {!listMode && !hasLight && !planet && <p className="hint" aria-hidden>Drag to drift · tap a light to read it</p>}
        <LightSheet />
        <Dock />
        {panel === 'thought' && <ThoughtSheet />}
        {panel === 'lanterns' && <LanternSheet />}
        {panel === 'bonds' && <BondsSheet />}
        {panel === 'map' && <MapSheet />}
        {panel === 'settings' && <SettingsSheet />}
        {panel === 'report' && <ReportSheet />}
        {planet && <PlanetSheet />}
        <IncomingCall />
        <MeteorCard />
        <Toast />
        {galaxy === 'neighbours' && !locationGranted && <NeighbourLocationPrompt />}
      </div>
    </Ctx.Provider>
  );
}
