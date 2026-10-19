'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useUI, MOOD_COLORS, MOOD_NAMES, F_ECHO, F_NEW, F_VET, F_BUSY } from '@/lib/sky/store';
import { useSky } from './ctx';
import { setSound, sfx, speakMessage } from '@/lib/sky/audio';
import { api, API } from '@/lib/api';
import { IcoPin, IcoCalendar, IcoAge, IcoBond, IcoChat, IcoChime, IcoCrystal, IcoBell, IcoClock, IcoSun, IcoSunset, IcoMoon, IcoCheck, IcoSparkle } from './icons';
import { resolveTheme, getTimeBasedThemeId, applyThemeCss, getThemeScheduleDescription } from '@/lib/sky/themes';

export function Sheet({ title, onClose, children, tall, className }: { title: string; onClose: () => void; children: ReactNode; tall?: boolean; className?: string }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, [onClose]);
  return (
    <div className={`modal${className ? ` modal-${className}` : ''}`} data-ui onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <section className={`sheet${tall ? ' tall' : ''}${className ? ` ${className}` : ''}`} role="dialog" aria-label={title}>
        <header className="sheet-h"><h2>{title}</h2><button className="icon" onClick={onClose} aria-label="Close">×</button></header>
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
    const e = await world.thought(clear ? '' : text.trim(), m);
    setBusy(false);
    if (e) {
      setErr(ERR[e] || 'Could not share that.');
    } else {
      ui.set({
        toast: clear ? 'Thought cleared from your light' : 'Thought released into the sky ✦',
      });
      close();
    }
  };

  const activeMoodColor = MOOD_COLORS[m] || '#cfe0ff';

  return (
    <Sheet title="Your thought" onClose={close} className="thought-sheet">
      {/* Live celestial orbit preview (Dynamic on Web) */}
      <div className="thought-preview-box" style={{ ['--glow-color' as string]: activeMoodColor }}>
        <div className="thought-preview-ambient" style={{ background: activeMoodColor }} />
        <div className="thought-preview-orb">
          <div className="thought-preview-halo" />
          <div className="thought-preview-core" />
        </div>
        <div className="thought-preview-content">
          <div className="thought-preview-badge" style={{ color: activeMoodColor }}>
            <span>●</span> {MOOD_NAMES[m]} light in orbit
          </div>
          <div className="thought-preview-quote">
            {text.trim() ? `“${text.trim()}”` : <span className="muted italic">Drift closer to others in the sky to reveal your thought…</span>}
          </div>
        </div>
      </div>

      {prompt && (
        <div className="thought-prompt-banner">
          <span className="thought-prompt-spark">✦</span>
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
        <span>How your light glows in the sky:</span>
        <span style={{ color: activeMoodColor, textTransform: 'capitalize' }}>{MOOD_NAMES[m]}</span>
      </div>
      <div className="thought-mood-grid" role="radiogroup" aria-label="Mood">
        {MOOD_COLORS.map((c, i) => (
          <button
            key={i}
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
          <span>✦ Release into the sky</span>
          <span className="thought-hint-kbd">⌘↵</span>
        </button>
      </div>
    </Sheet>
  );
}

export function LightSheet() {
  const { ui, world } = useSky();
  const sid = useUI(ui, (s) => s.selected), near = useUI(ui, (s) => s.near), incoming = useUI(ui, (s) => s.incoming);
  if (!sid) return null;
  const n = near.find((x) => x.sid === sid);
  const kind = !n ? '' : n.f & F_ECHO ? 'an echo of someone who passed through' : n.f & F_BUSY ? 'in a conversation' : n.f & F_NEW ? 'a new star' : n.f & F_VET ? 'an old soul' : 'a light';
  const pulsed = incoming.includes(sid);
  return (
    <aside className="peek" data-ui aria-label="Selected light">
      <div className="peek-body">
        {n ? (<><div className="row" style={{ alignItems: 'center', gap: 6, flexWrap: 'wrap' }}><i className="dot" style={{ background: MOOD_COLORS[n.m], boxShadow: `0 0 12px ${MOOD_COLORS[n.m]}` }} /><span className="tiny">{kind} · {MOOD_NAMES[n.m]}</span>{typeof n.distKm === 'number' && <span className="dist-chip"><IcoPin size={12} /> ~{n.distKm} km away</span>}</div>
          <p className="thought">{n.t || 'Quiet. No thought shared.'}</p></>)
          : <p className="muted">Drift closer to read their thought.</p>}
        {pulsed && <p className="tiny" style={{ color: 'var(--accent)' }}>They sent you a pulse. Pulse back to open a planet.</p>}
      </div>
      <div className="row peek-actions">
        <button className="btn" disabled={!n && !pulsed} onClick={() => world.pulse(sid)}>{pulsed ? 'Pulse back' : 'Send a pulse'}</button>
        {!(n && n.f & F_ECHO) && <button className="btn ghost" onClick={() => ui.set({ panel: 'report', reportSid: sid })}>Report</button>}
        {!(n && n.f & F_ECHO) && <button className="btn ghost" onClick={async () => { await world.block(sid); ui.set({ selected: null }); }}>Block</button>}
        <button className="icon" onClick={() => ui.set({ selected: null })} aria-label="Close">×</button>
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
      <p className="tiny">You will not see each other again. A person on our team reviews reports.</p>
      <div className="row"><button className="btn ghost" onClick={onCancel}>Cancel</button><button className="btn" style={{ flex: 1 }} disabled={busy} onClick={() => onSubmit(r, d)}>Send report</button></div>
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

const GALAXY_COLORS = ['#7aa2ff', '#ff8fb1', '#79e6b6', '#7fdcff', '#ffd27a', '#c4a0ff', '#ffb07a', '#a5b4fc'];

export function MapSheet() {
  const { ui, world } = useSky();
  const galaxies = useUI(ui, (s) => s.galaxies), census = useUI(ui, (s) => s.census), cur = useUI(ui, (s) => s.galaxy);
  const [q, setQ] = useState('');
  const [err, setErr] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(GALAXY_COLORS[0]);
  const [adding, setAdding] = useState(false);

  const query = q.trim().toLowerCase();
  const filtered = galaxies.filter((g) =>
    !query || g.name.toLowerCase().includes(query) || g.slug.toLowerCase().includes(query)
  );

  const hasExact = galaxies.some((g) => g.name.toLowerCase() === query || g.slug.toLowerCase() === query);

  const handleCreate = async (nameToUse: string, colorToUse = newColor) => {
    const t = nameToUse.trim();
    if (!t || t.length < 2) {
      setErr('Please enter at least 2 characters.');
      return;
    }
    setErr('');
    setAdding(true);
    const res = await world.addGalaxy(t, colorToUse);
    setAdding(false);
    if (res.error) {
      setErr(res.error === 'not_allowed' ? 'Blocked words are not allowed.' : res.error === 'slow_down' ? 'Slow down a little.' : 'Could not add interest.');
      return;
    }
    if (res.galaxy) {
      setShowAdd(false);
      setNewName('');
      setQ('');
      const travelErr = await world.travel(res.galaxy.slug);
      if (!travelErr) {
        ui.set({ panel: null });
      }
    }
  };

  const handleTravel = async (slug: string) => {
    if (slug === cur) return;
    setErr('');
    const e = await world.travel(slug);
    if (e) {
      setErr(e === 'full' ? 'That galaxy is full right now.' : 'Could not travel.');
    } else {
      ui.set({ panel: null });
    }
  };

  return (
    <Sheet title="Galaxies & Interests" onClose={() => ui.set({ panel: null })}>
      <p className="galaxy-sheet-desc">
        ✦ {census.total} lights in the sky right now. Search an interest or create your own realm.
      </p>

      {/* Search & Add Bar */}
      <div className="galaxy-controls">
        <div className="galaxy-search-box">
          <svg className="galaxy-search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8" />
            <line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="galaxy-search-input"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search interests or galaxies…"
            aria-label="Search galaxies"
          />
          {q && (
            <button className="galaxy-search-clear" onClick={() => setQ('')} aria-label="Clear search">
              ×
            </button>
          )}
        </div>
        <button
          className="galaxy-add-toggle-btn"
          onClick={() => {
            setShowAdd(!showAdd);
            if (!showAdd && q && !hasExact) setNewName(q);
          }}
        >
          <span>{showAdd ? 'Cancel' : '+ Add Interest'}</span>
        </button>
      </div>

      {/* Add Custom Interest Form */}
      {showAdd && (
        <div className="galaxy-add-card">
          <div className="galaxy-add-title">✦ Create a New Interest / Galaxy</div>
          <input
            className="field sm"
            value={newName}
            maxLength={24}
            placeholder="Interest name (e.g. Photography, Anime, Philosophy)"
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void handleCreate(newName);
            }}
          />
          <div className="row" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="tiny muted">Theme glow:</span>
            <div className="galaxy-colors">
              {GALAXY_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  className={`galaxy-color-swatch${newColor === c ? ' selected' : ''}`}
                  style={{ ['--swatch' as string]: c }}
                  onClick={() => setNewColor(c)}
                  aria-label={`Color ${c}`}
                />
              ))}
            </div>
          </div>
          <div className="row" style={{ justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
            <button className="btn ghost sm" onClick={() => setShowAdd(false)}>
              Cancel
            </button>
            <button
              className="btn sm"
              disabled={adding || !newName.trim()}
              onClick={() => void handleCreate(newName)}
            >
              {adding ? 'Creating…' : '✦ Create & Travel'}
            </button>
          </div>
        </div>
      )}

      {/* Galaxies Grid */}
      <div className="galaxy-grid">
        {filtered.map((g) => {
          const raw = census.counts[g.slug] || 0;
          const n = g.slug === cur ? Math.max(0, raw - 1) : raw;
          const isCur = g.slug === cur;
          const isNeighbours = g.slug === 'neighbours';
          return (
            <button
              key={g.slug}
              className={`galaxy-card${isCur ? ' active' : ''}${isNeighbours ? ' neighbours-card' : ''}`}
              style={{ ['--c' as string]: g.color }}
              disabled={isCur}
              onClick={() => void handleTravel(g.slug)}
            >
              <div className="row" style={{ width: '100%', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="galaxy-card-orb" />
                {isCur ? (
                  <span className="galaxy-card-badge">Current</span>
                ) : isNeighbours ? (
                  <span className="galaxy-card-badge neighbours-badge"><IcoPin size={11} /> Max 100 km</span>
                ) : null}
              </div>
              <b className="galaxy-card-name ellipsis" style={{ maxWidth: '100%' }}>{g.name}</b>
              <span className="galaxy-card-count">
                {isNeighbours ? 'Strangers near you' : n === 0 ? 'Quiet' : `${n} online`}
              </span>
            </button>
          );
        })}

        {/* If query has no matches or no exact match, offer instant creation */}
        {query && !hasExact && !showAdd && (
          <div className="galaxy-empty-match">
            <p className="tiny muted">No galaxy named “{q}” yet.</p>
            <button
              className="btn sm"
              style={{ padding: '8px 16px' }}
              onClick={() => void handleCreate(q)}
            >
              ✦ Create interest “{q}” & Travel
            </button>
          </div>
        )}
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
  const s = useUI(ui, (x) => x), [confirmDel, setConfirmDel] = useState(''), [err, setErr] = useState('');
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

  const save = (k: string, v: boolean) => { try { localStorage.setItem(k, v ? '1' : '0'); } catch { /* ignore */ } };
  const del = async () => {
    setErr('');
    try {
      const t = await getToken();
      if (t) await api('DELETE', '/me', t);
      const { deleteLogin } = await import('@/lib/auth');
      try { await deleteLogin(); } catch { /* the profile is gone; sign-in will be removed on next login if needed */ }
      onDeleted();
    } catch { setErr('Could not delete right now. Sign in again and retry.'); }
  };
  const exportData = async () => {
    const t = await getToken(); if (!t) return;
    const r = await fetch(`${API}/api/me/export`, { headers: { authorization: `Bearer ${t}` } });
    const b = await r.blob(); const a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'my-data.json'; a.click(); URL.revokeObjectURL(a.href);
  };
  const Row = ({ label, hint, on, set }: { label: string; hint?: string; on: boolean; set: (v: boolean) => void }) => (
    <label className="switch"><div><b>{label}</b>{hint && <div className="tiny">{hint}</div>}</div><input type="checkbox" checked={on} onChange={(e) => set(e.target.checked)} /><i /></label>
  );
  return (
    <Sheet title="Settings" onClose={() => ui.set({ panel: null })} tall className="settings-sheet">
      <div className="sheet-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="dot" style={{ background: '#7aa2ff', boxShadow: '0 0 10px #7aa2ff' }} />
            <b style={{ fontSize: 16, color: 'var(--ink)' }}>{s.name || 'Anonymous Light'}</b>
          </div>
          <span className="tiny" style={{ background: 'rgba(122, 162, 255, 0.16)', color: 'var(--accent)', padding: '3px 9px', borderRadius: 999, fontWeight: 500, textTransform: 'capitalize' }}>
            {s.galaxies.find((g) => g.slug === s.galaxy)?.name || s.galaxy || 'Night'}
          </span>
        </div>
        {profile?.email && <p className="tiny muted" style={{ margin: '4px 0 6px', wordBreak: 'break-all' }}>{profile.email}</p>}
        <div className="tiny muted" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 16px', marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IcoAge size={13} /> {profile?.age ? `${profile.age} years old` : '18+ verified'}</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IcoBond size={13} /> {s.bonds.length} bond{s.bonds.length === 1 ? '' : 's'}</span>
          {profile?.createdAt ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><IcoCalendar size={13} /> Member since {new Date(profile.createdAt).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}</span> : null}
        </div>
      </div>

      {/* Space Atmosphere & Celestial Theme Selector */}
      <div className="sheet-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <IcoSun size={16} style={{ color: '#ffd27a' }} />
              <b style={{ fontSize: 14, color: 'var(--ink)' }}>Space Atmosphere & Theme</b>
            </div>
            <div className="tiny muted" style={{ marginTop: 2 }}>
              Celestial space appearance synchronized with local time or custom preference
            </div>
          </div>
          {s.skyTheme === 'auto' && (
            <span className="tiny" style={{ background: 'rgba(56, 239, 125, 0.16)', color: '#38ef7d', padding: '3px 10px', borderRadius: 999, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#38ef7d' }} />
              Auto Active: {getTimeBasedThemeId() === 'day' ? 'Daylight' : getTimeBasedThemeId() === 'evening' ? 'Sunset' : 'Dark Space'}
            </span>
          )}
        </div>

        {/* Live sync banner */}
        {s.skyTheme === 'auto' ? (
          <div style={{
            background: 'rgba(122, 162, 255, 0.12)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            padding: '9px 12px',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
            fontSize: 12.5,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: 'var(--ink)' }}>
              <IcoClock size={15} style={{ color: 'var(--accent)' }} />
              <span>
                Atmosphere is <strong>automatically matching your clock</strong> ({getTimeBasedThemeId() === 'day' ? 'Daylight' : getTimeBasedThemeId() === 'evening' ? 'Sunset Twilight' : 'Deep Cosmos'}).
              </span>
            </div>
            <span className="tiny" style={{ color: 'var(--ink3)', whiteSpace: 'nowrap' }}>
              {getThemeScheduleDescription()}
            </span>
          </div>
        ) : (
          <div style={{
            background: 'rgba(255, 255, 255, 0.05)',
            border: '1px solid var(--line)',
            borderRadius: 12,
            padding: '9px 12px',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 8,
          }}>
            <span style={{ fontSize: 12.5, color: 'var(--ink2)' }}>
              Custom theme locked. Atmosphere is not adapting to the time of day.
            </span>
            <button
              type="button"
              className="btn sm"
              style={{ fontSize: 11.5, padding: '4px 10px', height: 'auto', background: 'var(--accent)', color: '#071026' }}
              onClick={() => {
                ui.set({ skyTheme: 'auto' });
                try {
                  localStorage.setItem('skyTheme', 'auto');
                  localStorage.removeItem('skyThemeLocked');
                } catch {}
                applyThemeCss(resolveTheme('auto'));
              }}
            >
              Re-enable Auto (Time)
            </button>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
          {[
            {
              id: 'auto',
              name: 'Auto (Time)',
              sub: `Syncs with clock (${getTimeBasedThemeId() === 'day' ? 'Daylight' : getTimeBasedThemeId() === 'evening' ? 'Sunset' : 'Dark'})`,
              icon: IcoClock,
              iconColor: '#7aa2ff',
              preview: 'linear-gradient(135deg, #dce8fd 0%, #ff9aa8 50%, #050818 100%)',
            },
            {
              id: 'day',
              name: 'White / Day',
              sub: 'Bright sky & stars (06:00–17:00)',
              icon: IcoSun,
              iconColor: '#eab308',
              preview: 'linear-gradient(135deg, #dce8fd 0%, #9dbef2 100%)',
            },
            {
              id: 'evening',
              name: 'Evening / Sunset',
              sub: 'Golden rose twilight (17:00–20:30)',
              icon: IcoSunset,
              iconColor: '#ff6584',
              preview: 'linear-gradient(135deg, #181035 0%, #7a304e 100%)',
            },
            {
              id: 'midnight',
              name: 'Dark Space',
              sub: 'Obsidian & cosmos (20:30–06:00)',
              icon: IcoMoon,
              iconColor: '#93c5fd',
              preview: 'linear-gradient(135deg, #050818 0%, #0f183d 100%)',
            },
          ].map((item) => {
            const IconComp = item.icon;
            const active = s.skyTheme === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`btn sm ${active ? '' : 'ghost'}`}
                style={{
                  justifyContent: 'flex-start',
                  fontSize: 13,
                  padding: '10px 12px',
                  background: active ? 'rgba(122, 162, 255, 0.22)' : 'rgba(255, 255, 255, 0.04)',
                  borderColor: active ? 'var(--accent)' : 'var(--line)',
                  color: active ? 'var(--ink)' : 'var(--ink2)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  textAlign: 'left',
                  boxShadow: active ? '0 0 16px -2px rgba(122, 162, 255, 0.3)' : 'none',
                }}
                onClick={() => {
                  ui.set({ skyTheme: item.id });
                  try {
                    localStorage.setItem('skyTheme', item.id);
                    if (item.id === 'auto') {
                      localStorage.removeItem('skyThemeLocked');
                    } else {
                      localStorage.setItem('skyThemeLocked', 'true');
                    }
                  } catch {}
                  applyThemeCss(resolveTheme(item.id));
                }}
              >
                <div style={{
                  width: 30,
                  height: 30,
                  borderRadius: 8,
                  background: item.preview,
                  display: 'grid',
                  placeItems: 'center',
                  flexShrink: 0,
                  border: '1px solid rgba(255, 255, 255, 0.3)',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
                }}>
                  <IconComp size={16} style={{ color: item.id === 'day' ? '#1e3a8a' : item.iconColor }} />
                </div>
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{item.name}</span>
                    {active && <IcoCheck size={13} style={{ color: 'var(--accent)' }} />}
                  </div>
                  <div className="tiny muted" style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.sub}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="sheet-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <IcoPin size={16} style={{ color: '#38ef7d' }} />
              <b style={{ fontSize: 14, color: 'var(--ink)' }}>Neighbour location discovery</b>
            </div>
            <div className="tiny muted" style={{ marginTop: 2 }}>
              Find strangers within 100 km in the Neighbours space
            </div>
          </div>
          <label className="switch" style={{ margin: 0 }}>
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
                      if (ok) ui.set({ toast: 'Location discovery activated (fuzzed to ~1.1 km for privacy).' });
                    },
                    () => {
                      ui.set({ toast: 'Location access was denied or unavailable.' });
                    },
                    { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
                  );
                }
              }}
            />
            <i />
          </label>
        </div>
        {s.locationGranted && (
          <div className="tiny" style={{ color: '#38ef7d', display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
            <span>●</span> Active · Fuzzed to ~1.1 km for privacy (max 100 km discovery)
          </div>
        )}
      </div>
      <Row label="Master sound" hint="Soft ambient tones and chimes" on={s.sound} set={(v) => { ui.set({ sound: v }); setSound(v); save('sound', v); }} />
      <Row
        label="Message sounds"
        hint="Play sound when sending and receiving chat messages"
        on={s.messageSound}
        set={(v) => {
          ui.set({ messageSound: v });
          save('messageSound', v);
        }}
      />
      {s.messageSound && (
        <div className="sheet-card" style={{ padding: '12px 14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>Message Sound Tone</span>
            <span className="tiny muted">Tap to listen</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
            {[
              { id: 'pop', name: 'WhatsApp Pop', icon: IcoChat },
              { id: 'chime', name: 'Cosmic Chime', icon: IcoChime },
              { id: 'crystal', name: 'Crystal Ping', icon: IcoCrystal },
              { id: 'bell', name: 'Soft Bell', icon: IcoBell },
            ].map((tone) => {
              const IconComp = tone.icon;
              return (
                <button
                  key={tone.id}
                  type="button"
                  className={`btn sm ${s.messageTone === tone.id ? '' : 'ghost'}`}
                  style={{
                    justifyContent: 'flex-start',
                    fontSize: 13,
                    padding: '7px 10px',
                    background: s.messageTone === tone.id ? 'rgba(122, 162, 255, 0.22)' : 'rgba(255, 255, 255, 0.04)',
                    borderColor: s.messageTone === tone.id ? 'var(--accent)' : 'var(--line)',
                    color: s.messageTone === tone.id ? 'var(--ink)' : 'var(--ink2)',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                  }}
                  onClick={() => {
                    ui.set({ messageTone: tone.id });
                    try { localStorage.setItem('messageTone', tone.id); } catch { /* ignore */ }
                    sfx.msgSent(tone.id);
                    setTimeout(() => sfx.msgReceived(tone.id), 260);
                  }}
                >
                  <IconComp size={15} style={{ opacity: s.messageTone === tone.id ? 1 : 0.7 }} />
                  <span>{tone.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
      <Row
        label="Voice reader"
        hint="Speak incoming messages aloud with browser voice"
        on={s.voiceReader}
        set={(v) => {
          ui.set({ voiceReader: v });
          save('voiceReader', v);
          if (v) speakMessage('Voice reader enabled. Incoming messages will be read aloud.');
        }}
      />
      <Row label="Haptics" hint="Gentle vibration on pulses" on={s.haptics} set={(v) => { ui.set({ haptics: v }); save('haptics', v); }} />
      <Row label="Lite mode" hint="Fewer effects, saves battery and data" on={s.lite} set={(v) => { ui.set({ lite: v }); save('lite', v); }} />
      <Row label="List view" hint="Thoughts as a simple list instead of the sky" on={s.listMode} set={(v) => { ui.set({ listMode: v, panel: null }); save('list', v); }} />
      <p className="tiny">Sky quality: {s.quality}. It adjusts automatically to keep things smooth.</p>
      <hr className="sep" />
      <div className="stack" style={{ marginTop: 0 }}>
        <div className="row"><a className="btn ghost" href="/rules" target="_blank" rel="noopener">Community rules</a><a className="btn ghost" href="/privacy" target="_blank" rel="noopener">Privacy</a></div>
        <button className="btn ghost" onClick={exportData}>Download my data</button>
        <button className="btn ghost" onClick={onSignOut}>Sign out</button>
        <details><summary className="tiny" style={{ cursor: 'pointer' }}>Delete my account</summary>
          <p className="tiny">This removes your profile, lanterns, and bonds permanently. Type DELETE to confirm.</p>
          <div className="row"><input className="field" value={confirmDel} onChange={(e) => setConfirmDel(e.target.value)} aria-label="Type DELETE" /><button className="btn danger" disabled={confirmDel !== 'DELETE'} onClick={del}>Delete</button></div>
          <div className="err">{err}</div></details>
      </div>
    </Sheet>
  );
}
