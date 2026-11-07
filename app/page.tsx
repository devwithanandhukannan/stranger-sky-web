'use client';
import { useState } from 'react';
import Link from 'next/link';

interface FAQItem {
  q: string;
  a: string;
}

const FAQS: FAQItem[] = [
  {
    q: 'What is Untold and how does it work?',
    a: 'Untold is a quiet, contemplative digital universe where people meet as gentle glowing lights. Unlike modern social media, there are no profile pictures, bios, follower counts, or algorithmic feeds. You drift freely across a real-time celestial canvas, read thoughts that surface only when you draw close, and connect organically.',
  },
  {
    q: 'How do chats work, and are they really never stored?',
    a: 'When you send a pulse to a nearby light and they pulse back, a private Planet forms. Inside this temporary sanctuary, you talk 1-on-1 in real time. The moment either person leaves or disconnects, the planet collapses into stardust. No messages, chat histories, or transcripts are ever written to disk or database.',
  },
  {
    q: 'What are Drifting Paper Lanterns?',
    a: 'Lanterns are anonymous notes released into the night sky. A lantern floats across the cosmos until another stranger catches it. They can hold it for up to 48 hours, read it, optionally leave a gentle reply, and release it back into the wind. Each lantern journeys up to 6 hops across strangers worldwide.',
  },
  {
    q: 'How do Mutual Bonds work?',
    a: 'On Untold, you remain entirely anonymous and identifiable only by a transient glowing star. If you have a meaningful connection inside a planet and both people explicitly choose to keep in touch, a Bond is created. Only then are your chosen first names shared, allowing you to connect again.',
  },
  {
    q: 'Is Untold safe and who is it designed for?',
    a: 'Untold is strictly 18+ to protect the tranquility of the space. We have zero algorithmic vanity feeds, hyperlinks are blocked to prevent spam and scams, and every light or planet has an instant one-tap block and report button with automated server evidence capture.',
  },
];

const COMMUNITY_MEMBERS = [
  { name: 'Elena', color: '#60a5fa', mood: 'Calm', location: 'Tokyo' },
  { name: 'Marcus', color: '#a78bfa', mood: 'Warm', location: 'Berlin' },
  { name: 'Hana', color: '#f472b6', mood: 'Deep', location: 'Seoul' },
  { name: 'Liam', color: '#38bdf8', mood: 'Quiet', location: 'Dublin' },
  { name: 'Aria', color: '#fb923c', mood: 'Grounded', location: 'Toronto' },
  { name: 'Dev', color: '#4ade80', mood: 'Joyful', location: 'Bengaluru' },
  { name: 'Chloe', color: '#facc15', mood: 'Dreamy', location: 'Paris' },
];

