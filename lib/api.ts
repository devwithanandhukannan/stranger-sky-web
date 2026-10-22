export const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';

export type Galaxy = { slug: string; name: string; color: string };
export type PublicConfig = {
  appName: string; minAge: number; skyTheme: string; announcement: string; galaxies: Galaxy[];
  firebase: Record<string, string>;
};
export type Me = { id: string; name: string; galaxy: string; age: number; createdAt: string };

export class ApiError extends Error {
  constructor(public status: number, public code: string) { super(code); }
}

export const DEFAULT_CONFIG: PublicConfig = {
  appName: 'Stranger Sky',
  minAge: 18,
  skyTheme: 'auto',
  announcement: '',
  galaxies: [
    { slug: 'night', name: 'One Sky', color: '#9fb0ff' },
    { slug: 'neighbours', name: 'Neighbours (Near Me)', color: '#38ef7d' },
    { slug: 'music', name: 'Music', color: '#7aa2ff' },
    { slug: 'cinema', name: 'Cinema', color: '#ff8fb1' },
    { slug: 'games', name: 'Games', color: '#79e6b6' },
    { slug: 'tech', name: 'Tech', color: '#7fdcff' },
    { slug: 'travel', name: 'Travel', color: '#ffd27a' },
    { slug: 'learn', name: 'Languages', color: '#c4a0ff' },
    { slug: 'kerala', name: 'Kerala', color: '#ffb07a' },
  ],
  firebase: {
    apiKey: 'AIzaSyAydMVet7JSq6S9zkZE0FOXN_5pUpIj9CU',
    authDomain: 'stranger-social-41bc5.firebaseapp.com',
    projectId: 'stranger-social-41bc5',
    appId: '1:758529337031:web:48a255a0dfe0de557c40e2',
    messagingSenderId: '758529337031',
    storageBucket: 'stranger-social-41bc5.firebasestorage.app',
  },
};

let cfg: Promise<PublicConfig> | null = null;
export function getConfig(): Promise<PublicConfig> {
  if (!cfg) {
    let cached: PublicConfig | null = null;
    try {
      const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('lumen_public_config') : null;
      if (raw) cached = JSON.parse(raw);
    } catch { /* ignore */ }

    if (cached?.firebase?.apiKey) {
      // Re-fetch in background to keep config fresh, but return cached immediately
      fetch(`${API}/api/config`)
        .then((r) => r.ok ? r.json() : null)
        .then((fresh) => {
          if (fresh?.firebase?.apiKey) {
            try { localStorage.setItem('lumen_public_config', JSON.stringify(fresh)); } catch {}
          }
        })
        .catch(() => {});
      cfg = Promise.resolve(cached);
      return cfg;
    }

    cfg = fetch(`${API}/api/config`)
      .then((r) => { if (!r.ok) throw new ApiError(r.status, 'config'); return r.json(); })
      .then((data: PublicConfig) => {
        try { localStorage.setItem('lumen_public_config', JSON.stringify(data)); } catch {}
        return data;
      })
      .catch((_e) => {
        // Fallback gracefully to default config so UI & Auth don't crash when API is starting up
        cfg = Promise.resolve(DEFAULT_CONFIG);
        return DEFAULT_CONFIG;
      });
  }
  return cfg;
}

export async function api<T = unknown>(method: string, path: string, token: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}/api${path}`, {
    method,
    headers: { authorization: `Bearer ${token}`, ...(body ? { 'content-type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* empty body */ }
  if (!res.ok) throw new ApiError(res.status, json?.error || 'error');
  return json as T;
}
