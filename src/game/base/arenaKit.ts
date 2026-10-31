import { DeploymentFlow } from '../hub/deploymentFlow';
import { DEFAULT_SECURE_PREFERENCE } from '../hub/secureAutofill';
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
  /** A way in has come under the cursor: the pit shows it. */
  aim(insertionId: RunInsertionId): void;
  /** What is under the player where they stand at the fence, said at the top of the rim's panel. */
  below(): readonly string[];
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
    // The partner wins a level tie for the container's protection.
    game.starterSpeciesId,
    // Whoever went down last raid is back on the bench.
    game.raidProgress.lastBench,
  );
}
