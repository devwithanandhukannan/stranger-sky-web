'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useUI, MOOD_COLORS, MOOD_NAMES, F_ECHO, F_NEW, F_VET, F_BUSY, type NearItem } from '@/lib/sky/store';
import { useSky } from './ctx';
import { setSound, sfx, speakMessage } from '@/lib/sky/audio';
import { api, API } from '@/lib/api';
import { IcoPin, IcoCalendar, IcoAge, IcoBond, IcoChat, IcoChime, IcoCrystal, IcoBell, IcoClock, IcoSun, IcoSunset, IcoMoon, IcoCheck, IcoSparkle, IcoIncognito, IcoShieldAlert, IcoX } from './icons';

import { resolveTheme, getTimeBasedThemeId, applyThemeCss, getThemeScheduleDescription } from '@/lib/sky/themes';

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
            <div className="row" style={{ alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <i className="dot" style={{ background: MOOD_COLORS[n.m], boxShadow: `0 0 12px ${MOOD_COLORS[n.m]}` }} />
              <span className="tiny">{kind} · {MOOD_NAMES[n.m]}</span>
              {n.isIncognito && (
                <span className="top-incognito-badge" style={{ fontSize: 11, padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <IcoIncognito size={11} /> Ignoto
                </span>
              )}
              {typeof n.distKm === 'number' && <span className="dist-chip"><IcoPin size={12} /> ~{n.distKm} km away</span>}
            </div>
            <p className="thought">{n.t || 'Quiet. No thought shared.'}</p>
            {lightInterests.length > 0 && (
              <div className="light-interests-list">
                {lightInterests.map((tag) => {
                  const shared = myInterests.map((t) => t.toLowerCase()).includes(tag.toLowerCase());
                  return (
                    <span
                      key={tag}
                      className={`interest-tag-pill${shared ? ' shared' : ''}`}
                      title={shared ? 'Shared interest with you!' : `Interest: #${tag}`}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}
                    >
                      {shared && <IcoSparkle size={10} />}#{tag}
                    </span>
                  );
                })}
              </div>
            )}
          </>
        ) : (
          <p className="muted">Drift closer to read their thought.</p>
        )}
        {pulsed && <p className="tiny" style={{ color: 'var(--accent)' }}>They sent you a pulse. Pulse back to open a planet.</p>}
      </div>
      <div className="row peek-actions">
        <button className="btn" disabled={!n && !pulsed} onClick={() => world.pulse(sid)}>{pulsed ? 'Pulse back' : 'Send a pulse'}</button>
        {!(n && n.f & F_ECHO) && <button className="btn ghost" onClick={() => ui.set({ panel: 'report', reportSid: sid })}>Report</button>}
        {!(n && n.f & F_ECHO) && <button className="btn ghost" onClick={async () => { await world.block(sid); ui.set({ selected: null }); }}>Block</button>}
        <button className="icon" onClick={() => ui.set({ selected: null })} aria-label="Close"><IcoX size={15} /></button>
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
          <span><b>Zero Tolerance (Omegle-Style):</b> Reports immediately issue a temporary 24-hour ban or suspension and instantly sever socket connections.</span>
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
      <p className="galaxy-sheet-desc">
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginRight: 5 }}><IcoSparkle size={13} /></span>
        {census.total} lights drifting across One Sky. Add your interests to steer and connect through the cosmos.
      </p>

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
              <span className="galaxy-card-orb one-sky" />
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
              <span className="galaxy-card-orb neighbours" />
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
          : `Bond with ${name} removed`,
      });
    } catch {
      ui.set({ toast: 'Could not complete that action. Please try again.' });
    } finally {
      setBusyId(null);
    }
  };

  return (
    <Sheet title="Kept in touch" onClose={() => ui.set({ panel: null })}>
      {!bonds.length && <p className="muted">When you and a stranger both choose to keep in touch, they appear here with their name. Nobody is added without both saying yes.</p>}
      <ul className="list">
        {bonds.map((b) => (
          <li key={b.id}>
            <i className="dot" style={{ background: b.online ? '#79e6b6' : '#4a5278', boxShadow: b.online ? '0 0 10px #79e6b6' : 'none' }} />
            <div style={{ flex: 1 }}><b>{b.name}</b><div className="tiny">{b.online ? 'in the sky now' : 'away'}</div></div>
            <button className="btn" disabled={!b.online || busyId === b.id} onClick={() => { world.callBond(b.id); ui.set({ panel: null }); }}>Call</button>
            <button className="btn ghost" disabled={busyId === b.id} onClick={() => void remove(b.id, false)}>Remove</button>
            <button className="btn danger" disabled={busyId === b.id} onClick={() => void remove(b.id, true)}>Block</button>
          </li>
        ))}
      </ul>
    </Sheet>
  );
}

