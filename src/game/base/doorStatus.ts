import { traderProgressOf, type RestoredGame } from '../save/SaveManager';
import { buildContractBoard } from '../hub/contractBoard';
import { WORKSHOP_UPGRADES, builtUpgrades, workshopOffers } from '../hub/workshop';
import { pokemonNeedingRecovery } from '../hub/recovery';
import {
  scripHeld,
  traderBarterOffers,
  traderStanding,
  traderStockOffers,
  type TraderCounter,
} from '../hub/trader';
import type { BaseDoor } from './doors';

/**
 * What each door says about what is waiting inside it.
 *
 * The lobby carried this on the four cards it was made of - how many contracts
 * were on the board, who was hurt, how much of the ladder stood and how much
 * scrip was in hand - and the walkable base would have thrown all four away.
 * That is the one thing a map is worse at than a list, so it is put back where
 * the map can carry it: on the caption over the building, which speaks as the
 * player walks up to it and, with the look key held, over the whole yard at
 * once. A base you can read from the middle of the yard is the base the lobby
 * was; a base you have to open four screens to read is worse than it.
 *
 * Phaser-free, so the wording is held by `doorStatus.test.ts`, in the manner of
 * `raidHud.ts` and `contractBoard.ts`. Every number is derived from the save
 * the same way the card that used to carry it derived it.
 */
export function doorStatusLine(door: BaseDoor, game: RestoredGame): string {
  switch (door.screen) {
    case 'raid': {
      const open = buildContractBoard(game.raidProgress).rows.length;
      return open === 0
        ? 'No contracts; raid for what the maps hold'
        : `${open} contract${open === 1 ? '' : 's'} on the board`;
    }
    case 'stash': {
      const hurt = pokemonNeedingRecovery(game.stash).length;
      // The swap offer is said here for the reason it was said on the lobby's
      // stash card: a player down to one Pokemon needs to be told it exists,
      // and the screen that holds it is behind a door they have no reason to
      // open. It outranks the condition line because a vault with one Pokemon
      // left in it is the only state that has it.
      if (game.stash.canSwapStarter()) {
        return 'Your last partner can be swapped here';
      }
      return hurt === 0 ? 'Everyone is fit' : `${hurt} Pokémon hurt`;
    }
    case 'workshop': {
      const built = builtUpgrades(game.raidProgress.workshopUpgrades).length;
      const ready = workshopOffers(
        { stash: game.stash, starterSpeciesId: game.starterSpeciesId },
        game.raidProgress.workshopUpgrades,
      ).filter((offer) => offer.affordable).length;
      const standing = `${built} of ${WORKSHOP_UPGRADES.length} built`;
      return ready === 0 ? standing : `${standing} · ${ready} ready`;
    }
    case 'trader': {
      const counter: TraderCounter = {
        stash: game.stash,
        progress: traderProgressOf(game.raidProgress),
        rationUsed: game.traderRationUsed,
        berthPaid: game.traderBerthPaid,
      };
      const ready =
        traderStockOffers(counter).filter((offer) => offer.refusal === undefined).length +
        traderBarterOffers(counter).filter((offer) => offer.refusal === undefined).length;
      const money = `${scripHeld(game.stash)} scrip`;
      return ready === 0
        ? `${traderStanding(counter.progress).name} · ${money}`
        : `${money} · ${ready} deal${ready === 1 ? '' : 's'} ready`;
    }
  }
}
