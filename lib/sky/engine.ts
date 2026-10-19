'use client';
import {
  AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, Mesh, MeshBasicMaterial, OrthographicCamera,
  PlaneGeometry, Points, Scene, ShaderMaterial, WebGLRenderer,
} from 'three';
import { F_BUSY, F_ECHO, F_NEW, F_VET, MOOD_COLORS, type QualityName, type Store } from './store';
import type { Light, WorldState } from './state';
import type { World } from './world';
import { resolveTheme, type Theme } from './themes';

type QSpec = { dpr: number; far: number; mid: number; nebula: number; twinkle: number; fps: number; labels: number };
const QUALITY: Record<QualityName, QSpec> = {
  high: { dpr: 2, far: 950, mid: 480, nebula: 8, twinkle: 1.2, fps: 60, labels: 8 },
  balanced: { dpr: 1.5, far: 550, mid: 280, nebula: 5, twinkle: 1.0, fps: 60, labels: 6 },
  low: { dpr: 1, far: 260, mid: 130, nebula: 2, twinkle: 0.4, fps: 30, labels: 4 },
};
const ORDER: QualityName[] = ['high', 'balanced', 'low'];
const MAX_LIGHTS = 1100, MAX_FX = 64, SPAN = 2400, MAX_SPEED = 150;
const KIND_RING = 0, KIND_BURST = 1, KIND_METEOR = 2, KIND_LANTERN = 3;

const hex = (h: string) => new Color(h);
const MOOD_RGB = MOOD_COLORS.map((c) => { const k = hex(c); return [k.r, k.g, k.b]; });

const STAR_VERT = `
uniform vec2 uCam; uniform float uPar; uniform float uSpan; uniform float uDpr; uniform float uTime; uniform float uTw;
attribute float aSize; attribute float aPhase; attribute float aBright;
varying float vA;
void main(){
  vec2 p = mod(position.xy - uCam*uPar + uSpan*0.5, uSpan) - uSpan*0.5;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 0., 1.);
  float tw = 1.0 - uTw*0.4*(0.5+0.5*sin(uTime*(0.5+aPhase*0.9)+aPhase*40.));
  gl_PointSize = aSize*uDpr;
  vA = aBright*tw;
}`;
const STAR_FRAG = `
uniform vec3 uColor; varying float vA;
void main(){ float d=length(gl_PointCoord-.5)*2.; float a=1.-smoothstep(0.,1.,d); a*=a; gl_FragColor=vec4(uColor, a*vA); }`;

const LIGHT_VERT = `
uniform vec2 uCam; uniform float uDpr; uniform float uFade;
attribute float aSize; attribute vec3 aColor; attribute float aKind; attribute float aBright;
varying vec3 vColor; varying float vKind; varying float vBright;
void main(){
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy - uCam, 0., 1.);
  gl_PointSize = aSize*uDpr;
  vColor = aColor; vKind = aKind; vBright = aBright*uFade;
}`;
const LIGHT_FRAG = `
uniform float uTime;
varying vec3 vColor; varying float vKind; varying float vBright;
void main(){
  vec2 q = gl_PointCoord-.5; float d = length(q)*2.;
  if (d>1.) discard;
  float a = smoothstep(.28,.0,d) + exp(-d*d*5.)*.7;
  vec3 col = vColor;
  if (vKind>.5 && vKind<1.5) { // new star: sharp twinkling cross
    float cr = max(0.,1.-abs(q.x)*16.)*max(0.,1.-abs(q.y)*2.2) + max(0.,1.-abs(q.y)*16.)*max(0.,1.-abs(q.x)*2.2);
    a += cr*(.7+.3*sin(uTime*3.+vBright*9.)); col = mix(col, vec3(1.), .55);
  } else if (vKind>1.5 && vKind<2.5) { // old soul: broad warm halo
    a += exp(-d*d*1.6)*.4; col = mix(col, vec3(1.,.86,.62), .35);
  } else if (vKind>2.5 && vKind<3.5) { // echo: faint, flickering trace
    a *= .5*(.75+.25*sin(uTime*1.4+gl_FragCoord.x*.02)); col = mix(col, vec3(.6,.7,1.), .5);
  } else if (vKind>3.5 && vKind<4.5) { // you: pulsing ring
    float pr = .62+.1*sin(uTime*2.3); a += smoothstep(.06,0.,abs(d-pr))*.9; col = mix(col, vec3(1.), .4);
  } else if (vKind>4.5) { // in a conversation: dimmer, ringed
    a *= .5; a += smoothstep(.05,0.,abs(d-.72))*.55;
  }
  gl_FragColor = vec4(col, clamp(a,0.,1.)*vBright);
}`;

