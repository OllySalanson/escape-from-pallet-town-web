import type { GridPosition } from '../movement/gridMovement';
import type { WorldMapId } from '../worldMap';

// Outer exits invite committed routes without making players wait out the opening.
export const EXTRACTION_UNLOCK_DELAY_MS = 25_000;

export type ExtractionRequirement =
  | { readonly kind: 'always' }
  | { readonly kind: 'elapsed'; readonly unlockAtMs: number }
  | { readonly kind: 'poi-activated'; readonly poiId: string };

export interface ExtractionPoint {
  readonly mapId: WorldMapId;
  readonly position: GridPosition;
  readonly label: string;
  readonly unlockAtMs: number;
  /**
   * A visible condition for this route. unlockAtMs remains for backwards
   * compatible generated exits and is mirrored by elapsed requirements.
   */
  readonly requirement?: ExtractionRequirement;
}

export function isExtractionAvailable(
  point: ExtractionPoint,
  elapsedMs: number,
  activatedPoiIds: ReadonlySet<string>,
): boolean {
  const requirement =
    point.requirement ??
    (point.unlockAtMs === 0
      ? { kind: 'always' as const }
      : { kind: 'elapsed' as const, unlockAtMs: point.unlockAtMs });
  switch (requirement.kind) {
    case 'always':
      return true;
    case 'elapsed':
      return elapsedMs >= requirement.unlockAtMs;
    case 'poi-activated':
      return activatedPoiIds.has(requirement.poiId);
  }
}

export function extractionRequirementText(point: ExtractionPoint, elapsedMs: number): string {
  const requirement =
    point.requirement ??
    (point.unlockAtMs === 0
      ? { kind: 'always' as const }
      : { kind: 'elapsed' as const, unlockAtMs: point.unlockAtMs });
  if (requirement.kind === 'always') {
    return 'OPEN';
  }
  if (requirement.kind === 'poi-activated') {
    return 'ACTIVATE RANGER RADIO';
  }
  const seconds = Math.max(0, Math.ceil((requirement.unlockAtMs - elapsedMs) / 1_000));
  return seconds === 0 ? 'OPEN' : `FERRY IN ${seconds}s`;
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
  {
    mapId: 'floodplain-relay',
    position: { x: 15, y: 28 },
    label: 'SOUTH GATE',
    unlockAtMs: 0,
    requirement: { kind: 'always' },
  },
  {
    mapId: 'floodplain-relay',
    position: { x: 7, y: 21 },
    label: 'FERRY DOCK',
    unlockAtMs: 45_000,
    requirement: { kind: 'elapsed', unlockAtMs: 45_000 },
  },
  {
    mapId: 'floodplain-relay',
    position: { x: 19, y: 8 },
    label: 'RADIO EXIT',
    unlockAtMs: 0,
    requirement: { kind: 'poi-activated', poiId: 'floodplain-ranger-radio' },
  },
];
