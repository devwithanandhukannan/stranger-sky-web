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
const MAX_LIGHTS = 1100, MAX_FX = 64, SPAN = 4000, MAX_SPEED = 150;
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
  private renderer: WebGLRenderer | null = null;
  private ctx2d: CanvasRenderingContext2D | null = null;
  private is2d = false;
  private stars2d: { x: number; y: number; r: number; a: number; par: number; phase: number }[] = [];
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
  private threadSvg: SVGSVGElement | null = null;
  private threadGlowPath: SVGPathElement | null = null;
  private threadCorePath: SVGPathElement | null = null;
  private threadPulsePath: SVGPathElement | null = null;
  private threadSparkCircle: SVGCircleElement | null = null;
  private threadUserRing: SVGCircleElement | null = null;
  private threadTargetGlow: SVGCircleElement | null = null;
  private threadPeerLabel: HTMLDivElement | null = null;
  private threadConnectedSid: string | null = null;
  private threadProgress = 0;
  private cleanup: (() => void)[] = [];
  constructor(private canvas: HTMLCanvasElement, private host: HTMLElement, private state: WorldState, private ui: Store, private world: World) {
    for (let i = 0; i < 220; i++) {
      this.stars2d.push({
        x: (Math.random() - 0.5) * SPAN,
        y: (Math.random() - 0.5) * SPAN,
        r: 0.8 + Math.random() * 1.8,
        a: 0.3 + Math.random() * 0.7,
        par: i < 70 ? 0.15 : i < 150 ? 0.35 : 0.6,
        phase: Math.random() * Math.PI * 2,
      });
    }

    try {
      this.renderer = new WebGLRenderer({
        canvas,
        alpha: true,
        antialias: false,
        powerPreference: 'high-performance',
        stencil: false,
        depth: false,
        failIfMajorPerformanceCaveat: false,
      });
      this.renderer.setClearColor(0x000000, 0);
    } catch {
      try {
        this.renderer = new WebGLRenderer({
          canvas,
          alpha: true,
          antialias: false,
          powerPreference: 'default',
          stencil: false,
          depth: false,
          failIfMajorPerformanceCaveat: false,
        });
        this.renderer.setClearColor(0x000000, 0);
      } catch {
        try {
          this.renderer = new WebGLRenderer({ canvas, alpha: true });
          this.renderer.setClearColor(0x000000, 0);
        } catch {
          this.renderer = null;
          this.is2d = true;
          this.ctx2d = canvas.getContext('2d');
        }
      }
    }
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

    // Celestial connection thread SVG & peer label
    if (typeof document !== 'undefined') {
      const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('class', 'sky-threads');
      svg.setAttribute('aria-hidden', 'true');
      svg.style.opacity = '0';
      
      const glowPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      glowPath.setAttribute('class', 'sky-thread-glow');
      
      const corePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      corePath.setAttribute('class', 'sky-thread-core');
      
      const pulsePath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      pulsePath.setAttribute('class', 'sky-thread-pulse');

      const sparkCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      sparkCircle.setAttribute('class', 'sky-thread-spark');
      sparkCircle.setAttribute('r', '2.5');
      sparkCircle.style.opacity = '0';

      const userRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      userRing.setAttribute('class', 'sky-thread-user-ring');
      userRing.setAttribute('r', '22');
      userRing.style.opacity = '0';

      const targetGlow = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      targetGlow.setAttribute('class', 'sky-thread-target-glow');
      targetGlow.setAttribute('r', '28');
      targetGlow.style.opacity = '0';
      
      svg.appendChild(targetGlow);
      svg.appendChild(userRing);
      svg.appendChild(glowPath);
      svg.appendChild(corePath);
      svg.appendChild(pulsePath);
      svg.appendChild(sparkCircle);
      host.appendChild(svg);
      
      this.threadSvg = svg;
      this.threadGlowPath = glowPath;
      this.threadCorePath = corePath;
      this.threadPulsePath = pulsePath;
      this.threadSparkCircle = sparkCircle;
      this.threadUserRing = userRing;
      this.threadTargetGlow = targetGlow;
      
      const peerLbl = document.createElement('div');
      peerLbl.className = 'connected-peer-label';
      peerLbl.textContent = 'a stranger';
      host.appendChild(peerLbl);
      this.threadPeerLabel = peerLbl;
    }

    this.applyTheme(this.theme);
    this.setQuality(this.quality);
    this.bind();
    this.unsub = ui.subscribe(() => this.onUI());
    this.onUI();
    if (this.state.you) {
      this.cam.x = this.state.you.x;
      this.cam.y = this.state.you.y;
    }
  }

  // ----- public -----
  start() {
    if (this.state.you) {
      this.cam.x = this.state.you.x;
      this.cam.y = this.state.you.y;
    }
    this.fade = 1;
    this.resize();
    if (this.running) return;
    this.running = true; this.last = performance.now();
    this.raf = requestAnimationFrame(this.loop);
  }
  stop() { this.running = false; cancelAnimationFrame(this.raf); }
  dispose() {
    this.stop(); this.unsub(); this.cleanup.forEach((f) => f());
    this.labels.forEach((l) => l.remove()); this.lanternEl.remove(); this.meteorEl.remove();
    this.threadSvg?.remove(); this.threadPeerLabel?.remove();
    if (this.renderer) {
      this.scene.traverse((o) => { const m = o as Mesh; m.geometry?.dispose?.(); (m.material as { dispose?: () => void } | undefined)?.dispose?.(); });
      this.renderer.dispose();
    }
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
    if (this.renderer) {
      this.renderer.setPixelRatio(this.dpr);
      this.far.geometry.setDrawRange(0, s.far); this.mid.geometry.setDrawRange(0, s.mid);
      this.nebula.forEach((m, i) => { m.visible = i < s.nebula; });
      (this.far.material as ShaderMaterial).uniforms.uTw.value = s.twinkle;
      (this.mid.material as ShaderMaterial).uniforms.uTw.value = s.twinkle;
    }
    this.resize();
    if (this.ui.get().quality !== q) this.ui.set({ quality: q });
  }
  resize() {
    const r = this.host.getBoundingClientRect();
    this.W = Math.max(1, Math.round(r.width)); this.H = Math.max(1, Math.round(r.height));
    if (this.renderer) {
      this.renderer.setSize(this.W, this.H, false);
      const c = this.camera; c.left = -this.W / 2; c.right = this.W / 2; c.top = this.H / 2; c.bottom = -this.H / 2; c.updateProjectionMatrix();
      for (const m of [this.far, this.mid]) (m.material as ShaderMaterial).uniforms.uDpr.value = this.dpr;
      this.lightMat.uniforms.uDpr.value = this.dpr; this.fxMat.uniforms.uDpr.value = this.dpr;
    } else if (this.ctx2d) {
      this.canvas.width = Math.round(this.W * this.dpr);
      this.canvas.height = Math.round(this.H * this.dpr);
      this.canvas.style.width = `${this.W}px`;
      this.canvas.style.height = `${this.H}px`;
    }
    if (this.threadSvg) {
      this.threadSvg.setAttribute('width', `${this.W}`);
      this.threadSvg.setAttribute('height', `${this.H}`);
      this.threadSvg.setAttribute('viewBox', `0 0 ${this.W} ${this.H}`);
    }
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
    if (s.warp !== p.warp) {
      p.warp = s.warp;
      this.fade = 0;
      if (you) { this.cam.x = you.x; this.cam.y = you.y; }
      this.fxN = 0;
      this.lanternFx = -1;
      this.meteorFx = -1;
      this.lanternAge = 0;
      this.lanternCooldown = 3;
      this.lanternOpacity = 0;
    }
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
  private lanternPos = { x: 0, y: 0 };
  private lanternVel = { x: 0, y: 0 };
  private lanternAge = 0;
  private lanternDuration = 38;
  private lanternCooldown = 0;
  private lanternOpacity = 0;

  private wrap(v: number, span = this.state.bound * 2): number {
    const half = span / 2;
    return ((((v + half) % span) + span) % span) - half;
  }

  private spawnLanternDrift() {
    const you = this.state.you;
    const baseCamX = you ? you.x : this.cam.x;
    const baseCamY = you ? you.y : this.cam.y;
    const fromLeft = Math.random() < 0.5;
    const spawnOffsetX = fromLeft ? -(this.W * 0.45 + 120) : (this.W * 0.45 + 120);
    const spawnOffsetY = (Math.random() - 0.5) * (this.H * 0.6);
    this.lanternPos = {
      x: this.wrap(baseCamX + spawnOffsetX),
      y: this.wrap(baseCamY + spawnOffsetY),
    };
    this.lanternVel = {
      x: (fromLeft ? 1 : -1) * (10 + Math.random() * 8),
      y: (Math.random() - 0.5) * 6,
    };
    this.lanternAge = 0;
    this.lanternDuration = 34 + Math.random() * 10;
    this.lanternOpacity = 0;
    this.lanternFx = this.spawn(this.lanternPos.x, this.lanternPos.y, KIND_LANTERN, '#ffb35a', 90, 1e9, true);
  }

  private toWorld(sx: number, sy: number) {
    return {
      x: this.wrap(this.cam.x + (sx - this.W / 2)),
      y: this.wrap(this.cam.y - (sy - this.H / 2)),
    };
  }
  private toScreen(x: number, y: number) {
    const dx = this.wrap(x - this.cam.x);
    const dy = this.wrap(y - this.cam.y);
    return { x: this.W / 2 + dx, y: this.H / 2 - dy };
  }

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
    const lost = (e: Event) => {
      e.preventDefault();
      this.renderer = null;
      this.is2d = true;
      this.ctx2d = this.canvas.getContext('2d');
      this.resize();
    };
    el.addEventListener('pointerdown', down); window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up);
    window.addEventListener('keydown', kd); window.addEventListener('keyup', ku); document.addEventListener('visibilitychange', vis);
    if (this.renderer) this.canvas.addEventListener('webglcontextlost', lost);
    this.cleanup.push(() => { el.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); window.removeEventListener('keydown', kd); window.removeEventListener('keyup', ku); document.removeEventListener('visibilitychange', vis); if (this.renderer) this.canvas.removeEventListener('webglcontextlost', lost); ro.disconnect(); });
  }

  private tap(sx: number, sy: number) {
    const s = this.ui.get();
    if (s.panel || s.planet) { /* sheets are open: ignore sky taps */ }
    if (s.meteor) { const m = this.toScreen(s.meteor.x, s.meteor.y); if (Math.hypot(m.x - sx, m.y - sy) < 46) { void this.world.catchMeteor(s.meteor.id); return; } }
    if (s.lanternDrift && this.lanternFx >= 0 && this.lanternOpacity > 0.15) {
      const bob = Math.sin(performance.now() * 0.001 * 0.9) * 4;
      const l = this.toScreen(this.lanternPos.x, this.lanternPos.y + bob);
      if (Math.hypot(l.x - sx, l.y - sy) < 44) { this.ui.set({ panel: 'lanterns' }); return; }
    }
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
      const dx = this.wrap(tx - you.x), dy = this.wrap(ty - you.y), d = Math.hypot(dx, dy);
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
    const span = b * 2;
    let nx = you.x + vx * dt;
    let ny = you.y + vy * dt;
    if (nx > b) { nx -= span; you.x -= span; this.cam.x -= span; }
    else if (nx < -b) { nx += span; you.x += span; this.cam.x += span; }

    if (ny > b) { ny -= span; you.y -= span; this.cam.y -= span; }
    else if (ny < -b) { ny += span; you.y += span; this.cam.y += span; }

    you.x = nx; you.y = ny;
    you.tx = you.x; you.ty = you.y;
    if (Math.hypot(this.wrap(you.x - this.lastSent.x), this.wrap(you.y - this.lastSent.y)) > 0.5) {
      this.lastSent = { x: you.x, y: you.y };
      this.world.move(you.x, you.y);
    }
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
      const s = this.ui.get();
      let targetX = you.x;
      let targetY = you.y;
      const peerSid = (s.planet && !s.planet.ended) ? s.planet.sid : null;
      if (peerSid) {
        const other = this.state.bySid.get(peerSid) || Array.from(this.state.lights.values()).find((l) => l.sid === peerSid);
        if (other && !other.hidden) {
          const otherRelX = you.x + this.wrap(other.x - you.x);
          const otherRelY = you.y + this.wrap(other.y - you.y);
          targetX = you.x * 0.65 + otherRelX * 0.35;
          targetY = you.y * 0.65 + otherRelY * 0.35;
        }
      }
      const dx = this.wrap(targetX - this.cam.x);
      const dy = this.wrap(targetY - this.cam.y);
      if (Math.hypot(dx, dy) > 0.05) {
        this.cam.x = this.wrap(this.cam.x + dx * k);
        this.cam.y = this.wrap(this.cam.y + dy * k);
      }
    }
    this.fade = Math.min(1, this.fade + dt * 0.7);
    const fadeE = this.fade * this.fade * (3 - 2 * this.fade);
    const cam: [number, number] = [this.cam.x, this.cam.y];

    if (this.renderer) {
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
      this.renderer.render(this.scene, this.camera);
    } else if (this.ctx2d) {
      this.render2D(fadeE, time, dt);
    }
    this.layoutLabels(time);
    this.updateConnectionThread(time, dt);

    if (this.theme.sparkle && now - this.lastSparkle > 1100 && this.quality !== 'low') {
      this.lastSparkle = now;
      const w = this.toWorld(Math.random() * this.W, Math.random() * this.H);
      this.spawn(w.x, w.y, KIND_BURST, this.theme.nebula[Math.floor(Math.random() * 3)], 90, 1.2);
    }
  };

  private render2D(fade: number, time: number, dt: number) {
    const ctx = this.ctx2d;
    if (!ctx) return;
    const w = this.W * this.dpr, h = this.H * this.dpr;
    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.scale(this.dpr, this.dpr);

    const half = SPAN / 2;
    const mod = (v: number) => ((((v + half) % SPAN) + SPAN) % SPAN) - half;

    const isLight = this.theme.mode === 'light';
    const starRgb = isLight ? '80, 120, 200' : '230, 240, 255';
    for (const s of this.stars2d) {
      const sx = mod(s.x - this.cam.x * s.par) + this.W / 2;
      const sy = mod(s.y - this.cam.y * s.par) + this.H / 2;
      if (sx < -10 || sx > this.W + 10 || sy < -10 || sy > this.H + 10) continue;
      const tw = s.a * (0.65 + 0.35 * Math.sin(time * 2.5 + s.phase));
      ctx.fillStyle = `rgba(${starRgb},${tw.toFixed(2)})`;
      ctx.beginPath();
      ctx.arc(sx, sy, s.r, 0, Math.PI * 2);
      ctx.fill();
    }

    const ease = 1 - Math.exp(-dt * 7);
    const sel = this.ui.get().selected;
    const inc = this.ui.get().incoming;
    const halfW = this.W / 2 + 100;
    const halfH = this.H / 2 + 100;

    for (const l of this.state.lights.values()) {
      if (l !== this.state.you) {
        const dtx = this.wrap(l.tx - l.x);
        const dty = this.wrap(l.ty - l.y);
        l.x = this.wrap(l.x + dtx * ease);
        l.y = this.wrap(l.y + dty * ease);
      }
      if (l.hidden) continue;

      const isYou = l === this.state.you;
      const relX = this.wrap(l.x - this.cam.x);
      const relY = this.wrap(l.y - this.cam.y);
      if (!isYou && (Math.abs(relX) > halfW || Math.abs(relY) > halfH)) continue;

      const p = { x: this.W / 2 + relX, y: this.H / 2 - relY };
      const mood = MOOD_COLORS[l.m % 8] || MOOD_COLORS[0];
      const baseR = isYou ? 7 : l.near ? 5.5 : 4;

      const glowR = isYou ? 24 : 15;
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, glowR);
      grad.addColorStop(0, mood);
      grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, glowR, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = isYou ? '#ffffff' : mood;
      ctx.beginPath();
      ctx.arc(p.x, p.y, baseR, 0, Math.PI * 2);
      ctx.fill();

      if (isYou || l.sid === sel || inc.includes(l.sid)) {
        const pulse = 10 + 6 * Math.sin(time * 4);
        ctx.strokeStyle = mood;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, pulse, 0, Math.PI * 2);
        ctx.stroke();
      }
    }

    const s = this.ui.get();
    if (s.meteor) {
      const mp = this.toScreen(s.meteor.x, s.meteor.y);
      ctx.fillStyle = '#bfe0ff';
      ctx.beginPath();
      ctx.arc(mp.x, mp.y, 8, 0, Math.PI * 2);
      ctx.fill();
    }
    if (s.lanternDrift && this.lanternFx >= 0 && this.lanternOpacity > 0.02) {
      const bob = Math.sin(time * 0.9) * 4;
      const lp = this.toScreen(this.lanternPos.x, this.lanternPos.y + bob);
      if (lp.x >= -40 && lp.x <= this.W + 40 && lp.y >= -40 && lp.y <= this.H + 40) {
        ctx.save();
        ctx.globalAlpha = this.lanternOpacity;
        ctx.fillStyle = '#ffb35a';
        ctx.beginPath();
        ctx.arc(lp.x, lp.y, 7, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }

    ctx.restore();
  }

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
    const userInterests = this.ui.get().userInterests || [];
    const selectedInterest = this.ui.get().selectedInterest?.toLowerCase();
    const ease = 1 - Math.exp(-dt * 7);

    let n = 0;
    const margin = 180;
    const halfW = this.W / 2 + margin;
    const halfH = this.H / 2 + margin;

    for (const l of st.lights.values()) {
      if (l !== st.you) {
        const dtx = this.wrap(l.tx - l.x);
        const dty = this.wrap(l.ty - l.y);
        l.x = this.wrap(l.x + dtx * ease);
        l.y = this.wrap(l.y + dty * ease);
      }
      if (l.hidden || n >= MAX_LIGHTS) continue;

      const isYou = l === st.you;
      const relX = this.wrap(l.x - this.cam.x);
      const relY = this.wrap(l.y - this.cam.y);

      // Viewport culling: only process and draw lights within or near screen
      if (!isYou && (Math.abs(relX) > halfW || Math.abs(relY) > halfH)) continue;

      const f = l.f, mood = MOOD_RGB[l.m % 8] || MOOD_RGB[0];
      let kind = 0, size = 40, bright = l.near ? 0.95 : 0.58;
      if (isYou) { kind = 4; size = 66; bright = 1.1; }
      else if (f & F_ECHO) { kind = 3; size = 32; bright = 0.7; }
      else if (f & F_BUSY) { kind = 5; size = 40; bright = 0.7; }
      else if (f & F_NEW) { kind = 1; size = 46; }
      else if (f & F_VET) { kind = 2; size = 54; }

      const isMatchingInterest = !isYou && l.interests && l.interests.length > 0 && (
        (selectedInterest && l.interests.some((tag) => tag.toLowerCase() === selectedInterest)) ||
        (userInterests.length > 0 && userInterests.some((myTag) => l.interests!.some((theirTag) => theirTag.toLowerCase() === myTag.toLowerCase())))
      );
      if (isMatchingInterest) {
        bright = Math.max(bright, 1.25 + 0.3 * Math.sin(time * 4 + l.i));
        size = Math.round(size * 1.35);
      }

      const connectedSid = this.ui.get().planet?.sid;
      if (connectedSid && l.sid === connectedSid) {
        bright = 1.45 + 0.25 * Math.sin(time * 5);
        size = Math.round(size * 1.35);
      } else if (l.sid === sel) bright = 1.3 + 0.2 * Math.sin(time * 6);
      else if (inc.includes(l.sid)) bright = 1.1 + 0.4 * Math.sin(time * 5);

      g.pos[n * 3] = this.cam.x + relX;
      g.pos[n * 3 + 1] = this.cam.y + relY;
      g.pos[n * 3 + 2] = 0;
      g.size[n] = size;
      g.kind[n] = kind;
      g.bright[n] = bright;
      g.color[n * 3] = Math.min(1, mood[0] * this.tint[0]);
      g.color[n * 3 + 1] = Math.min(1, mood[1] * this.tint[1]);
      g.color[n * 3 + 2] = Math.min(1, mood[2] * this.tint[2]);
      n++;
    }
    const geo = this.lights.geometry; geo.setDrawRange(0, n);
    for (const k of ['position', 'aSize', 'aColor', 'aKind', 'aBright']) (geo.getAttribute(k) as BufferAttribute).needsUpdate = true;
  }

  private writeFx(dt: number, time: number) {
    const s = this.ui.get(), d = this.fxd;
    // persistent things: meteor and lantern
    if (s.meteor && Date.now() > s.meteor.until) this.ui.set({ meteor: null });
    const wantMeteor = !!this.ui.get().meteor;
    const wantLantern = !!s.lanternDrift;

    if (wantMeteor && this.meteorFx < 0) this.meteorFx = this.spawn(s.meteor!.x, s.meteor!.y, KIND_METEOR, '#bfe0ff', 150, 1e9, true);
    if (!wantMeteor && this.meteorFx >= 0) { this.kill(this.meteorFx); this.meteorFx = -1; }

    if (wantLantern) {
      if (this.lanternFx < 0) {
        if (this.lanternCooldown > 0) {
          this.lanternCooldown -= dt;
        } else {
          this.spawnLanternDrift();
        }
      } else {
        this.lanternAge += dt;
        this.lanternPos.x += this.lanternVel.x * dt;
        this.lanternPos.y += this.lanternVel.y * dt;

        // Smooth fade-in (first 3.5s) and fade-out (last 5s)
        const fadeIn = Math.min(1, this.lanternAge / 3.5);
        const fadeOut = Math.max(0, Math.min(1, (this.lanternDuration - this.lanternAge) / 5.0));
        this.lanternOpacity = fadeIn * fadeOut;

        const i = this.lanternFx;
        const bob = Math.sin(time * 0.9) * 4;
        d.pos[i * 3] = this.lanternPos.x;
        d.pos[i * 3 + 1] = this.lanternPos.y + bob;
        d.size[i] = 90 * Math.max(0.01, this.lanternOpacity);

        if (this.lanternAge >= this.lanternDuration) {
          this.kill(this.lanternFx);
          this.lanternFx = -1;
          this.lanternOpacity = 0;
          this.lanternCooldown = 14 + Math.random() * 12;
        }
      }
    } else {
      if (this.lanternFx >= 0) {
        this.kill(this.lanternFx);
        this.lanternFx = -1;
      }
      this.lanternOpacity = 0;
      this.lanternCooldown = 0;
    }

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
    const sel = this.ui.get().selected;
    const cands: { l: Light; d: number }[] = [];
    if (you) for (const l of st.lights.values()) {
      if (l.hidden || !l.t) continue;
      const dx = this.wrap(l.x - you.x);
      const dy = this.wrap(l.y - you.y);
      const d = l === you ? -1 : dx * dx + dy * dy;
      if (!l.near && l !== you && sel !== l.sid && d > (st.radius * 1.5) ** 2) continue;
      cands.push({ l, d });
    }
    cands.sort((a, b) => a.d - b.d);
    const placed: { x: number; y: number }[] = [];
    let n = 0;
    const R = Math.max(220, st.radius * 1.25);
    for (const c of cands) {
      if (n >= Math.min(spec.labels, this.labels.length)) break;
      const p = this.toScreen(c.l.x, c.l.y);
      if (p.x < -60 || p.x > this.W + 60 || p.y < -20 || p.y > this.H + 20) continue;
      const isSelected = sel === c.l.sid;
      if (!isSelected && placed.some((q) => Math.abs(q.x - p.x) < 70 && Math.abs(q.y - p.y) < 22)) continue;
      placed.push(p);
      const el = this.labels[n], cache = this.labelCache[n];
      const dist = Math.sqrt(Math.max(0, c.d));
      const op = c.l === you ? 0.85 : isSelected ? 1 : Math.max(0.65, Math.min(1, 1.3 - dist / R));
      const lx = Math.max(110, Math.min(this.W - 110, p.x));
      const tf = `translate3d(${Math.round(lx)}px,${Math.round(p.y - 24)}px,0)`, ops = op.toFixed(2);
      if (cache.text !== c.l.t) { el.textContent = c.l.t; cache.text = c.l.t; }
      if (cache.tf !== tf) { el.style.transform = tf; cache.tf = tf; }
      if (cache.op !== ops) { el.style.opacity = ops; cache.op = ops; }
      el.classList.toggle('you', c.l === you);
      n++;
    }
    for (; n < this.labels.length; n++) { const cache = this.labelCache[n]; if (cache.op !== '0') { this.labels[n].style.opacity = '0'; cache.op = '0'; cache.text = ''; } }
    const s = this.ui.get();
    const bob = Math.sin(time * 0.9) * 4;
    this.place(
      this.lanternEl,
      s.lanternDrift && this.lanternFx >= 0 && this.lanternOpacity > 0.05
        ? { x: this.lanternPos.x, y: this.lanternPos.y + bob }
        : null,
      time,
      this.lanternOpacity
    );
    this.place(this.meteorEl, s.meteor ? { x: s.meteor.x, y: s.meteor.y } : null, time);
  }
  private place(el: HTMLElement, w: { x: number; y: number } | null, time: number, alpha = 1) {
    if (!w || alpha <= 0.02) { if (el.style.opacity !== '0') el.style.opacity = '0'; return; }
    const p = this.toScreen(w.x, w.y);
    if (p.x < -120 || p.x > this.W + 120 || p.y < -120 || p.y > this.H + 120) {
      if (el.style.opacity !== '0') el.style.opacity = '0';
      return;
    }
    el.style.transform = `translate3d(${Math.round(p.x)}px,${Math.round(p.y + 30)}px,0)`;
    const pulse = 0.65 + 0.3 * Math.sin(time * 2);
    el.style.opacity = String((pulse * alpha).toFixed(2));
  }

  private updateConnectionThread(time: number, dt: number) {
    if (!this.threadSvg || !this.threadCorePath) return;
    const s = this.ui.get();
    const you = this.state.you;

    let targetSid: string | null = null;
    let peerName = 'a stranger';
    let isConnected = false;

    if (s.planet && s.planet.sid && !s.planet.ended) {
      targetSid = s.planet.sid;
      peerName = (s.planet.known && s.planet.with?.name) ? s.planet.with.name : 'a stranger';
      isConnected = true;
    } else if (s.selected) {
      targetSid = s.selected;
      peerName = 'a stranger';
      isConnected = false;
    }

    const targetLight = targetSid ? (this.state.bySid.get(targetSid) || Array.from(this.state.lights.values()).find((l) => l.sid === targetSid)) : null;

    if (!you || !targetSid || !targetLight || targetLight === you || targetLight.hidden) {
      this.threadConnectedSid = null;
      this.threadProgress = 0;
      if (this.threadSvg.style.opacity !== '0') {
        this.threadSvg.style.opacity = '0';
      }
      if (this.threadPeerLabel && this.threadPeerLabel.style.opacity !== '0') {
        this.threadPeerLabel.style.opacity = '0';
      }
      if (this.threadUserRing) this.threadUserRing.style.opacity = '0';
      if (this.threadTargetGlow) this.threadTargetGlow.style.opacity = '0';
      return;
    }

    // Connection animation progress (draw-in)
    if (this.threadConnectedSid !== targetSid) {
      this.threadConnectedSid = targetSid;
      this.threadProgress = 0;
    }

    this.threadProgress = Math.min(1, this.threadProgress + dt * (isConnected ? 2.2 : 2.0));
    const t = this.threadProgress;

    const p1 = this.toScreen(you.x, you.y);
    const p2 = this.toScreen(targetLight.x, targetLight.y);

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dist = Math.hypot(dx, dy);

    if (dist < 10 || p1.x < -200 || p1.x > this.W + 200 || p1.y < -200 || p1.y > this.H + 200 || p2.x < -200 || p2.x > this.W + 200 || p2.y < -200 || p2.y > this.H + 200) {
      this.threadSvg.style.opacity = '0';
      if (this.threadPeerLabel) this.threadPeerLabel.style.opacity = '0';
      if (this.threadUserRing) this.threadUserRing.style.opacity = '0';
      if (this.threadTargetGlow) this.threadTargetGlow.style.opacity = '0';
      return;
    }

    // Midpoint between both stars
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;

    // Unit normal vector perpendicular to chord
    let nx = -dy / dist;
    let ny = dx / dist;

    // Ensure the arc curves upwards (towards sky, ny < 0 in screen space)
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    // If nearly vertical, ensure it consistently bows outward
    if (Math.abs(ny) < 0.12 && nx > 0) {
      nx = -nx;
    }

    // Organic gentle cosmic string harmonic vibration
    const wave = Math.sin(time * 2.2) * (Math.min(dist * 0.02, 3.5));
    // Arc height (approx 22% of span for control point, bowing curve by ~11% of span)
    const baseArch = Math.min(180, Math.max(36, dist * 0.22));
    const archHeight = baseArch + wave;

    const cx = mx + nx * archHeight;
    const cy = my + ny * archHeight;

    // Draw-in interpolated path: quadratic bezier curve B(t) from p1 to (cx, cy) to p2
    const currentEndX = (1 - t) * (1 - t) * p1.x + 2 * (1 - t) * t * cx + t * t * p2.x;
    const currentEndY = (1 - t) * (1 - t) * p1.y + 2 * (1 - t) * t * cy + t * t * p2.y;
    const currentControlX = (1 - t) * p1.x + t * cx;
    const currentControlY = (1 - t) * p1.y + t * cy;

    const pathD = `M ${p1.x.toFixed(1)} ${p1.y.toFixed(1)} Q ${currentControlX.toFixed(1)} ${currentControlY.toFixed(1)} ${currentEndX.toFixed(1)} ${currentEndY.toFixed(1)}`;

    this.threadGlowPath?.setAttribute('d', pathD);
    this.threadCorePath?.setAttribute('d', pathD);
    this.threadPulsePath?.setAttribute('d', pathD);

    // Continuous flowing pulse along the thread
    if (this.threadPulsePath) {
      const dashOffset = -(time * 120) % 184;
      this.threadPulsePath.style.strokeDashoffset = `${dashOffset}px`;
    }

    // Traveling light spark particle
    if (this.threadSparkCircle) {
      if (t >= 0.95) {
        const sparkT = (time * 0.45) % 1;
        const sx = (1 - sparkT) * (1 - sparkT) * p1.x + 2 * (1 - sparkT) * sparkT * cx + sparkT * sparkT * p2.x;
        const sy = (1 - sparkT) * (1 - sparkT) * p1.y + 2 * (1 - sparkT) * sparkT * cy + sparkT * sparkT * p2.y;
        this.threadSparkCircle.setAttribute('cx', sx.toFixed(1));
        this.threadSparkCircle.setAttribute('cy', sy.toFixed(1));
        this.threadSparkCircle.style.opacity = String(0.85 + 0.15 * Math.sin(time * 5));
      } else {
        this.threadSparkCircle.setAttribute('cx', currentEndX.toFixed(1));
        this.threadSparkCircle.setAttribute('cy', currentEndY.toFixed(1));
        this.threadSparkCircle.style.opacity = '1';
      }
    }

    // Rings & halos on the two connected stars
    if (this.threadUserRing) {
      this.threadUserRing.setAttribute('cx', p1.x.toFixed(1));
      this.threadUserRing.setAttribute('cy', p1.y.toFixed(1));
      this.threadUserRing.style.opacity = String(Math.min(1, t * 1.2));
    }
    if (this.threadTargetGlow) {
      this.threadTargetGlow.setAttribute('cx', p2.x.toFixed(1));
      this.threadTargetGlow.setAttribute('cy', p2.y.toFixed(1));
      this.threadTargetGlow.style.opacity = String(Math.min(1, Math.max(0, (t - 0.15) / 0.85)));
    }

    this.threadSvg.style.opacity = '1';

    // Peer label below their star
    if (this.threadPeerLabel) {
      if (t >= 0.5) {
        this.threadPeerLabel.textContent = peerName;
        this.threadPeerLabel.style.transform = `translate3d(${Math.round(p2.x)}px,${Math.round(p2.y + 26)}px,0)`;
        this.threadPeerLabel.style.opacity = String(Math.min(1, (t - 0.5) / 0.5));
      } else {
        this.threadPeerLabel.style.opacity = '0';
      }
    }
  }
}
