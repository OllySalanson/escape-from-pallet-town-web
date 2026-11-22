import { DeploymentFlow } from '../hub/deploymentFlow';
import { DEFAULT_SECURE_PREFERENCE } from '../hub/secureAutofill';
import { secureGrowthLeft } from '../hub/secureGrowth';
import { EMPTY_ARRANGEMENT } from '../items';
import { availableContracts, FIRST_CONTRACT_ID, secureGrid, securePokemonLimit } from '../objectives';
import { FIRST_CONTRACT, availableInsertionIds, runInsertions, type RunInsertion, type RunInsertionId } from '../run/runGeneration';
import { activeSaveSlot, isPlaytestRun } from '../dev/playtestMode';
import { friendRoom } from '../raidRoom/friendRoom';
import type { RaidProgress, RestoredGame } from '../save/SaveManager';
import type { WorldMapId } from '../worldMap';
import type { WorldSceneData } from '../scenes/WorldScene';

/**
 * What a player is getting ready with while they walk about THE RAID ARENA's
 * hall: the save as they read it, and what they have chosen so far.
 *
 * The hall owns it and every panel opened from the hall shares it, because a
 * panel is a look at one corner of one set of choices: who is on the bench, what
 * is on the rack and in the locker, and where they are stood over. It lives as
 * long as the visit, so walking from the bench to the rim forgets nothing, and
 * like the screens it replaced it is gone when the player walks out of the door.
 */
export interface ArenaKit {
  game: RestoredGame;
  readonly flow: DeploymentFlow;
  /** Back out of a panel, onto the tile it was opened from. */
  close(): void;
  /** Over the fence: the raid is committed to, and this is what it starts with. */
  jump(world: WorldSceneData): void;
  /** Another pack was chosen at the rack: it is on the player's back at once. */
  dress(): void;
  /** A way in has come under the cursor: the pit shows it. */
  aim(insertionId: RunInsertionId): void;
}

/**
 * Every way into a raid this save may take, in authored order: the ones the
 * contracts unlocked and the ones walked to, narrowed to the active contract's
 * own area while one is running, so a first raid can never be deployed somewhere
 * its objective cannot be reached.
 */
export function offeredInsertions(progress: RaidProgress): readonly RunInsertion[] {
  const available = availableInsertionIds(progress);
  const first = availableContracts(progress.completedContracts).some((contract) => contract.id === FIRST_CONTRACT_ID);
  return runInsertions().filter(
    (insertion) => available.includes(insertion.id) && (!first || insertion.mapId === FIRST_CONTRACT.mapId),
  );
}

/** The map of the raid room this browser holds, while raiding with a friend is offered here at all. */
export function heldRoomMapId(): WorldMapId | null {
  const held = activeSaveSlot() === 'normal' && !isPlaytestRun() ? friendRoom()?.room : null;
  return held ? (held.mapId as WorldMapId) : null;
}

/** A new set of choices for this save, opening on the way in it is offered first. */
export function flowForGame(game: RestoredGame): DeploymentFlow {
  return new DeploymentFlow(
    game.stash,
    offeredInsertions(game.raidProgress)[0]?.id,
    {
      pokemon: securePokemonLimit(game.raidProgress.workshopUpgrades),
      secureGrid: secureGrid(game.raidProgress.completedContracts, game.raidProgress.workshopUpgrades, game.traderBerthPaid),
      secureGrowth: secureGrowthLeft(
        game.raidProgress.completedContracts,
        game.raidProgress.workshopUpgrades,
        game.traderBerthPaid,
      ),
    },
    // The container fills itself from what it held last raid, so a player
    // deploying again and again is not re-picking from scratch.
    game.raidProgress.securePreference ?? DEFAULT_SECURE_PREFERENCE,
    // The pack comes back laid out the way it was left, at base and in the
    // field alike; an empty pair is a save that has never arranged one.
    {
      bag: game.raidProgress.packArrangement ?? EMPTY_ARRANGEMENT,
      secure: game.raidProgress.secureArrangement ?? EMPTY_ARRANGEMENT,
    },
    // The partner has its own place; the starter's line leads the container
    // only for a save whose partner was lost before that place existed.
    game.starterSpeciesId,
    // Whoever went down last raid is back on the bench.
    game.raidProgress.lastBench,
    // And what the pack held as it was left is packed again.
    game.raidProgress.lastPack,
    // And what was taken out of it stays out.
    game.raidProgress.packLeftOut,
  );
}

/**
 * The team the hall's bench should write back to the save as it is put away,
 * or null when the save already holds exactly that team in that order. The
 * hall builds its bench from `lastBench` each time it is walked into, so a
 * bench left unwritten came back without whoever was added (veteran
 * playtest, 20 Nov 2026).
 */
export function benchToKeep(
  flow: Pick<DeploymentFlow, 'party' | 'benchIsStandIn'>,
  saved: readonly string[] | undefined,
): readonly string[] | null {
  // Somebody stood on an empty bench by the hall is not the player's team, and
  // written back it replaced the fainted partner for good (playtests of 22 Nov 2026).
  if (flow.benchIsStandIn) {
    return null;
  }
  const chosen = flow.party.map((one) => one.id);
  const before = saved ?? [];
  const same = chosen.length === before.length && chosen.every((id, index) => id === before[index]);
  return same ? null : chosen;
}