const FX_VERT = `
uniform vec2 uCam; uniform float uDpr;
attribute float aSize; attribute vec3 aColor; attribute float aKind; attribute float aAge;
varying vec3 vColor; varying float vKind; varying float vAge;
void main(){
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position.xy - uCam, 0., 1.);
  gl_PointSize = aSize*uDpr; vColor=aColor; vKind=aKind; vAge=aAge;
}`;
const FX_FRAG = `
varying vec3 vColor; varying float vKind; varying float vAge;
void main(){
  vec2 q = gl_PointCoord-.5; float d=length(q)*2.; if(d>1.) discard;
  float a = 0.;
  if (vKind<.5) { a = smoothstep(.08,0.,abs(d-vAge*.95))*(1.-vAge); }
  else if (vKind<1.5) { a = exp(-d*d*7.)*(1.-vAge) + smoothstep(.05,0.,abs(d-vAge))*(1.-vAge)*.8; }
  else if (vKind<2.5) { float r=.3+.5*fract(vAge*3.); a = exp(-d*d*14.) + smoothstep(.05,0.,abs(d-r))*(1.-r)*.9; }
  else { a = exp(-d*d*12.) + exp(-d*d*2.5)*.35; }
  gl_FragColor = vec4(vColor, clamp(a,0.,1.));
}`;

function glowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d')!;
  const gr = g.createRadialGradient(128, 128, 0, 128, 128, 128);
  gr.addColorStop(0, 'rgba(255,255,255,0.95)');
  gr.addColorStop(0.2, 'rgba(255,255,255,0.55)');
  gr.addColorStop(0.5, 'rgba(210,230,255,0.22)');
  gr.addColorStop(0.8, 'rgba(180,210,255,0.07)');
  gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
  return new CanvasTexture(c);
}

function starLayer(max: number, par: number, size: [number, number], bright: number, color: string) {
  const geo = new BufferGeometry();
  const pos = new Float32Array(max * 3), sz = new Float32Array(max), ph = new Float32Array(max), br = new Float32Array(max);
  for (let i = 0; i < max; i++) {
    pos[i * 3] = (Math.random() - 0.5) * SPAN; pos[i * 3 + 1] = (Math.random() - 0.5) * SPAN;
    sz[i] = size[0] + Math.random() * (size[1] - size[0]); ph[i] = Math.random(); br[i] = bright * (0.4 + Math.random() * 0.6);
  }
  geo.setAttribute('position', new BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new BufferAttribute(sz, 1));
  geo.setAttribute('aPhase', new BufferAttribute(ph, 1));
  geo.setAttribute('aBright', new BufferAttribute(br, 1));
  const mat = new ShaderMaterial({
    vertexShader: STAR_VERT, fragmentShader: STAR_FRAG, transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending,
    uniforms: { uCam: { value: [0, 0] }, uPar: { value: par }, uSpan: { value: SPAN }, uDpr: { value: 1 }, uTime: { value: 0 }, uTw: { value: 1 }, uColor: { value: new Color(color) } },
  });
  const p = new Points(geo, mat); p.frustumCulled = false;
  return p;
}

export class SkyEngine {
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new OrthographicCamera(-1, 1, 1, -1, -10, 10);
  private far: Points; private mid: Points;
  private nebula: Mesh[] = [];
  private lights: Points; private fx: Points;
  private lg = { pos: new Float32Array(MAX_LIGHTS * 3), size: new Float32Array(MAX_LIGHTS), color: new Float32Array(MAX_LIGHTS * 3), kind: new Float32Array(MAX_LIGHTS), bright: new Float32Array(MAX_LIGHTS) };
  private fxd = { pos: new Float32Array(MAX_FX * 3), size: new Float32Array(MAX_FX), color: new Float32Array(MAX_FX * 3), kind: new Float32Array(MAX_FX), age: new Float32Array(MAX_FX) };
  private fxLife: { life: number; age: number; persistent: boolean }[] = [];
  private fxN = 0;
  private lightMat: ShaderMaterial; private fxMat: ShaderMaterial;
  private cam = { x: 0, y: 0 };
  private W = 1; private H = 1; private dpr = 1;
  private raf = 0; private running = false; private last = 0; private t0 = performance.now();
  private ema = 16; private emaSince = 0; private quality: QualityName; private lockedLow = false; private qStable = 0;
  private theme: Theme; private tint: [number, number, number] = [1, 1, 1];
  private fade = 0;
  private labels: HTMLDivElement[] = []; private labelCache: { text: string; tf: string; op: string }[] = [];
  private lanternEl: HTMLDivElement; private meteorEl: HTMLDivElement;
  private pointer = { down: false, x: 0, y: 0, sx: 0, sy: 0, t: 0, drag: false };
  private waypoint: { x: number; y: number } | null = null;
  private keys = new Set<string>();
  private lastSent = { x: 1e9, y: 1e9 };
  private unsub: () => void;
  private prevUI: { planet: boolean; incoming: number; selected: string | null; warp: number; theme: string; census: string } = { planet: false, incoming: 0, selected: null, warp: 0, theme: '', census: '' };
  private lastSparkle = 0;
  private cleanup: (() => void)[] = [];

