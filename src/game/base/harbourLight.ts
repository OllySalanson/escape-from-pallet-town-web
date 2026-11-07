import { windowLight } from './homeClock';

/**
 * The harbour by the player's own clock. THE BOLTHOLE's window already goes
 * orange at dusk and dark at night (`homeClock.ts`); this is the same hour laid
 * over the whole harbour (`harbourNight.ts` draws it). Nothing is stored and
 * nothing changes but the picture: the harbour has no clock of its own, and
 * a night raid is decided by the same hour (`world/nightRaids.ts`).
 */
export interface HarbourWash {
  readonly colour: number;
  /** How much of the wash is laid over the picture. */
  readonly alpha: number;
}

/** The wash for this hour: warm at dusk, deep blue at night, none by day. */
export function harbourWash(now: Date): HarbourWash | null {
  switch (windowLight(now)) {
    case 'day':
      return null;
    case 'dusk':
      return { colour: 0xff8a3d, alpha: 0.16 };
    case 'night':
      return { colour: 0x14204a, alpha: 0.42 };
  }
}

/** Whether the windows, the ships and the harbour light are lit: from dusk until morning. */
export function lightsAreOn(now: Date): boolean {
  return windowLight(now) !== 'day';
}

/** How long the harbour light takes to swing across the bay and back. */
export const BEAM_SWEEP_MS = 7_000;
/** The arc it swings through, in radians, screen-wise (0 is east, a quarter turn is south). */
export const BEAM_ARC = { from: -0.25, to: 1.75 } as const;

/** Which way the harbour light points, `ms` after the harbour was drawn. */
export function beamAngle(ms: number): number {
  const phase = (Math.cos((ms / BEAM_SWEEP_MS) * Math.PI * 2) + 1) / 2;
  return BEAM_ARC.from + (BEAM_ARC.to - BEAM_ARC.from) * phase;
}
