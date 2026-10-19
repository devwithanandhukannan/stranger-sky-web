import Link from 'next/link';

export default function Home() {
  return (
    <main className="page">
      <div className="card center">
        <div className="logo" />
        <h1>Lumen</h1>
        <p className="muted" style={{ margin: '8px 0 0' }}>A quiet night sky of strangers. Everyone is a light. Drift close, read a thought that fits, send a pulse.</p>
        <div className="stack">
          <Link className="btn" href="/sky" style={{ textAlign: 'center', textDecoration: 'none', display: 'grid', placeItems: 'center' }}>Enter the sky</Link>
        </div>
        <p className="tiny" style={{ marginTop: 18 }}>18+ only · no photos, no profiles, no feeds · <Link href="/rules">Community rules</Link> · <Link href="/privacy">Privacy</Link></p>
      </div>
    </main>
  );
}
