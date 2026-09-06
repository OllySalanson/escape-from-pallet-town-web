import { Pokemon } from '../pokemon';
import { BULBASAUR, PIDGEY, PIKACHU } from '../pokemon/species';
import type { PokemonBase } from '../pokemon/PokemonBase';
import type { TrainerBattle } from '../pokemon/battle/battleEngine';
import type { GridBounds, GridPosition } from '../movement/gridMovement';
import type { ActiveRunSession } from '../run/RunSession';
import type { RunResult } from '../run/RunManager';
import type { HunterTuning } from '../run/runGeneration';
import type { WorldMapId } from '../worldMap';

export const HUNTER_ID = 'rival-hunter';
export const HUNTER_SPAWN_MS = 60_000;
export const HUNTER_ENRAGED_STEPS_PER_PLAYER_STEP = 2;
export const DEFAULT_HUNTER_TUNING: HunterTuning = {
  spawnDelayMs: HUNTER_SPAWN_MS,
  aggressionStepsPerPlayerStep: 1,
  teamTierOffset: 0,
};

const HUNTER_TIERS = [
  { startsAtMs: 0, level: 6, party: [PIDGEY] },
  { startsAtMs: 120_000, level: 9, party: [PIDGEY, BULBASAUR] },
  { startsAtMs: 240_000, level: 12, party: [PIDGEY, BULBASAUR, PIKACHU] },
] as const;
const HUNTER_ENRAGED_TIER = { level: 15, party: [PIDGEY, BULBASAUR, PIKACHU] } as const;

export interface HunterState {
  readonly spawned: boolean;
  readonly defeated: boolean;
  readonly mapId?: WorldMapId;
  readonly position?: GridPosition;
}

export interface HunterTier {
  readonly level: number;
  readonly party: readonly PokemonBase[];
}

export const createHunterState = (): HunterState => ({ spawned: false, defeated: false });

export const hunterTierFor = (
  elapsedMs: number,
  isEnraged: boolean,
  tuning: HunterTuning = DEFAULT_HUNTER_TUNING,
): HunterTier => {
  if (isEnraged) {
    return HUNTER_ENRAGED_TIER;
  }
  const baseTierIndex = HUNTER_TIERS.reduce(
    (selected, tier, index) => (elapsedMs >= tier.startsAtMs ? index : selected),
    0,
  );
  const tierIndex = Math.max(
    0,
    Math.min(HUNTER_TIERS.length - 1, baseTierIndex + tuning.teamTierOffset),
  );
  return HUNTER_TIERS[tierIndex];
};

export const createHunterTrainer = (
  elapsedMs: number,
  isEnraged: boolean,
  tuning: HunterTuning = DEFAULT_HUNTER_TUNING,
): TrainerBattle => {
  const tier = hunterTierFor(elapsedMs, isEnraged, tuning);
  return {
    id: HUNTER_ID,
    name: 'RIVAL HUNTER',
    party: tier.party.map((species) => new Pokemon(species, tier.level)),
    defeatText: 'You slipped through my fingers... this time.',
  };
};

/**
 * Selects the legal cardinal move which most reduces Manhattan distance.
 * Fixed tie ordering keeps the hunter predictable and unit-testable.
 */
export const chooseHunterPursuitStep = (
  hunter: GridPosition,
  player: GridPosition,
  bounds: GridBounds,
  isBlocked: (tile: GridPosition) => boolean,
): GridPosition | null => {
  const candidates = [
    { x: hunter.x, y: hunter.y - 1 },
    { x: hunter.x, y: hunter.y + 1 },
    { x: hunter.x - 1, y: hunter.y },
    { x: hunter.x + 1, y: hunter.y },
  ].filter((tile, index, tiles) =>
    (tile.x !== hunter.x || tile.y !== hunter.y) &&
    tile.x >= 0 && tile.y >= 0 && tile.x < bounds.width && tile.y < bounds.height &&
    !isBlocked(tile) &&
    tiles.findIndex((candidate) => candidate.x === tile.x && candidate.y === tile.y) === index,
  );

  return candidates
    .map((tile) => ({ tile, distance: Math.abs(player.x - tile.x) + Math.abs(player.y - tile.y) }))
    .sort((left, right) => left.distance - right.distance)[0]?.tile ?? null;
};

export const isHunterContactingPlayer = (hunter: GridPosition, player: GridPosition): boolean =>
  Math.abs(hunter.x - player.x) + Math.abs(hunter.y - player.y) <= 1;

/** First-contract players must make a navigation choice before pursuit starts. */
export const isHunterEligibleForFirstContract = (
  mapId: WorldMapId,
  hasFirstContract: boolean,
  hasVisitedFieldStation: boolean,
): boolean => !hasFirstContract || mapId === 'route-1' || hasVisitedFieldStation;

/** Keeps hunter defeats on the exact secure-slot run-resolution path. */
export const resolveHunterBattleLoss = (session: ActiveRunSession): RunResult =>
  session.manager.resolveWipe(session.secureSlot);
