'use client';
import type { Socket } from 'socket.io-client';
import { API } from '../api';
import { getToken, getIncognitoSession } from '../auth';
import { sfx, buzz, speakMessage } from './audio';
import { type NearItem, type Store, type Planet, type Galaxy, type ToastItem } from './store';
import type { WorldState } from './state';
import type { World } from './world';

const ack = <T,>(s: Socket, ev: string, data?: unknown, ms = 6000) =>
  new Promise<T>((resolve) => {
    const t = setTimeout(() => resolve({ error: 'timeout' } as T), ms);
    s.emit(ev, data, (r: T) => { clearTimeout(t); resolve(r); });
  });

export class NetWorld implements World {
  private s: Socket | null = null;
  private nearMap = new Map<string, NearItem>();
  private flushQueued = false;
  private stopped = false;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;

  constructor(private state: WorldState, private ui: Store) {}

  private toast(msg: ToastItem, duration = 3500) {
    this.ui.set({ toast: msg });
    if (this.toastTimer) clearTimeout(this.toastTimer);
    if (duration > 0) {
      this.toastTimer = setTimeout(() => this.ui.set({ toast: null }), duration);
    }
  }
  private flushNear() {
    if (this.flushQueued) return;
    this.flushQueued = true;
    queueMicrotask(() => {
      this.flushQueued = false;
      this.ui.set({ near: [...this.nearMap.values()] });
    });
  }
  private patchPlanet(fn: (p: Planet) => Partial<Planet>) {
    const p = this.ui.get().planet;
    if (p) this.ui.set({ planet: { ...p, ...fn(p) } });
  }

