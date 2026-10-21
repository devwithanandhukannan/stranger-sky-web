export const metadata = { title: 'Privacy · Lumen' };
export default function Privacy() {
  return (
    <main className="page"><article className="card" style={{ width: 'min(640px,100%)', border: 'none' }}>
      <h1>Privacy</h1>
      <ul className="muted" style={{ lineHeight: 1.7 }}>
        <li><b>What we keep:</b> your email (for login), first name, date of birth (to check 18+), and what you choose to do: lanterns you release, people you keep in touch with, blocks and reports.</li>
        <li><b>What we do not keep:</b> planet chats. They exist only while both of you are there and are gone afterwards. We do not collect photos, contacts, or exact location.</li>
        <li><b>Ignoto / Incognito Mode:</b> guest sessions are completely ephemeral. No email, name, bonds, or chat logs are ever stored in the database.</li>
        <li><b>Strangers never see</b> your name, email or birthday. A name is shared only when you and another person both choose to keep in touch.</li>
        <li><b>Reports & Immediate Bans:</b> when someone is reported or flagged for safety violations, access is immediately terminated and temporary bans are enforced.</li>
        <li><b>Your control:</b> download your data or delete your account anytime in Settings. Deleting removes your profile and everything linked to it.</li>
        <li><b>Age check:</b> the date of birth is self-declared. We cannot verify it, and we remove accounts that appear to be under 18.</li>
      </ul>
      <a className="btn ghost" href="/" style={{ textDecoration: 'none', border: 'none' }}>Back</a>
    </article></main>
  );
}
