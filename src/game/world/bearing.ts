import type { GridPosition } from '../movement/gridMovement';

export type CompassPoint = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW';

const POINTS: readonly CompassPoint[] = ['E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'NE'];

const WORDS: Readonly<Record<CompassPoint, string>> = {
  N: 'north',
  NE: 'north-east',
  E: 'east',
  SE: 'south-east',
  S: 'south',
  SW: 'south-west',
  W: 'west',
  NW: 'north-west',
};

/**
 * The compass point from one tile towards another, to the nearest of eight, or
 * null when they are the same tile. Every heading the raid prints is this one:
 * the objective chip, the hunter chip and the field guide each used to name a
 * bare quadrant, so a kit two tiles west and eleven south read `SW` on the chip
 * under a briefing that (rightly) called it SOUTH.
 */
export function compassBearing(from: GridPosition, to: GridPosition): CompassPoint | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) {
    return null;
  }
  // Screen coordinates: y grows southwards, so a positive angle turns E to S.
  const eighth = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return POINTS[(eighth + 8) % 8];
}

export function compassWord(point: CompassPoint): string {
  return WORDS[point];
}
