import { traderProgressOf, type RestoredGame } from '../save/SaveManager';
import { buildContractBoard } from '../hub/contractBoard';
import { WORKSHOP_UPGRADES, builtUpgrades, workshopOffers } from '../hub/workshop';
import { pokemonNeedingRecovery } from '../hub/recovery';
import {
  moneyHeld,
  traderBarterOffers,
  traderStanding,
  traderStockOffers,
  type TraderCounter,
} from '../hub/trader';
import { formatMoney } from '../items';
import type { BaseDoor, BaseScreen } from './doors';
import { errandBeat, errandThing } from '../hub/errands';
import { BADGES, wonBadges } from './badgeCase';

/**
 * What each door says about what is waiting inside it.
 *
 * The lobby carried this on the four cards it was made of - how many contracts
 * were on the board, who was hurt, how much of the ladder stood and how much
 * money was in hand - and the walkable base would have thrown all four away.
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
export function doorStatusLine(door: BaseDoor, game: RestoredGame, ownerName: string | null = null): string {
  const errand = door.screen === null ? undefined : errandLine(door.screen, game);
  switch (door.screen) {
    case null: {
      // The player's own house, which says from the yard how full its badge
      // case is - the one number in it worth walking over for - under the name
      // that was given at its door (`home/houseName.ts`).
      const whose = ownerName ? `${ownerName}'s house` : 'Your house';
      const won = wonBadges(game).length;
      return won === 0 ? whose : `${whose} · ${won} of ${BADGES.length} badges`;
    }
    case 'raid': {
      if (errand) {
        return errand;
      }
      const open = buildContractBoard(game.raidProgress).rows.length;
      return open === 0
        ? 'No contracts; raid for what the maps hold'
        : `${open} contract${open === 1 ? '' : 's'} on the board`;
    }
    case 'stash': {
      const team = game.stash.listPokemon();
      const fainted = team.filter((stored) => stored.pokemon.isFainted).length;
      const hurt = pokemonNeedingRecovery(game.stash).length - fainted;
      // A faint is said apart from a scratch (`teamConditionLine`), and a team
      // with nobody standing is said as what it means - no raid until Joy - which
      // outranks even the swap offer below: a swapped partner arrives in the
      // fainted one's condition, so the Center is the answer either way.
      if (fainted > 0 && fainted === team.length) {
        return 'Nobody fit to raid';
      }
      // The swap offer is said here for the reason it was said on the lobby's
      // stash card: a player down to one Pokemon needs to be told it exists,
      // and the screen that holds it is behind a door they have no reason to
      // open. It outranks the condition line because a vault with one Pokemon
      // left in it is the only state that has it.
      if (game.stash.canSwapStarter()) {
        return 'Your last partner can be swapped here';
      }
      if (errand) {
        return errand;
      }
      if (fainted > 0) {
        return hurt > 0 ? `${fainted} fainted · ${hurt} hurt` : `${fainted} Pokémon fainted`;
      }
      return hurt === 0 ? 'Everyone is fit' : `${hurt} Pokémon hurt`;
    }
    case 'workshop': {
      if (errand) {
        return errand;
      }
      const built = builtUpgrades(game.raidProgress.workshopUpgrades).length;
      const ready = workshopOffers(
        { stash: game.stash },
        game.raidProgress.workshopUpgrades,
      ).filter((offer) => offer.affordable).length;
      const standing = `${built} of ${WORKSHOP_UPGRADES.length} built`;
      return ready === 0 ? standing : `${standing} · ${ready} ready`;
    }
    case 'trader': {
      if (errand) {
        return errand;
      }
      const counter: TraderCounter = {
        stash: game.stash,
        progress: traderProgressOf(game.raidProgress),
        rationUsed: game.traderRationUsed,
        berthPaid: game.traderBerthPaid,
      };
      const ready =
        traderStockOffers(counter).filter((offer) => offer.refusal === undefined).length +
        traderBarterOffers(counter).filter((offer) => offer.refusal === undefined).length;
      const money = formatMoney(moneyHeld(game.stash));
      return ready === 0
        ? `${traderStanding(counter.progress).name} · ${money}`
        : `${money} · ${ready} deal${ready === 1 ? '' : 's'} ready`;
    }
  }
}

/**
 * What a door says about its keeper's errand, when there is something to go in
 * for (`../hub/errands`): a favour to be asked, a thing to hand over, or a loss
 * they want to hear about. An errand merely in progress says nothing here - it
 * is on the drop-in screen and in the field guide, and a door that nagged would
 * hide the line the room is usually read for.
 */
function errandLine(giver: BaseScreen, game: RestoredGame): string | undefined {
  const beat = errandBeat(giver, game.raidProgress, (itemId) => game.stash.itemCount(itemId));
  if (!beat) {
    return undefined;
  }
  const { errand } = beat;
  if (beat.kind === 'thanks') {
    return `${errandThing(errand)} to hand over`;
  }
  return beat.kind === 'ask' ? `${errand.name} has a favour to ask` : `${errand.name} wants a word`;
}
