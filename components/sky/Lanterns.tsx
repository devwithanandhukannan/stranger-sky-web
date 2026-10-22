'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useUI } from '@/lib/sky/store';
import { useSky } from './ctx';
import { ReportForm, Sheet } from './Sheets';

type Thread = { mine: boolean; body: string; at: string }[];
type Item = { id: number; body: string; status: string; hops: number; thread: Thread; kept: boolean; caught?: boolean };
type Inbox = { sent: Item[]; held: Item[] };
type Held = { id: number; body: string; hops: number; galaxy?: string };

const ERR: Record<string, string> = {
  daily_limit: 'You have released all your lanterns for today.',
  content_not_allowed: 'Links and blocked words are not allowed.',
  too_many_held: 'Answer or release your lanterns first.',
  thread_full: 'This thread is full.',
};

export function LanternSheet() {
  const { ui, world, getToken } = useSky();
  const drift = useUI(ui, (s) => s.lanternDrift), tick = useUI(ui, (s) => s.inboxTick);
  const bonds = useUI(ui, (s) => s.bonds);

  const [tab, setTab] = useState<'inbox' | 'release' | 'catch' | 'mine'>('inbox');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [left, setLeft] = useState<number>(3);
  const [caught, setCaught] = useState<Held | null>(null);
  const [body, setBody] = useState('');
  const [reply, setReply] = useState('');
  const [inbox, setInbox] = useState<Inbox>({ sent: [], held: [] });
  const [err, setErr] = useState('');
  const [ok, setOk] = useState('');
  const [reporting, setReporting] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [busyDelete, setBusyDelete] = useState(false);

  const call = useCallback(async <T,>(m: string, p: string, b?: unknown): Promise<T | null> => {
    setErr('');
    const t = await getToken();
    if (!t) return null;
    try {
      return await api<T>(m, `/lanterns${p}`, t, b);
    } catch (e) {
      setErr(ERR[(e as Error).message] || 'Something went wrong.');
      return null;
    }
  }, [getToken]);

  const load = useCallback(async () => {
    const r = await call<Inbox>('GET', '/inbox');
    if (r) {
      setInbox(r);
      const remaining = Math.max(0, 3 - (r.sent?.length || 0));
      setLeft(remaining);
    }
  }, [call]);

  useEffect(() => {
    void load();
  }, [load, tick]);

  const doCatch = async () => {
    const r = await call<{ lantern: Held | null }>('POST', '/catch');
    if (r?.lantern) {
      setCaught(r.lantern);
      ui.set({ lanternDrift: false });
      setTab('catch');
    } else if (r) {
      setErr('Nothing to catch right now. Try again later.');
      ui.set({ lanternDrift: false });
    }
  };

  const doRelease = async () => {
    const t = body.trim();
    if (!t) return;
    const r = await call<{ left: number }>('POST', '', { body: t });
    if (r) {
      setBody('');
      setLeft(r.left);
      setOk(`Your lantern is drifting away. ${r.left} left today.`);
      void load();
      setTab('inbox');
    }
  };

  const sendReply = async (id: number, text: string, after: () => void) => {
    if (!text.trim()) return;
    if (await call('POST', `/${id}/reply`, { body: text.trim() })) {
      after();
      void load();
    }
  };

  const deleteLantern = async (id: number) => {
    setBusyDelete(true);
    try {
      const res = await call('DELETE', `/${id}`);
      if (res) {
        ui.set({ toast: 'Lantern deleted and removed from the sky.' });
        setOk('Lantern deleted and removed from the sky.');
        setSelectedItem(null);
        setDeletingId(null);
        void load();
      }
    } finally {
      setBusyDelete(false);
    }
  };

  const ThreadDetails = ({ it, onBack }: { it: Item; onBack?: () => void }) => {
    const [r, setR] = useState('');
    const [bond, setBond] = useState('');
    return (
      <div className="thread-detail-container">
        {onBack && (
          <button className="btn-ghost-back" onClick={onBack}>
            ← Back to Inbox
          </button>
        )}
        <div className="inbox-card special" style={{ marginTop: 8, marginBottom: 16 }}>
          <div className="orb-amber" />
          <div className="inbox-card-info">
            <h3 className="inbox-card-title">
              {it.caught ? 'A lantern you caught' : 'Your released lantern'}
            </h3>
            <p className="inbox-card-sub italic">“{it.body}”</p>
          </div>
        </div>

        <div className="thread-messages">
          {it.thread.length === 0 && (
            <p className="muted tiny" style={{ textAlign: 'center', margin: '20px 0' }}>
              No replies yet. When a stranger answers, their note will appear here.
            </p>
          )}
          {it.thread.map((m, i) => (
            <div key={i} className={`thread-bub${m.mine ? ' me' : ' them'}`}>
              <span className="thread-bub-author">{m.mine ? 'You' : 'Stranger'}</span>
              <p className="thread-bub-body">{m.body}</p>
            </div>
          ))}
        </div>

        {it.caught !== false && (
          <div className="row" style={{ marginTop: 14, gap: 8 }}>
            <input
              className="field"
              value={r}
              maxLength={400}
              placeholder="Reply anonymously…"
              aria-label="Reply"
              onChange={(e) => setR(e.target.value)}
            />
            <button
              className="btn-ivory"
              disabled={!r.trim()}
              onClick={() => sendReply(it.id, r, () => { setR(''); void load(); })}
            >
              Send
            </button>
          </div>
        )}

        <div className="row" style={{ marginTop: 12, justifyContent: 'space-between', alignItems: 'center' }}>
          {it.thread.length > 0 && (
            <button
              className="btn-ghost-action"
              disabled={it.kept}
              onClick={async () => {
                const k = await call<{ bonded: boolean; with?: { name: string } }>('POST', `/${it.id}/keep`);
                if (k) {
                  setBond(k.bonded ? `You and ${k.with?.name} kept each other.` : 'Kept. They will see your name only if they keep you too.');
                  void load();
                }
              }}
            >
              {it.kept ? '✓ Kept in touch' : 'Keep in touch'}
            </button>
          )}
          <div className="row" style={{ gap: 8, margin: 0 }}>
            {!it.caught && (
              deletingId === it.id ? (
                <div className="row" style={{ gap: 6, margin: 0, alignItems: 'center' }}>
                  <span className="tiny" style={{ color: '#f87171', fontWeight: 600 }}>Delete permanently?</span>
                  <button
                    type="button"
                    className="btn danger sm"
                    disabled={busyDelete}
                    onClick={() => void deleteLantern(it.id)}
                  >
                    {busyDelete ? 'Deleting…' : 'Delete'}
                  </button>
                  <button
                    type="button"
                    className="btn ghost sm"
                    disabled={busyDelete}
                    onClick={() => setDeletingId(null)}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="btn-ghost-action"
                  style={{ color: '#f87171', borderColor: 'rgba(248, 113, 113, 0.3)' }}
                  onClick={() => setDeletingId(it.id)}
                >
                  Delete lantern
                </button>
              )
            )}
            <button className="btn-ghost-action" style={{ color: '#f87171' }} onClick={() => setReporting(it.id)}>
              Report
            </button>
          </div>
        </div>
        {bond && <p className="tiny" style={{ color: '#ffaa40', marginTop: 8 }}>{bond}</p>}
      </div>
    );
  };

  const answeredList = inbox.sent.filter((it) => it.thread && it.thread.length > 0);
  const title = tab === 'inbox' ? 'Inbox' : tab === 'release' ? 'Release a lantern' : tab === 'catch' ? 'Catch a lantern' : 'My lanterns';

  return (
    <Sheet
      title={title}
      onClose={() => ui.set({ panel: null })}
      tall
      className="lantern-sheet"
      headerExtra={<span className="lantern-header-count">{left} lanterns left tonight</span>}
    >
      {/* Tab Switcher allowing users to access old & new modes */}
      <div className="lantern-tabs" role="tablist">
        {(['inbox', 'release', 'catch', 'mine'] as const).map((t) => (
          <button
            key={t}
            role="tab"
            aria-selected={tab === t}
            className={tab === t ? 'on' : ''}
            onClick={() => {
              setTab(t);
              setSelectedItem(null);
              setDeletingId(null);
              setOk('');
              setErr('');
            }}
          >
            {t === 'inbox' ? 'Inbox' : t === 'release' ? 'Release' : t === 'catch' ? 'Catch' : 'Mine'}
          </button>
        ))}
      </div>

      {reporting !== null ? (
        <ReportForm
          onCancel={() => setReporting(null)}
          onSubmit={async (reason, details) => {
            await call('POST', `/${reporting}/report`, { reason, details });
            setReporting(null);
            setOk('Reported. You will not hear from them again.');
            void load();
          }}
        />
      ) : selectedItem ? (
        <ThreadDetails it={selectedItem} onBack={() => setSelectedItem(null)} />
      ) : tab === 'inbox' ? (
        <div className="inbox-container">
          {/* SECTION: NEW */}
          <div className="lantern-sec-title">NEW</div>

          <div className="inbox-cards-scroll">
            {answeredList.length > 0 && (
              answeredList.map((it) => (
                <div key={'ans-' + it.id} className="inbox-card special">
                  <div className="orb-amber" />
                  <div className="inbox-card-info">
                    <h3 className="inbox-card-title">A stranger answered your lantern</h3>
                    <p className="inbox-card-sub italic">
                      “{it.thread[it.thread.length - 1]?.body || it.body}”
                    </p>
                  </div>
                  <button className="btn-ivory" onClick={() => setSelectedItem(it)}>
                    Read
                  </button>
                </div>
              ))
            )}

            {inbox.held.length > 0 && (
              inbox.held.map((it) => (
                <div key={'held-' + it.id} className="inbox-card special">
                  <div className="orb-amber" />
                  <div className="inbox-card-info">
                    <h3 className="inbox-card-title">A lantern you caught</h3>
                    <p className="inbox-card-sub italic">“{it.body}”</p>
                  </div>
                  <button className="btn-ivory" onClick={() => setSelectedItem({ ...it, caught: true })}>
                    Read
                  </button>
                </div>
              ))
            )}

            {!answeredList.length && !inbox.held.length && (
              drift ? (
                <div className="inbox-card special">
                  <div className="orb-amber" />
                  <div className="inbox-card-info">
                    <h3 className="inbox-card-title">A lantern is drifting by</h3>
                    <p className="inbox-card-sub">Someone let a thought go into the sky · tap to catch</p>
                  </div>
                  <button className="btn-ivory" onClick={doCatch}>
                    Catch
                  </button>
                </div>
              ) : (
                <div className="inbox-card">
                  <div className="orb-amber" style={{ opacity: 0.65 }} />
                  <div className="inbox-card-info">
                    <h3 className="inbox-card-title">No new answers yet</h3>
                    <p className="inbox-card-sub">Release a lantern and wait for a wanderer to answer.</p>
                  </div>
                  <button className="btn-ivory" onClick={() => setTab('release')}>
                    Release
                  </button>
                </div>
              )
            )}
          </div>

          {/* SECTION: KEPT IN TOUCH */}
          <div className="lantern-sec-header">
            <div className="lantern-sec-title-row">
              <span className="lantern-sec-title">KEPT IN TOUCH</span>
              {bonds.length > 0 && (
                <span className="bonds-count-chip">{bonds.length}</span>
              )}
            </div>
            {bonds.length > 0 && (
              <button
                type="button"
                className="bonds-view-all-btn"
                onClick={() => ui.set({ panel: 'bonds' })}
              >
                View all ({bonds.length}) →
              </button>
            )}
          </div>

          {bonds.length > 0 ? (
            <div className="bonds-horizontal-rail">
              {[...bonds]
                .sort((a, b) => (a.online === b.online ? 0 : a.online ? -1 : 1))
                .map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    className={`bond-rail-item${b.online ? ' online' : ' away'}`}
                    onClick={() => {
                      if (b.online) {
                        world.callBond(b.id);
                        ui.set({ panel: null });
                      } else {
                        ui.set({ toast: `${b.name} is away right now.` });
                      }
                    }}
                    title={b.online ? `Say hi to ${b.name} (Online)` : `${b.name} (Away)`}
                  >
                    <div className="bond-rail-avatar-wrap">
                      <div className={b.online ? 'bond-orb-green' : 'bond-orb-purple'}>
                        <span className="bond-initial">{b.name.charAt(0).toUpperCase()}</span>
                      </div>
                      <span className={`bond-presence-indicator ${b.online ? 'live' : 'idle'}`} />
                    </div>
                    <span className="bond-rail-name">{b.name}</span>
                    <span className={`bond-rail-status ${b.online ? 'online' : 'away'}`}>
                      {b.online ? 'Say hi' : 'away'}
                    </span>
                  </button>
                ))}

              {bonds.length > 4 && (
                <button
                  type="button"
                  className="bond-rail-item view-more"
                  onClick={() => ui.set({ panel: 'bonds' })}
                  title="View all connections"
                >
                  <div className="bond-rail-avatar-wrap more">
                    <span className="more-count">+{bonds.length}</span>
                  </div>
                  <span className="bond-rail-name">All</span>
                  <span className="bond-rail-status">Manage</span>
                </button>
              )}
            </div>
          ) : (
            <div className="inbox-card empty-bonds-card">
              <div className="orb-purple" style={{ opacity: 0.55 }} />
              <div className="inbox-card-info">
                <h3 className="inbox-card-title">No kept bonds yet</h3>
                <p className="inbox-card-sub">
                  When you and a stranger both choose to keep in touch, they appear here.
                </p>
              </div>
            </div>
          )}

          {/* Large Action Button from Image 2 */}
          <div className="inbox-release-box">
            <button className="btn-release-main" onClick={() => setTab('release')}>
              Release a lantern
            </button>
            <p className="release-caption">
              A note for a stranger. It drifts, and you may never know where.
            </p>
          </div>
        </div>
      ) : tab === 'catch' ? (
        caught ? (
          <div className="catch-box">
            <div className="inbox-card special" style={{ marginBottom: 14 }}>
              <div className="orb-amber" />
              <div className="inbox-card-info">
                <h3 className="inbox-card-title">
                  A lantern from a stranger{caught.hops ? `, passed along ${caught.hops} time${caught.hops > 1 ? 's' : ''}` : ''}
                </h3>
                <p className="inbox-card-sub italic">“{caught.body}”</p>
              </div>
            </div>
            <div className="row" style={{ gap: 8 }}>
              <input
                className="field"
                value={reply}
                maxLength={400}
                placeholder="Write back…"
                aria-label="Reply"
                onChange={(e) => setReply(e.target.value)}
              />
              <button
                className="btn-ivory"
                disabled={!reply.trim()}
                onClick={() =>
                  sendReply(caught.id, reply, () => {
                    setReply('');
                    setCaught(null);
                    setOk('Sent. Find it under Mine or Inbox.');
                    void load();
                  })
                }
              >
                Reply
              </button>
            </div>
            <div className="row" style={{ marginTop: 14, justifyContent: 'space-between' }}>
              <button
                className="btn-ghost-action"
                onClick={async () => {
                  if (await call('POST', `/${caught.id}/release`)) {
                    setCaught(null);
                    setOk('You let it drift on to someone else.');
                  }
                }}
              >
                Let it go on
              </button>
              <button className="btn-ghost-action" style={{ color: '#f87171' }} onClick={() => setReporting(caught.id)}>
                Report
              </button>
            </div>
          </div>
        ) : (
          <div className="center" style={{ padding: '24px 0' }}>
            <div className="orb-amber" style={{ margin: '0 auto 16px', width: 48, height: 48 }} />
            <p className="muted" style={{ marginBottom: 16 }}>
              {drift
                ? 'A lantern is drifting your way right now.'
                : 'No lantern nearby right now. They appear every so often, keep an eye on the sky.'}
            </p>
            <button className="btn-ivory" style={{ padding: '10px 24px', fontSize: 15 }} disabled={!drift} onClick={doCatch}>
              Catch it
            </button>
          </div>
        )
      ) : tab === 'release' ? (
        <div className="release-view">
          <p className="muted tiny" style={{ marginBottom: 12 }}>
            Write something for a stranger. It drifts to someone you will never meet unless you both choose to.
          </p>
          <textarea
            className="field"
            rows={4}
            maxLength={200}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Something you would tell a stranger…"
            aria-label="Lantern message"
          />
          <div className="row" style={{ marginTop: 12, alignItems: 'center' }}>
            <span className="tiny" style={{ flex: 1, color: '#8a94a6' }}>
              {body.length}/200
            </span>
            <button
              className="btn-ivory"
              style={{ padding: '10px 26px', fontSize: 15 }}
              disabled={!body.trim()}
              onClick={doRelease}
            >
              Release
            </button>
          </div>
          <p className="release-caption" style={{ marginTop: 24 }}>
            A note for a stranger. It drifts, and you may never know where.
          </p>
        </div>
      ) : (
        <ul className="list lans" style={{ padding: 0 }}>
          {!inbox.sent.length ? (
            <p className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
              No lanterns released yet. Release a lantern into the sky to see it here.
            </p>
          ) : (
            inbox.sent.map((it) => (
              <div
                key={'s' + it.id}
                className={`inbox-card${it.thread.length > 0 ? ' special' : ''}`}
                style={{ cursor: 'pointer' }}
                onClick={() => setSelectedItem(it)}
              >
                <div className="orb-amber" />
                <div className="inbox-card-info">
                  <h3 className="inbox-card-title">
                    {it.thread.length > 0 ? 'Stranger answered' : 'Released by you'}
                  </h3>
                  <p className="inbox-card-sub italic">“{it.body}”</p>
                </div>
                <div
                  className="row"
                  style={{ gap: 8, margin: 0, alignItems: 'center' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {deletingId === it.id ? (
                    <div className="row" style={{ gap: 6, margin: 0, alignItems: 'center' }}>
                      <span className="tiny" style={{ color: '#f87171', fontWeight: 600, whiteSpace: 'nowrap' }}>
                        Delete?
                      </span>
                      <button
                        type="button"
                        className="btn danger sm"
                        style={{ minHeight: 28, padding: '4px 10px', fontSize: 12 }}
                        disabled={busyDelete}
                        onClick={() => void deleteLantern(it.id)}
                      >
                        {busyDelete ? 'Deleting…' : 'Delete'}
                      </button>
                      <button
                        type="button"
                        className="btn ghost sm"
                        style={{ minHeight: 28, padding: '4px 10px', fontSize: 12 }}
                        disabled={busyDelete}
                        onClick={() => setDeletingId(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button className="btn-ivory" onClick={() => setSelectedItem(it)}>
                        Open
                      </button>
                      <button
                        type="button"
                        className="btn-ghost-action"
                        style={{ color: '#f87171', borderColor: 'rgba(248, 113, 113, 0.3)', padding: '6px 12px' }}
                        onClick={() => setDeletingId(it.id)}
                        title="Delete this lantern"
                      >
                        Delete
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </ul>
      )}

      {err && <div className="err" style={{ marginTop: 12 }}>{err}</div>}
      {ok && <p className="tiny" style={{ color: '#ffaa40', marginTop: 12, textAlign: 'center' }}>{ok}</p>}
    </Sheet>
  );
}
