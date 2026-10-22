'use client';
import React, { useState } from 'react';

interface FAQItem {
  q: string;
  a: string;
}

const FAQS: FAQItem[] = [
  {
    q: "What is Stranger Sky?",
    a: "Stranger Sky is a quiet, contemplative digital universe where people meet as gentle glowing lights. Unlike modern social media, there are no profile pictures, bios, follower counts, or algorithmic feeds. You drift freely across a real-time celestial canvas, read thoughts that surface only when you draw close, and connect organically."
  },
  {
    q: "How do chats work, and are they really never stored?",
    a: "When you send a pulse to a nearby light and they pulse back, a private 'Planet' forms. Inside this temporary sanctuary, you can talk 1-on-1 in real-time. The moment either person leaves or disconnects, the planet collapses into stardust. No messages, chat histories, or transcripts are ever written to disk or database."
  },
  {
    q: "What are Drifting Paper Lanterns?",
    a: "Lanterns are anonymous notes released into the sky. A lantern floats across the cosmos until another stranger catches it. They can hold it for up to 48 hours, read it, optionally leave a gentle anonymous reply, and release it back into the wind. Each lantern journeys up to 6 hops across strangers worldwide."
  },
  {
    q: "How do Mutual Bonds work?",
    a: "On Stranger Sky, you remain entirely anonymous and identifiable only by a transient glowing star. If you have a meaningful connection inside a planet and both people explicitly choose to keep in touch, a 'Bond' is created. Only then are your chosen first names shared, allowing you to connect again."
  },
  {
    q: "Is Stranger Sky safe and who is it designed for?",
    a: "Stranger Sky is strictly 18+ to protect the tranquility of the space. We have zero algorithmic vanity feeds, hyperlinks are blocked to prevent spam and scams, and every light or planet has an instant one-tap block and report button with automated server evidence capture."
  },
];

export default function LandingFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  const toggle = (idx: number) => {
    setOpenIndex(openIndex === idx ? null : idx);
  };

  return (
    <div className="faq-list">
      {FAQS.map((item, idx) => {
        const isOpen = openIndex === idx;
        return (
          <div
            key={idx}
            className="faq-item-card"
            onClick={() => toggle(idx)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                toggle(idx);
              }
            }}
          >
            <div className="faq-question">
              <span>{item.q}</span>
              <span
                style={{
                  fontSize: '20px',
                  color: isOpen ? '#8B7BFA' : '#A1A1AA',
                  transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
                  transition: 'transform 0.25s ease, color 0.2s',
                  display: 'inline-block',
                }}
              >
                +
              </span>
            </div>
            {isOpen && (
              <div className="faq-answer">
                {item.a}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
