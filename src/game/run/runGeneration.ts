import type { WildEncounterTable } from '../pokemon/encounters';
import { Pokemon } from '../pokemon';
import {
  getWorldMap,
  WORLD_MAPS,
  type WorldMapDefinition,
  type WorldMapId,
} from '../worldMap';
import type { GridPosition } from '../movement/gridMovement';
import { stepDistances } from '../world/mapStructure';
import { EXTRACTION_POINTS, type ExtractionPoint } from '../world/extractionPoints';
import type { WorldLoot } from '../world/loot';
import {
  createRunTrainerEncounters,
  withoutDefeatedBosses,
  type RunTrainerEncounter,
} from '../world/trainers';
import type { RaidContract } from '../objectives/contracts';
import { applyHunterThreat, hunterThreatFor, type HunterThreat } from '../world/hunterThreat';
import { createSeededRng } from './rng';

export { FIRST_CONTRACT } from '../objectives/contracts';

// Every raid map is its own level, entered at its own insertion - no map is
// reachable by walking off the edge of another, so no two insertions can be the
// same level under two names. Floodplain Relay is listed first because it is the
// starting area every save deploys into; the other three unlock together when
// the first contract is extracted.
//
// A map may carry more than one entry. The first listed for a map is its front
// door; any other is a drop-in point, which nothing unlocks except standing on
// it - see `availableInsertionIds`. Drop-in points are how a vast map is played
// in pieces: reach one, extract, and the next raid starts from there.
export const RUN_INSERTIONS = {
  'floodplain-relay': {
    id: 'floodplain-relay',
    label: 'Floodplain Relay',
    mapId: 'floodplain-relay',
    position: { x: 13, y: 9 },
    description: 'The Landing: the relay office, the quay and the ferry jetty. A watched road south, the reeds round it, and a river town past that with three doors somebody is holding.',
  },
  'floodplain-market-isle': {
    id: 'floodplain-market-isle',
    label: 'Market Isle',
    mapId: 'floodplain-relay',
    position: { x: 27, y: 39 },
    description: 'The square in the middle of the river. Home is the plank bridge; the towered one beside it is the way east, and it is held.',
  },
  'floodplain-mill-weir': {
    id: 'floodplain-mill-weir',
    label: 'Mill Weir',
    mapId: 'floodplain-relay',
    position: { x: 37, y: 25 },
    description: 'The east bank, behind the toll bridge. The mill on its pond, the orchard south of it, and the gatehouse standing in the race.',
  },
  'floodplain-beacon-keep': {
    id: 'floodplain-beacon-keep',
    label: 'Beacon Keep',
    mapId: 'floodplain-relay',
    position: { x: 50, y: 12 },
    description: 'Inside the moat, under the tower you could see from the Landing. The old causeway home is a short wade from here.',
  },
  'floodplain-vault': {
    id: 'floodplain-vault',
    label: 'The Vault',
    mapId: 'floodplain-relay',
    position: { x: 36, y: 51 },
    description: 'Behind the orchard fence. The gravel yard, the open trapdoor, and a causeway straight across to the South Gate road.',
  },
  'town-square': {
    id: 'town-square',
    label: 'Town Square',
    mapId: 'pallet-town',
    position: { x: 7, y: 6 },
    description: 'A fenced market square with one gate on each side. Four gates, four different halves of the town.',
  },
  'route-1': {
    id: 'route-1',
    label: 'Route 1',
    mapId: 'route-1',
    position: { x: 16, y: 3 },
    description: 'The head of the braid. Two roads run the length of it and every crossing between them is grass.',
  },
  'route-1-overlook': {
    id: 'route-1-overlook',
    label: 'Overlook Landing',
    mapId: 'route-1',
    position: { x: 30, y: 3 },
    description: 'Behind the Overlook Gate. A short loop with its own stile out, and the warden\'s spur the only way back to the braid.',
  },
  'viridian-forest': {
    id: 'viridian-forest',
    label: 'Viridian Forest',
    mapId: 'viridian-forest',
    position: { x: 7, y: 2 },
    description: 'North Landing. Eleven clearings, seventeen trails, and no fast lane anywhere on the map.',
  },
} as const;

export type RunInsertionId = keyof typeof RUN_INSERTIONS;
export type RunInsertion = (typeof RUN_INSERTIONS)[RunInsertionId];

/**
 * A map's front door: the first insertion authored for it, which is the one a
 * contract unlocks and the one the contract board names. Every other insertion
 * on the map is a drop-in point.
 */