export default function Home() {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  const toggleFaq = (idx: number) => {
    setOpenFaq(openFaq === idx ? null : idx);
  };

  return (
    <div className="lp-minimal">
      {/* ── Top Navigation (Picky Minimalist Style) ── */}
      <header className="lp-header">
        <div className="lp-header-inner">
          <Link href="/" className="lp-logo">
            untold<span>.</span>
          </Link>

          <nav className="lp-nav-links">
            <a href="#philosophy">Philosophy</a>
            <a href="#why">Why Untold</a>
            <a href="#how">How It Works</a>
            <a href="#community">Community</a>
            <a href="#faq">FAQ</a>
          </nav>

          <Link href="/login" className="lp-nav-btn">
            Sign In
          </Link>
        </div>
      </header>

      {/* ── Hero Section (Matching Picky Reference 1) ── */}
      <section className="lp-hero-section">
        <div className="lp-hero-container">
          <h1 className="lp-hero-title">
            Real Humans.<br />
            Quiet Thoughts.<br />
            Zero Vanity.
          </h1>

          <p className="lp-hero-desc">
            A contemplative digital sanctuary where people meet without algorithms,
            follower counts, or vanity feeds. Just gentle presence.
          </p>

          <div className="lp-hero-actions">
            <Link href="/sky" className="lp-primary-btn">
              Enter the Sky
            </Link>
            <a href="#philosophy" className="lp-secondary-btn">
              Explore philosophy &darr;
            </a>
          </div>

          {/* Clean Editorial Hero Visual (Picky Style) */}
          <div className="lp-hero-visual-card">
            <img
              src="/assets/imageone.webp"
              alt="Untold community connection"
              className="lp-hero-photo"
            />
          </div>

          {/* Under-Hero Community Strip (Picky Style 7-Avatar Row) */}
          <div className="lp-community-strip">
            <h3 className="lp-strip-title">A Contemplative Digital Universe</h3>
            <p className="lp-strip-subtitle">
              Meet as gentle glowing lights. No profiles, no pressure, no performative feeds.
            </p>

            <div className="lp-avatars-row">
              {COMMUNITY_MEMBERS.map((member, i) => (
                <div key={i} className="lp-avatar-item" title={`${member.name} · ${member.mood} (${member.location})`}>
                  <div
                    className="lp-avatar-orb"
                    style={{
                      background: `radial-gradient(circle at 35% 35%, #ffffff 0%, ${member.color} 60%, rgba(0,0,0,0.7) 100%)`,
                      boxShadow: `0 0 14px ${member.color}88`,
                    }}
                  />
                  <span className="lp-avatar-initial">{member.name[0]}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Editorial Manifesto / Statement ── */}
      <section id="philosophy" className="lp-manifesto-section">
        <div className="lp-manifesto-inner">
          <span className="lp-kicker">Our Philosophy</span>
          <p className="lp-manifesto-text">
            Untold is our calm, contemplative universe for mindful connection—offering
            anonymous encounters, zero message history, drifting paper lanterns,
            and genuine human sincerity.
          </p>

          {/* Minimalist Feature Ticker */}
          <div className="lp-ticker-row">
            <span className="lp-ticker-tag"><span>+</span> 100% Anonymous</span>
            <span className="lp-ticker-tag"><span>+</span> Zero Chat Storage</span>
            <span className="lp-ticker-tag"><span>+</span> Ephemeral By Design</span>
            <span className="lp-ticker-tag"><span>+</span> No Algorithmic Vanity</span>
            <span className="lp-ticker-tag"><span>+</span> Strictly 18+</span>
          </div>
        </div>
      </section>

      {/* ── Why Untold (Matching Picky's 4 Divider Rows) ── */}
      <section id="why" className="lp-why-section">
        <div className="lp-why-inner">
          <div className="lp-why-header">
            <span className="lp-kicker">Why Untold</span>
            <p className="lp-why-intro">
              Designed from first principles to restore human peace in digital communication.
            </p>
          </div>

          <div className="lp-divider-rows">
            <div className="lp-divider-row">
              <h4 className="lp-row-title">Zero Algorithmic Validation</h4>
              <p className="lp-row-desc">
                No follower counts, like buttons, or bios. You exist purely as your presence and your genuine thoughts.
              </p>
            </div>

            <div className="lp-divider-row">
              <h4 className="lp-row-title">Ephemeral Sanctuaries</h4>
              <p className="lp-row-desc">
                Private 1-on-1 planets vanish the instant you part ways. Nothing is ever written to disk or database.
              </p>
            </div>

            <div className="lp-divider-row">
              <h4 className="lp-row-title">Global Drifting Paper Lanterns</h4>
              <p className="lp-row-desc">
                Release thoughtful notes into the cosmos. Strangers across the globe catch, cherish, and pass them along.
              </p>
            </div>

            <div className="lp-divider-row">
              <h4 className="lp-row-title">Deep Sincerity Over Surface</h4>
              <p className="lp-row-desc">
                Thoughts only illuminate as you draw close. A space deliberately designed to slow down digital communication.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── How It Works (Matching Picky's 3 Pastel Cards) ── */}
      <section id="how" className="lp-how-section">
        <div className="lp-how-inner">
          <span className="lp-kicker">How It Works</span>
          <h2 className="lp-section-h2">Three simple steps into quietude.</h2>

          <div className="lp-pastel-grid">
            {/* Card 1: Pastel Mint */}
            <div className="lp-pastel-card lp-pastel-card--mint">
              <div className="lp-card-badge">01</div>
              <h3 className="lp-card-title">Wander the Cosmos</h3>
              <p className="lp-card-desc">
                Drift freely through themed galaxies and discover nearby thoughts as they gently illuminate in real time.
              </p>
            </div>

            {/* Card 2: Pastel Rose */}
            <div className="lp-pastel-card lp-pastel-card--rose">
              <div className="lp-card-badge">02</div>
              <h3 className="lp-card-title">Form a Private Planet</h3>
              <p className="lp-card-desc">
                Exchange a pulse with someone nearby. A quiet 1-on-1 sanctuary opens instantly in volatile memory.
              </p>
            </div>

            {/* Card 3: Pastel Sky */}
            <div className="lp-pastel-card lp-pastel-card--sky">
              <div className="lp-card-badge">03</div>
              <h3 className="lp-card-title">Disappear Into Stardust</h3>
              <p className="lp-card-desc">
                The moment either person leaves, the world dissolves forever. No chat logs, no transcripts, pure peace.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ── Community Testimonials (Picky Reference) ── */}
      <section id="community" className="lp-community-section">
        <div className="lp-community-inner">
          <span className="lp-kicker">Hear It From Our Community</span>
          <h2 className="lp-section-h2">Gentle reflections from visitors.</h2>

          <div className="lp-testimonials-grid">
            <div className="lp-test-card">
              <div className="lp-quote-mark">&ldquo;</div>
              <p className="lp-test-quote">
                Untold reminded me what the internet used to feel like before algorithms took over. It feels like stargazing on a quiet rooftop with someone you&apos;ve never met.
              </p>
              <div className="lp-test-author">
                <div
                  className="lp-author-orb"
                  style={{
                    background: 'radial-gradient(circle at 35% 35%, #ffffff 0%, #60a5fa 60%, #1e40af 100%)',
                    boxShadow: '0 0 14px rgba(96, 165, 250, 0.45)',
                  }}
                >
                  E
                </div>
                <div>
                  <div className="lp-author-name">Elena R.</div>
                  <div className="lp-author-loc">Tokyo, Japan</div>
                </div>
              </div>
            </div>

            <div className="lp-test-card">
              <div className="lp-quote-mark">&ldquo;</div>
              <p className="lp-test-quote">
                There&apos;s no anxiety of who is watching or how many likes. Just writing what is genuinely in my heart and letting it drift into the night.
              </p>
              <div className="lp-test-author">
                <div
                  className="lp-author-orb"
                  style={{
                    background: 'radial-gradient(circle at 35% 35%, #ffffff 0%, #a78bfa 60%, #5b21b6 100%)',
                    boxShadow: '0 0 14px rgba(167, 139, 250, 0.45)',
                  }}
                >
                  M
                </div>
                <div>
                  <div className="lp-author-name">Marcus K.</div>
                  <div className="lp-author-loc">Berlin, Germany</div>
                </div>
              </div>
            </div>

            <div className="lp-test-card">
              <div className="lp-quote-mark">&ldquo;</div>
              <p className="lp-test-quote">
                A paper lantern I released in Seoul was caught by someone in Reykjavik. That feeling of gentle human resonance across borders is unmatched.
              </p>
              <div className="lp-test-author">
                <div
                  className="lp-author-orb"
                  style={{
                    background: 'radial-gradient(circle at 35% 35%, #ffffff 0%, #f472b6 60%, #9d174d 100%)',
                    boxShadow: '0 0 14px rgba(244, 114, 182, 0.45)',
                  }}
                >
                  H
                </div>
                <div>
                  <div className="lp-author-name">Hana S.</div>
                  <div className="lp-author-loc">Seoul, Korea</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── FAQs (Picky Clean Accordion) ── */}
      <section id="faq" className="lp-faq-section">
        <div className="lp-faq-inner">
          <span className="lp-kicker">FAQs</span>
          <h2 className="lp-section-h2">Frequently asked questions.</h2>

          <div className="lp-faq-accordion">
            {FAQS.map((faq, i) => (
              <div key={i} className={`lp-faq-item ${openFaq === i ? 'is-open' : ''}`}>
                <button
                  type="button"
                  className="lp-faq-q"
                  onClick={() => toggleFaq(i)}
                  aria-expanded={openFaq === i}
                >
                  <span>{faq.q}</span>
                  <span className="lp-faq-icon">{openFaq === i ? '−' : '+'}</span>
                </button>
                {openFaq === i && (
                  <div className="lp-faq-a">
                    <p>{faq.a}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA Banner (Picky Style) ── */}
      <section className="lp-cta-section">
        <div className="lp-cta-card">
          <h2 className="lp-cta-title">Your light belongs in the sky.</h2>
          <p className="lp-cta-sub">
            Step into the quiet. It only takes a second, and no account is required.
          </p>
          <div className="lp-cta-actions">
            <Link href="/sky" className="lp-primary-btn">
              Enter Untold
            </Link>
          </div>
        </div>
      </section>

      {/* ── Clean Minimalist Footer ── */}
      <footer className="lp-footer">
        <div className="lp-footer-inner">
          <div className="lp-footer-brand">
            <Link href="/" className="lp-logo">
              untold<span>.</span>
            </Link>
            <p className="lp-footer-tagline">A quiet universe of real humans.</p>
          </div>

          <div className="lp-footer-links">
            <Link href="/rules">Community Rules</Link>
            <Link href="/privacy">Privacy Policy</Link>
            <Link href="/login">Sign In</Link>
            <span className="lp-age-badge">18+</span>
          </div>
        </div>

        <div className="lp-footer-bottom">
          <p>&copy; {new Date().getFullYear()} Untold. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
