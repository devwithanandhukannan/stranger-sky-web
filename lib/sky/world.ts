import type { WorldState } from './state';
import type { Store } from './store';

export interface World {
  start(): void | Promise<void>;
  stop(): void;
  move(x: number, y: number): void;
  thought(text: string, mood: number): Promise<string | null>;
  pulse(sid: string): void;
  travel(galaxy: string): Promise<string | null>;
  addGalaxy(name: string, color?: string): Promise<{ ok?: boolean; galaxy?: import('./store').Galaxy; error?: string }>;
  hop(): void;
  feed(): Promise<void>;
  send(text: string): Promise<string | null>;
  typing(): void;
  askPrompt(): void;
  keep(): void;
  leave(): void;
  block(sid: string): Promise<boolean>;
  report(sid: string, reason: string, details: string): Promise<boolean>;
  catchMeteor(id: string): Promise<string | null>;
  callBond(id: string): void;
  answerBond(id: string, accept: boolean): void;
  setLocation(lat: number, lon: number): Promise<boolean>;
  clearLocation(): Promise<boolean>;
  setInterests(interests: string[]): Promise<boolean>;
  toggleInterestDrive(on?: boolean): void;
  selectInterest(tag: string | null): void;
  driveToInterest(tag?: string): void;
}
export type WorldCtor = new (state: WorldState, ui: Store) => World;