export function frontDoorFor(mapId: WorldMapId): RunInsertion | undefined {
  return Object.values(RUN_INSERTIONS).find((insertion) => insertion.mapId === mapId);
}

export function isDropInPoint(insertion: RunInsertion): boolean {
  return frontDoorFor(insertion.mapId)?.id !== insertion.id;
}

/** The insertion standing on this tile, if there is one. */
export function insertionAt(mapId: WorldMapId, position: GridPosition): RunInsertion | undefined {
  return Object.values(RUN_INSERTIONS).find(
    (insertion) =>
      insertion.mapId === mapId &&
      insertion.position.x === position.x &&
      insertion.position.y === position.y,
  );
}

/**
 * Every insertion the lobby may offer, in authored order: the ones contracts
 * have unlocked plus the ones the player has walked to. It is derived from the
 * two lists in `raidProgress` rather than stored, so reaching a drop-in point
 * and being offered it can never disagree.
 */
export function availableInsertionIds(progress: {
  readonly unlockedInsertions: readonly string[];
  readonly reachedInsertions: readonly string[];
}): readonly RunInsertionId[] {
  return (Object.keys(RUN_INSERTIONS) as RunInsertionId[]).filter(
    (id) => progress.unlockedInsertions.includes(id) || progress.reachedInsertions.includes(id),
  );
}

export const RUN_GENERATION_BOUNDS = {
  encounterLevelVariance: 1,
  encounterRateMinimum: 0.05,
  encounterRateMaximum: 0.14,
  extractionUnlockMinimumMs: 0,
  extractionUnlockMaximumMs: 75_000,
  extractionUnlockVarianceMs: 10_000,
  hunterSpawnDelayMinimumMs: 55_000,
  hunterSpawnDelayMaximumMs: 75_000,
  hunterAggressionMinimum: 1,
  hunterAggressionMaximum: 1,
  hunterTeamTierMinimum: 0,
  hunterTeamTierMaximum: 0,
} as const;

export interface HunterTuning {
  readonly spawnDelayMs: number;
  readonly aggressionStepsPerPlayerStep: number;
  readonly teamTierOffset: number;
}

export interface RunPlan {
  readonly seed: number;
  /** The intentional, valid location used for every newly deployed raid. */
  readonly insertion: RunInsertion;
  readonly contract?: RaidContract;
  /**
   * The bosses already beaten when this raid deployed. `WorldScene` adds the
   * ones beaten during the raid to decide which gates stand open, so the door
   * opens in the raid that won it even where nothing can be written to storage.
   */
  readonly defeatedBosses: readonly string[];
  readonly encounters: Readonly<Partial<Record<WorldMapId, WildEncounterTable>>>;
  readonly loot: Readonly<Record<WorldMapId, readonly WorldLoot[]>>;
  readonly trainers: readonly RunTrainerEncounter[];
  readonly extractionPoints: readonly ExtractionPoint[];
  readonly hunter: HunterTuning;
}

/**
 * What the base the raid deployed from adds to it. Only the Outfitter's beacon
 * so far: an exit at the landing itself, sealed until `unlockAtMs`.
 */
export interface RunOutfitting {
  readonly beaconUnlockAtMs?: number;
}

export const BEACON_EXIT_LABEL = 'BEACON';

export interface RunGenerationContent {
  readonly maps: Readonly<Record<WorldMapId, WorldMapDefinition>>;
  readonly extractionPoints: readonly ExtractionPoint[];
  readonly trainers: readonly RunTrainerEncounter[];
}

/**
 * The authored world as it stands for this player: every map in the gate state
 * their beaten bosses have earned. Everything below reads collision - where
 * loot may land, which exit is guaranteed - so it has to be this raid's
 * collision and not a fresh save's.
 */
function authoredContent(defeatedBosses: readonly string[]): RunGenerationContent {
  return {
    maps: Object.fromEntries(
      (Object.keys(WORLD_MAPS) as WorldMapId[]).map((id) => [id, getWorldMap(id, defeatedBosses)]),
    ) as Record<WorldMapId, WorldMapDefinition>,
    extractionPoints: EXTRACTION_POINTS,
    trainers: createRunTrainerEncounters(),
  };
}

/**
 * Produces all variable raid content from one seed. The supplied content seam
 * makes the generator deterministic and independently testable.
 */
