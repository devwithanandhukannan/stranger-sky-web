'use client';
import { useState, useEffect } from 'react';
import { useUI, MOOD_COLORS, MOOD_NAMES, type NearItem, F_ECHO } from '@/lib/sky/store';
import { useSky } from './ctx';
import { IcoX } from './icons';

const MOOD_OPTIONS = [
  { id: 0, name: 'calm', color: '#4ade80' },
  { id: 1, name: 'warm', color: '#fbbf24' },
  { id: 2, name: 'hopeful', color: '#38bdf8' },
  { id: 3, name: 'curious', color: '#818cf8' },
];

/**
 * 1. Sky Header: Wordmark Untold, Incognito Switch, Chats, You
 */
export function SkyHeader() {
  const { ui, state, world } = useSky();
  const isIncognito = useUI(ui, (s) => s.isIncognito);
  const lanternDrift = useUI(ui, (s) => s.lanternDrift);
  const bonds = useUI(ui, (s) => s.bonds);
  const incoming = useUI(ui, (s) => s.incoming);
  const activeChatCount = bonds.filter((b) => b.online).length + incoming.length;

  const toggleIncognito = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isIncognito) return;
    ui.set({ isIncognito: true });
    if (state.you) state.you.isIncognito = true;
    try {
      sessionStorage.setItem('lumen_incognito', JSON.stringify({ isIncognito: true, alias: 'Drifting Stranger' }));
      ui.set({ toast: 'Incognito enabled · Disguised in the sky' });
    } catch {}
    void world.setIncognito(true);
  };

  return (
    <header className="sky-header" data-ui>
      <div className="sky-header-left">
        <h1 className="sky-brand-title">Untold</h1>
      </div>

      <div className="sky-header-right">
        {!isIncognito && (
          <label
            className="sky-incognito-wrap"
            title="Incognito mode: Disguise presence in the sky"
          >
            <span className="sky-incognito-label">Incognito</span>
            <input
              type="checkbox"
              className="sky-switch-input"
              checked={false}
              onChange={toggleIncognito}
              aria-label="Toggle Incognito"
            />
            <span className="sky-switch-track">
              <span className="sky-switch-thumb" />
            </span>
          </label>
        )}

        <button
          type="button"
          className="sky-nav-btn"
          onClick={() => ui.set({ panel: 'lanterns' })}
          aria-label="Open Lanterns"
        >
          <span>Lanterns</span>
          {lanternDrift && <span className="sky-nav-badge lantern-badge" />}
        </button>

        <button
          type="button"
          className="sky-nav-btn"
          onClick={() => ui.set({ panel: 'chats' })}
          aria-label="Open Chats"
        >
          <span>Chats</span>
          {activeChatCount > 0 && <span className="sky-nav-badge" />}
        </button>

        <button
          type="button"
          className="sky-nav-btn"
          onClick={() => ui.set({ panel: 'you' })}
          aria-label="Open You Settings"
        >
          <span>You</span>
        </button>
      </div>
    </header>
  );
}

/**
 * 2. Selected Light Thought (Lower Left)
 * Displays large stranger thought with Say hello / Report / Close
 */