  async start() {
    this.stopped = false;
    const { io } = await import('socket.io-client');
    if (this.stopped) return;
    if (this.s) { this.s.close(); this.s = null; }
    this.ui.set({ status: 'connecting' });
    const s = io(API, {
      transports: ['websocket'], reconnectionDelayMax: 8000,
      auth: (cb) => {
        const inc = getIncognitoSession();
        if (inc) {
          cb({ token: '', incognito: inc });
        } else {
          getToken().then((t) => cb({ token: t || '' })).catch(() => cb({ token: '' }));
        }
      },
    });
    this.s = s;
    const st = this.state, ui = this.ui;

    s.on('connect', () => ui.set({ status: 'live' }));
    s.on('disconnect', () => { if (ui.get().status === 'live') ui.set({ status: 'offline' }); });
    s.on('connect_error', (e: Error) => {
      const m = e.message || '';
      if (['email_not_verified', 'no_profile'].includes(m) || m.startsWith('account_')) { ui.set({ status: 'denied', denied: m }); s.close(); }
      else ui.set({ status: 'offline' });
    });

    s.on('hello', (h) => {
      if (h.bound) st.bound = h.bound;
      if (h.scale) st.scale = h.scale;
      if (h.radius) st.radius = h.radius;
      const currentTheme = ui.get().skyTheme;
      let savedInterests: string[] = [];
      try {
        const raw = localStorage.getItem('userInterests');
        if (raw) savedInterests = JSON.parse(raw);
      } catch { /* ignore */ }
      ui.set({
        name: h.name,
        galaxies: h.galaxies,
        thoughtMax: h.thoughtMax,
        skyTheme: currentTheme || 'auto',
        announcement: h.announcement || '',
        bonds: h.bonds,
        isIncognito: !!h.isIncognito,
        activeInterests: h.activeInterests || [],
        userInterests: savedInterests,
      });
      if (savedInterests.length) {
        void this.setInterests(savedInterests);
      }
      if (!h.isIncognito) {
        getToken().then((token) => {
          if (token) {
            import('../api').then(({ api }) => {
              api<{ available: boolean }>('GET', '/lanterns/drift', token)
                .then((res) => { if (res?.available) ui.set({ lanternDrift: true }); })
                .catch(() => {});
            });
          }
        }).catch(() => {});
      }
      try {
        const raw = typeof localStorage !== 'undefined' ? localStorage.getItem('userLoc') : null;
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed?.lat === 'number' && typeof parsed?.lon === 'number') {
            void this.setLocation(parsed.lat, parsed.lon);
          }
        }
      } catch { /* ignore */ }
    });
    s.on('lantern:drift', (d: { available?: boolean }) => {
      ui.set({ lanternDrift: !!d?.available });
      if (d?.available) sfx.receive();
    });
    s.on('galaxy:enter', (g) => {
      st.reset(); this.nearMap.clear();
      st.you = st.add({ ...g.you });
      const myThought = g.you?.t || ui.get().thought || (typeof localStorage !== 'undefined' ? localStorage.getItem('userThought') || '' : '');
      if (myThought) {
        st.you.t = myThought;
        if (!ui.get().thought) ui.set({ thought: myThought });
        void this.thought(myThought, ui.get().mood || 0);
      }
      for (const r of g.roster) {
        if (!(r.f & 8)) st.add(r);
      }
      for (const sid of g.hide) { const l = st.bySid.get(sid); if (l) l.hidden = true; }
      st.warpedAt = performance.now();
      ui.set({ galaxy: g.galaxy, near: [], selected: null, census: g.census, status: 'live', warp: ui.get().warp + 1, incoming: [] });
    });
    s.on('roster:add', (r) => { if (!(r.f & 8)) st.add(r); });
    s.on('roster:interests', (p: { i: number; sid: string; interests: string[] }) => {
      const l = st.bySid.get(p.sid) || st.lights.get(p.i);
      if (l) l.interests = p.interests;
    });
    s.on('roster:del', (r) => { st.remove(r.i); this.nearMap.delete(r.sid); });
    s.on('galaxies:update', (d: { galaxies: Galaxy[] }) => { if (d?.galaxies) ui.set({ galaxies: d.galaxies }); });
    s.on('pos', (buf: ArrayBuffer | Uint8Array) => {
      const ab = buf instanceof ArrayBuffer ? buf : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      st.applyPos(new Int16Array(ab as ArrayBuffer));
    });
    s.on('flag', (p) => { const l = st.lights.get(p.i); if (l) { l.f = p.f; l.m = p.m; } });
    s.on('hide', (p) => {
      const hideSet = new Set(p.sids);
      for (const [sid, l] of st.bySid) {
        if (l === st.you) continue;
        const shouldHide = hideSet.has(sid);
        l.hidden = shouldHide;
        if (shouldHide && this.nearMap.delete(sid)) this.flushNear();
      }
    });
    s.on('near:in', (n: NearItem) => {
      let l = st.bySid.get(n.sid) || (n.i != null ? st.lights.get(n.i) : undefined);
      if (l) {
        l.near = true;
        if (n.t) l.t = n.t;
        l.m = n.m;
        l.f = n.f;
        if (n.sid && !l.sid) l.sid = n.sid;
        if (n.sid) st.bySid.set(n.sid, l);
      } else if (n.i != null && n.sid) {
        l = st.add({
          i: n.i,
          sid: n.sid,
          x: 0,
          y: 0,
          m: n.m,
          f: n.f,
          t: n.t,
          near: true,
          interests: n.interests,
          isIncognito: n.isIncognito,
        });
      }
      this.nearMap.set(n.sid, n);
      this.flushNear();
    });
    s.on('near:out', (n: { sid: string }) => {
      const l = st.bySid.get(n.sid);
      if (l) l.near = false;
      this.nearMap.delete(n.sid);
      this.flushNear();
    });
    s.on('warp', (p) => { if (st.you) { st.you.x = st.you.tx = p.x; st.you.y = st.you.ty = p.y; st.warpedAt = performance.now(); } });

    s.on('pulse:in', (p: { sid: string; i?: number; m?: number }) => {
      const cur = ui.get().incoming;
      if (!cur.includes(p.sid)) ui.set({ incoming: [...cur, p.sid] });
      sfx.receive(); buzz(25, ui.get().haptics);
      const nearItem = ui.get().near.find((n) => n.sid === p.sid);
      const light = st.bySid.get(p.sid);
      const mood = p.m ?? nearItem?.m ?? light?.m ?? 0;
      const thought = nearItem?.t || light?.t || '';
      const distance = typeof nearItem?.distKm === 'number' && nearItem.distKm > 0 ? `~${Math.round(nearItem.distKm)} km away` : '';
      const strangerText = distance ? `Stranger nearby · ${distance}` : 'Stranger nearby';
      this.toast({
        message: 'Someone nearby sent you a pulse',
        type: 'pulse',
        sid: p.sid,
        title: strangerText,
        thought,
        subtitle: 'Sent you a pulse',
        mood,
      }, 12000);
    });
    s.on('pulse:sent', () => { sfx.pulse(); buzz(15, ui.get().haptics); this.toast('Pulse sent. If they pulse back, a planet opens.'); });
    s.on('pulse:busy', () => this.toast('That light is in a conversation right now.'));
    s.on('pulse:limit', () => this.toast('Slow down a little. Try again in a minute.'));
    s.on('pulse:echo', () => this.toast('That is an echo, a trace of someone who passed through.'));

    s.on('planet:open', (p) => {
      const planet: Planet = {
        pid: p.pid, sid: p.sid, known: p.known, with: p.with, m: p.m, t: p.t,
        prompt: p.prompt, msgs: [], typing: false, kept: false, ended: null, prompts: [],
        distKm: p.distKm ?? null,
      };
      if (this.toastTimer) {
        clearTimeout(this.toastTimer);
        this.toastTimer = null;
      }
      ui.set({
        planet,
        planetMinimized: false,
        panel: null,
        selected: null,
        ring: null,
        incoming: [],
        toast: null,
      });
      sfx.open(); buzz([30, 40, 30], ui.get().haptics);
    });
    s.on('planet:msg', (m: { t: string; ts: number }) => {
      this.patchPlanet((p) => ({ msgs: [...p.msgs, { mine: false, t: m.t, ts: m.ts }].slice(-200), typing: false }));
      const uiState = this.ui.get();
      if (uiState.sound && uiState.messageSound) {
        sfx.msgReceived(uiState.messageTone);
      }
      if (uiState.voiceReader) {
        speakMessage(m.t);
      }
    });
    s.on('planet:typing', () => {
      this.patchPlanet(() => ({ typing: true }));
      setTimeout(() => this.patchPlanet(() => ({ typing: false })), 2500);
    });
    s.on('planet:prompt', (p: { q: string }) => this.patchPlanet((pl) => ({ prompts: [...pl.prompts, p.q].slice(-5) })));
    s.on('planet:kept', () => this.patchPlanet(() => ({ kept: true })));
    s.on('planet:end', (p: { reason: string }) => {
      sfx.close();
      this.patchPlanet(() => ({ ended: p.reason }));
      if (this.ui.get().planetMinimized) {
        this.ui.set({ planet: null, planetMinimized: false, incoming: [] });
      }
    });

    s.on('bond:new', (b) => {
      ui.set({ bonds: [...ui.get().bonds.filter((x) => x.id !== b.id), b] });
      this.patchPlanet((p) => ({ known: true, with: { id: b.id, name: b.name } }));
      sfx.bond(); buzz([20, 30, 60], ui.get().haptics);
      this.toast(`You and ${b.name} kept each other`);
    });
    s.on('bond:presence', (p: { id: string; online: boolean }) =>
      ui.set({ bonds: ui.get().bonds.map((b) => (b.id === p.id ? { ...b, online: p.online } : b)) }));
    s.on('bond:ring', (r: { id: string; name: string }) => { ui.set({ ring: r }); sfx.ring(); buzz([200, 100, 200], ui.get().haptics); });
    s.on('bond:declined', () => this.toast('They are not available right now.'));

    s.on('meteor', (m: { id: string; x: number; y: number; ttl: number }) => {
      ui.set({ meteor: { id: m.id, x: m.x, y: m.y, until: Date.now() + m.ttl * 1000 }, meteorPrompt: null });
      sfx.meteor();
    });
    s.on('census', (c) => ui.set({ census: c }));
    s.on('interests:active', (d: { interests: { tag: string; count: number }[] }) => {
      if (d?.interests) ui.set({ activeInterests: d.interests });
    });
    s.on('toast', (d: { text: string }) => {
      if (d?.text) this.toast(d.text);
    });
    s.on('lantern:reply', () => { ui.set({ inboxTick: ui.get().inboxTick + 1 }); this.toast('A lantern was answered'); sfx.receive(); });
    s.on('kicked', (k: { reason: string; bannedUntil?: number; displayReason?: string; message?: string }) => {
      ui.set({
        status: 'kicked',
        denied: k.reason,
        banInfo: k.bannedUntil ? {
          bannedUntil: k.bannedUntil,
          reason: k.reason,
          displayReason: k.displayReason || 'Temporary Ban',
          message: k.message,
        } : null,
      });
      s.close();
    });
    s.on('full', () => { ui.set({ status: 'full' }); s.close(); });
  }

  stop() { this.stopped = true; this.s?.close(); this.s = null; if (this.toastTimer) clearTimeout(this.toastTimer); }

  private lastMove = 0;
  move(x: number, y: number) {
    const now = performance.now();
    if (now - this.lastMove < 95) return;
    this.lastMove = now;
    this.s?.volatile.emit('move', { x, y });
  }
  async thought(text: string, mood: number) {
    if (!this.s) return 'offline';
    const r = await ack<{ ok?: boolean; error?: string }>(this.s, 'thought', { text, mood });
    if (r.ok) { this.ui.set({ thought: text, mood }); if (this.state.you) { this.state.you.t = text; this.state.you.m = mood; } return null; }
    return r.error || 'error';
  }
  pulse(sid: string) {
    const curPlanet = this.ui.get().planet;
    if (curPlanet && curPlanet.sid === sid && !curPlanet.ended) {
      this.ui.set({ planetMinimized: false, selected: null, toast: null });
      return;
    }
    this.s?.emit('pulse', { sid });
  }
  declinePulse(sid: string) {
    const inc = this.ui.get().incoming.filter((id) => id !== sid);
    const curToast = this.ui.get().toast;
    const isPulseToast = typeof curToast === 'object' && curToast?.type === 'pulse' && curToast.sid === sid;
    buzz(12, this.ui.get().haptics);
    this.ui.set({
      incoming: inc,
      ...(isPulseToast ? { toast: null } : {}),
    });
    if (isPulseToast && this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }
  }
  async travel(galaxy: string) {
    if (!this.s) return 'offline';
    const r = await ack<{ ok?: boolean; error?: string }>(this.s, 'travel', { galaxy });
    return r.ok ? null : r.error || 'error';
  }
  async addGalaxy(name: string, color?: string) {
    if (!this.s) return { error: 'offline' };
    const r = await ack<{ ok?: boolean; galaxy?: Galaxy; error?: string }>(this.s, 'galaxy:add', { name, color });
    if (r.ok && r.galaxy) {
      const cur = this.ui.get().galaxies;
      if (!cur.some((g) => g.slug === r.galaxy!.slug)) {
        this.ui.set({ galaxies: [...cur, r.galaxy!] });
      }
    }
    return r;
  }
  hop() { this.s?.emit('hop'); }
  async feed() {
    if (!this.s) return;
    const r = await ack<{ lights?: NearItem[] }>(this.s, 'feed');
    if (r.lights) {
      const liveNearSids = new Set<string>();
      for (const l of this.state.lights.values()) {
        if (l.near) liveNearSids.add(l.sid);
      }
      for (const sid of Array.from(this.nearMap.keys())) {
        if (!liveNearSids.has(sid) && !r.lights.some((n) => n.sid === sid)) {
          this.nearMap.delete(sid);
        }
      }
      for (const n of r.lights) this.nearMap.set(n.sid, n);
      this.flushNear();
    }
  }
  async send(text: string) {
    if (!this.s) return 'offline';
    const r = await ack<{ ok?: boolean; error?: string; ts?: number }>(this.s, 'planet:send', { text });
    if (r.ok) {
      this.patchPlanet((p) => ({ msgs: [...p.msgs, { mine: true, t: text, ts: r.ts || Date.now() }].slice(-200) }));
      const uiState = this.ui.get();
      if (uiState.sound && uiState.messageSound) {
        sfx.msgSent(uiState.messageTone);
      }
      return null;
    }
    return r.error || 'error';
  }
  typing() { this.s?.volatile.emit('planet:typing'); }
  askPrompt() { this.s?.emit('planet:prompt'); }
  keep() {
    if (this.ui.get().isIncognito) {
      this.toast('Making friends is disabled in Incognito Mode.');
      return;
    }
    this.s?.emit('planet:keep');
  }
  leave() {
    this.s?.emit('planet:leave');
    this.ui.set({
      planet: null,
      planetMinimized: false,
      selected: null,
      incoming: [],
    });
  }
  async block(sid: string) {
    if (!this.s) return false;
    const r = await ack<{ ok?: boolean }>(this.s, 'block', { sid });
    if (r.ok) {
      if (this.ui.get().planet?.sid === sid) {
        this.ui.set({ planet: null, planetMinimized: false, incoming: [], selected: null });
      }
      this.toast('Blocked. You will not see each other again.');
    }
    return !!r.ok;
  }
  async report(sid: string, reason: string, details: string) {
    if (!this.s) return false;
    const r = await ack<{ ok?: boolean; banned?: boolean }>(this.s, 'report', { sid, reason, details });
    if (r.ok) {
      if (this.ui.get().planet?.sid === sid) {
        this.ui.set({ planet: null, planetMinimized: false, incoming: [], selected: null });
      }
      this.toast('Report submitted. The user was immediately disconnected and suspended.');
    }
    return !!r.ok;
  }
  async catchMeteor(id: string) {
    if (!this.s) return null;
    const r = await ack<{ prompt?: string; error?: string }>(this.s, 'meteor:catch', { id });
    if (r.prompt) { this.ui.set({ meteorPrompt: r.prompt, meteor: null }); return r.prompt; }
    this.toast(r.error === 'too_far' ? 'Drift closer to catch it' : 'It already flew away');
    return null;
  }
  callBond(id: string) { this.s?.emit('bond:call', { id }); this.toast('Calling…'); }
  answerBond(id: string, accept: boolean) { this.s?.emit('bond:answer', { id, accept }); this.ui.set({ ring: null }); }
  async setLocation(lat: number, lon: number) {
    if (!this.s) return false;
    const r = await ack<{ ok?: boolean }>(this.s, 'location:set', { lat, lon });
    if (r.ok) {
      this.ui.set({ locationGranted: true, userLocation: { lat, lon } });
      try { localStorage.setItem('userLoc', JSON.stringify({ lat, lon })); } catch { /* ignore */ }
      return true;
    }
    return false;
  }
  async clearLocation() {
    if (!this.s) return false;
    const r = await ack<{ ok?: boolean }>(this.s, 'location:clear');
    if (r.ok) {
      this.ui.set({ locationGranted: false, userLocation: null });
      try { localStorage.removeItem('userLoc'); } catch { /* ignore */ }
      return true;
    }
    return false;
  }

  async setInterests(interests: string[]): Promise<boolean> {
    this.ui.set({ userInterests: interests });
    try { localStorage.setItem('userInterests', JSON.stringify(interests)); } catch { /* ignore */ }
    if (!this.s) return true;
    const r = await ack<{ ok?: boolean; error?: string }>(this.s, 'interests:set', { interests });
    return !!r.ok;
  }

  toggleInterestDrive(on?: boolean) {
    const cur = this.ui.get().interestDrive;
    const next = on !== undefined ? on : !cur;
    this.ui.set({ interestDrive: next });
    this.toast(next ? 'Drive to Interest Sky: ON' : 'Drive to Interest Sky: OFF (Free drift)');
    if (next) sfx.pulse();
  }

  selectInterest(tag: string | null) {
    this.ui.set({ selectedInterest: tag });
    if (tag) this.driveToInterest(tag);
  }

  driveToInterest(tag?: string) {
    const targetTag = tag || this.ui.get().selectedInterest;
    if (!targetTag) return;
    this.hop();
    this.toast(`Driving toward strangers exploring “${targetTag}”…`);
  }

  async peek(sid: string): Promise<NearItem | null> {
    if (!this.s) return null;
    const r = await ack<{ ok?: boolean; sid: string; i: number; t: string; m: number; f: number; interests?: string[]; isIncognito?: boolean; distKm?: number }>(this.s, 'peek', { sid });
    if (r.ok) {
      const item: NearItem = {
        i: r.i,
        sid: r.sid,
        t: r.t,
        m: r.m,
        f: r.f,
        interests: r.interests || [],
        isIncognito: !!r.isIncognito,
        distKm: r.distKm,
      };
      this.nearMap.set(r.sid, item);
      const l = this.state.bySid.get(r.sid) || (r.i != null ? this.state.lights.get(r.i) : undefined);
      if (l) {
        l.near = true;
        l.t = r.t;
        l.m = r.m;
        l.f = r.f;
        l.interests = r.interests || [];
        if (r.sid && !l.sid) l.sid = r.sid;
        if (r.sid) this.state.bySid.set(r.sid, l);
      }
      this.flushNear();
      return item;
    }
    return null;
  }
}

