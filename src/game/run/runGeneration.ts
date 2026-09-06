import type { WildEncounterTable } from '../pokemon/encounters';
import { Pokemon } from '../pokemon';
import {
  WORLD_MAPS,
  type WorldMapDefinition,
  type WorldMapId,
} from '../worldMap';
import { EXTRACTION_POINTS, type ExtractionPoint } from '../world/extractionPoints';
import type { WorldLoot } from '../world/loot';
import {
  createRunTrainerEncounters,
  type RunTrainerEncounter,
} from '../world/trainers';
import { createSeededRng } from './rng';

export const RUN_INSERTIONS = {
  'town-square': {
    id: 'town-square',
    label: 'Town Square',
    mapId: 'pallet-town',
    position: { x: 6, y: 8 },
    description: 'A protected start with the South Gate marked for a safe escape.',
  },
  'south-verge': {
    id: 'south-verge',
    label: 'South Verge',
    mapId: 'pallet-town',
    position: { x: 7, y: 36 },
    description: 'A faster, rougher route toward Route 1.',
  },
  'floodplain-relay': {
    id: 'floodplain-relay',
    label: 'Floodplain Relay',
    mapId: 'floodplain-relay',
    position: { x: 15, y: 3 },
    description: 'A compact relay with a road checkpoint, reed bypass, and three extraction choices.',
  },
} as const;

export type RunInsertionId = keyof typeof RUN_INSERTIONS;
export type RunInsertion = (typeof RUN_INSERTIONS)[RunInsertionId];

export const FIRST_CONTRACT = {
  id: 'recover-lost-field-kit',
  description: 'Recover the lost field kit on Route 1',
  mapId: 'route-1',
  position: { x: 8, y: 15 },
  label: 'LOST FIELD KIT',
} as const;

export const RUN_GENERATION_BOUNDS = {
  encounterLevelVariance: 1,
  encounterRateMinimum: 0.05,
  encounterRateMaximum: 0.14,
  extractionUnlockMinimumMs: 0,
  extractionUnlockMaximumMs: 75_000,
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
  readonly contract?: typeof FIRST_CONTRACT;
  readonly encounters: Readonly<Partial<Record<WorldMapId, WildEncounterTable>>>;
  readonly loot: Readonly<Record<WorldMapId, readonly WorldLoot[]>>;
  readonly trainers: readonly RunTrainerEncounter[];
  readonly extractionPoints: readonly ExtractionPoint[];
  readonly hunter: HunterTuning;
}

export interface RunGenerationContent {
  readonly maps: Readonly<Record<WorldMapId, WorldMapDefinition>>;
  readonly extractionPoints: readonly ExtractionPoint[];
  readonly trainers: readonly RunTrainerEncounter[];
}

const DEFAULT_CONTENT: RunGenerationContent = {
  maps: WORLD_MAPS,
  extractionPoints: EXTRACTION_POINTS,
  trainers: createRunTrainerEncounters(),
};
/**
 * Produces all variable raid content from one seed. The supplied content seam
 * makes the generator deterministic and independently testable.
 */
export function generateRunPlan(
  seed: number,
  content: RunGenerationContent = DEFAULT_CONTENT,
  insertionId: RunInsertionId = 'town-square',
  includeFirstContract = true,
): RunPlan {
  const rng = createSeededRng(seed);
  const insertion = RUN_INSERTIONS[insertionId];
  const encounters = Object.fromEntries(
    Object.values(content.maps)
      .filter((map): map is WorldMapDefinition & { encounters: WildEncounterTable } =>
        map.encounters !== undefined,
      )
      .map((map) => [map.id, varyEncounterTable(map.encounters, rng)]),
  ) as Partial<Record<WorldMapId, WildEncounterTable>>;

  const extractionPoints = generateExtractionPoints(content.extractionPoints, rng, insertion.mapId);
  const reservedTiles = new Map<WorldMapId, Set<string>>();
  reserve(reservedTiles, insertion.mapId, insertion.position);
  if (includeFirstContract) {
    reserve(reservedTiles, FIRST_CONTRACT.mapId, FIRST_CONTRACT.position);
  }
  for (const point of extractionPoints) {
    reserve(reservedTiles, point.mapId, point.position);
  }
  for (const map of Object.values(content.maps)) {
    for (const poi of map.pois) {
      reserve(reservedTiles, poi.mapId, poi.position);
    }
  }
  const trainers = generateTrainers(content.trainers, content.maps, reservedTiles, rng);
  const loot = generateLoot(content.maps, reservedTiles, rng);

  return {
    seed: seed >>> 0,
    insertion,
    ...(includeFirstContract ? { contract: FIRST_CONTRACT } : {}),
    encounters,
    loot,
    trainers,
    extractionPoints,
    hunter: {
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

function generateExtractionPoints(
  points: readonly ExtractionPoint[],
  rng: ReturnType<typeof createSeededRng>,
  insertionMapId: WorldMapId,
): ExtractionPoint[] {
  const floodplainPoints = points.filter((point) => point.mapId === 'floodplain-relay');
  const standardPoints = points.filter((point) => point.mapId !== 'floodplain-relay');
  const guaranteed = standardPoints.find((point) => point.mapId === 'pallet-town') ?? standardPoints[0];
  const selected = standardPoints.filter((point) => point === guaranteed || rng.chance(0.6));
  if (guaranteed && !selected.includes(guaranteed)) {
    selected.unshift(guaranteed);
  }
  const generatedStandard = selected.map((point) => ({
    ...point,
    // The guaranteed starting-area exit is immediately reachable every run.
    unlockAtMs: point === guaranteed
      ? 0
      : rng.int(
        RUN_GENERATION_BOUNDS.extractionUnlockMinimumMs,
        RUN_GENERATION_BOUNDS.extractionUnlockMaximumMs,
      ),
  }));
  return insertionMapId === 'floodplain-relay' ? floodplainPoints : generatedStandard;
}

function generateTrainers(
  trainers: readonly RunTrainerEncounter[],
  maps: Readonly<Record<WorldMapId, WorldMapDefinition>>,
  reservedTiles: Map<WorldMapId, Set<string>>,
  rng: ReturnType<typeof createSeededRng>,
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
    const candidates = validTiles(maps[trainer.mapId], reservedTiles.get(trainer.mapId));
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
): Record<WorldMapId, readonly WorldLoot[]> {
  const generatedByMap = {} as Record<WorldMapId, readonly WorldLoot[]>;
  for (const map of Object.values(maps)) {
    // At least half a map's loot is present, so exploring is reliably worth the risk.
    const count = rng.int(Math.ceil(map.loot.length / 2), map.loot.length);
    const items = rng.shuffle(map.loot).slice(0, count);
    const candidates = rng.shuffle(validTiles(map, reservedTiles.get(map.id)));
    const generated = items.map((item, index) => {
      const position = candidates[index] ?? item.position;
      reserve(reservedTiles, map.id, position);
      return { ...item, position };
    });
    generatedByMap[map.id] = generated;
  }
  return generatedByMap;
}

function validTiles(map: WorldMapDefinition, reserved: ReadonlySet<string> = new Set()): { x: number; y: number }[] {
  const warpTiles = new Set(map.warps.map((warp) => tileKey(warp.source)));
  const entityTiles = new Set(map.entities.map((entity) => tileKey(entity.position)));
  const tiles: { x: number; y: number }[] = [];
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      const key = `${x},${y}`;
      if (!map.collision[y][x] && !warpTiles.has(key) && !entityTiles.has(key) && !reserved.has(key)) {
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
