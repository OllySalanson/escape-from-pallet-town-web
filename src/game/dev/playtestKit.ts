import { Pokemon } from '../pokemon';
import { getSpeciesById } from '../pokemon/species';
import type { RaidProgress } from '../save/SaveManager';
import type { Stash } from '../stash/Stash';
import { canJump } from '../minigames/pokemonJump';
import { canPickBerries } from '../minigames/berryPicking';
import { courseMovesOf } from '../minigames/fieldCourse';
import { valeGyms } from '../world/valeQuarters';
import { NO_GAME_CORNER } from '../minigames/tickets';
import { bestLines, lineMs, routeOf } from '../minigames/derby';
import { digsAPlus } from '../minigames/dig';
import { biteChance } from '../minigames/fishingDerby';
import { traitsOf } from '../minigames/traits';

/** How long a kind takes round the derby on its best lines, on a dry day: what makes a racer. */
function racerTime(speciesId: string): number | undefined {
  const racer = traitsOf(speciesId);
  if (!racer) return undefined;
  const lines = bestLines(racer, false);
  return lineMs(racer, routeOf(lines.first, lines.second), false);
}

/**
 * What the explorer run carries so that every new thing in the harbour can be
 * played the night it lands: **one row a feature**.
 *
 * The explorer run was built to look at maps - a Lv 99 Charizard and five
 * Lv 50 final forms - and not one of them is on FireRed's POKéMON JUMP list,
 * so the first cabinet in THE GAME CORNER told its playtester "Nobody here can
 * jump", with nothing to spend at the prize window either. Every harbour game
 * after it asks for Pokémon of its own kind, so this is a list a new game adds
 * a row to rather than a save somebody tops up by hand:
 *
 * - a **box** of Pokémon it is played with, named for what they are for;
 * - and, for a game, how it opens and **which kinds suit it**, which
 *   `playtestKit.test.ts` holds the save to: every game must find in the
 *   vault both a Pokémon that suits it and one that does not, because a game
 *   is only tested when it is played both ways.
 *
 * Applied to a new explorer run and to every one resumed (`withPlaytestKit`,
 * called on the way in from the title), and only ever *adds*: a kind already
 * in the vault anywhere is not added twice, a box already there is filled
 * rather than made again, and tickets are only ever raised to the floor. So a
 * run kept for weeks gets each new row the first time it is opened after the
 * row ships, and keeps everything it had.
 *
 * Nothing here is a new species or a stat: these are the 151 as the import
 * built them, at a level, each knowing its own FireRed moves.
 */

/** A box of Pokémon the kit keeps in the explorer run's vault. */
export interface PlaytestKitBox {
  /** The box's name, as the PC shows it. */
  readonly box: string;
  /** What they are for, for the board and for whoever adds the next row. */
  readonly why: string;
  readonly level: number;
  /** Species ids, in the order they go in. */
  readonly species: readonly string[];
}

/**
 * Every screen the board can open: the Game Corner's two, the two games that
 * are scenes of their own, and the promenade's three outdoor games.
 */
export type PlaytestGameScreen =
  | 'jump'
  | 'prizes'
  | 'berry-picking'
  | 'field-course'
  | 'derby'
  | 'dig'
  | 'fishing-derby';

/** A harbour game the PLAYTEST BOARD opens straight away. */
export interface PlaytestGame {
  readonly id: string;
  readonly name: string;
  /**
   * What the board opens: one of THE GAME CORNER's two screens (`jump`,
   * `prizes`), a game that is a scene of its own, or one of the promenade's outdoor games.
   */
  readonly opens: PlaytestGameScreen;
  /** Which kinds play it; absent for a screen nobody plays with a Pokémon. */
  readonly suits?: (speciesId: string) => boolean;
}

/**
 * FireRed's jumpers, three of each jump type (`generated/pokemonJump.ts`):
 * FAST, NORMAL and SLOW, so a team of one kind and a mixed team can both be
 * tried.
 */
const JUMPERS: PlaytestKitBox = {
  box: 'JUMPERS',
  why: 'POKéMON JUMP: three of each jump type',
  level: 20,
  species: ['rattata', 'mankey', 'krabby', 'pikachu', 'meowth', 'eevee', 'bulbasaur', 'psyduck', 'oddish'],
};

/**
 * The kinds the promenade's outdoor games are built round, each with its
 * opposite: the race's runners (Ponyta, Doduo) and its slowest (Golem), the
 * dig's digger (Diglett), and the fishing derby's best and worst leads
 * (Staryu's Illuminate, Grimer's Stench).
 */
const PROMENADE: PlaytestKitBox = {
  box: 'PROMENADE',
  why: 'The race, the dig and the fishing derby',
  level: 30,
  species: ['doduo', 'dodrio', 'ponyta', 'diglett', 'lapras', 'staryu', 'grimer', 'golem'],
};

/**
 * A box of first stages from right across the 151, for anything that asks
 * for a Pokémon that can still evolve, or a team at an ordinary level - the
 * Day-Care, a stone, a disc, the garden.
 */
const FIRST_STAGES: PlaytestKitBox = {
  box: 'FIRST STAGES',
  why: 'First stages from across the 151, at Lv 10',
  level: 10,
  species: [
    'charmander',
    'squirtle',
    'caterpie',
    'weedle',
    'pidgey',
    'spearow',
    'ekans',
    'sandshrew',
    'nidoran-f',
    'nidoran-m',
    'vulpix',
    'zubat',
    'paras',
    'venonat',
    'growlithe',
    'poliwag',
    'machop',
    'bellsprout',
    'tentacool',
    'geodude',
    'slowpoke',
    'magnemite',
    'gastly',
    'drowzee',
    'voltorb',
    'cubone',
    'horsea',
    'goldeen',
    'magikarp',
    'dratini',
  ],
};

