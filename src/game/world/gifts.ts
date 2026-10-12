import { Pokemon } from '../pokemon/Pokemon';
import { getSpeciesById } from '../pokemon/species';
import type { WorldMapId } from '../worldMap';

/**
 * A Pokemon an NPC hands over, once, in their own words. The tutorial this game
 * grew from has one such giver; a gift is a different feeling from a catch
 * because nobody rolled for it.
 *
 * **The gift is made inside the raid, and it is at risk.** It rides in the raid's
 * pack exactly as a caught Pokemon does (`RunManager.registerGiftedPokemon`):
 * banked on extraction, lost with the pack on a wipe or a timeout. That is the
 * point of an extraction game - being handed something is not the same as
 * having it - and the giver says so. What a wipe costs is therefore the
 * Pokemon and nothing else: the save records a gift as received only when a
 * raid banks it (`raidProgress.giftsReceived`), so a lost gift is offered again
 * by the same person next time, at the same level, and cannot be lost for good.
 * Nothing about a gift is stored beside that list.
 */
export interface PokemonGift {
  /** The id `giftsReceived` records. */
  readonly id: string;
  /** The `WorldEntity` who gives it. */
  readonly giverId: string;
  readonly mapId: WorldMapId;
  readonly speciesId: string;
  readonly level: number;
  /** What the giver says the first time, up to and including the hand-over. */
  readonly offer: readonly string[];
  /** The hand-over line when the party has no room and the gift rides in the pack. */
  readonly offerPackLine: string;
  /**
   * What the giver says when the *pack* has no room for it.
   *
   * A gift is cargo like a catch, so it costs squares, and a pack with none is
   * the one case where the hand-over cannot happen. It is said rather than
   * silently swallowed, and the gift stays unspoken - come back with room and
   * it is still here.
   */
  readonly offerNoRoomLine: string;
  /** What they say to anyone who has already been given it. */
  readonly after: readonly string[];
}

/**
 * Nan Pell kept the Reedbeds relay's log for forty years, and the relay is dead:
 * the flood took the mains. What she cannot keep is the thing in the battery
 * cupboard, which has done nothing since but stare at the pylons. The species
 * is the one the place is about - a Pikachu wants current, and there is none
 * left here.
 *
 * It is a level 2, three under the starter the player chose, on purpose: a gift
 * that outclasses the starter breaks the opening (`starterIdentity` holds that
 * nothing tells the starters apart but their kit). FireRed's Pikachu knows
 * Thunder Shock from level 1, so no level keeps a typed attack out of its kit -
 * it was a level 4 with Tackle and Growl until every species took FireRed's own
 * learnset (the captain, 2026-10-11), and a FireRed one at 4 won 90% of the
 * Floodplain's wild fights against a starter's 75-82%, and 82% at 3. At 2 it
 * wins 70%, less than every starter, and `gifts.test.ts` holds that
 * measurement rather than a list of moves. Its worth is a second body, and an
 * Electric one against the wild Flying types, not a stronger first one.
 */
export const REEDBEDS_PIKACHU: PokemonGift = {
  id: 'reedbeds-pikachu',
  giverId: 'reedbeds-night-operator',
  mapId: 'floodplain-relay',
  speciesId: 'pikachu',
  level: 2,
  offer: [
    'Nan Pell. Night operator, Reedbeds relay. Forty years on this line, and the line is dead.',
    'There is something in the battery cupboard that has not slept since the flood took the mains. It just stands at the window and watches the pylons.',
    'A dead relay is no place for a creature that wants a current. Take it. Go on - it is only small, mind, and it will not thank you for a fight it cannot win.',
    'PIKACHU joined your party! It is only yours once you carry it out of the reeds.',
  ],
  offerPackLine:
    'PIKACHU is in your pack - your party is full. It is only yours once you carry it out of the reeds.',
  // It is said after `packFullForPokemonLine`, which has already counted the
  // squares, so it adds what only she can say: nothing is lost by waiting.
  offerNoRoomLine:
    'Put something down and come back - it is not going anywhere, and neither am I.',
  after: [
    'It has stopped watching the pylons. Good.',
    'Mind the shore road. Whatever is hunting out there does not care that it is small.',
  ],
};

export const POKEMON_GIFTS: readonly PokemonGift[] = [REEDBEDS_PIKACHU];

export function giftGivenBy(giverId: string): PokemonGift | undefined {
  return POKEMON_GIFTS.find((gift) => gift.giverId === giverId);
}

/**
 * Whether the giver has nothing left to give: the save has banked the gift, or
 * this raid is already carrying it. Either way it is the one Pokemon, once.
 */
export function isGiftSpoken(
  gift: PokemonGift,
  banked: readonly string[],
  carriedThisRaid: readonly string[],
): boolean {
  return banked.includes(gift.id) || carriedThisRaid.includes(gift.id);
}

/**
 * What the giver's hand-over asks once it is read: FireRed asks a gift's
 * nickname exactly as it asks a catch's (`BattleScene`'s nickname question),
 * and the cursor starts on NO, because the key that read the last line is the
 * key that answers.
 */
export function giftNicknamePrompt(speciesName: string): {
  readonly lines: readonly string[];
  readonly options: readonly string[];
  readonly selected: number;
} {
  return { lines: ['Give a nickname to', `${speciesName.toUpperCase()}?`], options: ['YES', 'NO'], selected: 1 };
}

/** A new Pokemon for the gift; every hand-over is a fresh one at its authored level. */
export function createGiftPokemon(gift: PokemonGift): Pokemon {
  const species = getSpeciesById(gift.speciesId);
  if (!species) {
    throw new Error(`Gift "${gift.id}" names a species that does not exist: ${gift.speciesId}`);
  }
  return new Pokemon(species, gift.level);
}
