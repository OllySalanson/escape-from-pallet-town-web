import { raidsDeployed, type RestoredGame } from '../save/SaveManager';
import { STARTER_SPECIES } from '../stash/Stash';
import { PokemonType } from '../pokemon/PokemonType';
import { formatMoney } from '../items';
import { moneyHeld } from '../hub/trader';
import { hunterRival, rivalForRaid, type HunterRivalId } from '../world/hunters';
import { worldMapName, type WorldMapId } from '../worldMap';

/**
 * What the things in THE BOLTHOLE say, worked out from the save.
 *
 * A house is where a player goes between raids to look at what they have done,
 * so everything in it that can be faced reads something real off the save
 * rather than a line of furniture: the telly is the forecast of who hunts you
 * next (the same rotation the hunter is drawn from, `rivalForRaid`), the PC is
 * the raid log, the calendar counts the days, and the bed dreams of where you
 * keep going back to. Nothing here is stored and nothing here is a reward -
 * the bed in particular does not heal, because healing is Joy's and is priced
 * in raid time (`hub/recovery.ts`), and a free bed at home would price the
 * Pokémon Center at nothing.
 *
 * Phaser-free, so the words are held by `homeLines.test.ts`.
 */

/** Who hunts the next raid this save goes on. */
export function nextRival(game: RestoredGame): HunterRivalId {
  return rivalForRaid(raidsDeployed(game.raidProgress));
}

/**
 * KANTO TONIGHT's report on each rival, in their own voice where the games
 * give them one. Each is what the telly says while that rival is next.
 */
const TONIGHT: Readonly<Record<HunterRivalId, string>> = {
  blue: 'KANTO TONIGHT: BLUE, grandson of PROFESSOR OAK, tells our reporter he is "never more than one step behind you, loser."',
  misty: 'KANTO TONIGHT: the Cerulean Gym is shut today. Its leader MISTY was last seen "going after somebody who ignored her."',
  'lt-surge': 'KANTO TONIGHT: storm warning over Vermilion. LT. SURGE says he is shipping out to "settle a score with a kid."',
  koga: 'KANTO TONIGHT: there have been no sightings of KOGA of Fuchsia all week. That, our reporter says, is what worries her.',
  sabrina: 'KANTO TONIGHT: SABRINA of Saffron predicts "a visitor, on the next raid." She would not tell us who. We think she meant you.',
};

export function tellyLines(game: RestoredGame): readonly string[] {
  const rival = hunterRival(nextRival(game));
  return [TONIGHT[rival.id], `Next raid, the one on your trail will be ${rival.name}.`];
}

/** The raids this save has gone on, map by map, read off the save's own record. */
function record(game: RestoredGame): {
  readonly raids: number;
  readonly home: number;
  readonly lost: number;
  readonly favourite: { readonly mapId: string; readonly raids: number } | null;
} {
  const entries = Object.entries(game.raidProgress.raidRecord ?? {});
  const raids = raidsDeployed(game.raidProgress);
  const home = entries.reduce((total, [, each]) => total + each.extracted, 0);
  const lost = entries.reduce((total, [, each]) => total + each.wiped, 0);
  const best = entries
    .filter(([, each]) => each.deployed > 0)
    .sort((a, b) => b[1].deployed - a[1].deployed || a[0].localeCompare(b[0]))[0];
  return { raids, home, lost, favourite: best ? { mapId: best[0], raids: best[1].deployed } : null };
}

const times = (count: number): string =>
  count === 1 ? 'once' : count === 2 ? 'twice' : `${count} times`;

export function pcLines(game: RestoredGame): readonly string[] {
  const log = record(game);
  const keeping = `Bill is keeping ${formatMoney(moneyHeld(game.stash))} and ${game.stash.listPokemon().length} Pokémon for you.`;
  if (log.raids === 0) {
    return ['RAID LOG. No raids yet. Oak is up the row, with the contract board.', keeping];
  }
  return [
    `RAID LOG. ${log.raids} raid${log.raids === 1 ? '' : 's'}: ${log.home} came home, ${log.lost} lost.`,
    ...(log.favourite
      ? [`Raided most: ${worldMapName(log.favourite.mapId as WorldMapId).toUpperCase()}, ${times(log.favourite.raids)}.`]
      : []),
    keeping,
  ];
}

/** The day the calendar is open on: one a raid, and today is the next. */
export function calendarDay(game: RestoredGame): number {
  return raidsDeployed(game.raidProgress) + 1;
}

export function calendarLines(game: RestoredGame): readonly string[] {
  const log = record(game);
  if (log.raids === 0) {
    return [`DAY 1. A calendar, pinned by the stairs. Nothing crossed off yet.`];
  }
  return [
    `DAY ${calendarDay(game)}. Every raid is a day on this calendar, and ${log.raids} ${log.raids === 1 ? 'is' : 'are'} crossed off.`,
    ticks(log.home, log.raids),
  ];
}

/** How many of the crossed-off days are ticked, said as a sentence rather than as a count. */
function ticks(home: number, raids: number): string {
  if (raids === 1) return home === 1 ? 'It has a tick for coming home.' : 'It has no tick for coming home.';
  if (home === 0) return 'None of them has a tick for coming home.';
  if (home === raids) return 'Every one of them has a tick for coming home.';
  return `${home} of them ${home === 1 ? 'has' : 'have'} a tick for coming home.`;
}

/** Lying down in your own bed: a dream, and waking up. Never a heal. */
export function bedLines(game: RestoredGame): readonly string[] {
  const log = record(game);
  const rival = hunterRival(nextRival(game));
  const dream = log.favourite
    ? `You dream of ${worldMapName(log.favourite.mapId as WorldMapId).toUpperCase()}. ${rival.name} is there, one step behind you... and you wake up.`
    : `You dream of the drop-in. OAK's voice: "Come home with the pack on your back." And you wake up.`;
  return [
    'You lie down in your own bed. Nobody hunts you here.',
    dream,
    'You feel rested. Your Pokémon still need NURSE JOY for that.',
  ];
}

/**
 * The console under the telly. The fourth game of a visit to the base is the
 * one you finally win, which nobody is told about.
 */
export function consoleLine(gamesPlayed: number): string {
  if (gamesPlayed < 3) {
    return 'You play a quick game. You lose to a BUG CATCHER, again.';
  }
  if (gamesPlayed === 3) {
    return 'You play a quick game... and you finally beat that BUG CATCHER! You put the controller down while you are ahead.';
  }
  return 'You play a quick game. You win. It does not feel the same as the first time.';
}

/**
 * The upstairs rug is the colour of the player's partner: red for a Charmander
 * save, blue for a Squirtle, and FireRed's own green for a Bulbasaur - or for a
 * save that has none.
 */
export type RugColour = 'green' | 'red' | 'blue';

export function partnerRug(game: RestoredGame): RugColour {
  const starter = STARTER_SPECIES.find((species) => species.id === game.starterSpeciesId);
  switch (starter?.primaryType) {
    case PokemonType.Fire:
      return 'red';
    case PokemonType.Water:
      return 'blue';
    default:
      return 'green';
  }
}
