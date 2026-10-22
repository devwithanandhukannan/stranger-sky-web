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
      .catch((e) => { cfg = null; throw e; });
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
