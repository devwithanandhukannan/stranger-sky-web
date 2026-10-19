'use client';
// All sound is generated in the browser (no audio files to download).
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
let ambientOn = false;
let ambientTimers: (ReturnType<typeof setTimeout> | ReturnType<typeof setInterval>)[] = [];
let ambientNodes: (AudioNode | OscillatorNode)[] = [];

// Iconic Interstellar Chords: [Am9, Fmaj7, C add9, Em / G]
// Emulating the 1926 Harrison & Harrison cathedral pipe organ from Temple Church, London
const INTERSTELLAR_CHORDS = [
  // Am9: A1, E2, A2, C3, E3, B3, C4, E4
  [55, 82.41, 110, 130.81, 164.81, 246.94, 261.63, 329.63],
  // Fmaj7: F1, C2, F2, A2, C3, E3, A3, C4, E4
  [43.65, 65.41, 87.31, 110, 130.81, 164.81, 220, 261.63, 329.63],
  // C add9: C2, G2, C3, E3, G3, D4, E4
  [65.41, 98.0, 130.81, 164.81, 196.0, 293.66, 329.63],
  // Em / G6: E2, B2, E3, G3, B3, D4, G4
  [82.41, 123.47, 164.81, 196.0, 246.94, 293.66, 392.0],
];

