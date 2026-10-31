import { partnerOf } from '../base/partner';
import { ITEMS, type ItemId } from '../items/items';
import { PokemonType } from '../pokemon/PokemonType';
import { SPECIES_BY_ID } from '../pokemon/species';
import { raidsDeployed, type RaidProgress, type RestoredGame } from '../save/SaveManager';
import { hunterLineupFor } from '../world/hunter';
import { hunterRival, rivalForRaid, type HunterRival } from '../world/hunters';

/**
 * THE RAID ARENA's trailer: what a raid is, played out once, the first time the
 * Arena's door is walked through, and after that only for somebody who asks the
 * Gym Guide to run the reel again, with a SKIP (the captain, 2026-10-29: "when I
 * walk into the gym for the first time ... an epic cutscene of me in a raid
 * with my Charizard ... sneaking around finding pieces, then we get into a
 * battle and it looks like it's going to be OK but then all of a sudden we get
 * swarmed ... But then Charizard flies in, saves the day and we get out and we
 * extract").
 *
 * This module is the script and nothing that draws it: who is in it, every
 * word said, and when each beat starts. `scenes/ArenaIntroScene.ts` plays it
 * in the engine with the game's own art, so the trailer is the player's own -
 * their figure, their name, their partner in the fight, and the hunter who
 * will be after them on their next raid with that hunter's own team.
 *
 * Two rules the scene is held to by this module's tests. **It is never in the
 * way**: any key or click ends it, on any viewing, and an ending is the
 * great hall - the same place the door goes. And **it
 * is the player's once**: the save records that it has been seen the moment
 * it starts (`SaveManager.watchArenaIntro`), so a reload does not buy it twice
 * unasked, and a save from before it existed reads as never seen.
 */

/** Whether this is the trailer the door plays unasked, or the one the Gym Guide runs again. */
export type ArenaIntroViewing = 'first' | 'again';

export function arenaIntroViewing(progress: Pick<RaidProgress, 'arenaIntroSeen'>): ArenaIntroViewing {
  return progress.arenaIntroSeen === true ? 'again' : 'first';
}

/**
 * Whether the SKIP chip is on screen. Any key skips on any viewing; the chip
 * is what says so to somebody who has seen it all before, and the first
 * viewing is left to play without a button asking to be pressed.
 */
export function arenaIntroOffersSkip(viewing: ArenaIntroViewing): boolean {
  return viewing === 'again';
}

/**
 * Who closes the trailer. The captain's ask named "Mel", and nobody called Mel
 * lives in the harbour; the Gym Guide does - he stands at the Arena's door and
 * greets everybody with FireRed's own "Champ in the making!" - so the line is
 * his until the captain says otherwise. It is one constant so that call is a
 * one-word change.
 */
export const ARENA_INTRO_HOST = 'GYM GUIDE';

/** The room the trailer ends in: the Arena's great hall (`base/rooms.ts`). */
export const ARENA_INTRO_ENDS_ON = 'raid-arena';

/** The name the trailer calls the player by when the house has none yet. */
export const ARENA_INTRO_NAMELESS = 'TRAINER';

/** The three things found on the way in, in order. A prize last, for the gleam. */
export const ARENA_INTRO_FINDS: readonly ItemId[] = ['radio-valve', 'card-key', 'fire-stone'];

/** What the partner fights the wild Pokémon with: a move every starter's line reads as its own. */
const PARTNER_MOVE: Partial<Record<PokemonType, string>> = {
  [PokemonType.Fire]: 'EMBER',
  [PokemonType.Water]: 'WATER GUN',
  [PokemonType.Grass]: 'VINE WHIP',
  [PokemonType.Electric]: 'THUNDERSHOCK',
};

/** The wild Pokémon that is nearly beaten, and the hero who is not on the team at all. */
export const ARENA_INTRO_WILD = 'rattata';
export const ARENA_INTRO_HERO = 'charizard';

/** How many of the hunter's team come out of the trees. */
export const ARENA_INTRO_SWARM_SIZE = 6;

export interface ArenaIntroCast {
  readonly playerName: string;
  /** The partner who fights the wild Pokémon - the save's own, else Charmander. */
  readonly partner: { readonly id: string; readonly name: string; readonly dexId: number; readonly move: string };
  readonly wild: { readonly id: string; readonly name: string; readonly dexId: number };
  readonly hero: { readonly id: string; readonly name: string; readonly dexId: number };
  /** Whoever hunts the player's next raid, as the telly forecasts it. */
  readonly rival: HunterRival;
  /** The species that swarm in, the rival's signature first. */
  readonly swarm: readonly { readonly id: string; readonly name: string; readonly dexId: number }[];
  readonly finds: readonly { readonly id: ItemId; readonly name: string }[];
}

