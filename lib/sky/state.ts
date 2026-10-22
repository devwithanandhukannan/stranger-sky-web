// The per-frame world lives OUTSIDE React: plain objects the renderer reads every frame.
export type Light = {
  i: number; sid: string; x: number; y: number; tx: number; ty: number; m: number; f: number;
  hidden: boolean; near: boolean; t: string; interests?: string[]; isIncognito?: boolean;
};

export class WorldState {
  lights = new Map<number, Light>();
  bySid = new Map<string, Light>();
  you: Light | null = null;
  bound = 2000;
  radius = 160;
  scale = 16;
  warpedAt = 0;

  reset() { this.lights.clear(); this.bySid.clear(); this.you = null; }
  add(p: { i: number; sid: string; x: number; y: number; m: number; f: number; interests?: string[]; isIncognito?: boolean; t?: string; near?: boolean }) {
    const old = this.lights.get(p.i) || (p.sid ? this.bySid.get(p.sid) : undefined);
    if (old) this.bySid.delete(old.sid);
    const l: Light = {
      ...p,
      tx: p.x,
      ty: p.y,
      hidden: old ? old.hidden : false,
      near: p.near ?? (old ? old.near : false),
      t: (p.t !== undefined && p.t !== '') ? p.t : (old?.t || ''),
      interests: p.interests || (old ? old.interests : []),
    };
    this.lights.set(p.i, l);
    this.bySid.set(p.sid, l);
    return l;
  }
  remove(i: number) {
    const l = this.lights.get(i);
    if (!l) return;
    this.lights.delete(i);
    this.bySid.delete(l.sid);
  }
  applyPos(a: Int16Array) {
    for (let k = 0; k + 2 < a.length; k += 3) {
      const l = this.lights.get(a[k]);
      if (!l || l === this.you) continue;
      l.tx = a[k + 1] / this.scale;
      l.ty = a[k + 2] / this.scale;
    }
  }
}
