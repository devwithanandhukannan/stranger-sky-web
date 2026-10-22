'use client';
import { createContext, useContext } from 'react';
import type { Store } from '@/lib/sky/store';
import type { World } from '@/lib/sky/world';
import type { WorldState } from '@/lib/sky/state';

export type SkyCtx = { ui: Store; world: World; state: WorldState; getToken: (force?: boolean) => Promise<string | null>; onSignOut: () => void; onDeleted: () => void };
export const Ctx = createContext<SkyCtx | null>(null);
export const useSky = () => { const c = useContext(Ctx); if (!c) throw new Error('no sky ctx'); return c; };