export function SelectedLightThought() {
  const { ui, world } = useSky();
  const sid = useUI(ui, (s) => s.selected);
  const near = useUI(ui, (s) => s.near);
  const incoming = useUI(ui, (s) => s.incoming);
  const [peekItem, setPeekItem] = useState<NearItem | null>(null);

  useEffect(() => {
    if (!sid) {
      setPeekItem(null);
      return;
    }
    const alreadyNear = near.find((x) => x.sid === sid);
    if (alreadyNear) {
      setPeekItem(alreadyNear);
    } else {
      let active = true;
      void world.peek(sid).then((item) => {
        if (active && item) setPeekItem(item);
      });
      return () => {
        active = false;
      };
    }
  }, [sid, near, world]);

  if (!sid) return null;
  const n = peekItem || near.find((x) => x.sid === sid);
  const pulsed = incoming.includes(sid);
  const thoughtText = n?.t || 'Quiet. No thought shared.';
  const isEcho = n && (n.f & F_ECHO);

  return (
    <div className="sky-selected-card" data-ui aria-label="Selected thought">
      <h2 className="sky-selected-thought">{thoughtText}</h2>

      <div className="sky-selected-actions">
        <button
          type="button"
          className="sky-btn-say-hello"
          disabled={!n && !pulsed}
          onClick={() => world.pulse(sid)}
        >
          {pulsed ? 'Pulse back' : 'Say hello'}
        </button>

        {!isEcho && (
          <button
            type="button"
            className="sky-btn-link"
            onClick={() => ui.set({ panel: 'report', reportSid: sid })}
          >
            Report
          </button>
        )}

        <button
          type="button"
          className="sky-btn-link"
          onClick={() => ui.set({ selected: null })}
        >
          Close
        </button>
      </div>
    </div>
  );
}

/**
 * 3. One-line composer at the bottom with mood choices shown only while typing
 */
export function SkyComposer() {
  const { ui, world, state } = useSky();
  const currentMood = useUI(ui, (s) => s.mood);

  const [text, setText] = useState('');
  const [mood, setMood] = useState(Math.min(currentMood, 3));
  const [isFocused, setIsFocused] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  useEffect(() => {
    setMood(Math.min(currentMood, 3));
  }, [currentMood]);

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const val = text.trim();
    if (!val || isBusy) return;
    setIsBusy(true);
    try {
      const err = await world.thought(val, mood);
      if (err && err !== 'offline') {
        ui.set({ toast: err === 'slow_down' ? 'Please slow down a moment' : 'Could not release thought. Please try again.' });
      } else {
        ui.set({ thought: val, mood, toast: 'Thought released into the sky' });
        if (state.you) {
          state.you.t = val;
          state.you.m = mood;
        }
        setText('');
        try {
          localStorage.setItem('userThought', val);
          localStorage.setItem('userMood', String(mood));
        } catch {}
      }
      setIsFocused(false);
    } catch {
      ui.set({ toast: 'Could not release thought. Please try again.' });
    } finally {
      setIsBusy(false);
    }
  };

  const showMoods = isFocused || text.length > 0;
  const activeMoodColor = MOOD_OPTIONS[mood]?.color || '#4ade80';

  return (
    <div className="sky-composer-container" data-ui>
      <form className="sky-composer-form" onSubmit={handleSubmit}>
        <div className="sky-composer-line">
          <span
            className="sky-composer-dot"
            style={{ background: activeMoodColor, boxShadow: `0 0 10px ${activeMoodColor}66` }}
            title={`Active mood: ${MOOD_OPTIONS[mood]?.name || 'calm'}`}
          />
          <input
            type="text"
            className="sky-composer-input"
            placeholder="What is on your mind?"
            value={text}
            maxLength={120}
            onChange={(e) => setText(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => {
              if (!text.trim()) setIsFocused(false);
            }}
          />
          <button
            type="submit"
            className={`sky-btn-release${text.trim() ? ' active' : ''}`}
            disabled={!text.trim() || isBusy}
          >
            {isBusy ? '...' : 'Release'}
          </button>
        </div>

        {/* Mood choices shown only while typing / focused */}
        {showMoods && (
          <div className="sky-mood-row" role="radiogroup" aria-label="Select mood">
            {MOOD_OPTIONS.map((m) => {
              const selected = mood === m.id;
              return (
                <button
                  key={m.id}
                  type="button"
                  className={`sky-mood-opt${selected ? ' selected' : ''}`}
                  onClick={() => setMood(m.id)}
                  role="radio"
                  aria-checked={selected}
                >
                  <span className="sky-mood-dot" style={{ background: m.color }} />
                  <span className="sky-mood-name">{m.name}</span>
                </button>
              );
            })}
          </div>
        )}
      </form>
    </div>
  );
}

