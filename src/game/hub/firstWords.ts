import type { CharacterDesignId } from '../world/characterDesigns';
import type { DeploymentStep } from './deploymentFlow';

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
export const FIRST_WORDS_IDS = ['lab', 'loadout', 'dropin', 'check', 'center'] as const;
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

export const FIRST_WORDS: Readonly<Record<FirstWordsId, FirstWords>> = {
  lab: {
    speaker: 'prof-oak',
    name: 'Professor Oak',
    greeting: 'there you are!',
    lines: [
      'Out there are maps full of loot and wild Pokémon.',
      'A raid is a few minutes on one. Grab what you can, then walk out through an exit.',
      'Walk out and you keep it all. If your team faints or the clock runs out, the pack is lost.',
    ],
  },
  loadout: {
    speaker: 'prof-oak',
    name: 'Professor Oak',
    lines: [
      'Choose who comes with you, and what goes in the pack.',
      'Pack Poké Balls: throw one at a weakened wild Pokémon to bring it home.',
      'Leave room, though. A caught Pokémon takes 4 squares of the pack, or more.',
    ],
  },
  dropin: {
    speaker: 'prof-oak',
    name: 'Professor Oak',
    lines: [
      'Now, where to drop in. A map stays dark until you have walked it.',
      'The higher the grade, the stronger the Pokémon there. Grade 1 is the gentlest.',
    ],
  },
  check: {
    speaker: 'prof-oak',
    name: 'Professor Oak',
    lines: [
      'LOST IF YOU WIPE is what goes if your team faints or the clock runs out - Pokémon from base too.',
      'Only what COMES HOME is safe. That is your secure slot.',
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

/** The base screens, as `HubScene` names them, that have first words. */
export type FirstWordsView = 'home' | 'stash' | 'deploy' | (string & {});

/**
 * Which first words belong to the screen the player is looking at: the lab, a
 * step of preparation, or the Pokemon Center. The secure slot is a detour off
 * the loadout rather than a screen of its own, so it says nothing.
 */
export function firstWordsFor(view: FirstWordsView, step: DeploymentStep): FirstWordsId | undefined {
  if (view === 'home') return 'lab';
  if (view === 'stash') return 'center';
  if (view !== 'deploy') return undefined;
  if (step === 'loadout') return 'loadout';
  if (step === 'dropin') return 'dropin';
  if (step === 'confirm') return 'check';
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
