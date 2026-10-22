'use client';
import { useState } from 'react';
import { useUI, MOOD_COLORS } from '@/lib/sky/store';
import { useSky } from './ctx';
import { setSound, unlock } from '@/lib/sky/audio';
import { IcoSparkle, IcoIncognito, IcoX, IcoCheck, IcoAge, IcoGlobe, IcoRadar, IcoAlien } from './icons';
import Logo from '@/components/Logo';

const Ico = ({ d }: { d: string }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={d} /></svg>;
const ICONS = {
  sound: 'M11 5 6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13',
  mute: 'M11 5 6 9H3v6h3l5 4V5zM22 9l-6 6M16 9l6 6',
  gear: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  lantern: 'M9 3h6M10 3v2h4V3M7 8a5 5 0 0 1 10 0v6a5 5 0 0 1-10 0V8zM9 19v2h6v-2',
  people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  hop: 'M5 12h14M13 6l6 6-6 6',
  sky: 'M12 2l2.4 5.2 5.6.8-4 4 1 5.6-5-2.8-5 2.8 1-5.6-4-4 5.6-.8z',
};
export { Ico, ICONS };

export function TopBar() {
  const { ui, world } = useSky();
  const galaxy = useUI(ui, (s) => s.galaxy);
  const census = useUI(ui, (s) => s.census), sound = useUI(ui, (s) => s.sound), status = useUI(ui, (s) => s.status);
  const interestDrive = useUI(ui, (s) => s.interestDrive);
  const selectedInterest = useUI(ui, (s) => s.selectedInterest);
  const isIncognito = useUI(ui, (s) => s.isIncognito);
  const userCount = Math.max(1, (census.counts[galaxy] ?? census.total ?? 1));
  return (
    <header className="top" data-ui>
      <div className="row" style={{ gap: 8 }}>
        <button
          className="chip sky-realm-chip user-count-chip"
          onClick={() => ui.set({ panel: 'map' })}
          aria-label={`Users in sky: ${userCount}`}
          title="Users in sky"
        >
          <span className="chip-icon">
            <IcoAlien size={16} />
          </span>
          <span className="chip-count">{userCount}</span>
        </button>

        {/* Minimal Interest Sky Drive Toggle */}
        <button
          className={`interest-drive-chip${interestDrive ? ' active' : ''}`}
          onClick={() => world.toggleInterestDrive()}
          aria-label="Toggle Interest Sky Drive"
          title="Drive to Interest Sky: Steer towards lights with matching interests and draw constellation links"
        >
          <span className="chip-icon-sparkle"><IcoSparkle size={13} /></span>
          <span className="chip-label">{selectedInterest ? `#${selectedInterest}` : 'Interest'}</span>
          <span className={`chip-status-tag ${interestDrive ? 'on' : 'off'}`}>{interestDrive ? 'ON' : 'OFF'}</span>
        </button>

        {isIncognito && (
          <span className="top-incognito-badge" title="Ignoto / Incognito guest: Friends & save disabled">
            <IcoIncognito size={13} />
            <span className="incognito-label">Ignoto</span>
          </span>
        )}
      </div>

      <div className="row">
        <button className="icon" aria-label={sound ? 'Mute sound' : 'Turn sound on'} onClick={() => { const v = !sound; ui.set({ sound: v }); setSound(v); try { localStorage.setItem('sound', v ? '1' : '0'); } catch { /* ignore */ } if (v) unlock(); }}><Ico d={sound ? ICONS.sound : ICONS.mute} /></button>
        <button className="icon" aria-label="Settings" onClick={() => ui.set({ panel: 'settings' })}><Ico d={ICONS.gear} /></button>
      </div>
      {status !== 'live' && <div className="banner" role="status">{status === 'connecting' ? 'Reaching the sky…' : status === 'offline' ? 'Connection lost. Reconnecting…' : ''}</div>}
    </header>
  );
}

export function Announcement() {
  const { ui } = useSky();
  const text = useUI(ui, (s) => s.announcement);
  const [hide, setHide] = useState('');
  if (!text || hide === text) return null;
  return <div className="note" data-ui role="status"><span>{text}</span><button onClick={() => setHide(text)} aria-label="Dismiss"><IcoX size={14} /></button></div>;
}

export function Dock() {
  const { ui } = useSky();
  const thought = useUI(ui, (s) => s.thought), mood = useUI(ui, (s) => s.mood), drift = useUI(ui, (s) => s.lanternDrift);
  const bonds = useUI(ui, (s) => s.bonds), listMode = useUI(ui, (s) => s.listMode);
  const onlineBonds = bonds.filter((b) => b.online).length;
  return (
    <nav className="dock" data-ui aria-label="Actions">
      <button className="think" onClick={() => ui.set({ panel: 'thought' })}>
        <i className="dot" style={{ background: MOOD_COLORS[mood], boxShadow: `0 0 10px ${MOOD_COLORS[mood]}` }} />
        <span>{thought || 'What is on your mind?'}</span>
      </button>
      <button className={`icon big${drift ? ' glow' : ''}`} aria-label="Lanterns" onClick={() => ui.set({ panel: 'lanterns' })}><Ico d={ICONS.lantern} /></button>
      <button className="icon big" aria-label="Kept in touch" onClick={() => ui.set({ panel: 'bonds' })}><Ico d={ICONS.people} />{onlineBonds > 0 && <b className="badge">{onlineBonds}</b>}</button>
      <button
        className={`icon big${listMode ? ' active' : ''}`}
        aria-label={listMode ? 'Return to 3D Sky' : 'List view'}
        title={listMode ? 'Return to 3D Sky' : 'List view'}
        onClick={() => {
          const next = !listMode;
          ui.set({ listMode: next });
          try { localStorage.setItem('list', next ? '1' : '0'); } catch {}
        }}
      >
        <Ico d={listMode ? ICONS.sky : ICONS.list} />
      </button>
    </nav>
  );
}

export function Toast() {
  const { ui, world } = useSky();
  const t = useUI(ui, (s) => s.toast);
  if (!t) return null;

  const isPulse = typeof t === 'object' && t?.type === 'pulse';
  const message = typeof t === 'string' ? t : t.message;
  const pulseSid = typeof t === 'object' ? t.sid : undefined;
  
  let thought = typeof t === 'object' && t.thought ? t.thought : '';
  const title = typeof t === 'object' && t.title ? t.title : 'Stranger nearby';
  const subtitle = typeof t === 'object' && t.subtitle ? t.subtitle : 'Sent you a pulse';

  // Extract thought from subtitle if not explicitly present
  if (!thought && typeof t === 'object' && t.subtitle) {
    const match = t.subtitle.match(/“([^”]+)”/);
    if (match) thought = match[1];
  }

  const handleAccept = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pulseSid) {
      world.pulse(pulseSid);
    }
    ui.set({ toast: null });
  };

  const handleDecline = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pulseSid) {
      world.declinePulse(pulseSid);
    } else {
      ui.set({ toast: null });
    }
  };

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation();
    ui.set({ toast: null });
  };

  if (isPulse) {
    return (
      <div
        className="pulse-toast-banner"
        role="alertdialog"
        aria-label="Incoming pulse notification"
        data-ui
      >
        <div className="pulse-toast-content">
          <div className="pulse-toast-thought">
            {thought ? `“${thought}”` : 'Someone sent you a pulse'}
          </div>
          <div className="pulse-toast-stranger">
            {title || 'Stranger nearby'} {thought ? '· Sent you a pulse' : ''}
          </div>
        </div>

        <div className="pulse-toast-actions">
          <button
            type="button"
            className="pulse-toast-btn decline"
            onClick={handleDecline}
          >
            Decline
          </button>
          <button
            type="button"
            className="pulse-toast-btn accept"
            onClick={handleAccept}
          >
            Accept
          </button>
          <button
            type="button"
            className="pulse-toast-close"
            aria-label="Dismiss notification"
            title="Dismiss"
            onClick={handleClose}
          >
            <IcoX size={14} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className="toast"
      role="status"
      data-ui
      onClick={() => ui.set({ toast: null })}
      title="Click to dismiss"
    >
      <span className="toast-text">{message}</span>
      <button
        type="button"
        className="toast-close-btn"
        aria-label="Dismiss notification"
        title="Dismiss notification"
        onClick={handleClose}
      >
        <IcoX size={13} />
      </button>
    </div>
  );
}


