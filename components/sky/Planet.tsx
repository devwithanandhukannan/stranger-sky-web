'use client';
import { useEffect, useRef, useState } from 'react';
import { useUI, MOOD_COLORS, MOOD_NAMES } from '@/lib/sky/store';
import { useSky } from './ctx';
import { ReportForm } from './Sheets';
import { IcoPin, IcoBond, IcoIncognito, IcoSparkle, IcoLock, IcoShieldAlert, IcoX } from './icons';


export function PlanetSheet() {
  const { ui, world } = useSky();
  const p = useUI(ui, (s) => s.planet);
  const [text, setText] = useState(''), [err, setErr] = useState(''), [menu, setMenu] = useState<'' | 'report'>('');
  const sound = useUI(ui, (s) => s.sound);
  const messageSound = useUI(ui, (s) => s.messageSound);
  const isIncognito = useUI(ui, (s) => s.isIncognito);
  const bodyRef = useRef<HTMLDivElement>(null);
  const lastTyping = useRef(0);
  const minimized = useUI(ui, (s) => s.planetMinimized);
  const n = p?.msgs.length ?? 0;

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTo({
        top: bodyRef.current.scrollHeight,
        behavior: n > 1 ? 'smooth' : 'auto',
      });
    }
  }, [n, p?.typing]);

  if (!p) return null;
  const moodName = MOOD_NAMES[p.m] || 'quiet';
  const color = MOOD_COLORS[p.m] || '#7aa2ff';

  const send = async () => {
    const t = text.trim();
    if (!t || p.ended) return;
    setText('');
    setErr('');
    setTimeout(() => {
      if (bodyRef.current) {
        bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
      }
    }, 20);
    const e = await world.send(t);
    if (e) {
      setText(t);
      setErr(e === 'not_allowed' ? 'Links and blocked words are not allowed.' : e === 'slow_down' ? 'Slow down a little.' : 'Could not send.');
    }
  };

  const close = () => {
    world.leave();
    setMenu('');
  };

  const fmtTime = (ts?: number) => {
    if (!ts) return '';
    try {
      const d = new Date(ts);
      let hours = d.getHours();
      const minutes = d.getMinutes();
      const ampm = hours >= 12 ? 'pm' : 'am';
      hours = hours % 12;
      hours = hours ? hours : 12;
      const mStr = minutes < 10 ? `0${minutes}` : `${minutes}`;
      return `${hours}:${mStr} ${ampm}`;
    } catch {
      return '';
    }
  };

  if (minimized) {
    return (
      <div className="planet-docked-pill" data-ui role="status" aria-label="Connected peer in sky">
        <div className="planet-docked-orb" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
        <span className="planet-docked-name">{p.known && p.with ? p.with.name : 'A stranger'}</span>
        <span className="planet-docked-status">· Connected in sky</span>
        <button
          type="button"
          className="planet-docked-btn"
          onClick={() => ui.set({ planetMinimized: false })}
        >
          Open chat {n > 0 ? `(${n})` : ''}
        </button>
        <button
          type="button"
          className="planet-docked-close"
          onClick={close}
          title="Leave connection"
          aria-label="Leave connection"
        >
          <IcoX size={12} />
        </button>
      </div>
    );
  }

  return (
    <div className="planet-overlay" data-ui role="dialog" aria-label="Planet chat" style={{ ['--c' as string]: color }}>
      <div className="planet-glow" aria-hidden />
      <div className="planet">
        <header className="planet-h">
          <div className="planet-avatar">
            <div className="orb-planet" style={{ ['--c' as string]: color }} />
            <span className="planet-live-ring" />
          </div>
          <div className="planet-meta">
            <div className="planet-title-row">
              <b className="planet-name">{p.known && p.with ? p.with.name : 'A stranger'}</b>
              {isIncognito && (
                <span className="top-incognito-badge" style={{ fontSize: 11, padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <IcoIncognito size={11} /> Ignoto
                </span>
              )}
              <span className="planet-mood-tag" style={{ color, borderColor: `${color}45`, background: `${color}18` }}>
                {moodName}
              </span>
              {typeof p.distKm === 'number' && (
                <span className="planet-dist-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <IcoPin size={11} /> ~{p.distKm} km away
                </span>
              )}
            </div>
            <div className="planet-thought ellipsis">
              {p.typing ? (
                <span className="planet-typing-indicator" style={{ color: 'var(--accent)', fontWeight: 500 }}>typing…</span>
              ) : p.t ? (
                `“${p.t}”`
              ) : (
                'A quiet wandering soul'
              )}
            </div>
          </div>
          <div className="planet-actions">
            <button
              type="button"
              className="planet-btn-icon"
              onClick={() => ui.set({ planetMinimized: true })}
              title="View sky & thread"
              aria-label="Minimize to sky view"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/></svg>
            </button>
            <button
              type="button"
              className="planet-btn-icon"
              onClick={() => {
                const next = !messageSound;
                ui.set({ messageSound: next });
                try { localStorage.setItem('messageSound', next ? '1' : '0'); } catch { /* ignore */ }
              }}
              title={messageSound && sound ? 'Mute message sound' : 'Unmute message sound'}
              aria-label={messageSound && sound ? 'Mute message sound' : 'Unmute message sound'}
            >
              {messageSound && sound ? (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>
              ) : (
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ opacity: 0.6 }}><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>
              )}
            </button>
            <button
              type="button"
              className="planet-btn-icon"
              onClick={() => setMenu(menu ? '' : 'report')}
              title="Report user"
              aria-label="Report user"
            >
              <IcoShieldAlert size={15} />
            </button>
            <button
              type="button"
              className="planet-btn-leave"
              onClick={close}
              title={p.ended ? 'Close planet' : 'Leave planet'}
              aria-label={p.ended ? 'Close planet' : 'Leave planet'}
            >
              <IcoX size={13} />
              <span>{p.ended ? 'Close' : 'Leave'}</span>
            </button>
          </div>
        </header>

        {menu === 'report' ? (
          <div className="planet-body" ref={bodyRef}>
            <ReportForm onCancel={() => setMenu('')} onSubmit={async (r, d) => { await world.report(p.sid, r, d); setMenu(''); }} />
          </div>
        ) : (
          <>
            <div className="planet-body" ref={bodyRef} aria-live="polite">
              {isIncognito ? (
                <div className="planet-privacy-pill" style={{ background: 'rgba(255, 255, 255, 0.08)', color: '#ffffff', borderColor: 'rgba(255, 255, 255, 0.08)' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <span>Ignoto Mode · Ephemeral chat. Making friends and saving data is disabled.</span>
                </div>
              ) : (

                <div className="planet-privacy-pill">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                  <span>Private planet · Messages fade into the cosmos when you leave</span>
                </div>
              )}

              {p.msgs.map((m, i) => (
                <div key={m.ts ? `${m.ts}-${i}` : i} className={`bub-row${m.mine ? ' me' : ''}`}>
                  <div className={`bub${m.mine ? ' me' : ''}`}>
                    <div className="bub-content-row">
                      <p className="bub-text">{m.t}</p>
                      <div className="bub-meta">
                        {m.ts ? <span className="bub-time">{fmtTime(m.ts)}</span> : null}
                        {m.mine && (
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="bub-check" aria-hidden="true">
                            <polyline points="18 6 9 16 4 11" />
                          </svg>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {p.typing && (
                <div className="bub-row">
                  <div className="bub typing">
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                    <span className="typing-dot" />
                  </div>
                </div>
              )}

              {p.ended && (
                <div className="planet-ended-notice">
                  <span className="ended-icon" style={{ display: 'inline-flex', alignItems: 'center' }}><IcoSparkle size={14} /></span>
                  <p>{p.ended === 'blocked' ? 'This planet has closed.' : 'This planet has gently drifted away into the night sky.'}</p>
                </div>
              )}
            </div>

            {!p.ended && (
              <footer className="planet-f">
                <div className="planet-quick-actions">
                  {isIncognito ? (
                    <button
                      className="planet-chip-btn keep"
                      disabled
                      title="Ignoto / Incognito mode: Making friends and saving bonds is disabled"
                      style={{ opacity: 0.6, cursor: 'not-allowed' }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <IcoLock size={12} />
                        Friends disabled (Ignoto)
                      </span>
                    </button>
                  ) : (
                    <button
                      className={`planet-chip-btn keep${p.kept ? ' waiting' : ''}${p.known ? ' bonded' : ''}`}
                      disabled={p.kept || p.known}
                      onClick={() => world.keep()}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <IcoBond size={13} />
                        {p.known ? 'Kept in touch' : p.kept ? 'Waiting for them…' : 'Keep in touch'}
                      </span>
                    </button>
                  )}
                </div>

                <div className="planet-input-bar">
                  <input
                    className="planet-input"
                    value={text}
                    maxLength={400}
                    placeholder="Say something kind to this stranger…"
                    aria-label="Message"
                    onFocus={() => {
                      if (typeof window !== 'undefined') window.scrollTo(0, 0);
                      setTimeout(() => {
                        if (bodyRef.current) {
                          bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
                        }
                        if (typeof window !== 'undefined') window.scrollTo(0, 0);
                      }, 100);
                    }}
                    onChange={(e) => {
                      setText(e.target.value);
                      const now = Date.now();
                      if (now - lastTyping.current > 2000) {
                        lastTyping.current = now;
                        world.typing();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void send();
                    }}
                  />
                  <button
                    className="planet-send-btn"
                    onClick={send}
                    disabled={!text.trim()}
                    aria-label="Send message"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z" />
                    </svg>
                  </button>
                </div>

                {err && <div className="planet-err">{err}</div>}
              </footer>
            )}
          </>
        )}
      </div>
    </div>
  );
}
