'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Logo from '@/components/Logo';
import {
  IconCompass,
  IconThought,
  IconPulse,
  IconLantern,
  IconShield,
  IconLock,
  IconNoLinks,
  IconBan,
  IconSparkle,
  IconArrowRight,
  IconChevronDown,
} from '@/components/landing/LandingIcons';

interface StarNode {
  x: number;
  y: number;
  radius: number;
  alpha: number;
  speed: number;
  hue: number;
}

export default function Home() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const heroRef = useRef<HTMLDivElement>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const chaptersRef = useRef<(HTMLElement | null)[]>([]);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });

  useEffect(() => {
    // ── 1. Interactive Starlight Canvas ──
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize, { passive: true });

    // Detect mobile for optimized star count
    const isMobile = width <= 768;
    const nodeCount = Math.min(isMobile ? 32 : 64, Math.floor((width * height) / (isMobile ? 22000 : 16000)));
    const stars: StarNode[] = Array.from({ length: nodeCount }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      radius: Math.random() * 1.5 + 0.6,
      alpha: Math.random() * 0.6 + 0.2,
      speed: Math.random() * 0.22 + 0.08,
      hue: Math.random() > 0.6 ? 240 : 260, // soft cool violet/blue
    }));

    let isRunning = true;
    const render = () => {
      if (!isRunning) return;
      ctx.clearRect(0, 0, width, height);

      // Smooth mouse lerp
      mouseRef.current.x += (mouseRef.current.targetX - mouseRef.current.x) * 0.05;
      mouseRef.current.y += (mouseRef.current.targetY - mouseRef.current.y) * 0.05;

      const mx = (mouseRef.current.x - width / 2) * 0.03;
      const my = (mouseRef.current.y - height / 2) * 0.03;

      for (let i = 0; i < stars.length; i++) {
        const star = stars[i];
        star.y -= star.speed;
        if (star.y < -10) {
          star.y = height + 10;
          star.x = Math.random() * width;
        }

        const renderX = star.x + mx * (star.radius * 0.8);
        const renderY = star.y + my * (star.radius * 0.8);

        // Hardware-accelerated soft starlight glow (Zero GPU/CPU thermal blur overhead)
        ctx.beginPath();
        ctx.arc(renderX, renderY, star.radius * 2.2, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${star.hue}, 85%, 80%, ${star.alpha * 0.22})`;
        ctx.fill();

        // Pinpoint starlight core
        ctx.beginPath();
        ctx.arc(renderX, renderY, star.radius, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${star.hue}, 80%, 92%, ${star.alpha})`;
        ctx.fill();
      }

      animId = requestAnimationFrame(render);
    };

    animId = requestAnimationFrame(render);

    // Pause animation when tab or phone screen is hidden to eliminate battery drain
    const handleVisibility = () => {
      if (document.hidden) {
        isRunning = false;
        cancelAnimationFrame(animId);
      } else if (!isRunning) {
        isRunning = true;
        animId = requestAnimationFrame(render);
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.targetX = e.clientX;
      mouseRef.current.targetY = e.clientY;
    };
    window.addEventListener('mousemove', handleMouseMove, { passive: true });

    // ── 2. Parallel Scroll Engine & Eased Lerp ──
    let isTicking = false;
    const handleScroll = () => {
      if (!isTicking) {
        requestAnimationFrame(() => {
          const scrollY = window.scrollY;
          const maxScroll = document.documentElement.scrollHeight - window.innerHeight;
          const scrollProgress = maxScroll > 0 ? scrollY / maxScroll : 0;

          // Top progress line
          if (progressBarRef.current) {
            progressBarRef.current.style.transform = `scaleX(${scrollProgress})`;
          }

          // Hero parallax
          if (heroRef.current) {
            const heroY = scrollY * 0.38;
            const heroOpacity = Math.max(0, 1 - scrollY / 650);
            heroRef.current.style.transform = `translate3d(0, ${heroY}px, 0)`;
            heroRef.current.style.opacity = `${heroOpacity}`;
          }

          // Feature Chapters Parallel Multi-Speed Parallax
          const winH = window.innerHeight;
          chaptersRef.current.forEach((chapter) => {
            if (!chapter) return;
            const rect = chapter.getBoundingClientRect();
            // Relative distance from center of viewport (-1 to 1)
            const centerOffset = (rect.top + rect.height / 2 - winH / 2) / winH;

            // Image drifts at -70px speed, text at +25px speed in parallel
            const pImg = centerOffset * -65;
            const pText = centerOffset * 22;

            chapter.style.setProperty('--p-img', `${pImg.toFixed(1)}px`);
            chapter.style.setProperty('--p-text', `${pText.toFixed(1)}px`);
          });

          isTicking = false;
        });
        isTicking = true;
      }
    };

    // ── 3. Scroll Reveal System ──
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('lp-visible');
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -40px 0px' }
    );

    document.querySelectorAll('.lp-reveal').forEach((el) => observer.observe(el));

    // Stagger hero elements immediately
    requestAnimationFrame(() => {
      document.querySelectorAll('.lp-hero .lp-reveal').forEach((el, i) => {
        setTimeout(() => el.classList.add('lp-visible'), 60 + i * 100);
      });
    });

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll();

    return () => {
      isRunning = false;
      cancelAnimationFrame(animId);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('scroll', handleScroll);
      observer.disconnect();
    };
  }, []);

  return (
    <div className="lp">
      {/* ── Scroll Progress Indicator ── */}
      <div className="lp-progress-bar" ref={progressBarRef} aria-hidden="true" />

      {/* ── Interactive Starlight Ambient Canvas ── */}
      <canvas ref={canvasRef} className="lp-bg-canvas" aria-hidden="true" />

      {/* ── Ambient Glowing Halo Orbs ── */}
      <div className="lp-ambient-orb lp-ambient-orb--1" aria-hidden="true" />
      <div className="lp-ambient-orb lp-ambient-orb--2" aria-hidden="true" />

      {/* ── Apple-Style Borderless Floating Nav ── */}
      <nav className="lp-nav" aria-label="Main Navigation">
        <div className="lp-nav-pill">
          <Link href="/" className="lp-nav-brand">
            <Logo size={28} glow={false} />
            <span>Stranger Sky</span>
          </Link>

          <div className="lp-nav-links">
            <a href="#experience" className="lp-nav-link">Experience</a>
            <a href="#chapters" className="lp-nav-link">How it works</a>
            <a href="#privacy" className="lp-nav-link">Privacy</a>
          </div>

          <Link href="/sky" className="lp-nav-cta">
            Enter Sky
          </Link>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════
          HERO — Multi-Layer Parallel Scroll Experience
          ══════════════════════════════════════════════ */}
      <section className="lp-hero" id="experience">
        <div className="lp-hero-bg" ref={heroRef} aria-hidden="true">
          <img src="/assets/hero-sky.jpg" alt="" className="lp-hero-img" />
          <div className="lp-hero-fade" />
        </div>

        <div className="lp-hero-content">
          <div className="lp-badge lp-reveal">
            <span className="lp-badge-dot" />
            <span>A quiet place on the internet</span>
          </div>

          <h1 className="lp-hero-h1 lp-reveal">
            Drift quietly.<br />Connect genuinely.
          </h1>

          <p className="lp-hero-sub lp-reveal">
            No profiles. No feeds. No algorithms. Just gentle lights drifting in the dark,
            waiting for a quiet hello.
          </p>

          <div className="lp-hero-cta lp-reveal">
            <Link href="/sky" className="lp-btn-apple">
              Enter the Sky
              <IconSparkle size={15} />
            </Link>
            <a href="#chapters" className="lp-btn-link">
              Explore the experience
              <IconArrowRight size={15} />
            </a>
          </div>

          <div className="lp-hero-trust lp-reveal">
            <span><IconShield size={14} /> 100% Anonymous</span>
            <span><IconLock size={14} /> Zero Chat Storage</span>
            <span>Instant & Ephemeral</span>
            <span>Free · 18+</span>
          </div>
        </div>

        <div className="lp-scroll-hint lp-reveal" aria-hidden="true">
          <span>Scroll to explore</span>
          <div className="lp-scroll-line" />
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          BORDERLESS PHILOSOPHY / STAT RIBBON
          ══════════════════════════════════════════════ */}
      <section className="lp-stats-strip lp-reveal" aria-label="Key highlights">
        <div className="lp-stat-item">
          <span className="lp-stat-value">0</span>
          <span className="lp-stat-label">Algorithms or feeds</span>
        </div>
        <div className="lp-stat-item">
          <span className="lp-stat-value">100%</span>
          <span className="lp-stat-label">Completely anonymous</span>
        </div>
        <div className="lp-stat-item">
          <span className="lp-stat-value">0</span>
          <span className="lp-stat-label">Chat logs saved</span>
        </div>
        <div className="lp-stat-item">
          <span className="lp-stat-value">∞</span>
          <span className="lp-stat-label">Quiet night sky</span>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          PARALLEL SCROLL CHAPTERS
          ══════════════════════════════════════════════ */}
      <div id="chapters">
        <header className="lp-section-header">
          <span className="lp-eyebrow lp-reveal">The Experience</span>
          <h2 className="lp-section-title lp-reveal">
            Designed for human quietude.
          </h2>
          <p className="lp-section-desc lp-reveal">
            Every interaction is subtle, intentional, and completely free of social noise.
          </p>
        </header>

        {/* Chapter 01: Drift */}
        <section
          className="lp-chapter"
          ref={(el) => { chaptersRef.current[0] = el; }}
        >
          <div className="lp-chapter-media-wrap lp-reveal">
            <div className="lp-media-halo lp-media-halo--drift" aria-hidden="true" />
            <div className="lp-chapter-media">
              <img
                src="/assets/feature-drift.jpg"
                alt="Drift through the stars"
                loading="lazy"
              />
            </div>
          </div>

          <div className="lp-chapter-text lp-reveal">
            <span className="lp-chapter-index">01 / DRIFT</span>
            <h3 className="lp-chapter-h3">Wander across the stars.</h3>
            <p className="lp-chapter-desc">
              Glide freely through an infinite canvas. Every gentle light you see
              is a real person somewhere across the world, wandering quietly under the same night sky.
            </p>
            <div className="lp-chapter-pills">
              <span className="lp-chapter-pill">Real-time presence</span>
              <span className="lp-chapter-pill">Zero tracking</span>
            </div>
          </div>
        </section>

        {/* Chapter 02: Thoughts */}
        <section
          className="lp-chapter lp-chapter--reverse"
          ref={(el) => { chaptersRef.current[1] = el; }}
        >
          <div className="lp-chapter-media-wrap lp-reveal">
            <div className="lp-media-halo lp-media-halo--thoughts" aria-hidden="true" />
            <div className="lp-chapter-media">
              <img
                src="/assets/feature-thoughts.jpg"
                alt="Read quiet thoughts"
                loading="lazy"
              />
            </div>
          </div>

          <div className="lp-chapter-text lp-reveal">
            <span className="lp-chapter-index">02 / THOUGHTS</span>
            <h3 className="lp-chapter-h3">Listen to honest words.</h3>
            <p className="lp-chapter-desc">
              Float near another light to softly reveal their current thought.
              No follower counts, no likes, no comment sections — just genuine reflection.
            </p>
            <div className="lp-chapter-pills">
              <span className="lp-chapter-pill">No popularity contests</span>
              <span className="lp-chapter-pill">Pure expression</span>
            </div>
          </div>
        </section>

        {/* Chapter 03: Talk */}
        <section
          className="lp-chapter"
          ref={(el) => { chaptersRef.current[2] = el; }}
        >
          <div className="lp-chapter-media-wrap lp-reveal">
            <div className="lp-media-halo lp-media-halo--talk" aria-hidden="true" />
            <div className="lp-chapter-media">
              <img
                src="/assets/feature-talk.jpg"
                alt="One-on-one ephemeral conversations"
                loading="lazy"
              />
            </div>
          </div>

          <div className="lp-chapter-text lp-reveal">
            <span className="lp-chapter-index">03 / CONNECT</span>
            <h3 className="lp-chapter-h3">A spark in the silence.</h3>
            <p className="lp-chapter-desc">
              Send a gentle pulse to request a conversation. If accepted,
              a private space opens. When either person leaves, the words vanish forever.
            </p>
            <div className="lp-chapter-pills">
              <span className="lp-chapter-pill">In-memory only</span>
              <span className="lp-chapter-pill">Leaves no trace</span>
            </div>
          </div>
        </section>

        {/* Chapter 04: Lanterns */}
        <section
          className="lp-chapter lp-chapter--reverse"
          ref={(el) => { chaptersRef.current[3] = el; }}
        >
          <div className="lp-chapter-media-wrap lp-reveal">
            <div className="lp-media-halo lp-media-halo--lantern" aria-hidden="true" />
            <div className="lp-chapter-media">
              <img
                src="/assets/feature-lantern.jpg"
                alt="Release a sky lantern"
                loading="lazy"
              />
            </div>
          </div>

          <div className="lp-chapter-text lp-reveal">
            <span className="lp-chapter-index">04 / LANTERNS</span>
            <h3 className="lp-chapter-h3">Release a thought to the world.</h3>
            <p className="lp-chapter-desc">
              Write a kind note, a secret wish, or a gentle question into a paper lantern.
              Watch it float up into the atmosphere, where strangers worldwide can catch and cherish it.
            </p>
            <div className="lp-chapter-pills">
              <span className="lp-chapter-pill">Global serendipity</span>
              <span className="lp-chapter-pill">Shared warmth</span>
            </div>
          </div>
        </section>
      </div>

      {/* ══════════════════════════════════════════════
          BORDERLESS PRIVACY ARCHITECTURE
          ══════════════════════════════════════════════ */}
      <section className="lp-privacy-section" id="privacy">
        <header className="lp-section-header" style={{ padding: '0 0 20px' }}>
          <span className="lp-eyebrow lp-reveal">Privacy Architecture</span>
          <h2 className="lp-section-title lp-reveal">
            Engineered for pure privacy.
          </h2>
          <p className="lp-section-desc lp-reveal">
            Privacy isn’t a setting you toggle. It is the fundamental principle of our codebase.
          </p>
        </header>

        <div className="lp-privacy-grid">
          <div className="lp-privacy-card lp-reveal">
            <div className="lp-privacy-icon"><IconShield size={24} /></div>
            <h4>Completely Anonymous</h4>
            <p>No phone numbers, photos, bios, or tracking cookies. You exist only as a calm light.</p>
          </div>

          <div className="lp-privacy-card lp-reveal">
            <div className="lp-privacy-icon"><IconLock size={24} /></div>
            <h4>Ephemeral In-Memory</h4>
            <p>Messages live purely in volatile memory. When a conversation ends, it disappears forever.</p>
          </div>

          <div className="lp-privacy-card lp-reveal">
            <div className="lp-privacy-icon"><IconNoLinks size={24} /></div>
            <h4>Protected from Spam</h4>
            <p>Automatic safeguards instantly block malicious links, bots, and unsolicited advertising.</p>
          </div>

          <div className="lp-privacy-card lp-reveal">
            <div className="lp-privacy-icon"><IconBan size={24} /></div>
            <h4>Instant Departure</h4>
            <p>Disconnect or block any stranger with a single tap. Peace of mind is always in your control.</p>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════
          GRAND FINALE — Apple Minimalist CTA
          ══════════════════════════════════════════════ */}
      <section className="lp-finale lp-reveal">
        <div className="lp-finale-halo" aria-hidden="true" />
        <div className="lp-finale-content">
          <span className="lp-eyebrow">Ready to begin?</span>
          <h2 className="lp-finale-h2">Your light belongs in the sky.</h2>
          <p className="lp-finale-sub">
            Step into the quiet. It only takes a second, and no account is required.
          </p>
          <Link href="/sky" className="lp-btn-apple lp-btn-apple--lg">
            Enter the Sky
            <IconSparkle size={16} />
          </Link>
        </div>
      </section>

      {/* ── Apple-Style Minimalist Footer ── */}
      <footer className="lp-footer">
        <div className="lp-footer-links">
          <Link href="/rules">Rules</Link>
          <Link href="/privacy">Privacy</Link>
          <span className="lp-footer-badge">18+</span>
        </div>
        <p>© 2026 Stranger Sky. All rights reserved.</p>
      </footer>
    </div>
  );
}
