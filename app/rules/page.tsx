export const metadata = { title: 'Community rules · Lumen' };
export default function Rules() {
  return (
    <main className="page"><article className="card" style={{ width: 'min(640px,100%)', border: 'none' }}>
      <h1>Community rules</h1>
      <p className="muted">Lumen is a calm place. Keep it that way.</p>
      <ul className="muted" style={{ lineHeight: 1.7 }}>
        <li><b>18+ only.</b> If someone seems younger, report them.</li>
        <li><b>Be kind.</b> No harassment, hate, threats or pressure. If someone says stop, stop.</li>
        <li><b>Nothing sexual or explicit.</b> No nudity, no sexual requests.</li>
        <li><b>No selling, scams or links.</b> Links and handles are blocked because they are how scams start.</li>
        <li><b>Do not ask for private details</b> like phone numbers, addresses, or money.</li>
        <li><b>Zero Tolerance Immediate Ban:</b> Reports or automated red flags trigger an immediate temporary or permanent ban (Omegle-style zero tolerance), instantly severing connections.</li>
        <li><b>Ignoto / Incognito Mode:</b> Guests can wander without signing in, but making friends and saving/recalling sessions is disabled to keep interactions strictly ephemeral.</li>
      </ul>
      <p className="tiny">If you are in danger, contact your local emergency number. Lumen is not an emergency service.</p>
      <a className="btn ghost" href="/" style={{ textDecoration: 'none', border: 'none' }}>Back</a>
    </article></main>
  );
}
