import type { SecureSlot as StashSecureSlot } from '../stash';
import type { RunObjective } from '../objectives';
import type { SecureSlot, ItemStack } from './RunManager';
import type { Pokemon } from '../pokemon';
import type { RunManager } from './RunManager';
import type { RunPlan } from './runGeneration';
import { createSeededRng, type SeededRng } from './rng';
import type { Direction, GridPosition } from '../movement/gridMovement';
import type { WorldMapId } from '../worldMap';

export interface RaidLocation {
  readonly mapId: WorldMapId;
  readonly position: GridPosition;
  readonly facing: Direction;
}

/** Copies a scene location so battle transitions cannot fall back to a spawn. */
export function createBattleReturnLocation(location: RaidLocation): RaidLocation {
  return {
    mapId: location.mapId,
    position: { ...location.position },
    facing: location.facing,
  };
}

/**
 * Scene data for an active raid. The hub creates this after starting the
 * manager, then passes the same object through WorldScene and BattleScene.
 *
 * The stash needs IDs to delete deployed Pokemon on a wipe, while RunManager
 * keeps the actual Pokemon references needed to resolve the secure slot.
 */
export interface ActiveRunSession {
  readonly manager: RunManager;
  readonly secureSlot: SecureSlot;
  readonly stashSecureSlot: StashSecureSlot;
  readonly broughtPokemonIds: readonly string[];
  readonly broughtItems: readonly ItemStack[];
  readonly objectives: readonly RunObjective[];
  /** The deterministic world configuration generated when this raid begins. */
  readonly plan?: RunPlan;
  /**
   * The Outfitter upgrades standing at base when this raid deployed. The raid
   * derives what they mean from the ids, exactly as the lobby does, so the two
   * cannot describe the same base differently.
   */
  readonly outfitterUpgrades: readonly string[];
  /** The seed and runtime stream keep world events reproducible after generation. */
  readonly seed?: number;
  readonly rng?: SeededRng;
  /** Kept in the live session so battle returns do not replay onboarding. */
  firstDeploymentBriefingShown?: boolean;
  /** Set once the authored teaching encounter has been handed to BattleScene. */
  teachingEncounterUsed?: boolean;
  /**
   * Steps walked this raid, which is how the hunter's first arrival tells a
   * player who has set off from one still reading the insertion screen - see
   * `world/hunterArrival.ts`.
   */
  stepsTaken?: number;
  /**
   * Beaten trainers whose watch has already been seen to lift. The world is
   * rebuilt on every return from a fight, so the payoff for a win - the shading
   * letting go of the route - must be played once, on the return from *that*
   * fight, and not again after every wild encounter that follows.
   */
  watchesLifted?: string[];
}

export function createActiveRunSession(
  manager: RunManager,
  secureSlot: SecureSlot,
  stashSecureSlot: StashSecureSlot,
  broughtPokemonIds: readonly string[],
  broughtItems: readonly ItemStack[],
  objectives: readonly RunObjective[] = [],
  plan?: RunPlan,
  outfitterUpgrades: readonly string[] = [],
): ActiveRunSession {
  return {
    outfitterUpgrades: [...outfitterUpgrades],
    manager,
    secureSlot,
    stashSecureSlot,
    broughtPokemonIds: [...broughtPokemonIds],
    broughtItems: [...broughtItems],
    objectives: [...objectives],
    ...(plan === undefined
      ? {}
      : {
        plan,
        seed: plan.seed,
        rng: createSeededRng(plan.seed ^ 0x9e3779b9),
      }),
  };
}

export function registerCaughtPokemon(session: ActiveRunSession | undefined, pokemon: Pokemon): void {
  session?.manager.registerCaughtPokemon(pokemon);
}
