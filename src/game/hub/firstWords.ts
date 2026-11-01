import type { CharacterDesignId } from '../world/characterDesigns';
import { isMapRetired } from '../world/mapRoster';

/**
 * What Professor Oak, Nurse Joy and the Raid Arena's marshal say the first time
 * they are spoken to, and never again.
 *
 * Playtest 43 played the first hour as somebody who had never met either a
 * Pokemon game or an extraction game, and lost them at about fifty-four
 * minutes: nothing had ever said what a raid is, what a wipe takes, that a catch
 * takes room in the pack, or that healing is paid for out of the next raid's
 * clock. Every one of those facts was on a screen somewhere; none of them was
 * said by anybody. So the people a newcomer meets first speak a few lines, once,
 * the way the games this is dressed as do.
 *
 * They say it in their own room's dialogue box, before anything opens
 * (`BaseScene.speakToKeeper`). It used to be a bar along the foot of a screen,
 * and the captain's word for that (30 Oct 2026) was disengaged: the rooms are
 * the game, and a notification over a menu is what the harbour was built to end.
 *
 * Once means once per save. A set of words is recorded as heard at the moment
 * it is shown (`SaveManager.hearFirstWords`), as the opening fight's lesson is,
 * so leaving without reading it does not buy a second hearing - and the save
 * keeps only the list of ids, as it keeps every other permanent fact.
 */
export const FIRST_WORDS_IDS = ['lab', 'loadout', 'center', 'workshop', 'cottage', 'moved'] as const;
export type FirstWordsId = (typeof FIRST_WORDS_IDS)[number];

export interface FirstWords {
  /** Who is speaking: a named design, drawn the way the overworld draws them. */
  readonly speaker: CharacterDesignId;
  readonly name: string;
  /** A few short lines, each one fact a newcomer needs. */
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
      'On a raid, grab what you can and walk out through an exit.',
      'Faint, or run out of clock, and the pack is lost.',
      'Every raid starts at the RAID ARENA, west across the yard.',
    ],
  },
  // Said in the great hall by its own keeper, when spoken to, in the room's
  // dialogue box. She has it to say from the first raid's coming home: nothing
  // here is needed to go over the fence the first time, and all of it means
  // something once somebody has been.
  loadout: {
    speaker: ARENA_KEEPER_DESIGN,
    name: ARENA_KEEPER_NAME,
    lines: [
      'Everything for a raid is in this room. Walk up to it and press.',
      'The BENCH is who comes with you. The RACK is what you carry.',
      'The LOCKER comes home whatever happens. A catch takes 4 squares or more, so leave room.',
      'The cloud in the pit is whatever you have not walked yet.',
      'And a rival hunter comes looking. If they catch you, you fight.',
    ],
  },
  center: {
    speaker: 'nurse-joy',
    name: 'Nurse Joy',
    lines: [
      'Welcome to the Pokémon Center! Your Pokémon rest here between raids.',
      'I can heal anyone hurt or fainted. The time it takes comes off your next raid’s clock.',
      'A status like PAR or PSN stays on until it is treated, so do come and see me.',
      'Your boxes and everything you have banked are on BILL’S PC, over by the wall.',
    ],
  },
  workshop: {
    speaker: 'brock',
    name: 'Brock',
    lines: [
      'I build things into this base, and they stay built.',
      'Every bay with chalk in it is something I can put there.',
      'Walk up to the chalk and ask. I take materials from raids, nothing else.',
    ],
  },
  cottage: {
    speaker: 'bill',
    name: 'Bill',
    lines: [
      'Ah, a visitor! Everything on these shelves came off my boat.',
      'Walk up to anything and ask, and I will name my price.',
      'Under a sheet is what I keep back until I know you better.',
    ],
  },
  // Said in the yard, once, to somebody back from before the old maps were put
  // away: cloud over one map and nothing to say why read as a lost save.
  moved: {
    speaker: 'prof-oak',
    name: 'Professor Oak',
    lines: [
      'Oak on the radio: welcome back! A lot has moved while you were gone.',
      'The Floodplain, Route 1 and the rest are shut for now.',
      'Every raid goes into GREYSTONE VALE, from the RAID ARENA as ever.',
      'Your team and everything you banked are all still here.',
    ],
  },
};

/** Whether this save raided the maps since put away (`world/mapRoster.ts`) and has not yet been told. */
export function mapsMovedNews(progress: {
  readonly firstWordsHeard?: readonly string[];
  readonly raidRecord?: Readonly<Record<string, { readonly deployed: number }>>;
}): boolean {
  return (
    !hasHeard(progress.firstWordsHeard, 'moved') &&
    Object.entries(progress.raidRecord ?? {}).some(([mapId, record]) => isMapRetired(mapId) && record.deployed > 0)
  );
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
