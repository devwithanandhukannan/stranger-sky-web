'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { clearIncognitoSession, getIncognitoSession, getToken, logOut, onAuth } from '@/lib/auth';
import { resetThemeCss } from '@/lib/sky/themes';

// 🚀 Eager Parallel Chunk Preloading:
// Immediately prefetch the Sky bundle in parallel at module parse time
const skyLoader = () => import('@/components/sky/Sky');
if (typeof window !== 'undefined') {
  void skyLoader();
}

function SkyLoadingScreen() {
  return (
    <div className="sky-instant-loader" aria-label="Entering the sky">
      <div className="sky-loader-stars" />
      <div className="sky-loader-center">
        <div className="sky-loader-halo" />
        <div className="sky-loader-core" />
        <p className="sky-loader-text">Entering the sky…</p>
      </div>
    </div>
  );
}

const Sky = dynamic(skyLoader, {
  ssr: false,
  loading: () => <SkyLoadingScreen />,
});

export default function SkyPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [ok, setOk] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check if entered as an Ignoto / Incognito guest or has cached profile session
    if (getIncognitoSession()) {
      setOk(true);
      return;
    }
    try {
      if (sessionStorage.getItem('lumen_has_profile') === '1') {
        setOk(true);
      }
    } catch { /* ignore */ }

    let off = () => {}; let dead = false;
    onAuth(async (s) => {
      if (dead) return;
      if (getIncognitoSession()) {
        setOk(true);
        return;
      }
      if (!s || !s.verified) {
        try { sessionStorage.removeItem('lumen_has_profile'); } catch {}
        return router.replace('/login');
      }
      const t = await getToken(); if (!t) return;
      try {
        const r = await api<{ profile: unknown }>('GET', '/me', t);
        if (!r.profile) {
          try { sessionStorage.removeItem('lumen_has_profile'); } catch {}
          return router.replace('/welcome');
        }
        try { sessionStorage.setItem('lumen_has_profile', '1'); } catch {}
        setOk(true);
      } catch (e) {
        const m = (e as Error).message;
        if (m.startsWith('account_')) {
          try { sessionStorage.removeItem('lumen_has_profile'); } catch {}
          await logOut();
          router.replace('/login');
        } else {
          setOk(true); // API hiccup: let the sky retry on its own
        }
      }
    }).then((u) => { off = u; }).catch(() => {
      if (!getIncognitoSession()) router.replace('/login');
    });
    return () => { dead = true; off(); };
  }, [router]);

  const out = useCallback(() => {
    try { sessionStorage.removeItem('lumen_has_profile'); } catch {}
    clearIncognitoSession();
    resetThemeCss();
    void logOut().then(() => router.replace('/login'));
  }, [router]);

  if (!mounted || !ok) return <SkyLoadingScreen />;
  return (
    <Sky
      getToken={(force?: boolean) => getToken(force)}
      onSignOut={out}
      onDeleted={() => {
        clearIncognitoSession();
        resetThemeCss();
        router.replace('/');
      }}
    />
  );
}
