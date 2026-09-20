import type { GridPosition } from '../movement/gridMovement';
import type { WorldMapId } from '../worldMap';

// Outer exits invite committed routes without making players wait out the opening.
export const EXTRACTION_UNLOCK_DELAY_MS = 25_000;

export type ExtractionRequirement =
  | { readonly kind: 'always' }
  | { readonly kind: 'elapsed'; readonly unlockAtMs: number }
  | {
      readonly kind: 'poi-activated';
      readonly poiId: string;
      /** Named on the marker so a sealed exit says what opens it. */
      readonly poiLabel: string;
    };

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
    return `ACTIVATE ${requirement.poiLabel}`;
  }
  const seconds = Math.max(0, Math.ceil((requirement.unlockAtMs - elapsedMs) / 1_000));
  return seconds === 0 ? 'OPEN' : `OPENS IN ${seconds}s`;
}

/**
 * What the map says over an exit: its name, then whether it can be left by.
 *
 * Every exit used to be captioned `EXTRACT OPEN`, so six authored names - Mill
 * Race, Signal Fire, Vault Culvert - were good names nobody playing ever read. A
 * stranger asked to draw the Floodplain from memory placed all six exits and
 * could name two, both from text elsewhere. A map lives in people's heads as the
 * names of its ways out, so the name goes first, the way a gate's does.
 */
export function extractionCaption(point: ExtractionPoint, isOpen: boolean, elapsedMs: number): string {
  // An exit a landmark has to open says so on a line of its own. On one line it
  // was `EXTRACT ACTIVATE RANGER STATION` - two verbs in a row, and a caption
  // twelve tiles wide lying across the ground it was meant to be beside.
  //
  // `WORK` rather than the sentence's `ACTIVATE`, because it is the word the
  // rest of the game uses for a landmark and it is four characters shorter:
  // `ACTIVATE OAK'S FIELD STATION` made a 171px window, which is more than
  // half the base stage, and on Route 1's station apron there was nowhere on
  // the screen it fitted - so the one exit a player standing beside it most
  // needed named went undrawn. Every line here is held to a caption's width in
  // `extractionPoints.test.ts`.
  if (!isOpen && point.requirement?.kind === 'poi-activated') {
    return `${point.label}\nEXTRACT SEALED\nWORK ${point.requirement.poiLabel}`;
  }
  return `${point.label}\nEXTRACT ${isOpen ? 'OPEN' : extractionRequirementText(point, elapsedMs)}`;
}

