import type { SecureSlot as StashSecureSlot } from '../stash';
import { RUN_OBJECTIVES, type RunObjective } from '../objectives';
import type { SecureSlot, ItemStack } from './RunManager';
import type { Pokemon } from '../pokemon';
import type { RunManager } from './RunManager';
import type { RunPlan } from './runGeneration';

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
    ...(plan === undefined ? {} : { plan }),
  };
}

export function registerCaughtPokemon(session: ActiveRunSession | undefined, pokemon: Pokemon): void {
  session?.manager.registerCaughtPokemon(pokemon);
}
