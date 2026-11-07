'use client';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { clearIncognitoSession, getIncognitoSession, getToken, logOut, onAuth } from '@/lib/auth';
import { resetThemeCss } from '@/lib/sky/themes';

const skyLoader = () => import('@/components/sky/Sky');

// Clean, pitch-black minimal fallback matching the Untold aesthetic
function SkyLoadingFallback() {
  return (
    <div className="sky-instant-loader" aria-hidden="true">
      <header className="sky-header" data-ui>
        <div className="sky-header-left">
          <h1 className="sky-brand-title">Untold</h1>
        </div>
      </header>
    </div>
  );
}

const Sky = dynamic(skyLoader, {
  ssr: false,
  loading: () => <SkyLoadingFallback />,
});

export default function SkyPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Optimistic initial auth: if previously authenticated or incognito, load the sky with 0ms delay!
  const [ok, setOk] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return !!(
        getIncognitoSession() ||
        sessionStorage.getItem('lumen_has_profile') === '1' ||
        localStorage.getItem('untold_auth_cached') === '1'
      );
    } catch {
      return false;
    }
  });

  useEffect(() => {
    setMounted(true);

    if (typeof window !== 'undefined' && (localStorage.getItem('untold_auth_cached') === '1' || sessionStorage.getItem('lumen_has_profile') === '1')) {
      clearIncognitoSession();
    }

    if (getIncognitoSession()) {
      setOk(true);
      return;
    }

    let off = () => {};
    let dead = false;

    // Verify authentication in the background without blocking the UI
    onAuth(async (s) => {
      if (dead) return;
      if (getIncognitoSession()) {
        setOk(true);
        return;
      }
      if (!s || !s.verified) {
        try {
          sessionStorage.removeItem('lumen_has_profile');
          localStorage.removeItem('untold_auth_cached');
        } catch {}
        return router.replace('/login');
      }
      const t = await getToken();
      if (!t) return;
      try {
        const r = await api<{ profile: unknown }>('GET', '/me', t);
        if (!r.profile) {
          try {
            sessionStorage.removeItem('lumen_has_profile');
            localStorage.removeItem('untold_auth_cached');
          } catch {}
          return router.replace('/welcome');
        }
        try {
          sessionStorage.setItem('lumen_has_profile', '1');
          localStorage.setItem('untold_auth_cached', '1');
        } catch {}
        setOk(true);
      } catch (e) {
        const m = (e as Error).message;
        if (m.startsWith('account_')) {
          try {
            sessionStorage.removeItem('lumen_has_profile');
            localStorage.removeItem('untold_auth_cached');
          } catch {}
          await logOut();
          router.replace('/login');
        } else {
          setOk(true);
        }
      }
    }).then((u) => {
      off = u;
    }).catch(() => {
      if (!getIncognitoSession()) router.replace('/login');
    });

    return () => {
      dead = true;
      off();
    };
  }, [router]);

  const out = useCallback(() => {
    try {
      sessionStorage.removeItem('lumen_has_profile');
      localStorage.removeItem('untold_auth_cached');
    } catch {}
    clearIncognitoSession();
    resetThemeCss();
    void logOut().then(() => router.replace('/login'));
  }, [router]);

  if (!mounted || !ok) return <SkyLoadingFallback />;

  return (
    <Sky
      getToken={(force?: boolean) => getToken(force)}
      onSignOut={out}
      onDeleted={() => {
        try {
          sessionStorage.removeItem('lumen_has_profile');
          localStorage.removeItem('untold_auth_cached');
        } catch {}
        clearIncognitoSession();
        resetThemeCss();
        router.replace('/');
      }}
    />
  );
}
