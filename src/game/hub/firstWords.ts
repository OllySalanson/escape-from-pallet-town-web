import type { CharacterDesignId } from '../world/characterDesigns';

/**
 * What Professor Oak and Nurse Joy say the first time each of their screens
 * opens, and never again.
 *
 * Playtest 43 played the first hour as somebody who had never met either a
 * Pokemon game or an extraction game, and lost them at about fifty-four
 * minutes: nothing had ever said what a raid is, what a wipe takes, that a catch
 * takes room in the pack, or that healing is paid for out of the next raid's
 * clock. Every one of those facts was on a screen somewhere; none of them was
 * said by anybody. The captain chose the smallest answer (option A of that
 * report): the two people a newcomer meets first speak a few lines, once, the
 * way the games this is dressed as do, and the screens stay exactly as they are.
 *
 * Once means once per save. A set of words is recorded as heard at the moment
 * it is shown (`SaveManager.hearFirstWords`), as the opening fight's lesson is,
 * so leaving the screen without reading it does not buy a second hearing - and
 * the save keeps only the list of ids, as it keeps every other permanent fact.
 */
export const FIRST_WORDS_IDS = ['lab', 'loadout', 'check', 'center'] as const;
export type FirstWordsId = (typeof FIRST_WORDS_IDS)[number];

export interface FirstWords {
  /** Who is speaking: a named design, drawn the way the overworld draws them. */
  readonly speaker: CharacterDesignId;
  readonly name: string;
  /** A few short lines, each one fact a newcomer needs on this screen. */
  readonly lines: readonly string[];
  /**
   * How the first line is opened to the player by name, when it is: Oak met a
   * newcomer with "Ah, there you are!" seconds after they had told the game
   * what they are called (playtest 47). `spokenLines` puts the name in.
   */
  readonly greeting?: string;
}

/** Who keeps THE RAID ARENA's great hall (`base/rooms.ts`). */
export const ARENA_KEEPER_DESIGN = 'cooltrainer-woman' satisfies CharacterDesignId;
export const ARENA_KEEPER_NAME = 'THE MARSHAL';

export const FIRST_WORDS: Readonly<Record<FirstWordsId, FirstWords>> = {
  lab: {
    speaker: 'prof-oak',
    name: 'Professor Oak',
    greeting: 'there you are!',
    lines: [
      'Out there are maps full of loot and wild Pokémon.',
      'A raid is a few minutes on one. Grab what you can, then walk out through an exit.',
      'Walk out and you keep it all. If your team faints or the clock runs out, the pack is lost.',
      'Every raid starts at the RAID ARENA, west across the yard.',
    ],
  },
  // Said in the great hall by its own keeper, when spoken to, in the room's
  // dialogue box (`BaseScene.speakToMarshal`): the captain did not want Oak's
  // voice along the foot of the screen on arriving at the Arena.
  loadout: {
    speaker: ARENA_KEEPER_DESIGN,
    name: ARENA_KEEPER_NAME,
    lines: [
      'Everything for a raid is in this room. Walk up to it and press.',
      'The BENCH is who comes with you. The RACK is what you carry.',
      'Pack Poké Balls: throw one at a weakened wild Pokémon to keep it.',
      'A caught Pokémon takes 4 squares of the pack or more, so leave room!',
      'The LOCKER holds what comes home even if you lose everything else.',
      'When you are ready, walk round the rim and jump in over the fence.',
    ],
  },
  // Said the first time a player looks down from the rim, over the panel that
  // starts the raid: the last thing a newcomer reads before it does.
  check: {
    speaker: ARENA_KEEPER_DESIGN,
    name: ARENA_KEEPER_NAME,
    lines: [
      'That is Greystone Vale. The cloud is whatever you have not walked yet.',
      'Each light down there is a way in. Walk the rim, or pick one here.',
      'What is not in your locker is lost if your team faints or the clock runs out.',
      'And a rival hunter comes looking once you set off. If they catch you, you fight.',
    ],
  },
  center: {
    speaker: 'nurse-joy',
    name: 'Nurse Joy',
    lines: [
      'Welcome to the Pokémon Center! Your Pokémon rest here between raids.',
      'I can heal anyone hurt or fainted. The time it takes comes off your next raid’s clock.',
      'A status like PAR or PSN stays on until it is treated, so do come and see me.',
    ],
  },
};

/** The base screens, as `HubScene` names them, that have first words of their own. */
export type FirstWordsView = 'home' | 'stash' | 'rim' | (string & {});

/**
 * Which first words belong to the screen the player is looking at: the lab, the
 * rim of THE RAID ARENA's pit, or the Pokemon Center. The bench, the rack and
 * the locker say nothing over themselves, because the marshal who stands beside
 * them says what they are for, in the hall.
 */
export function firstWordsFor(view: FirstWordsView): FirstWordsId | undefined {
  if (view === 'home') return 'lab';
  if (view === 'stash') return 'center';
  if (view === 'rim') return 'check';
  return undefined;
}

/** The lines as said to this player: the greeting by name, else without one. */
export function spokenLines(words: FirstWords, playerName: string | null): readonly string[] {
  if (words.greeting === undefined) {
    return words.lines;
  }
  const [first = '', ...rest] = words.lines;
  const ah = playerName ? `Ah, ${playerName}, ${words.greeting}` : `Ah, ${words.greeting}`;
  return [`${ah} ${first}`.trim(), ...rest];
}

/** Whether a save has already heard these words. */
export function hasHeard(heard: readonly string[] | undefined, id: FirstWordsId): boolean {
  return (heard ?? []).includes(id);
}

export function isFirstWordsId(value: unknown): value is FirstWordsId {
  return typeof value === 'string' && (FIRST_WORDS_IDS as readonly string[]).includes(value);
}