export function generateRunPlan(
  seed: number,
  suppliedContent?: RunGenerationContent,
  insertionId: RunInsertionId = 'floodplain-relay',
  // No default: a raid carries the contract its caller chose. A default of "the
  // first contract" reads as harmless and is not - `undefined` passed for "no
  // contract" would silently take the default and attach one anyway.
  contract?: RaidContract,
  // What the deployed party costs in hunter. It is folded in here rather than by
  // the caller so `plan.hunter` stays the one tuning the raid reads; the default
  // is an empty party, which is the first tier and the seeded delay untouched.
  hunterThreat: HunterThreat = hunterThreatFor([]),
  // The bosses this save has already beaten: which gates stand open, and who
  // is no longer on the map. Empty is a fresh save, with every door shut.
  defeatedBosses: readonly string[] = [],
  // What the base this raid deployed from adds to it: the Outfitter's beacon.
  outfitting: RunOutfitting = {},
): RunPlan {
  const rng = createSeededRng(seed);
  const insertion = RUN_INSERTIONS[insertionId];
  const authored = suppliedContent ?? authoredContent(defeatedBosses);
  // A beaten boss is gone for good, so they are dropped before anything is
  // reserved for them: the tile they stood on is ordinary ground again.
  const content: RunGenerationContent = {
    ...authored,
    trainers: withoutDefeatedBosses(authored.trainers, defeatedBosses),
  };
  const encounters = Object.fromEntries(
    Object.values(content.maps)
      .filter((map): map is WorldMapDefinition & { encounters: WildEncounterTable } =>
        map.encounters !== undefined,
      )
      .map((map) => [map.id, varyEncounterTable(map.encounters, rng)]),
  ) as Partial<Record<WorldMapId, WildEncounterTable>>;

  // A contract the insertion cannot walk to is worse than no contract, so the
  // generator refuses to attach one to a raid that starts on another map.
  const carriedContract = contract?.mapId === insertion.mapId ? contract : undefined;
  // What this raid can walk to on its own map. A shut gate cuts a map into
  // regions, so "on this map" no longer means "reachable": the exit that is
  // promised open and the loot that is rolled both have to be on this side of
  // every door the player has not opened.
  const insertionMap = content.maps[insertion.mapId];
  const walkable = stepDistances(insertionMap.collision, insertion.position);
  const isReachable = (mapId: WorldMapId, position: GridPosition): boolean =>
    mapId !== insertion.mapId || (walkable[position.y]?.[position.x] ?? -1) >= 0;
  const extractionPoints = [
    ...generateExtractionPoints(content.extractionPoints, rng, insertion, content.maps, isReachable),
    ...beaconExit(insertion, content.extractionPoints, outfitting),
  ];
  const reservedTiles = new Map<WorldMapId, Set<string>>();
  reserve(reservedTiles, insertion.mapId, insertion.position);
  // Every stop of the carried contract is reserved, so seeded loot and roaming
  // trainers can never be rolled onto a tile the objective already owns.
  for (const marker of carriedContract?.markers ?? []) {
    reserve(reservedTiles, carriedContract!.mapId, marker.position);
  }
  for (const point of extractionPoints) {
    reserve(reservedTiles, point.mapId, point.position);
  }
  // Every drop-in point, not only the one this raid starts on: reaching one is
  // an event of its own, and a cache rolled onto it would speak over it.
  for (const dropIn of Object.values(RUN_INSERTIONS)) {
    reserve(reservedTiles, dropIn.mapId, dropIn.position);
  }
  for (const map of Object.values(content.maps)) {
    for (const poi of map.pois) {
      reserve(reservedTiles, poi.mapId, poi.position);
    }
  }
  const trainers = generateTrainers(content.trainers, content.maps, reservedTiles, rng, isReachable);
  const loot = generateLoot(content.maps, reservedTiles, rng, isReachable);

  return {
    seed: seed >>> 0,
    insertion,
    ...(carriedContract ? { contract: carriedContract } : {}),
    defeatedBosses: [...defeatedBosses],
    encounters,
    loot,
    trainers,
    extractionPoints,
    hunter: applyHunterThreat(
      {
        spawnDelayMs: rng.int(
          RUN_GENERATION_BOUNDS.hunterSpawnDelayMinimumMs,
          RUN_GENERATION_BOUNDS.hunterSpawnDelayMaximumMs,
        ),
        aggressionStepsPerPlayerStep: rng.int(
          RUN_GENERATION_BOUNDS.hunterAggressionMinimum,
          RUN_GENERATION_BOUNDS.hunterAggressionMaximum,
        ),
        teamTierOffset: rng.int(
          RUN_GENERATION_BOUNDS.hunterTeamTierMinimum,
          RUN_GENERATION_BOUNDS.hunterTeamTierMaximum,
        ),
      },
      hunterThreat,
    ),
  };
}

