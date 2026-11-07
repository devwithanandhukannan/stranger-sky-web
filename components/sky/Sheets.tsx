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

export function ThoughtSheet() {
  const { ui, world } = useSky();
  const cur = useUI(ui, (s) => s.thought), mood = useUI(ui, (s) => s.mood), max = useUI(ui, (s) => s.thoughtMax), prompt = useUI(ui, (s) => s.meteorPrompt);
  const [text, setText] = useState(cur), [m, setM] = useState(mood), [err, setErr] = useState(''), [busy, setBusy] = useState(false);
  const close = () => ui.set({ panel: null, meteorPrompt: null });
  const save = async (clear = false) => {
    setBusy(true); setErr('');
    const val = clear ? '' : text.trim();
    const e = await world.thought(val, m);
    setBusy(false);
    if (e) {
      setErr(ERR[e] || 'Could not share that.');
    } else {
      try {
        if (val) localStorage.setItem('userThought', val);
        else localStorage.removeItem('userThought');
      } catch { /* ignore */ }
      ui.set({
        toast: clear ? 'Thought cleared from your light' : 'Thought released into the sky',
      });
      close();
    }
  };

  const activeMoodColor = MOOD_COLORS[m] || '#cfe0ff';

  return (
    <Sheet title="Your thought" onClose={close} className="thought-sheet">
      {/* Live celestial orbit preview */}
      <div className="thought-preview-box" style={{ ['--glow-color' as string]: activeMoodColor }}>
        <div className="thought-preview-orb">
          <div className="thought-preview-core" style={{ background: '#ffffff', boxShadow: `0 0 10px 2px ${activeMoodColor}` }} />
        </div>
        <div className="thought-preview-content">
          <div className="thought-preview-badge">
            <span className="thought-preview-dot" style={{ background: activeMoodColor }} />
            <span>{MOOD_NAMES[m]} light in orbit</span>
          </div>
          <div className="thought-preview-quote">
            {text.trim() ? `“${text.trim()}”` : <span className="muted italic">Drift closer to others in the sky to reveal your thought…</span>}
          </div>
        </div>
      </div>

      {prompt && (
        <div className="thought-prompt-banner">
          <span className="thought-prompt-spark" style={{ display: 'inline-flex', alignItems: 'center' }}><IcoSparkle size={13} /></span>
          <div>Shooting star asks: <strong>{prompt}</strong></div>
        </div>
      )}


      {/* Thought text input */}
      <div className="thought-field-wrap">
        <textarea
          className="thought-textarea"
          rows={3}
          maxLength={max}
          autoFocus
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              void save();
            }
          }}
          placeholder={prompt || 'rain on the roof, thinking about home…'}
          aria-label="Your thought"
        />
        <div className="thought-char-pill">
          {text.length}/{max}
        </div>
      </div>

      {/* Mood Selector Palette */}
      <div className="thought-mood-label">
        <span>How your light glows in the sky</span>
        <span className="thought-mood-active-tag">
          <i className="dot" style={{ background: activeMoodColor }} />
          {MOOD_NAMES[m]}
        </span>
      </div>
      <div className="thought-mood-grid" role="radiogroup" aria-label="Mood">
        {MOOD_COLORS.map((c, i) => (
          <button
            key={i}
            type="button"
            role="radio"
            aria-checked={m === i}
            className={`thought-mood-btn${m === i ? ' active' : ''}`}
            onClick={() => setM(i)}
            style={{ ['--c' as string]: c }}
          >
            <i className="dot" />
            <span>{MOOD_NAMES[i]}</span>
          </button>
        ))}
      </div>

      {err && <div className="err" style={{ marginBottom: 12 }}>{err}</div>}

      {/* Action Row */}
      <div className="thought-actions-row">
        {cur && (
          <button
            type="button"
            className="btn ghost"
            disabled={busy}
            onClick={() => void save(true)}
          >
            Clear
          </button>
        )}
        <button
          type="button"
          className="thought-release-btn"
          disabled={busy}
          onClick={() => void save()}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><IcoSparkle size={14} /> Release into the sky</span>
          <span className="thought-hint-kbd">⌘↵</span>
        </button>

      </div>
    </Sheet>
  );
}

