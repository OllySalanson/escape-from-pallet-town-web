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
  /**
   * The pack worn into this raid, which a lost raid destroys along with
   * everything that was in it.
   *
   * It rides on the session for the same reason `broughtPokemonIds` does: the
   * pack is never in the bag - it *is* the bag - so nothing in the supply
   * accounting can name it, and only the session remembers what was risked.
   */
  readonly packItemId?: string;
  /**
   * The save's partner - the starter it picked, by the stash's own mark
   * (`Stash.partner()`) - when it came on this raid. The raid follower walks
   * the lead, and the partner when the lead has no walking art
   * (`world/raidFollower.ts`); the party alone cannot say which Pokemon was
   * the starter, because a caught lookalike is the same species.
   */
  readonly partner?: Pokemon;
  readonly objectives: readonly RunObjective[];
  /** The deterministic world configuration generated when this raid begins. */
  readonly plan?: RunPlan;
  /**
   * The workshop upgrades standing at base when this raid deployed. The raid
   * derives what they mean from the ids, exactly as the lobby does, so the two
   * cannot describe the same base differently.
   */
  readonly workshopUpgrades: readonly string[];
  /** The seed and runtime stream keep world events reproducible after generation. */
  readonly seed?: number;
  readonly rng?: SeededRng;
  /**
   * The stream a wild encounter's shininess is rolled on (`pokemon/shiny.ts`),
   * apart from `rng` so the rare roll moves no other roll of the raid.
   */
  readonly shinyRng?: SeededRng;
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
  /**
   * The Pokemon a map maker stood in the world that this raid has already
   * fought, by entity id. The world is rebuilt after the fight, so the one that
   * was met has to be left out of every rebuild after it, or it would stand up
   * again on the return from its own battle.
   */
  pokemonMet?: string[];
  /**
   * The berry trees this raid has picked, by entity id: bare until the next
   * raid, for the reason a met Pokemon stays met - the world is rebuilt after
   * every fight.
   */
  berriesPicked?: string[];
  /**
   * Where this raid has pushed each Strength boulder it moved, by entity id.
   * A boulder stands where the map put it at the start of every raid, so this
   * is raid state and nothing else.
   */
  bouldersMoved?: Record<string, GridPosition>;
  /**
   * The switches this raid has thrown, by id (`world/switches.ts`): a floor
   * switch a boulder came to rest on, or a lever pulled. Thrown stays thrown,
   * and the barriers they open stay open, for the rest of the raid only.
   */
  switchesThrown?: string[];
  /**
   * Whether the player is riding the Bicycle (`world/bicycle.ts`). The world is
   * rebuilt after every fight, and getting back on after each one is FireRed's
   * rule nowhere, so it rides here; it is re-asked on every rebuild, so a
   * Bicycle dropped in a fight to make room for a catch is not ridden.
   */
  riding?: boolean;
  /**
   * The barred exits this raid has opened - dug out with a Pickaxe or unlocked
   * with their key - by label (`ExtractionPoint.label`).
   */
  exitsOpened?: string[];
  /**
   * The ground this raid has walked, as row-major tile indices at the map's own
   * width - what the drop-in screen's picture of the place is drawn from.
   *
   * It lives on the session rather than on `WorldScene` because the world is
   * torn down and rebuilt for every fight, and a raid that walked half a map
   * and then met the hunter would otherwise remember only the half after the
   * battle. It is written to the save once, when the raid ends: a save is the
   * whole game serialised, and a write per step is a write per 150ms.
   */
  surveyed?: Set<number>;
}

/** Mixed into a raid's seed for its shiny stream, so the two streams never meet. */
const SHINY_STREAM = 0x5a17e5;

export function createActiveRunSession(
  manager: RunManager,
  secureSlot: SecureSlot,
  stashSecureSlot: StashSecureSlot,
  broughtPokemonIds: readonly string[],
  broughtItems: readonly ItemStack[],
  objectives: readonly RunObjective[] = [],
  plan?: RunPlan,
  workshopUpgrades: readonly string[] = [],
  packItemId?: string,
  partner?: Pokemon,
): ActiveRunSession {
  return {
    workshopUpgrades: [...workshopUpgrades],
    manager,
    secureSlot,
    stashSecureSlot,
    broughtPokemonIds: [...broughtPokemonIds],
    broughtItems: [...broughtItems],
    ...(packItemId === undefined ? {} : { packItemId }),
    ...(partner === undefined ? {} : { partner }),
    objectives: [...objectives],
    ...(plan === undefined
      ? {}
      : {
        plan,
        seed: plan.seed,
        rng: createSeededRng(plan.seed ^ 0x9e3779b9),
        shinyRng: createSeededRng(plan.seed ^ SHINY_STREAM),
      }),
  };
}

export function registerCaughtPokemon(session: ActiveRunSession | undefined, pokemon: Pokemon): void {
  session?.manager.registerCaughtPokemon(pokemon);
}