function varyEncounterTable(
  table: WildEncounterTable,
  rng: ReturnType<typeof createSeededRng>,
): WildEncounterTable {
  return {
    stepEncounterRate: clamp(
      table.stepEncounterRate + (rng.int(-2, 2) / 100),
      RUN_GENERATION_BOUNDS.encounterRateMinimum,
      RUN_GENERATION_BOUNDS.encounterRateMaximum,
    ),
    entries: table.entries.map((entry) => {
      const levelShift = rng.int(
        -RUN_GENERATION_BOUNDS.encounterLevelVariance,
        RUN_GENERATION_BOUNDS.encounterLevelVariance,
      );
      return {
        ...entry,
        minLevel: Math.max(1, entry.minLevel + levelShift),
        maxLevel: Math.max(1, entry.maxLevel + levelShift),
        weight: Math.max(1, entry.weight + rng.int(-1, 1)),
      };
    }),
  };
}

/**
 * Every authored exit a run can actually walk to is offered. Randomising which
 * exits exist used to leave whole runs with a single gate, which removes the
 * extraction choice the game is built around; run variance now lives in *when*
 * an unconditioned exit opens, never in whether it is there at all. Authored
 * conditions - the Floodplain's ferry signal and radio - are map design and are
 * passed through untouched.
 */
function generateExtractionPoints(
  points: readonly ExtractionPoint[],
  rng: ReturnType<typeof createSeededRng>,
  insertion: RunInsertion,
  maps: Readonly<Record<WorldMapId, WorldMapDefinition>>,
  isReachable: Reachability,
): ExtractionPoint[] {
  const reachableMaps = mapsReachableFrom(insertion.mapId, maps);
  const available = points.filter((point) => reachableMaps.has(point.mapId));
  // One exit is open from the first second, so leaving early is always possible
  // - and it has to be one this raid can walk to, or a drop-in behind a shut
  // gate is promised a door on the far side of it.
  const walkable = available.filter(
    (point) => point.mapId === insertion.mapId && isReachable(point.mapId, point.position),
  );
  const guaranteed =
    walkable.find((point) => point.requirement === undefined) ??
    walkable[0] ??
    available.find((point) => point.mapId === insertion.mapId) ??
    available[0];
  // Exits this raid can walk to now are listed first. The field guide names the
  // first exit on the map, and naming one on the far side of a shut gate would
  // send the player to a door they cannot reach. Order is otherwise authored.
  const walkableNow = new Set(walkable);
  const ordered = [
    ...available.filter((point) => walkableNow.has(point)),
    ...available.filter((point) => !walkableNow.has(point)),
  ];
  return ordered.map((point) => {
    if (point.requirement) {
      return point;
    }
    if (point === guaranteed) {
      return { ...point, unlockAtMs: 0 };
    }
    return {
      ...point,
      unlockAtMs: clamp(
        point.unlockAtMs +
          rng.int(
            -RUN_GENERATION_BOUNDS.extractionUnlockVarianceMs,
            RUN_GENERATION_BOUNDS.extractionUnlockVarianceMs,
          ),
        RUN_GENERATION_BOUNDS.extractionUnlockMinimumMs,
        RUN_GENERATION_BOUNDS.extractionUnlockMaximumMs,
      ),
    };
  });
}

/**
 * The Outfitter's beacon: the landing itself becomes a way out, late.
 *
 * It stands on the insertion tile rather than on a tile authored for it, which
 * is what lets one upgrade serve every map without touching any of them - the
 * landing is reachable by construction, `mapStructure.test.ts` already keeps
 * every trainer watch off it, and it is reserved against loot and trainers a
 * few lines above. It changes a route rather than shortening one: the way home
 * can be the way you came, but only for a raid that stayed in long enough.
 *
 * It carries an authored `elapsed` requirement so the generator's timing
 * variance passes it through untouched, and consumes no randomness, so a
 * seed plays the same raid with or without it. A map that already authors an
 * exit on its landing gets nothing, rather than two exits on one tile.
 */
function beaconExit(
  insertion: RunInsertion,
  points: readonly ExtractionPoint[],
  outfitting: RunOutfitting,
): ExtractionPoint[] {
  const unlockAtMs = outfitting.beaconUnlockAtMs;
  if (
    unlockAtMs === undefined ||
    !Number.isFinite(unlockAtMs) ||
    points.some(
      (point) =>
        point.mapId === insertion.mapId &&
        point.position.x === insertion.position.x &&
        point.position.y === insertion.position.y,
    )
  ) {
    return [];
  }
  const opensAtMs = Math.max(0, Math.floor(unlockAtMs));
  return [
    {
      mapId: insertion.mapId,
      position: { ...insertion.position },
      label: BEACON_EXIT_LABEL,
      unlockAtMs: opensAtMs,
      requirement: { kind: 'elapsed', unlockAtMs: opensAtMs },
    },
  ];
}

