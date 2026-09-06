import type { SecureSlot as StashSecureSlot } from '../stash';
import { RUN_OBJECTIVES, type RunObjective } from '../objectives';
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
  /** The seed and runtime stream keep world events reproducible after generation. */
  readonly seed?: number;
  readonly rng?: SeededRng;
  /** Kept in the live session so battle returns do not replay onboarding. */
  firstDeploymentBriefingShown?: boolean;
}

export function createActiveRunSession(
  manager: RunManager,
  secureSlot: SecureSlot,
  stashSecureSlot: StashSecureSlot,
  broughtPokemonIds: readonly string[],
  broughtItems: readonly ItemStack[],
  objectives: readonly RunObjective[] = RUN_OBJECTIVES,
  plan?: RunPlan,
): ActiveRunSession {
  return {
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
