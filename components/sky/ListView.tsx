'use client';
import { useEffect } from 'react';
import { useUI, MOOD_COLORS, MOOD_NAMES, F_ECHO, F_BUSY } from '@/lib/sky/store';
import { useSky } from './ctx';
import { IcoPin, IcoRefresh, IcoSparkle, IcoIncognito, IcoX } from './icons';

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

  const closeList = () => {
    ui.set({ listMode: false });
    try {
      localStorage.setItem('list', '0');
    } catch {}
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeList();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    void world.feed();
  }, [world, galaxy]);

  return (
    <main
      className="listview"
      data-ui
      role="dialog"
      aria-label="Thoughts nearby"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeList();
      }}
    >
      <div className="listview-panel">
        <header className="list-head">
          <div className="list-head-top">
            <div className="list-head-info">
              <h1 className="list-title">Thoughts nearby</h1>
              <p className="list-sub">
                {currentGalaxy?.name || 'Sky'} · {galaxy === 'neighbours' ? '≤ 100 km' : count === 1 ? '1 wanderer' : `${count} wanderers`}
              </p>
            </div>

            <button
              type="button"
              className="icon list-close-btn"
              onClick={closeList}
              aria-label="Close thoughts nearby"
              title="Close"
            >
              <IcoX size={15} />
            </button>
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
              title="Refresh thoughts"
            >
              <IcoRefresh size={13} style={{ marginRight: 4 }} />
              Refresh
            </button>

            <button
              type="button"
              className="btn ghost sm"
              onClick={() => world.hop()}
              title="Hop to new lights"
            >
              Hop
            </button>
          </div>
        </header>

        {!near.length ? (
          <div className="list-empty-state">
            <div className="list-empty-icon">
              <IcoSparkle size={24} style={{ color: 'var(--accent)' }} />
            </div>
            <h3 className="list-empty-title">The sky is quiet</h3>
            <p className="list-empty-text">
              No thoughts nearby right now.
            </p>
            <div className="list-empty-actions">
              <button
                type="button"
                className="btn sm"
                onClick={() => world.hop()}
              >
                Hop to new lights
              </button>
            </div>
          </div>
        ) : (
          <>
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
          <div className="list-footer-action" style={{ textAlign: 'center', marginTop: 14 }}>
            <button
              type="button"
              className="btn ghost sm"
              onClick={() => world.hop()}
            >
              Hop to another area
            </button>
          </div>
        </>
      )}
      </div>
    </main>
  );
}