// Iconic Hans Zimmer motifs (Day One, Stay, Cornfield Chase celestial phrases)
const CELESTE_MOTIFS = [
  [659.25, 698.46, 659.25], // E5 -> F5 -> E5 ("Day One" signature)
  [440.0, 493.88, 523.25, 659.25], // A4 -> B4 -> C5 -> E5 ("Stay")
  [659.25, 783.99, 880.0], // E5 -> G5 -> A5
  [523.25, 493.88, 440.0], // C5 -> B4 -> A4
  [329.63, 440.0, 493.88, 523.25], // E4 -> A4 -> B4 -> C5
  [880.0, 783.99, 659.25, 523.25], // A5 -> G5 -> E5 -> C5 ("Cornfield Chase")
];

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

  // Master ambient bus
  const ambientBus = c.createGain();
  ambientBus.gain.setValueAtTime(0.0001, c.currentTime);
  ambientBus.gain.exponentialRampToValueAtTime(0.24, c.currentTime + 3.5);
  ambientBus.connect(master);
  ambientNodes.push(ambientBus);

  // Warm cathedral pipe organ low-pass filter (Harrison & Harrison organ acoustic warmth)
  const organFilter = c.createBiquadFilter();
  organFilter.type = 'lowpass';
  organFilter.frequency.setValueAtTime(820, c.currentTime);
  organFilter.Q.value = 1.25;
  organFilter.connect(ambientBus);
  ambientNodes.push(organFilter);

  // Organ swell LFO (expression pedal slowly opening and closing over 18s)
  const swellLFO = c.createOscillator();
  const swellGain = c.createGain();
  swellLFO.type = 'sine';
  swellLFO.frequency.setValueAtTime(0.04, c.currentTime); // ~25s full swell cycle
  swellGain.gain.setValueAtTime(260, c.currentTime); // mod range ±260Hz around 820Hz
  swellLFO.connect(swellGain);
  swellGain.connect(organFilter.frequency);
  swellLFO.start();
  ambientNodes.push(swellLFO, swellGain);

  // Celestial cosmic stereo delay network (vast cathedral reverberation)
  const delayL = c.createDelay(1.5);
  const delayR = c.createDelay(1.5);
  const delayFeedback = c.createGain();
  const delayFilter = c.createBiquadFilter();

  delayL.delayTime.value = 0.38; // 380ms left
  delayR.delayTime.value = 0.54; // 540ms right
  delayFeedback.gain.value = 0.28;
  delayFilter.type = 'lowpass';
  delayFilter.frequency.value = 1200;

  delayL.connect(delayFilter);
  delayR.connect(delayFilter);
  delayFilter.connect(delayFeedback);
  delayFeedback.connect(delayL);
  delayFeedback.connect(delayR);
  delayFilter.connect(ambientBus);
  ambientNodes.push(delayL, delayR, delayFeedback, delayFilter);

  // Sub-bass Gargantua gravitational drone (42Hz deep space presence)
  const subOsc = c.createOscillator();
  const subGain = c.createGain();
  subOsc.type = 'sine';
  subOsc.frequency.setValueAtTime(42.5, c.currentTime);
  subGain.gain.setValueAtTime(0.038, c.currentTime);
  subOsc.connect(subGain);
  subGain.connect(ambientBus);
  subOsc.start();
  ambientNodes.push(subOsc, subGain);

  // Two alternating voice banks for seamless crossfading between Interstellar chords
  let currentChordIdx = 0;
  let activeBank = 'A';
  let bankANodes: OscillatorNode[] = [];
  let bankBNodes: OscillatorNode[] = [];
  let bankAGain = c.createGain();
  let bankBGain = c.createGain();

  bankAGain.connect(organFilter);
  bankBGain.connect(organFilter);
  ambientNodes.push(bankAGain, bankBGain);

  // Function to spawn organ pipe oscillators for a chord
  const spawnChordOscillators = (chordFrequencies: number[], targetGain: GainNode): OscillatorNode[] => {
    const list: OscillatorNode[] = [];
    chordFrequencies.forEach((freq, idx) => {
      const osc = c.createOscillator();
      // Pipe organ blend: triangle waves for rich church harmonics, sine for deep sub bass
      osc.type = freq < 100 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, c.currentTime);
      // Slight natural chorus/detuning like multiple pipe ranks (e.g. Diapason & Principal)
      osc.detune.setValueAtTime((idx % 3 - 1) * 3.5, c.currentTime);

      const noteGain = c.createGain();
      // Taper volume: deep bass notes get weight, high notes stay soft and airy
      const noteVol = freq < 70 ? 0.045 : freq < 150 ? 0.032 : 0.022;
      noteGain.gain.setValueAtTime(noteVol, c.currentTime);

      osc.connect(noteGain);
      noteGain.connect(targetGain);
      osc.start();
      list.push(osc);
      ambientNodes.push(osc, noteGain);
    });
    return list;
  };

  // Start with Chord 0 in Bank A
  bankAGain.gain.setValueAtTime(0.0001, c.currentTime);
  bankAGain.gain.exponentialRampToValueAtTime(1.0, c.currentTime + 3.0);
  bankBGain.gain.setValueAtTime(0.0001, c.currentTime);
  bankANodes = spawnChordOscillators(INTERSTELLAR_CHORDS[0], bankAGain);

  // Chord progression crossfade loop (every 14 seconds)
  const cycleChord = () => {
    if (!ambientOn || !c || !master) return;
    const now = c.currentTime;
    const nextChordIdx = (currentChordIdx + 1) % INTERSTELLAR_CHORDS.length;
    const fadeDuration = 7.0; // 7 second smooth crossfade

    if (activeBank === 'A') {
      // Fade out Bank A, fade in Bank B with next chord
      bankBNodes = spawnChordOscillators(INTERSTELLAR_CHORDS[nextChordIdx], bankBGain);
      bankBGain.gain.cancelScheduledValues(now);
      bankBGain.gain.setValueAtTime(bankBGain.gain.value, now);
      bankBGain.gain.linearRampToValueAtTime(1.0, now + fadeDuration);

      bankAGain.gain.cancelScheduledValues(now);
      bankAGain.gain.setValueAtTime(bankAGain.gain.value, now);
      bankAGain.gain.linearRampToValueAtTime(0.0001, now + fadeDuration);

      const oldNodes = bankANodes;
      const cleanTimer = setTimeout(() => {
        oldNodes.forEach((o) => {
          try { o.stop(); o.disconnect(); } catch {}
        });
      }, (fadeDuration + 0.5) * 1000);
      ambientTimers.push(cleanTimer);

      activeBank = 'B';
    } else {
      // Fade out Bank B, fade in Bank A with next chord
      bankANodes = spawnChordOscillators(INTERSTELLAR_CHORDS[nextChordIdx], bankAGain);
      bankAGain.gain.cancelScheduledValues(now);
      bankAGain.gain.setValueAtTime(bankAGain.gain.value, now);
      bankAGain.gain.linearRampToValueAtTime(1.0, now + fadeDuration);

      bankBGain.gain.cancelScheduledValues(now);
      bankBGain.gain.setValueAtTime(bankBGain.gain.value, now);
      bankBGain.gain.linearRampToValueAtTime(0.0001, now + fadeDuration);

      const oldNodes = bankBNodes;
      const cleanTimer = setTimeout(() => {
        oldNodes.forEach((o) => {
          try { o.stop(); o.disconnect(); } catch {}
        });
      }, (fadeDuration + 0.5) * 1000);
      ambientTimers.push(cleanTimer);

      activeBank = 'A';
    }

    currentChordIdx = nextChordIdx;
  };

  const chordInterval = setInterval(cycleChord, 14000);
  ambientTimers.push(chordInterval);

  // Miller's Planet Time Dilation subtle pulse (every 1.25s = 1 Earth day near Gargantua)
  const timeTickInterval = setInterval(() => {
    if (!ambientOn || !c || !master || !enabled) return;
    const now = c.currentTime;
    const tickOsc = c.createOscillator();
    const tickGain = c.createGain();
    const tickFilter = c.createBiquadFilter();

    tickFilter.type = 'lowpass';
    tickFilter.frequency.setValueAtTime(480, now);

    tickOsc.type = 'triangle';
    // Subtle wooden/sub-bass acoustic click sweep
    tickOsc.frequency.setValueAtTime(160, now);
    tickOsc.frequency.exponentialRampToValueAtTime(45, now + 0.032);

    tickGain.gain.setValueAtTime(0.022, now);
    tickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);

    tickOsc.connect(tickFilter);
    tickFilter.connect(tickGain);
    tickGain.connect(ambientBus);

    tickOsc.start(now);
    tickOsc.stop(now + 0.04);
  }, 1250);
  ambientTimers.push(timeTickInterval);

  // Celestial Celeste / Piano Motif ("Day One" / "Stay" echoes across the stars)
  const triggerCelesteMotif = () => {
    if (!ambientOn || !c || !master || !enabled) return;
    const motif = CELESTE_MOTIFS[Math.floor(Math.random() * CELESTE_MOTIFS.length)];
    const noteSpacing = 0.72; // Spacing between melodic notes

    motif.forEach((noteFreq, idx) => {
      const noteTime = c.currentTime + idx * noteSpacing;
      const o1 = c.createOscillator();
      const o2 = c.createOscillator();
      const noteGain = c.createGain();

      // Felt piano / celeste: fundamental triangle + sine overtone
      o1.type = 'triangle';
      o1.frequency.setValueAtTime(noteFreq, noteTime);
      o2.type = 'sine';
      o2.frequency.setValueAtTime(noteFreq * 2, noteTime);

      noteGain.gain.setValueAtTime(0.0001, noteTime);
      noteGain.gain.linearRampToValueAtTime(0.042, noteTime + 0.015);
      noteGain.gain.exponentialRampToValueAtTime(0.0001, noteTime + 3.2);

      o1.connect(noteGain);
      o2.connect(noteGain);
      noteGain.connect(organFilter);
      noteGain.connect(delayL);
      noteGain.connect(delayR);

      o1.start(noteTime);
      o2.start(noteTime);
      o1.stop(noteTime + 3.3);
      o2.stop(noteTime + 3.3);
    });

    // Schedule next celestial motif in 9 to 15 seconds
    const nextWait = 9000 + Math.random() * 6000;
    const nextTimer = setTimeout(triggerCelesteMotif, nextWait);
    ambientTimers.push(nextTimer);
  };

  const initialMotifTimer = setTimeout(triggerCelesteMotif, 4500);
  ambientTimers.push(initialMotifTimer);
}

function stopAmbient() {
  ambientOn = false;
  ambientTimers.forEach((t) => {
    try {
      clearTimeout(t);
      clearInterval(t);
    } catch {}
  });
  ambientTimers = [];

  ambientNodes.forEach((n) => {
    try {
      if ('stop' in n && typeof (n as OscillatorNode).stop === 'function') {
        (n as OscillatorNode).stop();
      }
      n.disconnect();
    } catch {
      /* ignore */
    }
  });
  ambientNodes = [];
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
