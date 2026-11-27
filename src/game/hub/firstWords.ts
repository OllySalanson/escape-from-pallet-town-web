import { ENRAGE_GRACE_MS } from '../run/RunManager';
import type { CharacterDesignId } from '../world/characterDesigns';
import { isMapRetired } from '../world/mapRoster';
import { landingsHeldBack, quarterOfLanding } from '../world/valeQuarters';

/**
 * What somebody says once, the first time it is true, and never again: Oak as
 * he hands the partner over, the news in the yard of a map put away or a
 * landing held back, the radio's word at a minute left, the Gym Guide's on the
 * stakes and on a gym's honour worn, and the rail's on a catch at base.
 *
 * Playtest 43 lost a newcomer at about fifty-four minutes because nothing had
 * ever said what a raid is, so the people a newcomer met first spoke a few
 * lines, once. The keepers no longer do: a keeper at a counter says one fixed
 * greeting and opens what they keep, as a FireRed clerk or nurse does
 * (`hub/keeperGreetings.ts`), because their first speeches were four to six
 * boxes of rules in front of the thing the player came in for (the harbour
 * audit, 27 Nov 2026). What those speeches explained is shown where it is true:
 * a price in the question that spends it, a greyed card, a padlock.
 *
 * Once means once per save. A set of words is recorded as heard at the moment
 * it is shown (`SaveManager.hearFirstWords`), as the opening fight's lesson is,
 * so leaving without reading it does not buy a second hearing - and the save
 * keeps only the list of ids, as it keeps every other permanent fact. An id no
 * longer said ('loadout', 'center', 'workshop', 'cottage', 'nearWork', which
 * the keepers had) is dropped from an old save as it loads (`isFirstWordsId`),
 * and nothing else about that save changes.
 */
export const FIRST_WORDS_IDS = ['lab', 'moved', 'coast', 'marsh', 'benchCatch', 'enraged', 'stakes', 'cascadeWorn', 'soulWorn'] as const;
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
      // Fainting and 0:00 are said where they are true, not here, before the
      // player has a pack, a hunter or a clock (the critic's problem 7): the
      // first catch says what a faint costs (`world/firstCatch.ts`), and the
      // first raid to reach 1:00 left says what 0:00 does (`FIRST_WORDS.enraged`).
      'Every raid starts at the RAID ARENA, west across the yard.',
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
  // Said in the yard, once, to somebody who walked to the Old Quay or the Cove
  // Steps before Misty's gym held the Coast: the landing went off the rim, and
  // one line says why and what brings it back (`world/valeQuarters.ts`).
  coast: {
    speaker: 'prof-oak',
    name: 'Professor Oak',
    lines: [
      'Oak on the radio: Misty holds the Coast from her gym on Gull Strand now. Beat her, and the Old Quay and the Cove Steps are yours again.',
    ],
  },
  // The same news for the Marsh, once Koga's gym in Tanglewood held it: the
  // Rest House and the Salvage Camp went off the rim for anybody who had
  // walked to them before.
  marsh: {
    speaker: 'prof-oak',
    name: 'Professor Oak',
    lines: [
      'Oak on the radio: Koga holds the Marsh from his gym in Tanglewood now. Beat him, and the Rest House and the Salvage Camp are yours again.',
    ],
  },
  // Said by the Gym Guide the first time he is spoken to wearing a gym's
  // honour (`base/gymGuide.ts`, `look/gymHonours.ts`): the brag, noticed, and
  // the one thing to know about it - everybody sees it.
  cascadeWorn: {
    speaker: 'gym-guide',
    name: 'The Gym Guide',
    lines: [
      "Whoa! Is that MISTY's CASCADE NECKERCHIEF? You beat her!",
      'Everybody in the harbour sees it on you, and her badge on your name plate too!',
      'Rather keep it quiet? YOUR WARDROBE in THE BOLTHOLE takes it off.',
    ],
  },
  soulWorn: {
    speaker: 'gym-guide',
    name: 'The Gym Guide',
    lines: [
      "No way... KOGA's SOUL BAND! You beat the ninja himself!",
      "His badge is on your name plate now. Folk can't miss it!",
    ],
  },
  // Said at the rail, once, before a lone Pokemon goes over with a catch at
  // base (`hub/benchOffer.ts`): the reason to take it, before the question.
  benchCatch: {
    speaker: ARENA_KEEPER_DESIGN,
    name: ARENA_KEEPER_NAME,
    lines: ["Your new catch is waiting at base. Take two, and one faint won't end the raid."],
  },
  // Said on the radio, once, the first time any raid reaches a minute left
  // (`WorldScene.warnOfEnrage`): what 0:00 does, while it is about to be true.
  // Four AI newcomers waited out the clock expecting the raid to end and met
  // an ENRAGED hunter with nothing having said what that was (22 Nov 2026).
  enraged: {
    speaker: 'prof-oak',
    name: 'Professor Oak',
    lines: [`OAK: One minute left! At 0:00 the hunters turn ENRAGED, and you've ${ENRAGE_GRACE_MS / 1000} seconds to get out. Head for an exit!`],
  },
  // Said by the Gym Guide on THE RAID ARENA's forecourt, the first time he is
  // spoken to after a raid (`base/gymGuide.ts`). Until then no survey job is
  // dealt (`objectives/standingBoard.ts`): the captain was offered "read all 3
  // survey stakes" from his second raid and was only told what one was on his
  // fifth (25 Nov 2026). He wears the harbour's "!" while he has it to say.
  stakes: {
    speaker: 'gym-guide',
    name: 'GYM GUIDE',
    lines: [
      "Yo, champ! Seen PROFESSOR OAK's survey stakes out in the vale?",
      'Wooden posts he hammers in to map it. Stand on one to read it.',
      "Read every one, then get out: that's a LINE SURVEY done.",
      "Now you know, he'll put survey jobs on the board for you.",
    ],
  },
};

/** The news a quarter's held-back landings are told with, by the quarter's id (`world/valeQuarters.ts`). */
const HELD_LANDING_NEWS: Readonly<Record<string, FirstWordsId>> = { 'the-coast': 'coast', 'the-marsh': 'marsh' };

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

/**
 * The news this save is owed about a landing its badges do not open - walked to
 * before the gym held the quarter - one quarter at a time:
 * the words for the first quarter it has a landing held back in and has not yet
 * been told about, or nothing.
 */
export function heldLandingNews(progress: {
  readonly firstWordsHeard?: readonly string[];
  readonly reachedInsertions: readonly string[];
  readonly unlockedInsertions?: readonly string[];
  readonly defeatedBosses: readonly string[];
  readonly openedGates?: readonly string[];
}): FirstWordsId | undefined {
  return landingsHeldBack(progress)
    .map((landing) => HELD_LANDING_NEWS[quarterOfLanding(landing)?.id ?? ''])
    .find((id) => id !== undefined && !hasHeard(progress.firstWordsHeard, id));
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
