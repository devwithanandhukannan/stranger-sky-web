'use client';
import { useEffect } from 'react';
import { useUI, MOOD_COLORS, MOOD_NAMES, F_ECHO, F_BUSY } from '@/lib/sky/store';
import { useSky } from './ctx';
import { IcoPin, IcoSky, IcoRefresh, IcoSparkle, IcoIncognito } from './icons';

// The calm list view: for devices that struggle with WebGL or wanderers who prefer reading.
export function ListView() {
  const { ui, world } = useSky();
  const near = useUI(ui, (s) => s.near);
  const incoming = useUI(ui, (s) => s.incoming);
  const galaxies = useUI(ui, (s) => s.galaxies);
  const galaxy = useUI(ui, (s) => s.galaxy);
  const census = useUI(ui, (s) => s.census);

  const currentGalaxy = galaxies.find((g) => g.slug === galaxy);
  const count = Math.max(0, (census.counts[galaxy] ?? 0) - 1);
  const myInterests = useUI(ui, (s) => s.userInterests);

  useEffect(() => {
    void world.feed();
  }, [world, galaxy]);

  return (
    <main className="listview" data-ui>
      <div className="listview-panel">
        <header className="list-head">
          <div className="list-head-info">
            <h1 className="list-title">Thoughts nearby</h1>
            <p className="list-sub">
              {currentGalaxy?.name || 'Sky'} · {galaxy === 'neighbours' ? '≤ 100 km radius' : `${count} wandering lights`}
            </p>
          </div>

          <div className="list-actions">
            <select
              className="field sm list-galaxy-select"
              value={galaxy}
              onChange={(e) => void world.travel(e.target.value)}
              aria-label="Galaxy"
            >
              {galaxies.map((g) => (
                <option key={g.slug} value={g.slug}>
                  {g.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              className="btn ghost sm"
              onClick={() => void world.feed()}
              title="Refresh thoughts nearby"
            >
              <IcoRefresh size={13} style={{ marginRight: 4 }} />
              Refresh
            </button>

            <button
              type="button"
              className="btn ghost sm"
              onClick={() => world.hop()}
              title="Hop to another part of the sky"
            >
              Hop
            </button>

            <button
              type="button"
              className="btn sm list-return-sky-btn"
              onClick={() => {
                ui.set({ listMode: false });
                try {
                  localStorage.setItem('list', '0');
                } catch {}
              }}
              title="Switch back to interactive 3D Sky canvas"
            >
              <IcoSky size={14} style={{ marginRight: 5 }} />
              3D Sky
            </button>
          </div>
        </header>

        {!near.length ? (
          <div className="list-empty-state">
            <div className="list-empty-icon">
              <IcoSparkle size={26} style={{ color: 'var(--accent)' }} />
            </div>
            <h3 className="list-empty-title">The sky is quiet here</h3>
            <p className="list-empty-text">
              No thoughts are floating within orbit right now. Tap <strong>Refresh</strong> to scan for wanderers, or <strong>Hop</strong> to drift toward another cluster of lights.
            </p>
            <div className="list-empty-actions">
              <button
                type="button"
                className="btn sm"
                onClick={() => void world.feed()}
              >
                <IcoRefresh size={14} style={{ marginRight: 6 }} />
                Refresh Nearby
              </button>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => world.hop()}
              >
                Hop to Wander
              </button>
              <button
                type="button"
                className="btn ghost sm"
                onClick={() => {
                  ui.set({ listMode: false });
                  try {
                    localStorage.setItem('list', '0');
                  } catch {}
                }}
              >
                <IcoSky size={14} style={{ marginRight: 6 }} />
                Open 3D Canvas
              </button>
            </div>
          </div>
        ) : (
          <ul className="list-cards">
            {near.map((n) => {
              const isEcho = !!(n.f & F_ECHO);
              const isBusy = !!(n.f & F_BUSY);
              const hasIncoming = incoming.includes(n.sid);
              const moodColor = MOOD_COLORS[n.m] || '#9fb0ff';

              return (
                <li key={n.sid} className="list-card-item">
                  <i
                    className="dot list-item-dot"
                    style={{
                      background: moodColor,
                      boxShadow: `0 0 12px ${moodColor}`,
                    }}
                  />
                  <div className="list-card-body">
                    <p className="list-card-thought">
                      {n.t || 'Quiet. No thought shared.'}
                    </p>
                    <div className="list-card-meta">
                      <span className="list-card-mood">{MOOD_NAMES[n.m] || 'calm'}</span>
                      {n.isIncognito && (
                        <span className="top-incognito-badge" style={{ fontSize: 10.5, padding: '2px 8px', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <IcoIncognito size={11} /> Ignoto
                        </span>
                      )}
                      {isEcho && <span className="list-card-tag echo">echo</span>}
                      {isBusy && <span className="list-card-tag busy">in conversation</span>}
                      {typeof n.distKm === 'number' && (
                        <span className="dist-chip" title="Fuzzed distance for privacy">
                          <IcoPin size={11} /> ~{n.distKm} km away
                        </span>
                      )}
                    </div>
                    {n.interests && n.interests.length > 0 && (
                      <div className="light-interests-list" style={{ margin: '6px 0 0' }}>
                        {n.interests.map((tag) => {
                          const shared = myInterests.map((t) => t.toLowerCase()).includes(tag.toLowerCase());
                          return (
                            <span key={tag} className={`interest-tag-pill${shared ? ' shared' : ''}`} style={{ fontSize: 11, padding: '3px 9px', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
                              {shared && <IcoSparkle size={10} />}#{tag}
                            </span>
                          );
                        })}
                      </div>
                    )}

                  </div>

                  <div className="list-card-actions">
                    {!isEcho && (
                      <button
                        type="button"
                        className="btn ghost sm list-report-btn"
                        onClick={() => ui.set({ panel: 'report', reportSid: n.sid })}
                        title="Report thought"
                      >
                        Report
                      </button>
                    )}
                    <button
                      type="button"
                      className={`btn sm ${hasIncoming ? 'pulse-back' : ''}`}
                      disabled={isBusy}
                      onClick={() => world.pulse(n.sid)}
                    >
                      {hasIncoming ? 'Pulse back' : 'Pulse'}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </main>
  );
}
