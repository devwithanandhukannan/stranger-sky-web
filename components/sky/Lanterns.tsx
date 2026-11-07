'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { useUI } from '@/lib/sky/store';
import { useSky } from './ctx';

type Thread = { mine: boolean; body: string; at: string }[];
type Item = { id: number; body: string; status: string; hops: number; thread: Thread; kept: boolean; caught?: boolean; createdAt?: string };
type Inbox = { sent: Item[]; held: Item[]; left?: number };
type Held = { id: number; body: string; hops: number; galaxy?: string };

const ERR: Record<string, string> = {
  daily_limit: 'You have released all your lanterns for today. Come back tomorrow.',
  content_not_allowed: 'Links and blocked words are not allowed in lanterns.',
  too_many_held: 'You are holding three lanterns already. Answer or release one first.',
  thread_full: 'This thread is full.',
  invalid_input: 'Please write a shorter thought.',
  unauthenticated: 'Lanterns require an account. Please sign in.',
  no_profile: 'Please complete your profile to use lanterns.',
  not_found: 'That lantern has already drifted away.',
  not_allowed: 'You cannot do that with this lantern.',
  already_reported: 'You already reported this lantern.',
};

export function LanternsSheet() {
  const { ui, getToken } = useSky();
  const drift = useUI(ui, (s) => s.lanternDrift);
  const isIncognito = useUI(ui, (s) => s.isIncognito);
  const tick = useUI(ui, (s) => s.inboxTick);

  const [tab, setTab] = useState<'catch' | 'release' | 'mine'>('catch');
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [left, setLeft] = useState<number>(5);
  const [caught, setCaught] = useState<Held | null>(null);
  const [body, setBody] = useState('');
  const [reply, setReply] = useState('');
  const [inbox, setInbox] = useState<Inbox>({ sent: [], held: [] });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const close = () => ui.set({ panel: null });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const call = useCallback(
    async <T,>(method: string, path: string, payload?: unknown): Promise<T | null> => {
      setErr('');
      let token = await getToken();
      if (!token) {
        try {
          token = await getToken(true);
        } catch {}
      }
      if (!token) {
        setErr('Lanterns require an account. Please sign in.');
        return null;
      }
      try {
        return await api<T>(method, `/lanterns${path}`, token, payload);
      } catch (e) {
        const msg = (e as Error).message;
        setErr(ERR[msg] || (msg && msg !== 'error' ? msg.replace(/_/g, ' ') : 'Something went wrong.'));
        return null;
      }
    },
    [getToken]
  );

  const load = useCallback(async () => {
    if (isIncognito) return;
    const res = await call<Inbox>('GET', '/inbox');
    if (res) {
      setInbox(res);
      if (typeof res.left === 'number') setLeft(res.left);
      if (res.held && res.held.length > 0 && !caught) {
        const first = res.held[0];
        setCaught({ id: first.id, body: first.body, hops: first.hops });
      }
    }
  }, [call, isIncognito, caught]);

  useEffect(() => {
    void load();
  }, [load, tick]);

  const handleCatch = async () => {
    setBusy(true);
    setErr('');
    try {
      const res = await call<{ lantern: Held | null }>('POST', '/catch');
      if (res?.lantern) {
        setCaught(res.lantern);
        ui.set({ lanternDrift: false, toast: 'You caught a drifting lantern' });
        setTab('catch');
        void load();
      } else {
        setErr('No floating lanterns caught right now. Release one or try again shortly.');
        ui.set({ lanternDrift: false });
      }
    } finally {
      setBusy(false);
    }
  };

  const handleRelease = async () => {
    const val = body.trim();
    if (!val || busy) return;
    setBusy(true);
    setErr('');
    try {
      const res = await call<{ id: number; left: number }>('POST', '', { body: val });
      if (res) {
        setBody('');
        setLeft(res.left);
        ui.set({ toast: 'Your lantern has been released into the sky' });
        void load();
        setTab('mine');
      }
    } finally {
      setBusy(false);
    }
  };

  const handleSendReply = async (id: number) => {
    const val = reply.trim();
    if (!val || busy) return;
    setBusy(true);
    try {
      const res = await call('POST', `/${id}/reply`, { body: val });
      if (res) {
        setReply('');
        ui.set({ toast: 'Anonymous reply sent' });
        void load();
      }
    } finally {
      setBusy(false);
    }
  };

  const handlePassOn = async (id: number) => {
    setBusy(true);
    try {
      const res = await call('POST', `/${id}/release`);
      if (res) {
        setCaught(null);
        ui.set({ toast: 'Lantern released back into the wind' });
        void load();
      }
    } finally {
      setBusy(false);
    }
  };

  const handleKeep = async (id: number) => {
    setBusy(true);
    try {
      const res = await call<{ bonded: boolean; with?: { id: string; name: string } }>('POST', `/${id}/keep`);
      if (res?.bonded && res.with) {
        ui.set({ toast: `Connected with ${res.with.name}! Added to your Chats.` });
      } else {
        ui.set({ toast: 'You chose to keep in touch. Waiting for stranger…' });
      }
      void load();
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async (id: number) => {
    setBusy(true);
    setErr('');
    try {
      const res = await call('DELETE', `/${id}`);
      if (res) {
        ui.set({ toast: 'Lantern removed' });
        setSelectedItem(null);
        setDeletingId(null);
        void load();
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="sky-drawer-backdrop"
      data-ui
      role="dialog"
      aria-label="Lanterns"
      onClick={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <aside className="sky-drawer">
        <header className="sky-drawer-header">
          <h2 className="sky-drawer-title">Lanterns</h2>
          <button
            type="button"
            className="sky-drawer-close"
            onClick={close}
            aria-label="Close Lanterns"
          >
            Close
          </button>
        </header>

        <div className="sky-drawer-body">
          {isIncognito ? (
            <div className="lanterns-incognito-notice">
              <p className="lanterns-notice-title">Lanterns require an account</p>
              <p className="lanterns-notice-sub">
                Drifting lanterns are anonymous, lasting encounters exchanged between wanderers across the cosmos. Sign in to release, catch, and reply to lanterns.
              </p>
              <button
                type="button"
                className="sky-btn-say-hello"
                style={{ width: '100%', marginTop: 18 }}
                onClick={() => {
                  close();
                  window.location.href = '/login';
                }}
              >
                Sign in to Untold
              </button>
            </div>
          ) : (
            <>
              {/* Tab Navigation */}
              <div className="lanterns-tabs" role="tablist">
                <button
                  type="button"
                  className={`lanterns-tab${tab === 'catch' ? ' active' : ''}`}
                  onClick={() => {
                    setSelectedItem(null);
                    setTab('catch');
                  }}
                  role="tab"
                  aria-selected={tab === 'catch'}
                >
                  <span>Catch</span>
                  {drift && <span className="lanterns-drift-dot" title="A lantern is drifting by" />}
                </button>
                <button
                  type="button"
                  className={`lanterns-tab${tab === 'release' ? ' active' : ''}`}
                  onClick={() => {
                    setSelectedItem(null);
                    setTab('release');
                  }}
                  role="tab"
                  aria-selected={tab === 'release'}
                >
                  Release
                </button>
                <button
                  type="button"
                  className={`lanterns-tab${tab === 'mine' ? ' active' : ''}`}
                  onClick={() => {
                    setSelectedItem(null);
                    setTab('mine');
                  }}
                  role="tab"
                  aria-selected={tab === 'mine'}
                >
                  <span>My Lanterns</span>
                  {inbox.sent.length + inbox.held.length > 0 && (
                    <span className="lanterns-count-badge">
                      {inbox.sent.length + inbox.held.length}
                    </span>
                  )}
                </button>
              </div>

              {err && <div className="lanterns-error-msg">{err}</div>}

              {/* 1. Catch Tab */}
              {tab === 'catch' && (
                <div className="lanterns-content-section">
                  {caught ? (
                    <div className="lantern-card-active">
                      <div className="lantern-meta-row">
                        <span className="lantern-meta-hop">Hop {caught.hops} of 6</span>
                        <span className="lantern-meta-badge">Held by you</span>
                      </div>

                      <blockquote className="lantern-body-quote">
                        “{caught.body}”
                      </blockquote>

                      {/* Conversation thread if replies exist */}
                      {(() => {
                        const heldItem = inbox.held.find((h) => h.id === caught.id);
                        const thread = heldItem?.thread || [];
                        return (
                          <>
                            {thread.length > 0 && (
                              <div className="lantern-thread-list">
                                {thread.map((t, idx) => (
                                  <div
                                    key={idx}
                                    className={`lantern-thread-bubble${t.mine ? ' mine' : ' other'}`}
                                  >
                                    <span className="lantern-thread-sender">
                                      {t.mine ? 'You' : 'Stranger'}
                                    </span>
                                    <p className="lantern-thread-text">{t.body}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                            {/* Reply Input Form */}
                            <form
                              className="lantern-reply-form"
                              onSubmit={(e) => {
                                e.preventDefault();
                                void handleSendReply(caught.id);
                              }}
                            >
                              <input
                                type="text"
                                className="lantern-reply-input"
                                placeholder="Write a gentle anonymous reply…"
                                value={reply}
                                maxLength={200}
                                onChange={(e) => setReply(e.target.value)}
                              />
                              <button
                                type="submit"
                                className="sky-btn-say-hello"
                                disabled={!reply.trim() || busy}
                              >
                                Reply
                              </button>
                            </form>

                            <div className="lantern-actions-row">
                              <button
                                type="button"
                                className="sky-btn-link"
                                disabled={busy || heldItem?.kept}
                                onClick={() => void handleKeep(caught.id)}
                              >
                                {heldItem?.kept ? 'Waiting for stranger…' : 'Keep in touch'}
                              </button>
                              <button
                                type="button"
                                className="sky-btn-link"
                                disabled={busy}
                                onClick={() => void handlePassOn(caught.id)}
                              >
                                Pass to next stranger
                              </button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <div className="lanterns-empty-view">
                      <div className="lanterns-orb-glow" />
                      <h3 className="lanterns-empty-title">
                        {drift ? 'A lantern is drifting across your sky' : 'No lanterns drifting near you'}
                      </h3>
                      <p className="lanterns-empty-sub">
                        {drift
                          ? 'A stranger released a quiet note into the cosmos. Reach out and catch it to read their words.'
                          : 'Lanterns drift gently through the night sky. Watch the cosmos or reach out to catch one drifting from across the world.'}
                      </p>
                      <button
                        type="button"
                        className="sky-btn-say-hello"
                        disabled={busy}
                        onClick={handleCatch}
                      >
                        {busy ? 'Catching…' : 'Catch a drifting lantern'}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* 2. Release Tab */}
              {tab === 'release' && (
                <div className="lanterns-content-section">
                  <div className="lantern-release-header">
                    <span className="lantern-release-title">Release a lantern</span>
                    <span className="lantern-release-sub">
                      An anonymous note set adrift in the sky. Strangers worldwide may catch it, reflect, and reply.
                    </span>
                  </div>

                  <textarea
                    className="lantern-release-textarea"
                    placeholder="Write a thought, a quiet reflection, or a kind word for a stranger…"
                    rows={4}
                    maxLength={200}
                    value={body}
                    onChange={(e) => setBody(e.target.value)}
                  />

                  <div className="lantern-release-footer">
                    <span className="lantern-char-count">{body.length} / 200</span>
                    <span className="lantern-limit-left">{left} remaining today</span>
                  </div>

                  <button
                    type="button"
                    className="sky-btn-say-hello"
                    style={{ width: '100%', marginTop: 14 }}
                    disabled={!body.trim() || busy || left <= 0}
                    onClick={handleRelease}
                  >
                    {busy ? 'Releasing…' : 'Release into the sky'}
                  </button>
                </div>
              )}

              {/* 3. My Lanterns Tab */}
              {tab === 'mine' && (
                <div className="lanterns-content-section">
                  {selectedItem ? (
                    <div className="lantern-card-active">
                      <button
                        type="button"
                        className="sky-btn-link"
                        style={{ marginBottom: 12, paddingLeft: 0 }}
                        onClick={() => setSelectedItem(null)}
                      >
                        ← Back to My Lanterns
                      </button>

                      <div className="lantern-meta-row">
                        <span className="lantern-meta-hop">Hop {selectedItem.hops} of 6</span>
                        <span className="lantern-meta-badge">
                          {selectedItem.thread.length > 0 ? 'Stranger answered' : 'Drifting in the sky'}
                        </span>
                      </div>

                      <blockquote className="lantern-body-quote">
                        “{selectedItem.body}”
                      </blockquote>

                      {/* Thread Messages */}
                      <div className="lantern-thread-list">
                        {selectedItem.thread.map((t, idx) => (
                          <div
                            key={idx}
                            className={`lantern-thread-bubble${t.mine ? ' mine' : ' other'}`}
                          >
                            <span className="lantern-thread-sender">
                              {t.mine ? 'You' : 'Stranger'}
                            </span>
                            <p className="lantern-thread-text">{t.body}</p>
                          </div>
                        ))}
                      </div>

                      {/* Reply back if in active thread */}
                      <form
                        className="lantern-reply-form"
                        onSubmit={(e) => {
                          e.preventDefault();
                          void handleSendReply(selectedItem.id);
                        }}
                      >
                        <input
                          type="text"
                          className="lantern-reply-input"
                          placeholder="Reply back to this stranger…"
                          value={reply}
                          maxLength={200}
                          onChange={(e) => setReply(e.target.value)}
                        />
                        <button
                          type="submit"
                          className="sky-btn-say-hello"
                          disabled={!reply.trim() || busy}
                        >
                          Reply
                        </button>
                      </form>

                      {/* Delete action */}
                      <div className="lantern-actions-row">
                        {deletingId === selectedItem.id ? (
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ fontSize: 13, color: '#ef4444' }}>Delete this lantern?</span>
                            <button
                              type="button"
                              className="sky-btn-link"
                              style={{ color: '#ef4444' }}
                              onClick={() => void handleDelete(selectedItem.id)}
                            >
                              Confirm
                            </button>
                            <button
                              type="button"
                              className="sky-btn-link"
                              onClick={() => setDeletingId(null)}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="sky-btn-link"
                            style={{ color: '#ef4444' }}
                            onClick={() => setDeletingId(selectedItem.id)}
                          >
                            Delete lantern
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="lanterns-list-view">
                      {inbox.sent.length === 0 && inbox.held.length === 0 ? (
                        <p className="chats-empty-hint">
                          No lanterns yet. Release a lantern into the sky or catch one drifting by.
                        </p>
                      ) : (
                        <>
                          {inbox.held.length > 0 && (
                            <div className="lanterns-group">
                              <span className="lanterns-group-title">Lanterns You Caught</span>
                              {inbox.held.map((h) => (
                                <div
                                  key={'h' + h.id}
                                  className="lanterns-item-card"
                                  onClick={() => setSelectedItem(h)}
                                >
                                  <div className="lanterns-item-dot" />
                                  <div className="lanterns-item-text">
                                    <p className="lanterns-item-quote">“{h.body}”</p>
                                    <span className="lanterns-item-sub">
                                      {h.thread.length > 0
                                        ? `${h.thread.length} replies`
                                        : 'Waiting for your reply'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {inbox.sent.length > 0 && (
                            <div className="lanterns-group">
                              <span className="lanterns-group-title">Lanterns You Released</span>
                              {inbox.sent.map((s) => (
                                <div
                                  key={'s' + s.id}
                                  className="lanterns-item-card"
                                  onClick={() => setSelectedItem(s)}
                                >
                                  <div
                                    className="lanterns-item-dot"
                                    style={{
                                      background: s.thread.length > 0 ? '#38bdf8' : '#fbbf24',
                                    }}
                                  />
                                  <div className="lanterns-item-text">
                                    <p className="lanterns-item-quote">“{s.body}”</p>
                                    <span className="lanterns-item-sub">
                                      {s.thread.length > 0
                                        ? `Stranger replied · ${s.thread.length} messages`
                                        : 'Drifting across the sky'}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}

