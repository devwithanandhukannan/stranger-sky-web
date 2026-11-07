'use client';
import { useEffect, useRef, useState } from 'react';
import { useUI } from '@/lib/sky/store';
import { useSky } from './ctx';
import { ReportForm } from './Sheets';
import { IcoVolume, IcoVolumeMute } from './icons';

export function PlanetSheet() {
  const { ui, world } = useSky();
  const p = useUI(ui, (s) => s.planet);
  const [text, setText] = useState('');
  const [err, setErr] = useState('');
  const [menu, setMenu] = useState<'' | 'report'>('');
  const isIncognito = useUI(ui, (s) => s.isIncognito);
  const voiceReader = useUI(ui, (s) => s.voiceReader);
  const bodyRef = useRef<HTMLDivElement>(null);
  const lastTyping = useRef(0);
  const n = p?.msgs.length ?? 0;

  useEffect(() => {
    return () => {
      if (typeof window !== 'undefined' && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTo({
        top: bodyRef.current.scrollHeight,
        behavior: n > 1 ? 'smooth' : 'auto',
      });
    }
  }, [n, p?.typing]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        world.leave();
        setMenu('');
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [world]);

  if (!p) return null;

  const strangerName = p.known && p.with ? p.with.name : 'Stranger';

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
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    world.leave();
    setMenu('');
  };

  const toggleVoice = () => {
    const next = !voiceReader;
    ui.set({ voiceReader: next });
    try {
      localStorage.setItem('voiceReader', next ? '1' : '0');
    } catch {}
    if (!next && typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    ui.set({ toast: next ? 'Voice over enabled' : 'Voice over turned off' });
  };

  const handleBlock = async () => {
    if (p.sid) {
      await world.report(p.sid, 'block', '');
    }
    close();
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

  return (
    <div
      className="sky-drawer-backdrop"
      data-ui
      role="dialog"
      aria-label="Conversation"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <aside className="sky-drawer chat-drawer">
        {/* Header: Stranger name + Voice Over toggle + Block and Leave */}
        <header className="sky-drawer-header">
          <h2 className="sky-drawer-title">{strangerName}</h2>
          <div className="chat-header-actions">
            <button
              type="button"
              className={`chat-header-btn chat-voice-btn${voiceReader ? ' on' : ''}`}
              onClick={toggleVoice}
              title={voiceReader ? 'Voice over is on. Tap to turn off.' : 'Voice over is off. Tap to turn on.'}
              aria-label={voiceReader ? 'Turn off voice over' : 'Turn on voice over'}
            >
              {voiceReader ? <IcoVolume size={14} /> : <IcoVolumeMute size={14} />}
              <span>{voiceReader ? 'Voice on' : 'Voice off'}</span>
            </button>
            <button
              type="button"
              className="chat-header-btn danger"
              onClick={handleBlock}
              title="Block this stranger"
              aria-label="Block this stranger"
            >
              Block
            </button>
            <button
              type="button"
              className="chat-header-btn"
              onClick={close}
              title="Leave conversation"
              aria-label="Leave conversation"
            >
              Leave
            </button>
          </div>
        </header>

        {menu === 'report' ? (
          <div className="sky-drawer-body">
            <ReportForm
              onCancel={() => setMenu('')}
              onSubmit={async (r, d) => {
                await world.report(p.sid, r, d);
                setMenu('');
                close();
              }}
            />
          </div>
        ) : (
          <>
            {/* Stranger's thought as a quote at the top */}
            <div className="chat-thought-quote-section">
              <blockquote className="chat-thought-quote">
                “{p.t || 'Quiet wandering stranger.'}”
              </blockquote>
              {typeof p.distKm === 'number' && (
                <span className="chat-thought-dist">~{p.distKm} km away</span>
              )}
            </div>

            {/* Plain Message List */}
            <div className="chat-messages-body" ref={bodyRef} aria-live={voiceReader ? 'polite' : 'off'}>
              {p.msgs.map((m, i) => (
                <div key={m.ts ? `${m.ts}-${i}` : i} className={`chat-bubble-row${m.mine ? ' me' : ''}`}>
                  <div className={`chat-bubble${m.mine ? ' me' : ''}`}>
                    <p className="chat-bubble-text">{m.t}</p>
                    {m.ts ? <span className="chat-bubble-time">{fmtTime(m.ts)}</span> : null}
                  </div>
                </div>
              ))}

              {p.typing && (
                <div className="chat-bubble-row">
                  <span className="chat-typing-indicator">Stranger is typing…</span>
                </div>
              )}

              {p.ended && (
                <div className="chat-ended-card">
                  <p>{p.ended === 'blocked' ? 'This conversation has ended.' : 'This stranger has gently drifted away.'}</p>
                </div>
              )}
            </div>

            {/* Footer with Keep In Touch + One-line Message Composer */}
            {!p.ended && (
              <footer className="chat-footer">
                {!isIncognito && (
                  <button
                    type="button"
                    className="chat-keep-btn"
                    disabled={p.kept || p.known}
                    onClick={() => world.keep()}
                  >
                    {p.known ? 'Kept in touch' : p.kept ? 'Waiting for stranger…' : 'Keep in touch'}
                  </button>
                )}

                <form
                  className="chat-composer-line"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void send();
                  }}
                >
                  <input
                    className="chat-composer-input"
                    value={text}
                    maxLength={400}
                    placeholder="Say something kind to this stranger…"
                    aria-label="Message"
                    onChange={(e) => {
                      setText(e.target.value);
                      const now = Date.now();
                      if (now - lastTyping.current > 2000) {
                        lastTyping.current = now;
                        world.typing();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void send();
                      }
                    }}
                  />
                  <button
                    type="submit"
                    className="chat-composer-send"
                    disabled={!text.trim()}
                    aria-label="Send message"
                  >
                    Send
                  </button>
                </form>

                {err && <div className="err" style={{ marginTop: 6, fontSize: 13 }}>{err}</div>}
              </footer>
            )}
          </>
        )}
      </aside>
    </div>
  );
}