function speciesCard(id: string): { readonly id: string; readonly name: string; readonly dexId: number } {
  const base = SPECIES_BY_ID[id];
  if (!base) {
    throw new Error(`the trailer names no species '${id}'`);
  }
  return { id, name: base.name.toUpperCase(), dexId: base.dexId };
}

export function arenaIntroCast(game: Pick<RestoredGame, 'stash' | 'raidProgress'>, playerName: string | null): ArenaIntroCast {
  const partnerId = partnerOf(game.stash)?.species ?? 'charmander';
  const partner = speciesCard(partnerId);
  const rival = hunterRival(rivalForRaid(raidsDeployed(game.raidProgress)));
  const lineup = hunterLineupFor(rival.id).map((species) => species.id);
  return {
    playerName: playerName?.trim() ? playerName.trim().toUpperCase() : ARENA_INTRO_NAMELESS,
    partner: { ...partner, move: PARTNER_MOVE[SPECIES_BY_ID[partnerId].primaryType] ?? 'TACKLE' },
    wild: speciesCard(ARENA_INTRO_WILD),
    hero: speciesCard(ARENA_INTRO_HERO),
    rival,
    swarm: Array.from({ length: ARENA_INTRO_SWARM_SIZE }, (_slot, index) => speciesCard(lineup[index % lineup.length])),
    finds: ARENA_INTRO_FINDS.map((id) => ({ id, name: ITEMS[id].displayName.toUpperCase() })),
  };
}

/**
 * The beats, in order, each with when it starts. The scene schedules every
 * cue inside a beat from the beat's own start, so retiming one beat is a
 * number here and nothing else.
 */
export const ARENA_INTRO_BEATS = [
  /** Night in the vale: sneaking up the path, picking up three finds. */
  { id: 'sneak', at: 0 },
  /** The grass moves. */
  { id: 'rustle', at: 8600 },
  /** A wild fight the partner is winning. */
  { id: 'battle', at: 9800 },
  /** Out of the trees: the hunter and their whole team. */
  { id: 'swarm', at: 16600 },
  /** A roar, and the comic panel. */
  { id: 'hero', at: 23200 },
  /** Fire across the clearing; the swarm scatters. */
  { id: 'rescue', at: 25600 },
  /** The run for the exit, bought by the hero: it holds the hunter, then shuts the road on them. */
  { id: 'escape', at: 30200 },
  /** EXTRACTED, and what came home. */
  { id: 'extracted', at: 36700 },
  /** Back at the Arena's door, where the host asks. */
  { id: 'arena', at: 40300 },
  /** PACK YOUR LOADOUT, held until a key is pressed. */
  { id: 'loadout', at: 48500 },
] as const;

export type ArenaIntroBeat = (typeof ARENA_INTRO_BEATS)[number]['id'];

export function beatStart(id: ArenaIntroBeat): number {
  return ARENA_INTRO_BEATS.find((beat) => beat.id === id)!.at;
}

/** How long a key is ignored once the trailer starts: the key that walked into the door is still down. */
export const ARENA_INTRO_ARMING_MS = 500;

/** Every word the trailer says, for the cast it is said to. */
export function arenaIntroWords(cast: ArenaIntroCast) {
  return {
    place: 'GREYSTONE VALE',
    hour: '02:47',
    battle: [
      `A wild ${cast.wild.name} appeared!`,
      `Go! ${cast.partner.name}!`,
      `${cast.partner.name} used ${cast.partner.move}!`,
      `${cast.wild.name} is nearly done for!`,
    ],
    cocky: 'Easy. Too easy...',
    warning: 'Wait. Something is coming...',
    spotted: `${cast.rival.name}!`,
    // What the rival says as they catch you: their gloat about your loot.
    shout: cast.rival.caught[0],
    trapped: `${cast.partner.name} can't hold them!`,
    roar: `${cast.hero.name}!`,
    run: 'RUN!',
    // Shouted over the fire, at somebody who has got away.
    getaway: cast.rival.getaway,
    extracted: 'EXTRACTED!',
    host: [
      `${ARENA_INTRO_HOST}: That's a raid, ${cast.playerName}. Sneak in, grab what you can, and get out before the hunter gets you.`,
      `${ARENA_INTRO_HOST}: So, champ in the making... are you ready to take on the challenge?`,
    ],
    loadout: 'PACK YOUR LOADOUT TO START THE RAID',
    press: 'PRESS ANY KEY',
    skip: 'SKIP',
  };
}