  constructor(private canvas: HTMLCanvasElement, private host: HTMLElement, private state: WorldState, private ui: Store, private world: World) {
    this.renderer = new WebGLRenderer({ canvas, alpha: true, antialias: false, powerPreference: 'high-performance', stencil: false, depth: false });
    this.renderer.setClearColor(0x000000, 0);
    this.theme = resolveTheme(ui.get().skyTheme);

    const nav = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
    const weak = (nav.hardwareConcurrency || 8) <= 4 || (nav.deviceMemory || 8) <= 4 || !!nav.connection?.saveData;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.quality = reduced ? 'low' : weak ? 'balanced' : 'high';
    this.lockedLow = ui.get().lite;
    if (this.lockedLow) this.quality = 'low';

    this.far = starLayer(QUALITY.high.far, 0.18, [1.5, 3.2], 0.85, '#e2ecff');
    this.mid = starLayer(QUALITY.high.mid, 0.45, [2.2, 5.2], 1.0, '#ffffff');
    const tex = glowTexture();
    for (let i = 0; i < 8; i++) {
      const m = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending, opacity: 0.16 + Math.random() * 0.1 }));
      m.userData = { bx: (Math.random() - 0.5) * SPAN, by: (Math.random() - 0.5) * SPAN, s: 750 + Math.random() * 700, par: 0.08 + Math.random() * 0.1 };
      m.scale.set(m.userData.s, m.userData.s, 1);
      this.nebula.push(m);
    }

    const lgGeo = new BufferGeometry();
    lgGeo.setAttribute('position', new BufferAttribute(this.lg.pos, 3).setUsage(35048));
    lgGeo.setAttribute('aSize', new BufferAttribute(this.lg.size, 1).setUsage(35048));
    lgGeo.setAttribute('aColor', new BufferAttribute(this.lg.color, 3).setUsage(35048));
    lgGeo.setAttribute('aKind', new BufferAttribute(this.lg.kind, 1).setUsage(35048));
    lgGeo.setAttribute('aBright', new BufferAttribute(this.lg.bright, 1).setUsage(35048));
    this.lightMat = new ShaderMaterial({ vertexShader: LIGHT_VERT, fragmentShader: LIGHT_FRAG, transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending, uniforms: { uCam: { value: [0, 0] }, uDpr: { value: 1 }, uTime: { value: 0 }, uFade: { value: 0 } } });
    this.lights = new Points(lgGeo, this.lightMat); this.lights.frustumCulled = false;

    const fxGeo = new BufferGeometry();
    fxGeo.setAttribute('position', new BufferAttribute(this.fxd.pos, 3).setUsage(35048));
    fxGeo.setAttribute('aSize', new BufferAttribute(this.fxd.size, 1).setUsage(35048));
    fxGeo.setAttribute('aColor', new BufferAttribute(this.fxd.color, 3).setUsage(35048));
    fxGeo.setAttribute('aKind', new BufferAttribute(this.fxd.kind, 1).setUsage(35048));
    fxGeo.setAttribute('aAge', new BufferAttribute(this.fxd.age, 1).setUsage(35048));
    this.fxMat = new ShaderMaterial({ vertexShader: FX_VERT, fragmentShader: FX_FRAG, transparent: true, depthTest: false, depthWrite: false, blending: AdditiveBlending, uniforms: { uCam: { value: [0, 0] }, uDpr: { value: 1 } } });
    this.fx = new Points(fxGeo, this.fxMat); this.fx.frustumCulled = false;

    this.scene.add(...this.nebula, this.far, this.mid, this.lights, this.fx);

    // DOM labels (thoughts). A small fixed pool, written only when text or position changes.
    for (let i = 0; i < 8; i++) { const d = document.createElement('div'); d.className = 'lbl'; host.appendChild(d); this.labels.push(d); this.labelCache.push({ text: '', tf: '', op: '' }); }
    this.lanternEl = document.createElement('div'); this.lanternEl.className = 'lbl special'; this.lanternEl.textContent = 'a lantern is drifting by'; host.appendChild(this.lanternEl);
    this.meteorEl = document.createElement('div'); this.meteorEl.className = 'lbl special'; this.meteorEl.textContent = 'shooting star · tap to catch'; host.appendChild(this.meteorEl);

    this.applyTheme(this.theme);
    this.setQuality(this.quality);
    this.bind();
    this.unsub = ui.subscribe(() => this.onUI());
    this.onUI();
  }

  // ----- public -----
  start() {
    if (this.running) return;
    this.running = true; this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  dispose() {
    this.stop(); this.unsub(); this.cleanup.forEach((f) => f());
    this.labels.forEach((l) => l.remove()); this.lanternEl.remove(); this.meteorEl.remove();
    this.scene.traverse((o) => { const m = o as Mesh; m.geometry?.dispose?.(); (m.material as { dispose?: () => void } | undefined)?.dispose?.(); });
    this.renderer.dispose(); this.renderer.forceContextLoss();
  }
  setLite(on: boolean) { this.lockedLow = on; this.setQuality(on ? 'low' : this.quality === 'low' ? 'balanced' : this.quality); }
  spawn(x: number, y: number, kind: number, color: string, size: number, life: number, persistent = false) {
    if (this.fxN >= MAX_FX) return -1;
    const i = this.fxN++, c = hex(color);
    this.fxd.pos.set([x, y, 0], i * 3); this.fxd.color.set([c.r, c.g, c.b], i * 3);
    this.fxd.size[i] = size; this.fxd.kind[i] = kind; this.fxd.age[i] = 0;
    this.fxLife[i] = { life, age: 0, persistent };
    return i;
  }

  // ----- internals -----
  private setQuality(q: QualityName) {
    this.quality = q;
    const s = QUALITY[q];
    this.dpr = Math.min(window.devicePixelRatio || 1, s.dpr);
    this.renderer.setPixelRatio(this.dpr);
    this.far.geometry.setDrawRange(0, s.far); this.mid.geometry.setDrawRange(0, s.mid);
    this.nebula.forEach((m, i) => { m.visible = i < s.nebula; });
    (this.far.material as ShaderMaterial).uniforms.uTw.value = s.twinkle;
    (this.mid.material as ShaderMaterial).uniforms.uTw.value = s.twinkle;
    this.resize();
    if (this.ui.get().quality !== q) this.ui.set({ quality: q });
  }
  private resize() {
    const r = this.host.getBoundingClientRect();
    this.W = Math.max(1, Math.round(r.width)); this.H = Math.max(1, Math.round(r.height));
    this.renderer.setSize(this.W, this.H, false);
    const c = this.camera; c.left = -this.W / 2; c.right = this.W / 2; c.top = this.H / 2; c.bottom = -this.H / 2; c.updateProjectionMatrix();
    for (const m of [this.far, this.mid]) (m.material as ShaderMaterial).uniforms.uDpr.value = this.dpr;
    this.lightMat.uniforms.uDpr.value = this.dpr; this.fxMat.uniforms.uDpr.value = this.dpr;
  }
  private applyTheme(t: Theme) {
    this.theme = t; this.tint = t.tint;
    this.nebula.forEach((m, i) => {
      const mat = m.material as MeshBasicMaterial;
      mat.color.set(t.nebula[i % t.nebula.length]);
      mat.opacity = t.mode === 'light' ? 0.04 : 0.2;
    });
    const starFar = t.mode === 'light' ? '#8bb5ff' : t.mode === 'evening' ? '#ffc4a8' : '#e2ecff';
    const starMid = t.mode === 'light' ? '#ffffff' : '#ffffff';
    (this.far.material as ShaderMaterial).uniforms.uColor.value.set(hex(starFar));
    (this.mid.material as ShaderMaterial).uniforms.uColor.value.set(hex(starMid));
  }
  private tintNebulaToCensus() {
    const { counts } = this.ui.get().census; const gal = this.ui.get().galaxies;
    let best = '', n = 0; for (const k in counts) if (counts[k] > n) { n = counts[k]; best = k; }
    const col = gal.find((g) => g.slug === best)?.color;
    this.nebula.forEach((m, i) => { const c = hex(this.theme.nebula[i % this.theme.nebula.length]); if (col && i % 2 === 0) c.lerp(hex(col), 0.4); (m.material as MeshBasicMaterial).color.copy(c); });
  }
  private onUI() {
    const s = this.ui.get(), p = this.prevUI, you = this.state.you;
    if (s.warp !== p.warp) { p.warp = s.warp; this.fade = 0; if (you) { this.cam.x = you.x; this.cam.y = you.y; } this.fxN = 0; this.lanternFx = -1; this.meteorFx = -1; }
    const resolved = resolveTheme(s.skyTheme);
    if (resolved.id !== this.theme.id || s.skyTheme !== p.theme) {
      p.theme = s.skyTheme;
      this.applyTheme(resolved);
    }
    const cs = JSON.stringify(s.census.counts); if (cs !== p.census) { p.census = cs; this.tintNebulaToCensus(); }
    if (!!s.planet !== p.planet) { p.planet = !!s.planet; if (s.planet && you) this.spawn(you.x, you.y, KIND_BURST, '#ffffff', 320, 1.4); }
    if (s.incoming.length > p.incoming) { const l = this.state.bySid.get(s.incoming[s.incoming.length - 1]); if (l) this.spawn(l.x, l.y, KIND_RING, MOOD_COLORS[l.m] || '#fff', 220, 1.6); }
    p.incoming = s.incoming.length;
    if (s.selected !== p.selected) { p.selected = s.selected; const l = s.selected ? this.state.bySid.get(s.selected) : null; if (l) this.spawn(l.x, l.y, KIND_RING, MOOD_COLORS[l.m] || '#fff', 120, 0.8); }
    if (s.lite !== this.lockedLow) this.setLite(s.lite);
  }
  private lanternFx = -1; private meteorFx = -1;

  private toWorld(sx: number, sy: number) { return { x: this.cam.x + (sx - this.W / 2), y: this.cam.y - (sy - this.H / 2) }; }
  private toScreen(x: number, y: number) { return { x: this.W / 2 + (x - this.cam.x), y: this.H / 2 - (y - this.cam.y) }; }

  private bind() {
    const el = this.canvas.parentElement || this.host;
    const rect = () => this.host.getBoundingClientRect();
    const down = (e: PointerEvent) => {
      if ((e.target as HTMLElement).closest('[data-ui]')) return;
      const r = rect(); const p = this.pointer;
      p.down = true; p.drag = false; p.sx = p.x = e.clientX - r.left; p.sy = p.y = e.clientY - r.top; p.t = performance.now();
      this.waypoint = null;
    };
    const move = (e: PointerEvent) => {
      const p = this.pointer; if (!p.down) return;
      const r = rect(); p.x = e.clientX - r.left; p.y = e.clientY - r.top;
      if (!p.drag && (Math.hypot(p.x - p.sx, p.y - p.sy) > 10 || performance.now() - p.t > 220)) p.drag = true;
    };
    const up = () => {
      const p = this.pointer; if (!p.down) return;
      p.down = false;
      if (!p.drag) this.tap(p.x, p.y);
      p.drag = false;
    };
    const kd = (e: KeyboardEvent) => { if ((e.target as HTMLElement)?.closest?.('input,textarea')) return; this.keys.add(e.key.toLowerCase()); };
    const ku = (e: KeyboardEvent) => this.keys.delete(e.key.toLowerCase());
    const vis = () => { if (document.hidden) this.stop(); else if (!this.running) this.start(); };
    const ro = new ResizeObserver(() => this.resize()); ro.observe(this.host);
    const lost = (e: Event) => { e.preventDefault(); this.ui.set({ listMode: true, toast: 'Your device could not keep the sky running. Switched to list view.' }); };
    el.addEventListener('pointerdown', down); window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); document.addEventListener('visibilitychange', vis);
    this.canvas.addEventListener('webglcontextlost', lost);
    this.cleanup.push(() => { el.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); document.removeEventListener('visibilitychange', vis); this.canvas.removeEventListener('webglcontextlost', lost); ro.disconnect(); });
  }

  private tap(sx: number, sy: number) {
    const s = this.ui.get();
    if (s.panel || s.planet) { /* sheets are open: ignore sky taps */ }
    if (s.meteor) { const m = this.toScreen(s.meteor.x, s.meteor.y); if (Math.hypot(m.x - sx, m.y - sy) < 46) { void this.world.catchMeteor(s.meteor.id); return; } }
    if (s.lanternDrift && this.lanternFx >= 0) { const l = this.toScreen(this.fxd.pos[this.lanternFx * 3], this.fxd.pos[this.lanternFx * 3 + 1]); if (Math.hypot(l.x - sx, l.y - sy) < 44) { this.ui.set({ panel: 'lanterns' }); return; } }
    let best: Light | null = null, bd = 30;
    for (const l of this.state.lights.values()) {
      if (l.hidden || l === this.state.you) continue;
      const p = this.toScreen(l.x, l.y), d = Math.hypot(p.x - sx, p.y - sy);
      if (d < bd) { bd = d; best = l; }
    }
    if (best) { this.ui.set({ selected: best.sid, panel: null }); return; }
    if (s.selected) this.ui.set({ selected: null });
    const w = this.toWorld(sx, sy); this.waypoint = { x: w.x, y: w.y };
    this.spawn(w.x, w.y, KIND_RING, '#ffffff', 70, 0.7);
  }

  private step(dt: number) {
    const you = this.state.you; if (!you) return;
    let tx: number | null = null, ty: number | null = null, speedCap = MAX_SPEED;
    const p = this.pointer;
    if (p.down && p.drag) { const w = this.toWorld(p.x, p.y); tx = w.x; ty = w.y; }
    else if (this.waypoint) { tx = this.waypoint.x; ty = this.waypoint.y; }
    let kx = 0, ky = 0;
    if (this.keys.has('arrowleft') || this.keys.has('a')) kx -= 1;
    if (this.keys.has('arrowright') || this.keys.has('d')) kx += 1;
    if (this.keys.has('arrowup') || this.keys.has('w')) ky += 1;
    if (this.keys.has('arrowdown') || this.keys.has('s')) ky -= 1;
    let vx = 0, vy = 0;
    if (kx || ky) { const n = Math.hypot(kx, ky); vx = (kx / n) * speedCap; vy = (ky / n) * speedCap; this.waypoint = null; }
    else if (tx !== null && ty !== null) {
      const dx = tx - you.x, dy = ty - you.y, d = Math.hypot(dx, dy);
      if (d < 4) {
        vx = 0; vy = 0;
        if (!(p.down && p.drag)) this.waypoint = null;
      } else {
        const sp = Math.min(speedCap, d * 2.2);
        vx = (dx / d) * sp;
        vy = (dy / d) * sp;
      }
    }
    const b = this.state.bound;
    you.x = Math.max(-b, Math.min(b, you.x + vx * dt)); you.y = Math.max(-b, Math.min(b, you.y + vy * dt));
    you.tx = you.x; you.ty = you.y;
    if (Math.hypot(you.x - this.lastSent.x, you.y - this.lastSent.y) > 0.5) { this.lastSent = { x: you.x, y: you.y }; this.world.move(you.x, you.y); }
  }

  private loop = (now: number) => {
    if (!this.running) return;
    this.raf = requestAnimationFrame(this.loop);
    const spec = QUALITY[this.quality];
    if (now - this.last < 1000 / spec.fps - 3) return;
    const dtMs = Math.min(100, now - this.last); this.last = now;
    const dt = dtMs / 1000, time = (now - this.t0) / 1000;
    this.adapt(dtMs, now);
    this.step(dt);

    const you = this.state.you;
    if (you) {
      const k = 1 - Math.exp(-dt * 4);
      const dx = you.x - this.cam.x, dy = you.y - this.cam.y;
      if (Math.hypot(dx, dy) > 0.05) {
        this.cam.x += dx * k;
        this.cam.y += dy * k;
      }
    }
    this.fade = Math.min(1, this.fade + dt * 0.7);
    const fadeE = this.fade * this.fade * (3 - 2 * this.fade);
    const cam: [number, number] = [this.cam.x, this.cam.y];

    for (const m of [this.far, this.mid]) { const u = (m.material as ShaderMaterial).uniforms; u.uCam.value = cam; u.uTime.value = time; }
    const half = SPAN / 2;
    for (const n of this.nebula) {
      if (!n.visible) continue;
      const d = n.userData; const mod = (v: number) => ((((v + half) % SPAN) + SPAN) % SPAN) - half;
      n.position.set(mod(d.bx - this.cam.x * d.par), mod(d.by - this.cam.y * d.par), 0);
    }
    this.lightMat.uniforms.uCam.value = cam; this.lightMat.uniforms.uTime.value = time; this.lightMat.uniforms.uFade.value = fadeE;
    this.fxMat.uniforms.uCam.value = cam;

    this.writeLights(time, dt);
    this.writeFx(dt, time);
    this.layoutLabels(time);

    if (this.theme.sparkle && now - this.lastSparkle > 1100 && this.quality !== 'low') {
      this.lastSparkle = now;
      const w = this.toWorld(Math.random() * this.W, Math.random() * this.H);
      this.spawn(w.x, w.y, KIND_BURST, this.theme.nebula[Math.floor(Math.random() * 3)], 90, 1.2);
    }
    this.renderer.render(this.scene, this.camera);
  };

  private adapt(dtMs: number, now: number) {
    this.ema = this.ema * 0.94 + dtMs * 0.06;
    if (now - this.emaSince < 2000) return;
    this.emaSince = now;
    const i = ORDER.indexOf(this.quality), budget = 1000 / QUALITY[this.quality].fps;
    if (this.ema > budget * 1.5 + 4 && i < ORDER.length - 1 && !this.lockedLow) { this.qStable = 0; this.setQuality(ORDER[i + 1]); }
    else if (this.ema < budget * 0.85) this.qStable++; else this.qStable = 0;
  }

  private writeLights(time: number, dt: number) {
    const st = this.state, sel = this.ui.get().selected, inc = this.ui.get().incoming, g = this.lg;
    const ease = 1 - Math.exp(-dt * 7);
    let n = 0;
    for (const l of st.lights.values()) {
      if (l !== st.you) { l.x += (l.tx - l.x) * ease; l.y += (l.ty - l.y) * ease; }
      if (l.hidden || n >= MAX_LIGHTS) continue;
      const f = l.f, mood = MOOD_RGB[l.m % 8] || MOOD_RGB[0];
      let kind = 0, size = 40, bright = l.near ? 0.95 : 0.58;
      if (l === st.you) { kind = 4; size = 66; bright = 1.1; }
      else if (f & F_ECHO) { kind = 3; size = 32; bright = 0.7; }
      else if (f & F_BUSY) { kind = 5; size = 40; bright = 0.7; }
      else if (f & F_NEW) { kind = 1; size = 46; }
      else if (f & F_VET) { kind = 2; size = 54; }
      if (l.sid === sel) bright = 1.3 + 0.2 * Math.sin(time * 6);
      else if (inc.includes(l.sid)) bright = 1.1 + 0.4 * Math.sin(time * 5);
      g.pos[n * 3] = l.x; g.pos[n * 3 + 1] = l.y; g.pos[n * 3 + 2] = 0;
      g.size[n] = size; g.kind[n] = kind; g.bright[n] = bright;
      g.color[n * 3] = Math.min(1, mood[0] * this.tint[0]); g.color[n * 3 + 1] = Math.min(1, mood[1] * this.tint[1]); g.color[n * 3 + 2] = Math.min(1, mood[2] * this.tint[2]);
      n++;
    }
    const geo = this.lights.geometry; geo.setDrawRange(0, n);
    for (const k of ['position', 'aSize', 'aColor', 'aKind', 'aBright']) (geo.getAttribute(k) as BufferAttribute).needsUpdate = true;
  }

  private writeFx(dt: number, time: number) {
    const s = this.ui.get(), d = this.fxd;
    // persistent things: meteor and lantern
    if (s.meteor && Date.now() > s.meteor.until) this.ui.set({ meteor: null });
    const wantMeteor = !!this.ui.get().meteor, wantLantern = s.lanternDrift;
    if (wantMeteor && this.meteorFx < 0) this.meteorFx = this.spawn(s.meteor!.x, s.meteor!.y, KIND_METEOR, '#bfe0ff', 150, 1e9, true);
    if (!wantMeteor && this.meteorFx >= 0) { this.kill(this.meteorFx); this.meteorFx = -1; }
    if (wantLantern && this.lanternFx < 0) this.lanternFx = this.spawn(0, 0, KIND_LANTERN, '#ffb35a', 90, 1e9, true);
    if (!wantLantern && this.lanternFx >= 0) { this.kill(this.lanternFx); this.lanternFx = -1; }
    if (this.lanternFx >= 0) { const i = this.lanternFx; d.pos[i * 3] = this.cam.x + Math.sin(time * 0.13) * this.W * 0.3; d.pos[i * 3 + 1] = this.cam.y + this.H * 0.18 + Math.sin(time * 0.5) * 14; }
    if (this.meteorFx >= 0 && this.ui.get().meteor) { const m = this.ui.get().meteor!; const i = this.meteorFx; d.pos[i * 3] = m.x; d.pos[i * 3 + 1] = m.y; }
    for (let i = 0; i < this.fxN; i++) {
      const L = this.fxLife[i];
      L.age += dt; d.age[i] = L.persistent ? time * 0.4 % 1000 : Math.min(1, L.age / L.life);
    }
    for (let i = this.fxN - 1; i >= 0; i--) { const L = this.fxLife[i]; if (!L.persistent && L.age >= L.life) this.kill(i); }
    const geo = this.fx.geometry; geo.setDrawRange(0, this.fxN);
    for (const k of ['position', 'aSize', 'aColor', 'aKind', 'aAge']) (geo.getAttribute(k) as BufferAttribute).needsUpdate = true;
  }
  private kill(i: number) {
    const last = this.fxN - 1, d = this.fxd;
    if (i !== last) {
      d.pos.copyWithin(i * 3, last * 3, last * 3 + 3); d.color.copyWithin(i * 3, last * 3, last * 3 + 3);
      d.size[i] = d.size[last]; d.kind[i] = d.kind[last]; d.age[i] = d.age[last]; this.fxLife[i] = this.fxLife[last];
      if (this.lanternFx === last) this.lanternFx = i; if (this.meteorFx === last) this.meteorFx = i;
    }
    this.fxLife.length = last; this.fxN = last;
  }

  private layoutLabels(time: number) {
    const st = this.state, you = st.you, spec = QUALITY[this.quality];
    const cands: { l: Light; d: number }[] = [];
    if (you) for (const l of st.lights.values()) {
      if (l.hidden || !l.t || (!l.near && l !== you)) continue;
      cands.push({ l, d: l === you ? -1 : (l.x - you.x) ** 2 + (l.y - you.y) ** 2 });
    }
    cands.sort((a, b) => a.d - b.d);
    const placed: { x: number; y: number }[] = [];
    let n = 0;
    const R = st.radius * 1.15;
    for (const c of cands) {
      if (n >= Math.min(spec.labels, this.labels.length)) break;
      const p = this.toScreen(c.l.x, c.l.y);
      if (p.x < -60 || p.x > this.W + 60 || p.y < -20 || p.y > this.H + 20) continue;
      if (placed.some((q) => Math.abs(q.x - p.x) < 150 && Math.abs(q.y - p.y) < 34)) continue;
      placed.push(p);
      const el = this.labels[n], cache = this.labelCache[n];
      const dist = Math.sqrt(Math.max(0, c.d)), op = c.l === you ? 0.7 : Math.max(0.15, Math.min(1, 1.25 - dist / R));
      const lx = Math.max(88, Math.min(this.W - 88, p.x));
      const tf = `translate3d(${Math.round(lx)}px,${Math.round(p.y - 22)}px,0)`, ops = op.toFixed(2);
      if (cache.text !== c.l.t) { el.textContent = c.l.t; cache.text = c.l.t; }
      if (cache.tf !== tf) { el.style.transform = tf; cache.tf = tf; }
      if (cache.op !== ops) { el.style.opacity = ops; cache.op = ops; }
      el.style.color = c.l === you ? '#cfe0ff' : '';
      el.classList.toggle('you', c.l === you);
      n++;
    }
    for (; n < this.labels.length; n++) { const cache = this.labelCache[n]; if (cache.op !== '0') { this.labels[n].style.opacity = '0'; cache.op = '0'; cache.text = ''; } }
    const s = this.ui.get();
    this.place(this.lanternEl, s.lanternDrift && this.lanternFx >= 0 ? { x: this.fxd.pos[this.lanternFx * 3], y: this.fxd.pos[this.lanternFx * 3 + 1] } : null, time);
    this.place(this.meteorEl, s.meteor ? { x: s.meteor.x, y: s.meteor.y } : null, time);
  }
  private place(el: HTMLElement, w: { x: number; y: number } | null, time: number) {
    if (!w) { if (el.style.opacity !== '0') el.style.opacity = '0'; return; }
    const p = this.toScreen(w.x, w.y);
    el.style.transform = `translate3d(${Math.round(p.x)}px,${Math.round(p.y + 30)}px,0)`;
    el.style.opacity = String(0.65 + 0.3 * Math.sin(time * 2));
  }
}