export function LightSheet() {
  const { ui, world } = useSky();
  const sid = useUI(ui, (s) => s.selected), near = useUI(ui, (s) => s.near), incoming = useUI(ui, (s) => s.incoming);
  const myInterests = useUI(ui, (s) => s.userInterests);
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
      return () => { active = false; };
    }
  }, [sid, near, world]);

  if (!sid) return null;
  const n = peekItem || near.find((x) => x.sid === sid);
  const kind = !n ? '' : n.f & F_ECHO ? 'an echo of someone who passed through' : n.f & F_BUSY ? 'in a conversation' : n.f & F_NEW ? 'a new star' : n.f & F_VET ? 'an old soul' : 'a light';
  const pulsed = incoming.includes(sid);
  const lightInterests = n?.interests || [];

  return (
    <aside className="peek" data-ui aria-label="Selected light">
      <div className="peek-body">
        {n ? (
          <>
            <div className="peek-header-row">
              <i className="dot" style={{ background: MOOD_COLORS[n.m], boxShadow: `0 0 10px ${MOOD_COLORS[n.m]}` }} />
              <span className="peek-kind-label">{kind} · {MOOD_NAMES[n.m]}</span>
              {n.isIncognito && (
                <span className="peek-badge-incognito">
                  <IcoIncognito size={10} /> Ignoto
                </span>
              )}
              {typeof n.distKm === 'number' && <span className="peek-dist-chip"><IcoPin size={10} /> ~{n.distKm} km away</span>}
            </div>
            <p className="peek-thought-text">{n.t ? `“${n.t}”` : 'Quiet. No thought shared.'}</p>
            {lightInterests.length > 0 && (
              <div className="light-interests-list">
                {lightInterests.map((tag) => {
                  const shared = myInterests.map((t) => t.toLowerCase()).includes(tag.toLowerCase());
                  return (
                    <span
                      key={tag}
                      className={`interest-tag-pill${shared ? ' shared' : ''}`}
                      title={shared ? 'Shared interest with you!' : `Interest: #${tag}`}
                    >
                      {shared && <IcoSparkle size={10} />}#{tag}
                    </span>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <p className="peek-muted-hint">Drift closer to read their thought.</p>
        )}
        {pulsed && <p className="peek-pulsed-banner">They sent you a pulse. Pulse back to open a planet.</p>}
      </div>
      <div className="peek-actions">
        <button className="btn btn-pulse-main" disabled={!n && !pulsed} onClick={() => world.pulse(sid)}>
          <IcoSparkle size={13} />
          <span>{pulsed ? 'Pulse back' : 'Send a pulse'}</span>
        </button>
        {pulsed && <button className="btn ghost" onClick={() => { world.declinePulse(sid); ui.set({ selected: null }); }}>Decline</button>}
        {!(n && n.f & F_ECHO) && <button className="btn ghost" onClick={() => ui.set({ panel: 'report', reportSid: sid })}>Report</button>}
        {!(n && n.f & F_ECHO) && <button className="btn ghost" onClick={async () => { await world.block(sid); ui.set({ selected: null }); }}>Block</button>}
        <button className="icon peek-close-btn" onClick={() => ui.set({ selected: null })} aria-label="Close"><IcoX size={14} /></button>
      </div>
    </aside>
  );
}

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

export function MapSheet() {
  const { ui, world } = useSky();
  const census = useUI(ui, (s) => s.census), cur = useUI(ui, (s) => s.galaxy);
  const userInterests = useUI(ui, (s) => s.userInterests);
  const activeInterests = useUI(ui, (s) => s.activeInterests);
  const interestDrive = useUI(ui, (s) => s.interestDrive);
  const selectedInterest = useUI(ui, (s) => s.selectedInterest);
  const [newTag, setNewTag] = useState('');
  const [err, setErr] = useState('');

  const handleAddInterest = (tag: string) => {
    const clean = tag.trim().toLowerCase().replace(/^#/, '');
    if (!clean) return;
    if (clean.length < 2 || clean.length > 24) {
      setErr('Interests must be 2 to 24 characters.');
      return;
    }
    if (userInterests.map((t) => t.toLowerCase()).includes(clean)) {
      setErr('You already added this interest.');
      return;
    }
    if (userInterests.length >= 8) {
      setErr('Maximum 8 interests at a time.');
      return;
    }
    setErr('');
    world.setInterests([...userInterests, clean]);
    setNewTag('');
  };

  const handleRemoveInterest = (tag: string) => {
    world.setInterests(userInterests.filter((t) => t.toLowerCase() !== tag.toLowerCase()));
  };

  const handleSwitchSky = async (slug: string) => {
    if (slug === cur) return;
    setErr('');
    const e = await world.travel(slug);
    if (e) {
      setErr(e === 'full' ? 'That sky realm is full right now.' : 'Could not travel.');
    } else {
      ui.set({ panel: null });
    }
  };

  return (
    <Sheet title="One Sky · Interests & Universe" onClose={() => ui.set({ panel: null })} tall className="universe-sheet">
      <div className="galaxy-sheet-desc">
        <span className="galaxy-sheet-desc-icon"><IcoSparkle size={14} /></span>
        <span>
          {census.total} {census.total === 1 ? 'light' : 'lights'} drifting across One Sky. Add your interests to steer and connect through the cosmos.
        </span>
      </div>

      {/* Interest Sky Drive ON / OFF Toggle Banner */}
      <div className="interest-drive-banner-card">
        <div className="interest-drive-info">
          <div className="interest-drive-title-row">
            <span className="interest-drive-spark" style={{ display: 'inline-flex', alignItems: 'center' }}><IcoSparkle size={13} /></span>
            <b className="interest-drive-title">Interest Sky Drive</b>
          </div>
          <p className="interest-drive-desc">
            Draw constellation links and steer toward online wanderers sharing your interests.
          </p>
        </div>
        <button
          type="button"
          className={`interest-drive-toggle${interestDrive ? ' on' : ''}`}
          onClick={() => world.toggleInterestDrive()}
          aria-label={interestDrive ? 'Turn off Interest Sky Drive' : 'Turn on Interest Sky Drive'}
          title="Toggle Interest Sky Drive"
        >
          <span className="toggle-state-label">{interestDrive ? 'ACTIVE' : 'OFF'}</span>
          <span className="toggle-track">
            <span className="toggle-thumb" />
          </span>
        </button>
      </div>

      {/* My Current Interests */}
      <div className="sheet-card" style={{ marginTop: 14 }}>
        <div className="sheet-card-header">
          <b className="sheet-card-title">My Interests</b>
          <span className="sheet-counter-pill">{userInterests.length}/8 tags</span>
        </div>

        {/* Input to add custom interest */}
        <div className="interest-input-row">
          <span className="interest-hash-prefix">#</span>
          <input
            className="field sm interest-field"
            value={newTag}
            maxLength={24}
            placeholder="Add an interest (e.g. music, coding, philosophy, stargazing)"
            onChange={(e) => { setNewTag(e.target.value); setErr(''); }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                handleAddInterest(newTag);
              }
            }}
          />
          <button
            type="button"
            className="btn sm interest-add-btn"
            disabled={!newTag.trim()}
            onClick={() => handleAddInterest(newTag)}
          >
            + Add
          </button>
        </div>

        {/* User's existing tags */}
        <div className="interest-tags-container">
          {userInterests.length === 0 ? (
            <div className="interest-empty-hint">
              No interests added yet. Add tags above to light up connections in One Sky.
            </div>
          ) : (
            userInterests.map((tag) => (
              <span key={tag} className="interest-tag-pill mine">
                <span className="tag-hash">#</span>
                <span className="tag-text">{tag}</span>
                <button
                  type="button"
                  className="interest-tag-remove"
                  onClick={() => handleRemoveInterest(tag)}
                  aria-label={`Remove ${tag}`}
                >
                  <IcoX size={11} />
                </button>
              </span>
            ))
          )}
        </div>
      </div>

      {/* What all current user interests are in the live sky */}
      <div className="sheet-card" style={{ marginTop: 14 }}>
        <div className="sheet-card-header">
          <b className="sheet-card-title">Live Sky Interests</b>
          <span className="sheet-counter-pill">{activeInterests.length} active topics</span>
        </div>
        <p className="sheet-card-subtitle">
          What current lights in the sky are into. Tap any interest to drive towards matching strangers:
        </p>

        {activeInterests.length === 0 ? (
          <div className="interest-empty-hint">
            No public interests posted yet. Be the first to share one above!
          </div>
        ) : (
          <div className="interest-tags-container">
            {activeInterests.map((item) => {
              const isSelected = selectedInterest?.toLowerCase() === item.tag.toLowerCase();
              const isMine = userInterests.map((t) => t.toLowerCase()).includes(item.tag.toLowerCase());
              return (
                <button
                  key={item.tag}
                  type="button"
                  className={`interest-tag-pill clickable${isSelected ? ' selected' : ''}${isMine ? ' mine' : ''}`}
                  onClick={() => {
                    world.driveToInterest(item.tag);
                    ui.set({ toast: `Steered toward #${item.tag} in One Sky` });
                  }}
                  title={`Drive to lights interested in #${item.tag}`}
                >
                  <span className="tag-hash">#</span>
                  <span className="tag-text">{item.tag}</span>
                  <span className="tag-count">{item.count}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Universe Realms Selector (One Sky & Neighbours) */}
      <div className="sheet-card" style={{ marginTop: 14, marginBottom: 12 }}>
        <b className="sheet-card-title" style={{ display: 'block', marginBottom: 12 }}>Sky Realms</b>
        <div className="realms-grid">
          <button
            type="button"
            className={`galaxy-card${cur !== 'neighbours' ? ' active' : ''}`}
            onClick={() => void handleSwitchSky('night')}
          >
            <div className="galaxy-card-top">
              <span className="galaxy-card-icon one-sky">
                <IcoGlobe size={16} />
              </span>
              {cur !== 'neighbours' && <span className="galaxy-card-badge">Current</span>}
            </div>
            <b className="galaxy-card-name">One Sky</b>
            <span className="galaxy-card-count">{Math.max(0, (census.counts['night'] ?? 1) - 1)} online</span>
          </button>

          <button
            type="button"
            className={`galaxy-card neighbours-card${cur === 'neighbours' ? ' active' : ''}`}
            onClick={() => void handleSwitchSky('neighbours')}
          >
            <div className="galaxy-card-top">
              <span className="galaxy-card-icon neighbours">
                <IcoRadar size={16} />
              </span>
              {cur === 'neighbours' && <span className="galaxy-card-badge neighbours-badge">Current</span>}
            </div>
            <b className="galaxy-card-name">Neighbours</b>
            <span className="galaxy-card-count">≤ 100 km physical radius</span>
          </button>
        </div>
      </div>

      {err && <div className="err" style={{ marginTop: 8 }}>{err}</div>}
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
