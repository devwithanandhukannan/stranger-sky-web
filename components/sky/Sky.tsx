'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import './sky.css';
import { createStore, initialUI, useUI } from '@/lib/sky/store';
import { WorldState } from '@/lib/sky/state';
import type { World } from '@/lib/sky/world';
import { NetWorld } from '@/lib/sky/net';
import { applyThemeCss, resetThemeCss, resolveTheme } from '@/lib/sky/themes';
import { setSound, unlock } from '@/lib/sky/audio';
import { Ctx, type SkyCtx } from './ctx';
import { Announcement, IncomingCall, SelectedLightThought, SkyComposer, SkyHeader, SkyHints, Toast, Warp } from './Hud';
import { BondsSheet, ReportSheet, SettingsSheet } from './Sheets';
import { LanternsSheet } from './Lanterns';
import { PlanetSheet } from './Planet';
import { SkyEngine } from '@/lib/sky/engine';
import { IcoShieldAlert } from './icons';
import Logo from '@/components/Logo';


const pref = (k: string, d: boolean) => { try { const v = localStorage.getItem(k); return v === null ? d : v === '1'; } catch { return d; } };
const hasWebGL = () => {
  try {
    if (typeof window === 'undefined') return true;
    const c = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (c.getContext('webgl2') || c.getContext('webgl') || c.getContext('experimental-webgl'))
    );
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

const initialSkyTheme = () => {
  try {
    const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('skyTheme') : null;
    if (saved && ['auto', 'day', 'midnight'].includes(saved)) return saved;
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
          To maintain a safe and respectful sanctuary, Untold enforces a strict zero-tolerance instant-suspension policy for explicit content, harassment, prohibited words, or safety reports. You cannot reconnect until the timer runs out.
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

export default function Sky({ getToken, onSignOut, onDeleted }: { getToken: (force?: boolean) => Promise<string | null>; onSignOut: () => void; onDeleted: () => void }) {
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
      listMode: pref('list', false),
      locationGranted: !!savedLoc(),
      userLocation: savedLoc(),
      skyTheme: initialSkyTheme(),
      thought: (typeof localStorage !== 'undefined' && localStorage.getItem('userThought')) || '',
    })
  );
  const [state] = useState(() => new WorldState());
  const [world] = useState<World>(() => new NetWorld(state, ui));
  const hostRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<SkyEngine | null>(null);

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
  const census = useUI(ui, (s) => s.census);

  const [activeTheme, setActiveTheme] = useState(() => resolveTheme(ui.get().skyTheme));
  const userCount = Math.max(1, (census.counts[galaxy] ?? census.total ?? 1));
  const prevCountRef = useRef<number | null>(null);

  useEffect(() => {
    if (status !== 'live') return;
    if (prevCountRef.current !== null && prevCountRef.current !== userCount) {
      if (userCount === 1 && prevCountRef.current > 1) {
        ui.set({ toast: 'No one in space right now' });
      } else if (userCount > 1 && prevCountRef.current === 1) {
        ui.set({ toast: 'A wanderer entered the sky' });
      }
    }
    prevCountRef.current = userCount;
  }, [userCount, status, ui]);

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
    return () => {
      clearInterval(iv);
      resetThemeCss();
    };
  }, [skyTheme]);
  useEffect(() => {
    if (!toast) return;
    const isPulse = typeof toast === 'object' && toast?.type === 'pulse';
    const duration = isPulse ? 12000 : 3600;
    const t = setTimeout(() => ui.set({ toast: null }), duration);
    return () => clearTimeout(t);
  }, [toast, ui]);
  useEffect(() => {
    if (status === 'denied') { if (denied === 'email_not_verified') router.replace('/login'); else if (denied === 'no_profile') router.replace('/welcome'); }
  }, [status, denied, router]);

  // the Three.js engine is initialized directly with zero network delay
  useEffect(() => {
    if (!hostRef.current || !canvasRef.current) return;
    try {
      const engine = new SkyEngine(canvasRef.current, hostRef.current, state, ui, world);
      engineRef.current = engine;
      if (!ui.get().listMode) {
        engine.start();
      }
    } catch (err) {
      console.warn('Could not start sky engine:', err);
    }
    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, [state, ui, world]);

  // Pause or resume rendering when switching between sky and list view
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) return;
    if (listMode) {
      engine.stop();
    } else {
      engine.start();
      engine.resize();
    }
  }, [listMode]);

  // Global keyboard listeners: Escape to close panels or clear selection
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (ui.get().panel) {
          ui.set({ panel: null });
        } else if (ui.get().selected) {
          ui.set({ selected: null });
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [ui]);

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
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
          <Logo size={48} glow={true} />
        </div>
        <h1>{status === 'full' ? 'The sky is full' : status === 'kicked' && denied === 'other_session' ? 'Opened somewhere else' : 'You are not in the sky'}</h1>
        <p className="muted">{status === 'full' ? 'Every galaxy is at capacity right now. Please try again in a little while.' : status === 'kicked' && denied === 'other_session' ? 'Untold is open in another tab or device. Only one at a time.' : 'Your session ended.'}</p>
        <div className="stack"><button className="btn" onClick={() => location.reload()}>Try again</button></div>
      </div></div>
    );
  }


  return (
    <Ctx.Provider value={ctx}>
      <div className={`sky-root${lite ? ' lite' : ''}`} data-theme={activeTheme.mode}>
        <div ref={hostRef} className="stage">
          <canvas ref={canvasRef} aria-label="Night sky of wanderers" />
        </div>

        {/* 1. Sky Header (Wordmark Untold, Incognito switch, Chats, You) */}
        <SkyHeader />

        <Announcement />
        <Warp />

        {/* 2. Selected Light Thought (Lower-left large thought + Say hello / Report / Close) */}
        <SelectedLightThought />

        {/* 3. Bottom One-line Composer + Mood Choices while typing */}
        <SkyComposer />

        {/* 4. Lower-right Hints */}
        <SkyHints />

        {/* Panels / Drawers */}
        {(panel === 'chats' || panel === 'bonds') && <BondsSheet />}
        {(panel === 'you' || panel === 'settings') && <SettingsSheet />}
        {panel === 'lanterns' && <LanternsSheet />}
        {panel === 'report' && <ReportSheet />}
        {planet && <PlanetSheet />}
        <IncomingCall />
        <Toast />
      </div>
    </Ctx.Provider>
  );
}
