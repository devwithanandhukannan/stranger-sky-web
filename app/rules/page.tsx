export const metadata = { title: 'Community rules · Lumen' };
export default function Rules() {
  return (
    <main className="page"><article className="card" style={{ width: 'min(640px,100%)' }}>
      <h1>Community rules</h1>
      <p className="muted">Lumen is a calm place. Keep it that way.</p>
      <ul className="muted" style={{ lineHeight: 1.7 }}>
        <li><b>18+ only.</b> If someone seems younger, report them.</li>
        <li><b>Be kind.</b> No harassment, hate, threats or pressure. If someone says stop, stop.</li>
        <li><b>Nothing sexual or explicit.</b> No nudity, no sexual requests.</li>
        <li><b>No selling, scams or links.</b> Links and handles are blocked because they are how scams start.</li>
        <li><b>Do not ask for private details</b> like phone numbers, addresses, or money.</li>
        <li><b>Block and report</b> anything that feels wrong. A person on our team reviews reports. Breaking these rules can end your access.</li>
      </ul>
      <p className="tiny">If you are in danger, contact your local emergency number. Lumen is not an emergency service.</p>
      <a className="btn ghost" href="/">Back</a>
    </article></main>
  );
}
