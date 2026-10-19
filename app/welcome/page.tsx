'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { api, getConfig } from '@/lib/api';
import { getToken, logOut, onAuth } from '@/lib/auth';

const MSG: Record<string, string> = {
  underage: 'Lumen is for people 18 and older.', registration_closed: 'Sign-ups are closed for now.', content_not_allowed: 'Please choose a different name.',
  invalid_input: 'Check your name and date of birth.',
};

export default function Welcome() {
  const router = useRouter();
  const [name, setName] = useState(''), [dob, setDob] = useState(''), [ok, setOk] = useState(false), [err, setErr] = useState(''), [busy, setBusy] = useState(false), [min, setMin] = useState(18), [ready, setReady] = useState(false);

  useEffect(() => {
    getConfig().then((c) => setMin(c.minAge)).catch(() => {});
    let off = () => {};
    onAuth(async (s) => {
      if (!s) return router.replace('/login');
      if (!s.verified) return router.replace('/login');
      const t = await getToken(); if (!t) return;
      try { const r = await api<{ profile: unknown }>('GET', '/me', t); if (r.profile) router.replace('/sky'); else setReady(true); } catch { setReady(true); }
    }).then((u) => { off = u; });
    return () => off();
  }, [router]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const t = await getToken(true); if (!t) throw new Error('auth');
      await api('POST', '/profile', t, { displayName: name.trim(), dob });
      router.replace('/sky');
    } catch (x) { setErr(MSG[(x as Error).message] || 'Something went wrong. Please try again.'); setBusy(false); }
  };
  const today = new Date().toISOString().slice(0, 10);
  if (!ready) return <main className="page"><div className="logo" /></main>;
  return (
    <main className="page">
      <form className="card" onSubmit={submit}>
        <h1>Before you enter</h1>
        <p className="muted" style={{ margin: '6px 0 0' }}>No photos, no bio. Just a first name and your birthday.</p>
        <div className="stack">
          <label className="tiny" htmlFor="nm">First name (shown only to people you choose to keep in touch with)</label>
          <input id="nm" className="field" required maxLength={30} value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" />
          <label className="tiny" htmlFor="dob">Date of birth (private, used only to check you are {min}+)</label>
          <input id="dob" className="field" type="date" required max={today} value={dob} onChange={(e) => setDob(e.target.value)} />
          <label className="row tiny" style={{ alignItems: 'flex-start' }}><input type="checkbox" checked={ok} onChange={(e) => setOk(e.target.checked)} style={{ marginTop: 3 }} /> <span>I am {min} or older and I agree to the <Link href="/rules" target="_blank">community rules</Link> and <Link href="/privacy" target="_blank">privacy notice</Link>.</span></label>
          <button className="btn" disabled={busy || !ok || !name.trim() || !dob}>Enter the sky</button>
          <button type="button" className="btn ghost" onClick={() => void logOut().then(() => router.replace('/login'))}>Sign out</button>
          <div className="err" role="alert">{err}</div>
        </div>
      </form>
    </main>
  );
}