export function SettingsSheet() {
  const { ui, world, getToken, onSignOut, onDeleted } = useSky();
  const s = useUI(ui, (x) => x);
  const [confirmDel, setConfirmDel] = useState('');
  const [err, setErr] = useState('');
  const [showDetails, setShowDetails] = useState(false);
  const [profile, setProfile] = useState<{ email?: string; age?: number; createdAt?: string } | null>(null);

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
  const galaxyName = s.galaxies.find((g) => g.slug === s.galaxy)?.name || s.galaxy;

  return (
    <Sheet title="You" onClose={() => ui.set({ panel: null })} tall className="settings-sheet">
      {/* Top Profile Card (Image 2 style) */}
      <div className="settings-profile-card">
        <div className="settings-profile-orb">
          <div className="settings-profile-orb-core" />
        </div>
        <div className="settings-profile-info">
          <div className="settings-profile-name-row">
            <h3 className="settings-profile-name">{s.name || 'Anonymous Light'}</h3>
            {galaxyName && <span className="settings-galaxy-badge">{galaxyName}</span>}
          </div>
          <p className="settings-profile-sub">
            {s.bonds.length} bond{s.bonds.length === 1 ? '' : 's'} · here since {memberSince}
          </p>
          {showDetails && profile?.email && (
            <p className="settings-profile-email">{profile.email} · {profile.age ? `${profile.age} yrs old` : '18+ verified'}</p>
          )}
        </div>
        <button
          type="button"
          className="btn-profile-edit"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? 'Close' : 'Edit'}
        </button>
      </div>

      {/* Two-Column Grid for Desktop */}
      <div className="settings-grid">
        {/* Left Column: SKY & PRIVACY */}
        <div className="settings-col">
          {/* Section: SKY */}
          <div className="settings-sec-title">SKY</div>
          <div className="settings-sky-pills" role="tablist">
            {[
              { id: 'auto', label: 'Auto' },
              { id: 'day', label: 'Day' },
              { id: 'evening', label: 'Dusk' },
              { id: 'midnight', label: 'Night' },
            ].map((theme) => {
              const active = s.skyTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  className={`sky-pill-btn${active ? ' active' : ''}`}
                  onClick={() => {
                    ui.set({ skyTheme: theme.id });
                    try {
                      localStorage.setItem('skyTheme', theme.id);
                      if (theme.id === 'auto') localStorage.removeItem('skyThemeLocked');
                      else localStorage.setItem('skyThemeLocked', 'true');
                    } catch {}
                    applyThemeCss(resolveTheme(theme.id));
                  }}
                >
                  {theme.label}
                </button>
              );
            })}
          </div>
          {s.skyTheme === 'auto' && (
            <div className="settings-auto-hint">
              Matching your clock ({getTimeBasedThemeId() === 'day' ? 'Daylight' : getTimeBasedThemeId() === 'evening' ? 'Sunset Dusk' : 'Dark Night'})
            </div>
          )}

          {/* Section: PRIVACY */}
          <div className="settings-sec-title" style={{ marginTop: 20 }}>PRIVACY</div>
          <div className="setting-switch-card">
            <div className="setting-switch-info">
              <h4 className="setting-switch-title">Nearby galaxy</h4>
              <p className="setting-switch-sub">Within 100 km, blurred to about 1 km</p>
            </div>
            <label className="switch">
              <input
                type="checkbox"
                checked={s.locationGranted}
                onChange={async (e) => {
                  if (!e.target.checked) {
                    await world.clearLocation();
                  } else {
                    if (typeof window === 'undefined' || !('geolocation' in navigator)) {
                      ui.set({ toast: 'Geolocation not supported by your browser.' });
                      return;
                    }
                    navigator.geolocation.getCurrentPosition(
                      async (pos) => {
                        const ok = await world.setLocation(pos.coords.latitude, pos.coords.longitude);
                        if (ok) ui.set({ toast: 'Location discovery activated (fuzzed to ~1.1 km).' });
                      },
                      () => ui.set({ toast: 'Location access was denied or unavailable.' }),
                      { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
                    );
                  }
                }}
              />
              <i />
            </label>
          </div>

          {/* Account & Safety Card */}
          <div className="setting-account-card">
            <div className="setting-links-row">
              <a className="setting-link" href="/rules" target="_blank" rel="noopener">Community rules</a>
              <span className="setting-link-sep">·</span>
              <a className="setting-link" href="/privacy" target="_blank" rel="noopener">Privacy</a>
            </div>
            <div className="setting-account-btns">
              <button className="btn-secondary-pill" onClick={exportData}>Download data</button>
              <button className="btn-secondary-pill" onClick={onSignOut}>Sign out</button>
            </div>
            <details className="settings-delete-details">
              <summary className="tiny muted" style={{ cursor: 'pointer' }}>Delete account</summary>
              <p className="tiny muted" style={{ margin: '8px 0' }}>This removes your profile permanently. Type DELETE to confirm.</p>
              <div className="row" style={{ gap: 8 }}>
                <input className="field" value={confirmDel} onChange={(e) => setConfirmDel(e.target.value)} aria-label="Type DELETE" />
                <button className="btn danger" disabled={confirmDel !== 'DELETE'} onClick={del}>Delete</button>
              </div>
              {err && <div className="err" style={{ marginTop: 6 }}>{err}</div>}
            </details>
          </div>
        </div>

        {/* Right Column: COMFORT */}
        <div className="settings-col">
          <div className="settings-sec-title">COMFORT</div>

          <div className="setting-switch-card">
            <div className="setting-switch-info">
              <h4 className="setting-switch-title">Sound</h4>
            </div>
            <label className="switch">
              <input type="checkbox" checked={s.sound} onChange={(e) => { ui.set({ sound: e.target.checked }); setSound(e.target.checked); save('sound', e.target.checked); }} />
              <i />
            </label>
          </div>

          <div className="setting-switch-card">
            <div className="setting-switch-info">
              <h4 className="setting-switch-title">Lite mode</h4>
            </div>
            <label className="switch">
              <input type="checkbox" checked={s.lite} onChange={(e) => { ui.set({ lite: e.target.checked }); save('lite', e.target.checked); }} />
              <i />
            </label>
          </div>

          <div className="setting-switch-card">
            <div className="setting-switch-info">
              <h4 className="setting-switch-title">List view</h4>
            </div>
            <label className="switch">
              <input type="checkbox" checked={s.listMode} onChange={(e) => { ui.set({ listMode: e.target.checked, panel: null }); save('list', e.target.checked); }} />
              <i />
            </label>
          </div>

          <div className="setting-switch-card">
            <div className="setting-switch-info">
              <h4 className="setting-switch-title">Message sounds</h4>
            </div>
            <label className="switch">
              <input type="checkbox" checked={s.messageSound} onChange={(e) => { ui.set({ messageSound: e.target.checked }); save('messageSound', e.target.checked); }} />
              <i />
            </label>
          </div>

          {s.messageSound && (
            <div className="settings-tone-subcard">
              <span className="tiny muted" style={{ display: 'block', marginBottom: 6 }}>Tone</span>
              <div className="settings-tone-pills">
                {[
                  { id: 'pop', label: 'Pop' },
                  { id: 'chime', label: 'Chime' },
                  { id: 'crystal', label: 'Crystal' },
                  { id: 'bell', label: 'Bell' },
                ].map((tone) => {
                  const active = s.messageTone === tone.id;
                  return (
                    <button
                      key={tone.id}
                      type="button"
                      className={`tone-pill-btn${active ? ' active' : ''}`}
                      onClick={() => {
                        ui.set({ messageTone: tone.id });
                        try { localStorage.setItem('messageTone', tone.id); } catch {}
                        sfx.msgSent(tone.id);
                        setTimeout(() => sfx.msgReceived(tone.id), 260);
                      }}
                    >
                      {tone.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="setting-switch-card">
            <div className="setting-switch-info">
              <h4 className="setting-switch-title">Voice reader</h4>
              <p className="setting-switch-sub">Speak incoming messages aloud</p>
            </div>
            <label className="switch">
              <input type="checkbox" checked={s.voiceReader} onChange={(e) => {
                ui.set({ voiceReader: e.target.checked });
                save('voiceReader', e.target.checked);
                if (e.target.checked) speakMessage('Voice reader enabled.');
              }} />
              <i />
            </label>
          </div>

          <div className="setting-switch-card">
            <div className="setting-switch-info">
              <h4 className="setting-switch-title">Haptics</h4>
            </div>
            <label className="switch">
              <input type="checkbox" checked={s.haptics} onChange={(e) => { ui.set({ haptics: e.target.checked }); save('haptics', e.target.checked); }} />
              <i />
            </label>
          </div>

          <p className="tiny muted" style={{ marginTop: 10, paddingLeft: 4 }}>
            Sky quality: {s.quality} · Adjusts automatically to your device.
          </p>
        </div>
      </div>
    </Sheet>
  );
}
