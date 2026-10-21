'use client';
import { useEffect, useState, type ReactNode } from 'react';
import { useUI, MOOD_COLORS, MOOD_NAMES, F_ECHO, F_NEW, F_VET, F_BUSY } from '@/lib/sky/store';
import { useSky } from './ctx';
import { setSound, sfx, speakMessage } from '@/lib/sky/audio';
import { api, API } from '@/lib/api';
import { IcoPin, IcoCalendar, IcoAge, IcoBond, IcoChat, IcoChime, IcoCrystal, IcoBell, IcoClock, IcoSun, IcoSunset, IcoMoon, IcoCheck, IcoSparkle, IcoIncognito, IcoShieldAlert, IcoX } from './icons';

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
        <header className="sheet-h"><h2>{title}</h2><button className="icon" onClick={onClose} aria-label="Close"><IcoX size={15} /></button></header>
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
  if (!sid) return null;
  const n = near.find((x) => x.sid === sid);
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
    <Sheet title="One Sky · Interests & Universe" onClose={() => ui.set({ panel: null })} tall>
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
      <div className="sheet-card theme-sheet-card">
        <div className="theme-header-row">
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
            <span className="tiny theme-auto-badge">
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0071e3' }} />
              Auto: {getTimeBasedThemeId() === 'day' ? 'Daylight' : getTimeBasedThemeId() === 'evening' ? 'Sunset' : 'Dark Space'}
            </span>
          )}
        </div>

        {/* Live sync banner */}
        {s.skyTheme === 'auto' ? (
          <div className="theme-sync-banner">
            <div className="theme-sync-info">
              <IcoClock size={15} style={{ color: '#0071e3', flexShrink: 0, marginTop: 2 }} />
              <span>
                Atmosphere is <strong>automatically matching your clock</strong> ({getTimeBasedThemeId() === 'day' ? 'Daylight' : getTimeBasedThemeId() === 'evening' ? 'Sunset Twilight' : 'Deep Cosmos'}).
              </span>
            </div>
            <span className="tiny theme-sync-schedule">
              {getThemeScheduleDescription()}
            </span>
          </div>
        ) : (
          <div className="theme-locked-banner">
            <span style={{ fontSize: 12.5, color: 'var(--ink2)' }}>
              Custom theme locked. Atmosphere is not adapting to the time of day.
            </span>
            <button
              type="button"
              className="btn sm theme-reenable-btn"
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

        <div className="theme-grid">
          {[
            {
              id: 'auto',
              name: 'Auto Sync',
              sub: `Syncs with clock (${getTimeBasedThemeId() === 'day' ? 'Daylight' : getTimeBasedThemeId() === 'evening' ? 'Sunset' : 'Dark Space'})`,
              icon: IcoClock,
              iconColor: '#7aa2ff',
            },
            {
              id: 'day',
              name: 'Daylight Sky',
              sub: 'Luminous azure & sunlight (06:00–17:00)',
              icon: IcoSun,
              iconColor: '#fbbf24',
            },
            {
              id: 'evening',
              name: 'Sunset Twilight',
              sub: 'Golden rose & violet horizon (17:00–20:30)',
              icon: IcoSunset,
              iconColor: '#ff6584',
            },
            {
              id: 'midnight',
              name: 'Dark Space',
              sub: 'Obsidian cosmos & stars (20:30–06:00)',
              icon: IcoMoon,
              iconColor: '#93c5fd',
            },
          ].map((item) => {
            const IconComp = item.icon;
            const active = s.skyTheme === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`theme-card${active ? ' active' : ''}`}
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
                aria-label={`Select ${item.name} theme`}
              >
                <div className={`theme-card-art ${item.id}`}>
                  <div className="theme-card-art-badge">
                    <IconComp size={15} style={{ color: item.iconColor }} />
                  </div>
                  {active && (
                    <div className="theme-card-active-pill">
                      <IcoCheck size={11} />
                      <span>ACTIVE</span>
                    </div>
                  )}
                </div>

                <div className="theme-card-meta">
                  <div className="theme-card-name-row">
                    <b className="theme-card-name">{item.name}</b>
                  </div>
                  <span className="theme-card-sub">{item.sub}</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <div className="sheet-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
              <IcoPin size={16} style={{ color: '#0071e3', flexShrink: 0 }} />
              <b style={{ fontSize: 14, color: 'var(--ink)' }}>Neighbour location discovery</b>
            </div>
            <div className="tiny muted" style={{ marginTop: 2 }}>
              Find strangers within 100 km in the Neighbours space
            </div>
          </div>
          <label className="switch" style={{ margin: 0, flexShrink: 0 }}>
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
          <div className="tiny" style={{ color: '#0071e3', display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#0071e3' }} /> Active · Fuzzed to ~1.1 km for privacy (max 100 km discovery)
          </div>
        )}
      </div>

      <div className="sheet-card settings-group">
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
          <div className="settings-sound-panel">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--ink)' }}>Message Sound Tone</span>
              <span className="tiny muted">Tap to listen</span>
            </div>
            <div className="sound-tone-grid">
              {[
                { id: 'pop', name: 'WhatsApp Pop', icon: IcoChat },
                { id: 'chime', name: 'Cosmic Chime', icon: IcoChime },
                { id: 'crystal', name: 'Crystal Ping', icon: IcoCrystal },
                { id: 'bell', name: 'Soft Bell', icon: IcoBell },
              ].map((tone) => {
                const IconComp = tone.icon;
                const active = s.messageTone === tone.id;
                return (
                  <button
                    key={tone.id}
                    type="button"
                    className={`sound-tone-btn${active ? ' active' : ''}`}
                    onClick={() => {
                      ui.set({ messageTone: tone.id });
                      try { localStorage.setItem('messageTone', tone.id); } catch { /* ignore */ }
                      sfx.msgSent(tone.id);
                      setTimeout(() => sfx.msgReceived(tone.id), 260);
                    }}
                  >
                    <IconComp size={15} style={{ opacity: active ? 1 : 0.7 }} />
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
      </div>

      <div className="sheet-card settings-group">
        <Row label="Haptics" hint="Gentle vibration on pulses" on={s.haptics} set={(v) => { ui.set({ haptics: v }); save('haptics', v); }} />
        <Row label="Lite mode" hint="Fewer effects, saves battery and data" on={s.lite} set={(v) => { ui.set({ lite: v }); save('lite', v); }} />
        <Row label="List view" hint="Thoughts as a simple list instead of the sky" on={s.listMode} set={(v) => { ui.set({ listMode: v, panel: null }); save('list', v); }} />
        <div style={{ padding: '10px 16px', fontSize: 12, color: 'var(--ink3)' }}>
          Sky quality: {s.quality}. It adjusts automatically to keep things smooth.
        </div>
      </div>

      <div className="sheet-card settings-actions-card">
        <div className="row" style={{ gap: 10, marginBottom: 10 }}>
          <a className="btn ghost settings-legal-btn" href="/rules" target="_blank" rel="noopener">Community rules</a>
          <a className="btn ghost settings-legal-btn" href="/privacy" target="_blank" rel="noopener">Privacy</a>
        </div>
        <div className="stack" style={{ gap: 8, margin: 0 }}>
          <button className="btn ghost" onClick={exportData}>Download my data</button>
          <button className="btn ghost" onClick={onSignOut}>Sign out</button>
          <details style={{ marginTop: 6 }}><summary className="tiny muted" style={{ cursor: 'pointer', padding: '4px 0' }}>Delete my account</summary>
            <p className="tiny muted" style={{ margin: '8px 0' }}>This removes your profile, lanterns, and bonds permanently. Type DELETE to confirm.</p>
            <div className="row" style={{ gap: 8 }}><input className="field" value={confirmDel} onChange={(e) => setConfirmDel(e.target.value)} aria-label="Type DELETE" /><button className="btn danger" disabled={confirmDel !== 'DELETE'} onClick={del}>Delete</button></div>
            <div className="err" style={{ marginTop: 6 }}>{err}</div>
          </details>
        </div>
      </div>
    </Sheet>
  );
}