export function IncomingCall() {
  const { ui, world } = useSky();
  const ring = useUI(ui, (s) => s.ring);
  if (!ring) return null;
  return (
    <div className="modal" data-ui role="dialog" aria-label="Incoming">
      <div className="sheet small center">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
          <Logo size={44} glow={true} />
        </div>
        <h2>{ring.name}</h2>
        <p className="muted">wants to talk</p>
        <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
          <button className="btn ghost" onClick={() => world.answerBond(ring.id, false)}>Not now</button>
          <button className="btn" onClick={() => world.answerBond(ring.id, true)}>Open a planet</button>
        </div>
      </div>
    </div>
  );
}

export function MeteorCard() {
  const { ui } = useSky();
  const q = useUI(ui, (s) => s.meteorPrompt);
  if (!q) return null;
  return (
    <div className="modal" data-ui role="dialog" aria-label="Shooting star">
      <div className="sheet small center">
        <p className="tiny">A shooting star asks</p>
        <h2 style={{ margin: '8px 0 16px' }}>{q}</h2>
        <div className="row" style={{ justifyContent: 'center' }}>
          <button className="btn ghost" onClick={() => ui.set({ meteorPrompt: null })}>Let it go</button>
          <button className="btn" onClick={() => ui.set({ panel: 'thought' })}>Answer as my thought</button>
        </div>
      </div>
    </div>
  );
}

export function Warp() {
  const { ui } = useSky();
  const n = useUI(ui, (s) => s.warp);
  return <div key={n} className="warp" aria-hidden />;
}
