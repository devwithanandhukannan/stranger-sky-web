'use client';
import { useSyncExternalStore } from 'react';
import type { Galaxy } from '../api';
export type { Galaxy };

export const MOOD_COLORS = ['#cfe0ff', '#ffd27a', '#ff8fb1', '#79e6b6', '#7fdcff', '#c4a0ff', '#ffb07a', '#9fb0ff'];
export const MOOD_NAMES = ['calm', 'warm', 'tender', 'hopeful', 'curious', 'dreamy', 'playful', 'quiet'];

export const F_NEW = 1, F_BUSY = 2, F_THOUGHT = 4, F_ECHO = 8, F_VET = 16;

export type NearItem = { i: number; sid: string; t: string; m: number; f: number; distKm?: number | null };
export type Bond = { id: string; name: string; online: boolean };
export type ChatMsg = { mine: boolean; t: string; ts: number };
export type Planet = {
  pid: string; sid: string; known: boolean; with: { id: string; name: string } | null; m: number; t: string; prompt: string;
  msgs: ChatMsg[]; typing: boolean; kept: boolean; ended: string | null; prompts: string[];
  distKm?: number | null;
};
export type Panel = null | 'thought' | 'lanterns' | 'bonds' | 'map' | 'settings' | 'list' | 'report';
export type QualityName = 'high' | 'balanced' | 'low';

export type UI = {
  status: 'idle' | 'connecting' | 'live' | 'offline' | 'kicked' | 'full' | 'denied';
  denied: string;
  name: string; galaxy: string; galaxies: Galaxy[];
  thought: string; mood: number; thoughtMax: number;
  near: NearItem[]; selected: string | null; incoming: string[];
  planet: Planet | null; bonds: Bond[]; ring: { id: string; name: string } | null;
  meteor: { id: string; x: number; y: number; until: number } | null; meteorPrompt: string | null;
  census: { counts: Record<string, number>; total: number };
  announcement: string; skyTheme: string;
  panel: Panel; lanternDrift: boolean; inboxTick: number; toast: string | null;
  listMode: boolean; sound: boolean; messageSound: boolean; messageTone: string; voiceReader: boolean; haptics: boolean; lite: boolean; quality: QualityName; warp: number;
  reportSid: string | null;
  locationGranted: boolean;
  userLocation: { lat: number; lon: number } | null;
};

export const initialUI: UI = {
  status: 'idle', denied: '', name: '', galaxy: '', galaxies: [], thought: '', mood: 0, thoughtMax: 120,
  near: [], selected: null, incoming: [], planet: null, bonds: [], ring: null, meteor: null, meteorPrompt: null,
  census: { counts: {}, total: 0 }, announcement: '', skyTheme: 'auto', panel: null, lanternDrift: false, inboxTick: 0,
  toast: null, listMode: false, sound: true, messageSound: true, messageTone: 'pop', voiceReader: false, haptics: true, lite: false, quality: 'high', warp: 0, reportSid: null,
  locationGranted: false,
  userLocation: null,
};

export function createStore<T extends object>(init: T) {
  let state = init;
  const subs = new Set<() => void>();
  return {
    get: () => state,
    set(patch: Partial<T> | ((s: T) => Partial<T>)) {
      const p = typeof patch === 'function' ? patch(state) : patch;
      state = { ...state, ...p };
      subs.forEach((f) => f());
    },
    subscribe(f: () => void) { subs.add(f); return () => { subs.delete(f); }; },
  };
}
export type Store = ReturnType<typeof createStore<UI>>;

// Selector hook: selectors must return primitives or stable references.
export function useUI<S>(store: Store, sel: (s: UI) => S): S {
  return useSyncExternalStore(store.subscribe, () => sel(store.get()), () => sel(initialUI));
}
