import type { GridPosition } from '../movement/gridMovement';
import type { WorldMapId } from '../worldMap';

// Outer exits invite committed routes without making players wait out the opening.
export const EXTRACTION_UNLOCK_DELAY_MS = 25_000;

export interface ExtractionPoint {
  readonly mapId: WorldMapId;
  readonly position: GridPosition;
  readonly label: string;
  readonly unlockAtMs: number;
}

export const EXTRACTION_POINTS: readonly ExtractionPoint[] = [
  {
    mapId: 'pallet-town',
    position: { x: 13, y: 39 },
    label: 'SOUTH GATE',
    unlockAtMs: 0,
  },
  {
    mapId: 'route-1',
    position: { x: 14, y: 25 },
    label: 'ROUTE OUTPOST',
    unlockAtMs: EXTRACTION_UNLOCK_DELAY_MS,
  },
  {
    mapId: 'viridian-forest',
    position: { x: 20, y: 30 },
    label: 'FOREST CLEARING',
    unlockAtMs: EXTRACTION_UNLOCK_DELAY_MS * 2,
  },
];