/** The set of maps a raid can walk to from its insertion, following warps. */
function mapsReachableFrom(
  originMapId: WorldMapId,
  maps: Readonly<Record<WorldMapId, WorldMapDefinition>>,
): ReadonlySet<WorldMapId> {
  const reachable = new Set<WorldMapId>([originMapId]);
  const pending: WorldMapId[] = [originMapId];
  while (pending.length > 0) {
    for (const warp of maps[pending.pop()!]?.warps ?? []) {
      if (!reachable.has(warp.destinationMapId)) {
        reachable.add(warp.destinationMapId);
        pending.push(warp.destinationMapId);
      }
    }
  }
  return reachable;
}

function generateTrainers(
  trainers: readonly RunTrainerEncounter[],
  maps: Readonly<Record<WorldMapId, WorldMapDefinition>>,
  reservedTiles: Map<WorldMapId, Set<string>>,
  rng: ReturnType<typeof createSeededRng>,
  isReachable: Reachability,
): RunTrainerEncounter[] {
  return trainers.map((trainer) => {
    if (trainer.fixedPosition) {
      reserve(reservedTiles, trainer.mapId, trainer.position);
      return {
        ...trainer,
        trainer: {
          ...trainer.trainer,
          party: trainer.trainer.party.map((pokemon) => new Pokemon(pokemon.base, pokemon.level)),
        },
      };
    }
    const candidates = validTiles(maps[trainer.mapId], reservedTiles.get(trainer.mapId), isReachable);
    const position = candidates.length > 0 ? rng.pick(candidates) : trainer.position;
    reserve(reservedTiles, trainer.mapId, position);
    return {
      ...trainer,
      position,
      trainer: {
        ...trainer.trainer,
        party: trainer.trainer.party.map((pokemon) => new Pokemon(pokemon.base, pokemon.level)),
      },
    };
  });
}

function generateLoot(
  maps: Readonly<Record<WorldMapId, WorldMapDefinition>>,
  reservedTiles: Map<WorldMapId, Set<string>>,
  rng: ReturnType<typeof createSeededRng>,
  isReachable: Reachability,
): Record<WorldMapId, readonly WorldLoot[]> {
  const generatedByMap = {} as Record<WorldMapId, readonly WorldLoot[]>;
  for (const map of Object.values(maps)) {
    // At least half a map's loot is present, so exploring is reliably worth the risk.
    const count = rng.int(Math.ceil(map.loot.length / 2), map.loot.length);
    const items = rng.shuffle(map.loot).slice(0, count);
    const candidates = rng.shuffle(validTiles(map, reservedTiles.get(map.id), isReachable));
    const generated = items.map((item, index) => {
      const position = candidates[index] ?? item.position;
      reserve(reservedTiles, map.id, position);
      return { ...item, position };
    });
    generatedByMap[map.id] = generated;
  }
  return generatedByMap;
}

/** Whether this raid can walk to a tile from where it dropped in. */
type Reachability = (mapId: WorldMapId, position: GridPosition) => boolean;

function validTiles(
  map: WorldMapDefinition,
  reserved: ReadonlySet<string> = new Set(),
  isReachable: Reachability = () => true,
): { x: number; y: number }[] {
  const warpTiles = new Set(map.warps.map((warp) => tileKey(warp.source)));
  const entityTiles = new Set(map.entities.map((entity) => tileKey(entity.position)));
  const tiles: { x: number; y: number }[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const key = `${x},${y}`;
      if (
        !map.collision[y][x] &&
        !warpTiles.has(key) &&
        !entityTiles.has(key) &&
        !reserved.has(key) &&
        isReachable(map.id, { x, y })
      ) {
        tiles.push({ x, y });
      }
    }
  }
  return tiles;
}

function reserve(tiles: Map<WorldMapId, Set<string>>, mapId: WorldMapId, position: { x: number; y: number }): void {
  const reserved = tiles.get(mapId) ?? new Set<string>();
  reserved.add(tileKey(position));
  tiles.set(mapId, reserved);
}

function tileKey(position: { x: number; y: number }): string {
  return `${position.x},${position.y}`;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.max(minimum, Math.min(maximum, value));
}
