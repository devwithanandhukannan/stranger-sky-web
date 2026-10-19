'use client';
// All sound is generated in the browser (no audio files to download).
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let ambientOn = false;
let ambientTimer: ReturnType<typeof setTimeout> | null = null;
let pads: OscillatorNode[] = [];

const PENTA = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];

function ensure() {
  if (ctx) return ctx;
  if (typeof window === 'undefined') return null;
  const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = enabled ? 0.22 : 0;
  master.connect(ctx.destination);
  return ctx;
}

export function unlock() {
  const c = ensure();
  if (c && c.state === 'suspended') void c.resume();
  if (enabled) startAmbient();
}

export function setSound(on: boolean) {
  enabled = on;
  if (master && ctx) master.gain.setTargetAtTime(on ? 0.22 : 0, ctx.currentTime, 0.1);
  if (!on) stopAmbient();
  else if (ctx) unlock(); // before the first tap there is no audio context yet (browsers require a gesture)
}

function tone(freq: number, dur = 0.9, vol = 0.5, type: OscillatorType = 'sine', delay = 0) {
  const c = ctx || ensure();
  if (!c || !master || !enabled) return;
  const t = c.currentTime + delay;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.value = freq;
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.05);
}

export function playMsgSent(toneName: string = 'pop') {
  if (!enabled) return;
  const c = ensure();
  if (!c || !master) return;
  const t = c.currentTime;

  if (toneName === 'pop') {
    // WhatsApp-style outgoing pop sound: snappy upward frequency sweep with quick decay
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(360, t);
    o.frequency.exponentialRampToValueAtTime(820, t + 0.045);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.26, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.09);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.1);
  } else if (toneName === 'crystal') {
    tone(1174.66, 0.16, 0.22, 'sine');
  } else if (toneName === 'bell') {
    tone(587.33, 0.2, 0.25, 'triangle');
  } else {
    // Cosmic chime: celestial starlight note
    tone(659.25, 0.22, 0.22, 'sine', 0);
    tone(987.77, 0.25, 0.16, 'sine', 0.04);
  }
}

export function playMsgReceived(toneName: string = 'pop') {
  if (!enabled) return;
  const c = ensure();
  if (!c || !master) return;

  if (toneName === 'pop') {
    // WhatsApp-style incoming double droplet
    tone(520, 0.1, 0.2, 'sine', 0);
    tone(780, 0.18, 0.24, 'sine', 0.05);
  } else if (toneName === 'crystal') {
    // Sparkling crystal chime
    tone(1046.5, 0.25, 0.22, 'sine', 0);
    tone(1567.98, 0.35, 0.18, 'sine', 0.07);
  } else if (toneName === 'bell') {
    // Soft marimba bell
    tone(523.25, 0.32, 0.24, 'triangle', 0);
    tone(783.99, 0.42, 0.18, 'triangle', 0.08);
  } else {
    // Cosmic Chime: harmonious starlight chime
    tone(783.99, 0.35, 0.25, 'sine', 0);
    tone(1046.5, 0.45, 0.18, 'sine', 0.07);
  }
}

export function speakMessage(text: string) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    window.speechSynthesis.cancel();
    const clean = text.replace(/https?:\/\/\S+/g, '').slice(0, 140);
    if (!clean.trim()) return;
    const u = new SpeechSynthesisUtterance(clean);
    u.rate = 1.0;
    u.pitch = 1.05;
    u.volume = 0.85;
    window.speechSynthesis.speak(u);
  } catch {
    /* ignore speech synthesis errors */
  }
}

function startAmbient() {
  const c = ensure();
  if (!c || !master || ambientOn) return;
  ambientOn = true;
  const g = c.createGain();
  g.gain.value = 0.0;
  g.gain.linearRampToValueAtTime(0.05, c.currentTime + 4);
  g.connect(master);
  const lfo = c.createOscillator();
  const lg = c.createGain();
  lfo.frequency.value = 0.07; lg.gain.value = 0.02;
  lfo.connect(lg).connect(g.gain);
  lfo.start();
  pads = [110, 164.81, 246.94].map((f, i) => {
    const o = c.createOscillator();
    o.type = 'sine'; o.frequency.value = f; o.detune.value = i * 4 - 4;
    o.connect(g); o.start();
    return o;
  });
  pads.push(lfo);
  const sparkle = () => {
    if (!ambientOn) return;
    tone(PENTA[Math.floor(Math.random() * PENTA.length)], 2.4, 0.05);
    ambientTimer = setTimeout(sparkle, 4000 + Math.random() * 5000);
  };
  ambientTimer = setTimeout(sparkle, 3000);
}
function stopAmbient() {
  ambientOn = false;
  if (ambientTimer) clearTimeout(ambientTimer);
  pads.forEach((o) => { try { o.stop(); } catch { /* already stopped */ } });
  pads = [];
}

export const sfx = {
  pulse: () => { tone(659.25, 0.7, 0.35); tone(987.77, 0.9, 0.2, 'sine', 0.08); },
  receive: () => { tone(880, 1.2, 0.3); tone(1318.5, 1.4, 0.15, 'sine', 0.12); },
  open: () => { [392, 523.25, 659.25, 783.99].forEach((f, i) => tone(f, 1.3, 0.28, 'sine', i * 0.09)); },
  msg: () => playMsgReceived('pop'),
  msgSent: (toneName?: string) => playMsgSent(toneName),
  msgReceived: (toneName?: string) => playMsgReceived(toneName),
  meteor: () => { [1318.5, 1567.98, 2093].forEach((f, i) => tone(f, 0.9, 0.12, 'sine', i * 0.07)); },
  bond: () => { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 1.6, 0.25, 'sine', i * 0.12)); },
  ring: () => { tone(880, 0.4, 0.3); tone(880, 0.4, 0.3, 'sine', 0.5); },
};

export function buzz(_pattern: number | number[], _on: boolean) {
  // Vibration disabled to prevent device vibration issues
}