export const EXTRACTION_POINTS: readonly ExtractionPoint[] = [
  {
    mapId: 'pallet-town',
    position: { x: 15, y: 42 },
    label: 'SOUTH GATE',
    unlockAtMs: 0,
    requirement: { kind: 'always' },
  },
  {
    mapId: 'pallet-town',
    position: { x: 29, y: 21 },
    label: 'MILL STAIR',
    unlockAtMs: EXTRACTION_UNLOCK_DELAY_MS,
  },
  {
    mapId: 'pallet-town',
    position: { x: 5, y: 37 },
    label: 'WEST CULVERT',
    unlockAtMs: 0,
    requirement: { kind: 'poi-activated', poiId: 'pallet-sluice-wheel', poiLabel: 'SLUICE WHEEL' },
  },
  {
    mapId: 'route-1',
    position: { x: 3, y: 29 },
    label: 'WEST GATE',
    unlockAtMs: 0,
    requirement: { kind: 'always' },
  },
  {
    mapId: 'route-1',
    position: { x: 16, y: 30 },
    label: 'ROUTE OUTPOST',
    unlockAtMs: EXTRACTION_UNLOCK_DELAY_MS,
  },
  {
    mapId: 'route-1',
    position: { x: 30, y: 17 },
    label: 'STATION RELAY',
    unlockAtMs: 0,
    requirement: {
      kind: 'poi-activated',
      poiId: 'oak-field-station-relay',
      poiLabel: "OAK'S FIELD STATION",
    },
  },
  {
    // Behind the Overlook Gate, and open from the first second: a raid that
    // drops in at the Overlook Landing must never depend on a door to get home.
    // It stands two tiles in from the map's north edge, not in its corner: a
    // caption seated hard against an edge the camera stops at has nowhere to
    // go, and a stranger placed this one from the road and never learned its
    // name.
    mapId: 'route-1',
    position: { x: 28, y: 2 },
    label: 'OVERLOOK STILE',
    unlockAtMs: 0,
    requirement: { kind: 'always' },
  },
  {
    // The arch in the orchard's north wall, in a pocket of its own off the
    // garden. The Orchard landing's own door: a drop-in is never more than a
    // dozen steps from a way home it does not have to wait for.
    mapId: 'route-1',
    position: { x: 45, y: 7 },
    label: 'ORCHARD GATE',
    unlockAtMs: 0,
    requirement: { kind: 'always' },
  },
  {
    // The gate out the back of the steading's yard, a step off its gravel.
    mapId: 'route-1',
    position: { x: 48, y: 42 },
    label: 'STEADING YARD',
    unlockAtMs: EXTRACTION_UNLOCK_DELAY_MS,
  },
  {
    // The rake of steps cut into the bank at the top of the water meadows, on
    // the wet side of the drove. The whole south-west's way home.
    mapId: 'route-1',
    position: { x: 3, y: 57 },
    label: 'BROOK STAIR',
    unlockAtMs: EXTRACTION_UNLOCK_DELAY_MS,
  },
  {
    // Where the two roads meet again and the route goes on to Viridian. Always
    // open, and the length of the map from the Route Head: the south country's
    // own front door, and the reason a raid can commit to going that far.
    mapId: 'route-1',
    position: { x: 22, y: 69 },
    label: 'SOUTH GATE',
    unlockAtMs: 0,
    requirement: { kind: 'always' },
  },
  {
    // The cart road out of the charcoal burn, in a nook in the rock at its east
    // side. Sealed until the kiln is drawn, which is at the other end of the
    // burn - the same bargain Oak's field station makes at the other end of the
    // map.
    mapId: 'route-1',
    position: { x: 61, y: 57 },
    label: 'KILN ROAD',
    unlockAtMs: 0,
    requirement: {
      kind: 'poi-activated',
      poiId: 'route-1-charcoal-kiln',
      poiLabel: 'THE CHARCOAL KILN',
    },
  },
  {
    mapId: 'viridian-forest',
    position: { x: 1, y: 20 },
    label: 'BROOK FORD',
    unlockAtMs: 0,
    requirement: { kind: 'always' },
  },
  {
    mapId: 'viridian-forest',
    position: { x: 20, y: 30 },
    label: 'FOREST CLEARING',
    unlockAtMs: EXTRACTION_UNLOCK_DELAY_MS * 2,
  },
  {
    mapId: 'viridian-forest',
    position: { x: 29, y: 6 },
    label: 'TOWER STEPS',
    unlockAtMs: 0,
    requirement: { kind: 'poi-activated', poiId: 'forest-fire-tower', poiLabel: 'FIRE TOWER' },
  },
  {
    // The ridge's own way off, in a pocket at the east end of the shelf above
    // the Tower Steps - always open, because a raid that drops in on the ridge
    // must never depend on the door it came through. It is the far side of the
    // rock the stair is cut into: two exits within sight of each other and a
    // whole ridge's walk between them.
    mapId: 'viridian-forest',
    position: { x: 28, y: 3 },
    label: 'RIDGE GAP',
    unlockAtMs: 0,
    requirement: { kind: 'always' },
  },
  {
    // The far end of the ridge, on the point of Raven Crag. The ridge is a road
    // with a door at each end and no way down in between, so this is what makes
    // dropping in on top of the wood a raid rather than a one-way walk.
    mapId: 'viridian-forest',
    position: { x: 61, y: 8 },
    label: 'CRAG PATH',
    unlockAtMs: 0,
    requirement: { kind: 'always' },
  },
  {
    // The cart nook off the collier's yard. Timed, because the kilns are a
    // drop-in of their own and a landing must never also be an instant exit.
    mapId: 'viridian-forest',
    position: { x: 62, y: 31 },
    label: 'KILN ROAD',
    unlockAtMs: EXTRACTION_UNLOCK_DELAY_MS,
  },
  {
    // The stone staith the mere's timber was floated off, in the south-west.
    mapId: 'viridian-forest',
    position: { x: 3, y: 58 },
    label: 'MERE STAITH',
    unlockAtMs: 0,
    requirement: { kind: 'always' },
  },
  {
    // The way to Viridian City, and the one tile of this map's own edge anybody
    // may stand on. Always open: the south of the wood is a long way from the
    // north landing and nothing down there may depend on a door.
    mapId: 'viridian-forest',
    position: { x: 28, y: 71 },
    label: 'SOUTH GATE',
    unlockAtMs: 0,
    requirement: { kind: 'always' },
  },
  {
    // The adit at the back of the quarry, behind Quarryman Mott. The same shape
    // the Ridge Gap has: an exit inside a boss's ground, so beating him buys a
    // way home as well as the ground itself.
    mapId: 'viridian-forest',
    position: { x: 44, y: 63 },
    label: 'QUARRY ADIT',
    unlockAtMs: 0,
    requirement: { kind: 'always' },
  },
  // The Floodplain is played a piece at a time, so every piece has a way out
  // inside it: three on the home bank on three different rules, and one behind
  // each door a boss holds. `hunterFlee.test.ts` holds the other half of that -
  // no tile on the map is further from its nearest exit than a flee buys.
  {
    mapId: 'floodplain-relay',
    position: { x: 17, y: 60 },
    label: 'SOUTH GATE',
    unlockAtMs: 0,
    requirement: { kind: 'always' },
  },
  {
    mapId: 'floodplain-relay',
    position: { x: 32, y: 12 },
    label: 'FERRY DOCK',
    unlockAtMs: 45_000,
    requirement: { kind: 'elapsed', unlockAtMs: 45_000 },
  },
  {
    mapId: 'floodplain-relay',
    position: { x: 4, y: 23 },
    label: 'RADIO EXIT',
    unlockAtMs: 0,
    requirement: {
      kind: 'poi-activated',
      poiId: 'floodplain-ranger-radio',
      poiLabel: 'RANGER STATION',
    },
  },
  {
    mapId: 'floodplain-relay',
    position: { x: 51, y: 25 },
    label: 'MILL RACE',
    unlockAtMs: 0,
    requirement: { kind: 'always' },
  },
  {
    mapId: 'floodplain-relay',
    position: { x: 48, y: 11 },
    label: 'SIGNAL FIRE',
    unlockAtMs: 0,
    requirement: { kind: 'always' },
  },
  {
    mapId: 'floodplain-relay',
    position: { x: 48, y: 58 },
    label: 'VAULT CULVERT',
    unlockAtMs: 0,
    requirement: { kind: 'always' },
  },
];
