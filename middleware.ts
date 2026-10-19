import { NextResponse, type NextRequest } from 'next/server';

const dev = process.env.NODE_ENV !== 'production';
const api = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000';
const ws = api.replace(/^http/, 'ws');

// Nonce-based, "strict-dynamic" CSP: only scripts that carry this request's nonce (and scripts they load) can run.
export function middleware(req: NextRequest) {
  const nonce = btoa(crypto.randomUUID());
  const csp = [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' https://apis.google.com${dev ? " 'unsafe-eval'" : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `style-src-attr 'unsafe-inline'`,
    `img-src 'self' data: blob:`,
    `font-src 'self'`,
    `connect-src 'self' ${api} ${ws} https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com https://firebaseinstallations.googleapis.com${dev ? ' ws://localhost:3000' : ''}`,
    `frame-src https://accounts.google.com https://*.firebaseapp.com https://*.web.app ${process.env.NEXT_PUBLIC_EXTRA_FRAME_SRC || ''}`.trim(),
    `media-src 'self' blob:`,
    `worker-src 'self' blob:`,
    `manifest-src 'self'`,
    `object-src 'none'`,
    `base-uri 'none'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
    dev ? '' : 'upgrade-insecure-requests',
  ].filter(Boolean).join('; ');

  const headers = new Headers(req.headers);
  headers.set('x-nonce', nonce);
  headers.set('content-security-policy', csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set('content-security-policy', csp);
  return res;
}

export const config = {
  matcher: [{ source: '/((?!_next/static|_next/image|favicon.ico|icon.svg).*)', missing: [{ type: 'header', key: 'next-router-prefetch' }, { type: 'header', key: 'purpose', value: 'prefetch' }] }],
};
