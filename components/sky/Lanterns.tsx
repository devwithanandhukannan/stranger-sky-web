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

const ERR: Record<string, string> = { daily_limit: 'You have released all your lanterns for today.', content_not_allowed: 'Links and blocked words are not allowed.', too_many_held: 'Answer or release your lanterns first.', thread_full: 'This thread is full.' };

export function LanternSheet() {
  const { ui, getToken } = useSky();
  const drift = useUI(ui, (s) => s.lanternDrift), tick = useUI(ui, (s) => s.inboxTick);
  const [tab, setTab] = useState<'catch' | 'release' | 'mine'>(drift ? 'catch' : 'release');
  const [caught, setCaught] = useState<Held | null>(null), [body, setBody] = useState(''), [reply, setReply] = useState('');
  const [inbox, setInbox] = useState<Inbox>({ sent: [], held: [] }), [err, setErr] = useState(''), [ok, setOk] = useState('');
  const [reporting, setReporting] = useState<number | null>(null);

  const call = useCallback(async <T,>(m: string, p: string, b?: unknown): Promise<T | null> => {
    setErr('');
    const t = await getToken(); if (!t) return null;
    try { return await api<T>(m, `/lanterns${p}`, t, b); } catch (e) { setErr(ERR[(e as Error).message] || 'Something went wrong.'); return null; }
  }, [getToken]);
  const load = useCallback(async () => { const r = await call<Inbox>('GET', '/inbox'); if (r) setInbox(r); }, [call]);
  useEffect(() => { if (tab === 'mine') void load(); }, [tab, tick, load]);

  const doCatch = async () => {
    const r = await call<{ lantern: Held | null }>('POST', '/catch');
    if (r?.lantern) { setCaught(r.lantern); ui.set({ lanternDrift: false }); } else if (r) { setErr('Nothing to catch right now. Try again later.'); ui.set({ lanternDrift: false }); }
  };
  const doRelease = async () => {
    const t = body.trim(); if (!t) return;
    const r = await call<{ left: number }>('POST', '', { body: t });
    if (r) { setBody(''); setOk(`Your lantern is drifting away. ${r.left} left today.`); }
  };
  const sendReply = async (id: number, text: string, after: () => void) => {
    if (!text.trim()) return;
    if (await call('POST', `/${id}/reply`, { body: text.trim() })) { after(); void load(); }
  };

  const Thread = ({ it }: { it: Item }) => {
    const [r, setR] = useState('');
    const [bond, setBond] = useState('');
    return (
      <li className="lan">
        <p className="thought">“{it.body}”</p>
        {it.thread.map((m, i) => <div key={i} className={`bub${m.mine ? ' me' : ''}`}>{m.body}</div>)}
        {(it.caught !== false) && (
          <div className="row" style={{ marginTop: 8 }}>
            <input className="field" value={r} maxLength={400} placeholder="Reply anonymously…" aria-label="Reply" onChange={(e) => setR(e.target.value)} />
            <button className="btn" disabled={!r.trim()} onClick={() => sendReply(it.id, r, () => setR(''))}>Send</button>
          </div>
        )}
        <div className="row" style={{ marginTop: 8 }}>
          {it.thread.length > 0 && <button className="btn ghost sm" disabled={it.kept} onClick={async () => { const k = await call<{ bonded: boolean; with?: { name: string } }>('POST', `/${it.id}/keep`); if (k) { setBond(k.bonded ? `You and ${k.with?.name} kept each other.` : 'Kept. They will see your name only if they keep you too.'); void load(); } }}>{it.kept ? 'Kept' : 'Keep in touch'}</button>}
          <button className="btn ghost sm" onClick={() => setReporting(it.id)}>Report</button>
        </div>
        {bond && <p className="tiny" style={{ color: 'var(--accent)' }}>{bond}</p>}
      </li>
    );
  };

  return (
    <Sheet title="Lanterns" onClose={() => ui.set({ panel: null })} tall>
      <div className="tabs" role="tablist">
        {(['catch', 'release', 'mine'] as const).map((t) => <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'on' : ''} onClick={() => { setTab(t); setOk(''); setErr(''); }}>{t === 'catch' ? 'Catch' : t === 'release' ? 'Release' : 'Mine'}</button>)}
      </div>
      {reporting !== null ? (
        <ReportForm onCancel={() => setReporting(null)} onSubmit={async (reason, details) => { await call('POST', `/${reporting}/report`, { reason, details }); setReporting(null); setOk('Reported. You will not hear from them again.'); void load(); }} />
      ) : tab === 'catch' ? (
        caught ? (
          <div>
            <p className="tiny">A lantern from a stranger{caught.hops ? `, passed along ${caught.hops} time${caught.hops > 1 ? 's' : ''}` : ''}</p>
            <p className="thought lg">“{caught.body}”</p>
            <div className="row"><input className="field" value={reply} maxLength={400} placeholder="Write back…" aria-label="Reply" onChange={(e) => setReply(e.target.value)} />
              <button className="btn" disabled={!reply.trim()} onClick={() => sendReply(caught.id, reply, () => { setReply(''); setCaught(null); setOk('Sent. Find it under Mine.'); })}>Reply</button></div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn ghost" onClick={async () => { if (await call('POST', `/${caught.id}/release`)) { setCaught(null); setOk('You let it drift on to someone else.'); } }}>Let it go on</button>
              <button className="btn ghost" onClick={() => setReporting(caught.id)}>Report</button>
            </div>
          </div>
        ) : (
          <div className="center" style={{ padding: '10px 0' }}>
            <p className="muted">{drift ? 'A lantern is drifting your way.' : 'No lantern nearby right now. They appear every so often, keep an eye on the sky.'}</p>
            <button className="btn" disabled={!drift} onClick={doCatch}>Catch it</button>
          </div>
        )
      ) : tab === 'release' ? (
        <div>
          <p className="muted tiny">Write something for a stranger. It drifts to someone you will never meet unless you both choose to.</p>
          <textarea className="field" rows={4} maxLength={200} value={body} onChange={(e) => setBody(e.target.value)} placeholder="Something you would tell a stranger…" aria-label="Lantern message" />
          <div className="row" style={{ marginTop: 10 }}><span className="tiny" style={{ flex: 1 }}>{body.length}/200</span><button className="btn" disabled={!body.trim()} onClick={doRelease}>Release</button></div>
        </div>
      ) : (
        <ul className="list lans">
          {!inbox.sent.length && !inbox.held.length && <p className="muted">Nothing yet. Release a lantern or catch one.</p>}
          {inbox.held.map((it) => <Thread key={'h' + it.id} it={{ ...it, caught: true }} />)}
          {inbox.sent.map((it) => <Thread key={'s' + it.id} it={it} />)}
        </ul>
      )}
      <div className="err">{err}</div>
      {ok && <p className="tiny" style={{ color: 'var(--accent)' }}>{ok}</p>}
    </Sheet>
  );
}
