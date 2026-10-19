'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { clearIncognitoSession, getIncognitoSession, getToken, logOut, onAuth } from '@/lib/auth';

const Sky = dynamic(() => import('@/components/sky/Sky'), { ssr: false, loading: () => <div className="page"><div className="logo" /></div> });

export default function SkyPage() {
  const router = useRouter();
  const [ok, setOk] = useState(false);

  useEffect(() => {
    // Check if entered as an Ignoto / Incognito guest
    const incognito = getIncognitoSession();
    if (incognito) {
      setOk(true);
      return;
    }

    let off = () => {}; let dead = false;
    onAuth(async (s) => {
      if (dead) return;
      if (getIncognitoSession()) {
        setOk(true);
        return;
      }
      if (!s || !s.verified) return router.replace('/login');
      const t = await getToken(); if (!t) return;
      try {
        const r = await api<{ profile: unknown }>('GET', '/me', t);
        if (!r.profile) return router.replace('/welcome');
        setOk(true);
      } catch (e) {
        const m = (e as Error).message;
        if (m.startsWith('account_')) { await logOut(); router.replace('/login'); } else setOk(true); // API hiccup: let the sky retry on its own
      }
    }).then((u) => { off = u; }).catch(() => {
      if (!getIncognitoSession()) router.replace('/login');
    });
    return () => { dead = true; off(); };
  }, [router]);

  const out = useCallback(() => {
    clearIncognitoSession();
    void logOut().then(() => router.replace('/login'));
  }, [router]);

  if (!ok) return <div className="page"><div className="logo" /></div>;
  return <Sky getToken={() => getToken()} onSignOut={out} onDeleted={() => { clearIncognitoSession(); router.replace('/'); }} />;
}