/**
 * 4. Lower-right Sky Hints
 */
export function SkyHints() {
  const { ui } = useSky();
  const selected = useUI(ui, (s) => !!s.selected);
  const planet = useUI(ui, (s) => !!s.planet);
  if (selected || planet) return null;

  return (
    <div className="sky-hints" aria-hidden="true">
      <div>Drag to drift.</div>
      <div>Tap a light to read it.</div>
    </div>
  );
}

/**
 * Toast Notifications
 */
export function Toast() {
  const { ui, world } = useSky();
  const t = useUI(ui, (s) => s.toast);
  if (!t) return null;

  const isPulse = typeof t === 'object' && t?.type === 'pulse';
  const message = typeof t === 'string' ? t : t.message;
  const pulseSid = typeof t === 'object' ? t.sid : undefined;
  let thought = typeof t === 'object' && t.thought ? t.thought : '';
  const title = typeof t === 'object' && t.title ? t.title : 'Stranger nearby';

  if (!thought && typeof t === 'object' && t.subtitle) {
    const match = t.subtitle.match(/“([^”]+)”/);
    if (match) thought = match[1];
  }

  const handleAccept = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pulseSid) world.pulse(pulseSid);
    ui.set({ toast: null });
  };

  const handleDecline = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (pulseSid) world.declinePulse(pulseSid);
    ui.set({ toast: null });
  };

  if (isPulse) {
    return (
      <div className="pulse-toast-banner" role="alertdialog" data-ui>
        <div className="pulse-toast-content">
          <div className="pulse-toast-thought">{thought ? `“${thought}”` : 'Someone sent you a pulse'}</div>
          <div className="pulse-toast-stranger">{title} · Sent you a pulse</div>
        </div>
        <div className="pulse-toast-actions">
          <button type="button" className="pulse-toast-btn decline" onClick={handleDecline}>Decline</button>
          <button type="button" className="pulse-toast-btn accept" onClick={handleAccept}>Accept</button>
          <button type="button" className="pulse-toast-close" onClick={() => ui.set({ toast: null })}><IcoX size={14} /></button>
        </div>
      </div>
    );
  }

  return (
    <div className="toast" role="status" data-ui onClick={() => ui.set({ toast: null })}>
      <span className="toast-text">{message}</span>
      <button type="button" className="toast-close-btn" onClick={() => ui.set({ toast: null })}>
        <IcoX size={13} />
      </button>
    </div>
  );
}

export function Announcement() {
  const { ui } = useSky();
  const text = useUI(ui, (s) => s.announcement);
  const [hide, setHide] = useState('');
  if (!text || hide === text) return null;
  return (
    <div className="note" data-ui role="status">
      <span>{text}</span>
      <button onClick={() => setHide(text)} aria-label="Dismiss"><IcoX size={14} /></button>
    </div>
  );
}

export function IncomingCall() {
  const { ui, world } = useSky();
  const ring = useUI(ui, (s) => s.ring);
  if (!ring) return null;
  return (
    <div className="modal" data-ui role="dialog" aria-label="Incoming connection">
      <div className="sheet small center">
        <h2>{ring.name}</h2>
        <p className="muted">wants to talk</p>
        <div className="row" style={{ justifyContent: 'center', marginTop: 14 }}>
          <button className="btn ghost" onClick={() => world.answerBond(ring.id, false)}>Not now</button>
          <button className="btn" onClick={() => world.answerBond(ring.id, true)}>Accept</button>
        </div>
      </div>
    </div>
  );
}

export function MeteorCard() {
  return null;
}

export function Warp() {
  const { ui } = useSky();
  const n = useUI(ui, (s) => s.warp);
  return <div key={n} className="warp" aria-hidden />;
}

// Backward compatibility aliases
export const TopBar = SkyHeader;
export const Dock = SkyComposer;