/** Every box the kit keeps, in the order they are made. */
export const PLAYTEST_KIT_BOXES: readonly PlaytestKitBox[] = [JUMPERS, PROMENADE, FIRST_STAGES];

/** The fewest tickets an explorer run holds: enough to buy everything at the prize window. */
export const PLAYTEST_TICKETS = 5_000;

/**
 * Every harbour game the board opens, one row each. A new game adds its row
 * here, with the kinds that suit it, and the kit box that holds them.
 */
export const PLAYTEST_GAMES: readonly PlaytestGame[] = [
  { id: 'pokemon-jump', name: 'POKéMON JUMP', opens: 'jump', suits: (speciesId) => canJump(speciesId) },
  { id: 'berry-picking', name: 'BERRY PICKING', opens: 'berry-picking', suits: (speciesId) => canPickBerries(speciesId) },
  {
    id: 'field-course',
    name: 'THE FIELD-MOVE COURSE',
    opens: 'field-course',
    // A runner suits the course if it can do any of its four moves; one that
    // can do none of them walks the long way round every time.
    suits: (speciesId) => courseMovesOf(speciesId).length > 0,
  },
  { id: 'prize-window', name: 'THE PRIZE WINDOW', opens: 'prizes' },
  { id: 'derby', name: 'PROMENADE DERBY', opens: 'derby', suits: (speciesId) => (racerTime(speciesId) ?? Infinity) <= 15_000 },
  { id: 'dig', name: 'THE DIG', opens: 'dig', suits: (speciesId) => Boolean(traitsOf(speciesId) && digsAPlus(traitsOf(speciesId)!)) },
  { id: 'fishing-derby', name: 'FISHING DERBY', opens: 'fishing-derby', suits: (speciesId) => (traitsOf(speciesId) ? biteChance(traitsOf(speciesId)!) >= 1 : false) },
];

/**
 * The one Pokémon the PLAYTEST BOARD's PRACTISE TO LOSE puts on the bench: a
 * Lv 10 first stage out of the kit, so a practice bout can be lost and its
 * "what beat you" read. The explorer run's own bench is a Lv 99 Charizard,
 * which no leader can beat (playtest wave 3, finding 6).
 */
export const PRACTICE_TO_LOSE_SPECIES = 'caterpie';

/** The bench PRACTISE TO LOSE sets: the vault's lowest-level Pokémon of `PRACTICE_TO_LOSE_SPECIES`, or none. */
export function practiceToLoseBench(stash: Stash): readonly string[] {
  const weakest = stash
    .listPokemon()
    .filter((stored) => stored.pokemon.base.id === PRACTICE_TO_LOSE_SPECIES && stored.pokemon.currentHp > 0)
    .sort((a, b) => a.pokemon.level - b.pokemon.level)[0];
  return weakest ? [weakest.id] : [];
}

/**
 * Every gym leader marked met, so each one waits on THE RAID ARENA's far floor
 * for a practice bout (`base/gymPractice.ts`) without a raid to their gym
 * first. Met, never beaten: a beaten leader's doors open and the leader is
 * taken off the map, and the explorer run keeps every keeper standing.
 */
export function withEveryLeaderMet(progress: RaidProgress): RaidProgress {
  const met = progress.gymsMet ?? [];
  const missing = valeGyms()
    .map((gym) => gym.bossId)
    .filter((id) => !met.includes(id));
  return missing.length === 0 ? progress : { ...progress, gymsMet: [...met, ...missing] };
}

/**
 * Puts every kit box's Pokémon into a vault that does not hold that kind yet,
 * making the box the first time it is needed. Returns whether anything was
 * added, so a resumed run is written back only when it changed.
 */
export function addPlaytestKit(stash: Stash): boolean {
  let added = false;
  const held = (): Set<string> =>
    new Set([
      ...stash.listPokemon().map((stored) => stored.pokemon.base.id),
      ...(stash.dayCare() ? [stash.dayCare()!.pokemon.base.id] : []),
    ]);
  for (const row of PLAYTEST_KIT_BOXES) {
    const missing = row.species.filter((id) => !held().has(id));
    if (missing.length === 0) {
      continue;
    }
    let boxIndex = stash.listBoxes().findIndex((box) => box.name === row.box);
    if (boxIndex < 0) {
      boxIndex = stash.addBox();
      stash.renameBox(boxIndex, row.box);
    }
    for (const speciesId of missing) {
      const base = getSpeciesById(speciesId);
      if (!base) {
        throw new Error(`The playtest kit names ${speciesId}, which is not one of the 151.`);
      }
      const id = stash.addPokemon(new Pokemon(base, row.level));
      // Refused only into a box filled by hand, and then the newcomer stays
      // wherever the vault put it, which every picker still reaches.
      stash.movePokemon(id, boxIndex);
      added = true;
    }
  }
  return added;
}

/** The kit's half of a run's progress: tickets raised to the floor, never lowered. */
export function withPlaytestTickets(progress: RaidProgress): RaidProgress {
  const corner = progress.gameCorner ?? NO_GAME_CORNER;
  if (corner.tickets >= PLAYTEST_TICKETS) {
    return progress;
  }
  return { ...progress, gameCorner: { ...corner, tickets: PLAYTEST_TICKETS } };
}

/**
 * A new day, as the board's NEW DAY makes one: every cabinet pays again and
 * the prize window's daily limits are back, because the ledger of today is
 * what both are counted against (`minigames/tickets.ts`). The best scores
 * ever, and the tickets in hand, are kept.
 */
export function withNewDay(progress: RaidProgress): RaidProgress {
  const corner = progress.gameCorner ?? NO_GAME_CORNER;
  return { ...progress, gameCorner: { ...corner, day: null } };
}
