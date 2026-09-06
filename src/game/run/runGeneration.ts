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
const STARTING_TILE = { x: 6, y: 8 };

/**
 * Produces all variable raid content from one seed. The supplied content seam
 * makes the generator deterministic and independently testable.
 */
export function generateRunPlan(
  seed: number,
  content: RunGenerationContent = DEFAULT_CONTENT,
): RunPlan {
  const rng = createSeededRng(seed);
  const encounters = Object.fromEntries(
    Object.values(content.maps)
      .filter((map): map is WorldMapDefinition & { encounters: WildEncounterTable } =>
        map.encounters !== undefined,
      )
      .map((map) => [map.id, varyEncounterTable(map.encounters, rng)]),
  ) as Partial<Record<WorldMapId, WildEncounterTable>>;

  const extractionPoints = generateExtractionPoints(content.extractionPoints, rng);
  const reservedTiles = new Map<WorldMapId, Set<string>>();
  for (const point of extractionPoints) {
    reserve(reservedTiles, point.mapId, point.position);
  }
  const trainers = generateTrainers(content.trainers, content.maps, reservedTiles, rng);
  const loot = generateLoot(content.maps, reservedTiles, rng);

  return {
    seed: seed >>> 0,
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
): ExtractionPoint[] {
  const guaranteed = points.find((point) => point.mapId === 'pallet-town') ?? points[0];
  const selected = points.filter((point) => point === guaranteed || rng.chance(0.6));
  if (guaranteed && !selected.includes(guaranteed)) {
    selected.unshift(guaranteed);
  }
  return selected.map((point) => ({
    ...point,
    // The guaranteed starting-area exit is immediately reachable every run.
    unlockAtMs: point === guaranteed
      ? 0
      : rng.int(
        RUN_GENERATION_BOUNDS.extractionUnlockMinimumMs,
        RUN_GENERATION_BOUNDS.extractionUnlockMaximumMs,
      ),
  }));
}

function generateTrainers(
  trainers: readonly RunTrainerEncounter[],
  maps: Readonly<Record<WorldMapId, WorldMapDefinition>>,
  reservedTiles: Map<WorldMapId, Set<string>>,
  rng: ReturnType<typeof createSeededRng>,
): RunTrainerEncounter[] {
  return trainers.map((trainer) => {
    const candidates = validTiles(maps[trainer.mapId], reservedTiles.get(trainer.mapId));
    const spawnSafeCandidates = trainer.mapId === 'pallet-town'
      ? candidates.filter((tile) => tile.x !== STARTING_TILE.x || tile.y !== STARTING_TILE.y)
      : candidates;
    const position = spawnSafeCandidates.length > 0 ? rng.pick(spawnSafeCandidates) : trainer.position;
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
