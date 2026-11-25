import type { ItemId } from '../items';
import { formatMoney } from '../items/items';
import { STEP_DURATION_MS } from '../movement/stepClock';
import type { GridPosition } from '../movement/gridMovement';
import type { WorldMapId } from '../worldMap';
import { formatGap, formatRaceTime } from './raceClock';
import type { CastCharacterDesignId } from './characterDesigns';
import type { RaceTrail } from './raceGhost';

/**
 * A townsperson who says "I'll race you!" - and means it.
 *
 * **What a race is for.** Knowing the map. The racer runs the way the village
 * is signed - roads, streets, plank walks, never a blade of grass
 * (`raceLine.ts`) - at exactly the player's own pace, so a newcomer who
 * follows them loses by a nose and sees them ahead the whole way. Everything
 * the player knows that is not a road beats them: the reeds' dry way, and,
 * for whoever brings a Cut, a ride through the pines nobody has walked in
 * years. It is the same lesson the whole game teaches, in twenty seconds.
 *
 * **Three marks, read off the clock.** BRONZE is beating the racer. SILVER is a
 * time only the reeds' dry way run clean makes, and GOLD one only the Cut line
 * makes - each par a few tiles of slack over the best that line can do
 * (`races.test.ts` measures every line against the real map, so a redraw that
 * moves a par is seen). A wild fight on the way costs what it costs in game
 * time (`raceClock.ts`), so a medal wants a quick flee or a Repel.
 *
 * **What it pays, and why so little a raid.** Every course so far finishes
 * near a way out of the map, and a race and a walk out would otherwise be a
 * payday on exactly the ground `raidStake.ts` keeps empty. So a raid's race
 * pays what walking straight out already pays - a coin for taking part, a
 * little more for winning - and the reward is once a day: the first GOLD of the
 * day takes the day's purse, an evolution stone of the player's own choosing.
 * That is the captain's rule for a Cut shortcut (25 Nov 2026: worth at least
 * double what Cut costs, so finding it is a thing to be proud of and to come
 * back to): HM01 is a linen roll and a parts crate at Bill's, and a stone is
 * five materials there (`hub/trader.ts`), two and a half times as much. The
 * first GOLD ever adds the course's trophy. All of it rides home in the pack
 * like any find, and a raid that does not walk out has not won it: the purse
 * and the trophy are written down only when a raid banks them.
 *
 * Once a raid. The racer stands from a save's second raid on - the first raid
 * is the staged chase, and nothing should crowd it.
 */

export type RaceMedal = 'gold' | 'silver' | 'bronze';

export interface RaceCourse {
  readonly id: string;
  readonly mapId: WorldMapId;
  /** What the course is called. */
  readonly name: string;
  readonly racer: {
    /** What the racer is called, in the capitals the dialogue names people in. */
    readonly name: string;
    /** How they are drawn: the look the map file gives the person who stands for them. */
    readonly design: CastCharacterDesignId;
    /** Where they stand to be asked: a person the map file places here. */
    readonly stands: GridPosition;
    /** Where they wait once over the line: off the planks, so nobody is blocked. */
    readonly waits: GridPosition;
    /**
     * The chalk mark the player toes before the count, beside them. Every line,
     * par and floor is measured from here, so which side the race was asked
     * from decides nothing (`races.test.ts`).
     */
    readonly mark: GridPosition;
    /**
     * Ground they never take, even once they know the map: the shortcut that is
     * the player's to find. The woodcutter's ride is grown shut for them, Cut or no Cut.
     */
    readonly keepsOff: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  };
  /**
   * Who stands at the line with a stopwatch and calls the time: a person the
   * map file places by it, who holds what a winner's pack had no room for.
   */
  readonly judge: { readonly name: string; readonly at: GridPosition };
  readonly finish: {
    /** The place the line is at, as the racer names it. */
    readonly name: string;
    /** Where that is, in words a newcomer can walk to. */
    readonly where: string;
    /** The line: stepping onto any of these crosses it. */
    readonly tiles: readonly GridPosition[];
  };
  /** Under this is SILVER: the reeds' dry way, run clean. */
  readonly silverMs: number;
  /** Under this is GOLD: only the Cut line. */
  readonly goldMs: number;
  /**
   * The floor: the fewest steps there are, from the best side of the racer, at
   * a step a tile - no fight, no stop, no wasted tile. A grid has no faster
   * line, so this is the last thing there is to chase (`races.test.ts` measures
   * it). On THE MERE DASH it is down the ride and then straight through the
   * reeds - two dozen wild tiles, so only a Repel makes it more than a dice roll.
   */
  readonly perfectMs: number;
  /** The trophy the first SILVER or better ever adds: something to put on a shelf. */
  readonly trophy: ItemId;
  /** What the first PERFECT a raid gets home adds: the rarest thing in the house. */
  readonly perfectTrophy: ItemId;
  /**
   * What the racer says next time it is worth knowing: to a loser who stuck to
   * their road, to one who left it and fought, to one who left it and was
   * slower anyway, to a winner who has not found the shortcut - and, once they
   * have learned the dry way themselves, to one who lost to them on it.
   */
  readonly hints: {
    readonly road: string;
    readonly fights: string;
    readonly longWay: string;
    readonly shortcut: string;
    /** The shortcut hint once its door is open: it is no longer grown shut. */
    readonly shortcutOpen: string;
    readonly learned: string;
  };
  /**
   * Who about the place talks about the race once a save has beaten the racer,
   * and what they say instead: the village noticing is half of being proud of it.
   */
  readonly gossip: readonly RaceGossip[];
}

/** A person or sign that says something else once the racer has been beaten. */
export interface RaceGossip {
  readonly at: GridPosition;
  /** What they say now, given the record and what they used to say. */
  readonly says: (record: RaceRecord, own: readonly string[]) => string[];
}

/**
 * THE MERE DASH: LINNET, from the alley mouth below Mill Square to THE LAST
 * HOUSE at the far end of the reeds. Her road goes down the lane and round the
 * whole mere on the boardwalk (153 steps); the reeds' dry way leaves the lane
 * across the wildfowlers' meadow (104 steps, five of them wild grass); the Cut
 * line goes west of the millpond, through the woodcutter's glade and down the
 * woodcutter's ride (68). Once a save has a SILVER she knows the dry way too,
 * and only the ride beats her. See `races.test.ts` for the measurements.
 */
export const MERE_DASH: RaceCourse = {
  id: 'mere-dash',
  mapId: 'greystone-vale',
  name: 'THE MERE DASH',
  racer: {
    name: 'LINNET',
    design: 'cooltrainer-woman',
    stands: { x: 84, y: 169 },
    waits: { x: 70, y: 220 },
    mark: { x: 83, y: 169 },
    keepsOff: { x: 82, y: 188, width: 2, height: 14 },
  },
  judge: { name: 'OLD REEVE', at: { x: 74, y: 220 } },
  finish: {
    name: 'THE LAST HOUSE',
    where: 'at the far end of the reeds',
    tiles: [
      { x: 72, y: 218 },
      { x: 72, y: 219 },
    ],
  },
  silverMs: 16_500,
  goldMs: 11_000,
  perfectMs: 9_300,
  trophy: 'silver-shield',
  // Found only on the Floodplain, which is put away: the race is its one way now.
  perfectTrophy: 'glass-ornament',
  hints: {
    road: 'You stuck to my boardwalk. Everybody does! The reeds have a dry way through, if you look.',
    fights: "The reeds are quick - but I don't stop while you fight in them. Find the dry way, or pack a Repel.",
    longWay: 'You left my boardwalk and still came in behind me? The dry way through the reeds is straighter than that.',
    shortcut:
      "Nobody gets under 0:11.0 through the reeds. There's an old ride through the pines behind the woodcutter's - grown shut. Bill trades a Cut disc for a linen roll and a parts crate.",
    shortcutOpen:
      "Nobody gets under 0:11.0 through the reeds. The woodcutter's ride's open now, mind - straight down through the pines.",
    learned:
      "My dry way now, too! Through the reeds you'll never beat me. The woodcutter's ride - that one's yours.",
  },
  gossip: [
    {
      // Pip, her little brother, on the square.
      at: { x: 88, y: 162 },
      says: (record) => [
        'Race you to the fountain!',
        record.perfect
          ? 'Somebody ran the mere in 0:09.3. LINNET says it cannot be done faster. She has taken up knitting.'
          : record.medal === 'gold'
          ? 'Somebody beat my sister LINNET by miles. Through the WOODS. She has not stopped talking about it.'
          : 'My sister LINNET says somebody beat her to the mere. She practises every night now. It was you, wasn\u2019t it.',
      ],
    },
    {
      // The Mill Square sign's last line is the race's notice.
      at: { x: 101, y: 157 },
      says: (record, own) => [
        ...own.filter((line) => !line.startsWith('RACES:')),
        `RACES: ask LINNET, by the alley. Course record: ${record.bestMs === undefined ? '-' : formatRaceTime(record.bestMs)}${
          record.perfect ? ' PERFECT' : record.medal ? ` ${MEDAL_WORDS[record.medal]}` : ''
        }. She is furious.`,
      ],
    },
  ],
};

export const RACE_COURSES: readonly RaceCourse[] = [MERE_DASH];

/** The course whose racer stands on this tile, if any. */
export function courseStartedAt(mapId: WorldMapId, tile: GridPosition): RaceCourse | undefined {
  return RACE_COURSES.find(
    (course) => course.mapId === mapId && course.racer.stands.x === tile.x && course.racer.stands.y === tile.y,
  );
}

/** What a person or sign at `tile` says about a race this save has won, if they talk about it. */
export function raceGossipAt(
  mapId: WorldMapId,
  tile: GridPosition,
  records: Readonly<Record<string, RaceRecord>> | undefined,
  own: readonly string[],
): string[] | undefined {
  for (const course of RACE_COURSES) {
    const record = records?.[course.id];
    if (course.mapId !== mapId || !record || record.wins === 0) continue;
    const gossip = course.gossip.find((one) => one.at.x === tile.x && one.at.y === tile.y);
    if (gossip) return gossip.says(record, own);
  }
  return undefined;
}

export function courseById(id: string): RaceCourse | undefined {
  return RACE_COURSES.find((course) => course.id === id);
}

/** Whether stepping onto `tile` crosses the course's line. */
export function crossesLine(course: RaceCourse, tile: GridPosition): boolean {
  return course.finish.tiles.some((line) => line.x === tile.x && line.y === tile.y);
}

/** How long the racer takes over a line of so many tiles: the player's own pace. */
export function racerTimeMs(lineTiles: number): number {
  return Math.max(0, lineTiles - 1) * STEP_DURATION_MS;
}

/** The mark a crossing earns: null for one that did not beat the racer. */
export function raceMedal(course: RaceCourse, timeMs: number, beatRacer: boolean): RaceMedal | null {
  if (!beatRacer) {
    return null;
  }
  if (timeMs < course.goldMs) {
    return 'gold';
  }
  return timeMs < course.silverMs ? 'silver' : 'bronze';
}

const MEDAL_RANK: Readonly<Record<RaceMedal, number>> = { bronze: 1, silver: 2, gold: 3 };

/** The better of two marks. */
export function betterMedal(a: RaceMedal | undefined, b: RaceMedal | null | undefined): RaceMedal | undefined {
  if (!b) return a;
  if (!a) return b;
  return MEDAL_RANK[b] > MEDAL_RANK[a] ? b : a;
}

export const MEDAL_WORDS: Readonly<Record<RaceMedal, string>> = { gold: 'GOLD', silver: 'SILVER', bronze: 'BRONZE' };

/** A race the player crossed: who was first, and the clock. */
export type RaceOutcome = 'won' | 'lost' | 'late';

/** P for crossing the line behind the racer, before they have gone home. */
export const TAKING_PART_MONEY = 10;
/** P for beating them, by the mark: a GOLD is the run worth coming back for every raid. */
export const MEDAL_MONEY: Readonly<Record<RaceMedal, number>> = { bronze: 30, silver: 40, gold: 60 };

/** The five stones the day's purse can be, in Bill's order. */
export const PURSE_STONES: readonly ItemId[] = ['thunder-stone', 'fire-stone', 'water-stone', 'leaf-stone', 'moon-stone'];

/** What a crossing pays, given what this save has already had. */
export interface RacePrize {
  readonly money: number;
  /** The day's purse: a stone the player chooses. */
  readonly purse: boolean;
  /** The course's trophy, for the first SILVER or better ever. */
  readonly trophy: boolean;
}

export interface RaceRecordView {
  /** The day's purse has already gone home with a raid today. */
  readonly purseTakenToday: boolean;
  /** A raid has banked the trophy. */
  readonly trophyBanked: boolean;
}

export function racePrize(outcome: RaceOutcome, medal: RaceMedal | null, record: RaceRecordView): RacePrize {
  if (outcome === 'late') {
    return { money: 0, purse: false, trophy: false };
  }
  return {
    money: outcome === 'won' && medal ? MEDAL_MONEY[medal] : TAKING_PART_MONEY,
    purse: medal === 'gold' && !record.purseTakenToday,
    trophy: (medal === 'gold' || medal === 'silver') && !record.trophyBanked,
  };
}

/**
 * Whether the racer runs the reeds' dry way rather than their road: once a save
 * has beaten them off it with a SILVER or better, AND the shortcut that stays
 * the player's is open to them. It is the race's ladder - road, reeds, ride -
 * and it keeps the race close for whoever is on its next rung; but a rung is
 * only put above a player who can climb it. Learned before the ride is open,
 * a SILVER would buy a wall: every race lost by a step, for as long as Cut
 * took to come by.
 */
export function racerKnowsTheWay(record: RaceRecord | undefined, shortcutOpen: boolean): boolean {
  return shortcutOpen && (record?.medal === 'silver' || record?.medal === 'gold');
}

/** A crossing within this of the racer's is a photo finish, and said as one. */
export const PHOTO_FINISH_MS = 100;

/** A time as the screen says it: to the tenth below. Every judgement is of what was shown. */
export function shownTenths(ms: number): number {
  return Math.floor(Math.max(0, ms) / 100);
}

/**
 * Who crossed first, judged on the tenth the screen shows: a dead heat is the
 * player's - they were the one racing somebody who knows the way - and a frame
 * the clock happened to take nobody can see does not lose it.
 */
export function raceOutcome(timeMs: number, racerMs: number): 'won' | 'lost' {
  return shownTenths(timeMs) <= shownTenths(racerMs) ? 'won' : 'lost';
}

/** The player's own calendar day, which is what "today's purse" means. */
export function raceDay(now: Date): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** What a save remembers about one course (`RaidProgress.races`). */
export interface RaceRecord {
  readonly runs: number;
  readonly wins: number;
  readonly bestMs?: number;
  readonly medal?: RaceMedal;
  /** The day a raid last banked the purse. */
  readonly purseDay?: string;
  /** A raid has banked the trophy. */
  readonly trophy?: true;
  /** Where the best run went and when (`raceGhost.ts`): raced again as a see-through you. */
  readonly ghost?: RaceTrail;
  /** A PERFECT has been run: the floor, not a step wasted. Written at the line. */
  readonly perfect?: true;
  /** A raid has banked the PERFECT trophy. */
  readonly perfectTrophy?: true;
}

// -- What the racer says ---------------------------------------------------------

/**
 * The offer, up to the question: who, where the line is, and what it pays -
 * short, once it is known, and shorter again to a player who said NO a moment ago.
 */
export function raceOfferLines(
  course: RaceCourse,
  record: RaceRecord | undefined,
  purseTakenToday: boolean,
  shortcutOpen: boolean,
  askedThisRaid = false,
): string[] {
  const racer = course.racer.name;
  if (askedThisRaid) {
    return [`${racer}: Changed your mind?`];
  }
  const purse = purseTakenToday
    ? "Today's purse is gone - come back tomorrow for it."
    : `Under ${formatRaceTime(course.goldMs)} takes today's purse: any evolution stone you like.`;
  if (!record || record.runs === 0) {
    return [
      `${racer}: I'll race you! First to ${course.finish.name}, ${course.finish.where} - the line's by its door.`,
      `Beat me: ${formatMoney(MEDAL_MONEY.bronze)}. Lose: ${formatMoney(TAKING_PART_MONEY)} for the legs. ${purse}`,
    ];
  }
  const best = record.bestMs === undefined ? '' : ` Your best: ${formatRaceTime(record.bestMs)}${record.medal ? ` ${MEDAL_WORDS[record.medal]}` : ''}.`;
  const learned = racerKnowsTheWay(record, shortcutOpen) ? " I've been practising - I know the reeds' dry way now too." : '';
  return [`${racer}: Back for more?${best}${learned}`, purse];
}

/** The captain's question, word for word. */
export function raceQuestion(course: RaceCourse): string {
  return `Do you want to race ${course.racer.name} to ${course.finish.name}?`;
}

export const RACE_ANSWERS: readonly string[] = ['YES', 'NO'];

export function raceDeclinedLine(course: RaceCourse): string {
  return `${course.racer.name}: Scared? I'll be here.`;
}

/** On a save's first raid: the racer is there, and wants the player home first. */
export function raceNotYetLines(course: RaceCourse): string[] {
  return [`${course.racer.name}: Get home in one piece first. THEN I'll race you.`];
}

export interface RaceResultInput {
  readonly outcome: RaceOutcome;
  /** Game time spent fighting on the way. */
  readonly fightMs: number;
  /** Whether the player left the racer's road. */
  readonly offRoad: boolean;
  /** Whether the racer ran the reeds' dry way this race. */
  readonly racerKnew: boolean;
  /** Whether the player came down the shortcut that stays theirs (`RaceCourse.racer.keepsOff`). */
  readonly tookShortcut: boolean;
  /** Whether the shortcut's door is open: what the racer says about it changes. */
  readonly shortcutOpen: boolean;
  /** Whether the save had no GOLD before this run. */
  readonly firstGold: boolean;
  /** Whether the save has run a PERFECT before. */
  readonly hadPerfect: boolean;
  /** Steps the run took, from its trail (`raceRunShape`). */
  readonly steps?: number;
  /** How long the player stood still after GO before their first step. */
  readonly startLagMs?: number;
  /** Whether the save had beaten the racer before. */
  readonly beatenBefore: boolean;
  readonly timeMs: number;
  readonly racerMs: number;
  readonly medal: RaceMedal | null;
  readonly newBest: boolean;
  readonly prize: RacePrize;
}

/** Whether a time is the floor: not a step wasted. */
export function isPerfect(course: RaceCourse, timeMs: number): boolean {
  return shownTenths(timeMs) <= shownTenths(course.perfectMs);
}

/** The big word over the screen at the line: the mark and the time, or the place. */
export function raceLineWord(course: RaceCourse, input: { readonly medal: RaceMedal | null; readonly timeMs: number }): string {
  const mark = input.medal === 'gold' && isPerfect(course, input.timeMs) ? 'PERFECT' : input.medal ? MEDAL_WORDS[input.medal] : '2ND';
  return `${mark} ${formatRaceTime(input.timeMs)}`;
}

/** How a gap is said: a whisker is a photo finish. */
function gapWords(gapMs: number): string {
  return gapMs < PHOTO_FINISH_MS ? 'by a whisker' : `by ${formatGap(gapMs)}`;
}

/** The gap between two times as the screen shows them, so it always adds up: 0:23.0 against 0:22.8 is 0.2s. */
export function shownGap(later: number, earlier: number): number {
  return Math.max(0, shownTenths(later) - shownTenths(earlier)) * 100;
}

/**
 * The player over the line first: the judge calls it, and pays out of the
 * racer's winnings - the racer is still out on the course, and is heard from
 * when they run in (`racerArrivesLines`).
 */
export function judgeLines(course: RaceCourse, input: RaceResultInput): string[] {
  const judge = course.judge.name;
  const racer = course.racer.name;
  const fought = input.fightMs > 0 ? ` - ${formatGap(input.fightMs)} of it fighting` : '';
  const photo = shownGap(input.racerMs, input.timeMs) < PHOTO_FINISH_MS ? 'Photo finish - and it\u2019s yours! ' : 'Over the line! ';
  const mark =
    input.medal === 'gold' && isPerfect(course, input.timeMs)
      ? ' GOLD - and PERFECT.'
      : input.medal
        ? ` ${MEDAL_WORDS[input.medal]}!`
        : '';
  return [
    `${judge}: ${photo}${formatRaceTime(input.timeMs)}${fought}.${mark}${input.newBest ? ' A new best.' : ''}`,
    `${racer} left your winnings with me: ${formatMoney(input.prize.money)}.`,
  ];
}

/** What the racer says as they run in behind a player who beat them. */
export function racerArrivesLines(course: RaceCourse, input: RaceResultInput): string[] {
  const racer = course.racer.name;
  const behind = gapWords(shownGap(input.racerMs, input.timeMs));
  if (input.medal === 'gold' && isPerfect(course, input.timeMs)) {
    return [`${racer}: Not a step wasted. I watched. I'm going to be sick.`];
  }
  const tip = perfectTip(course, input);
  if (input.medal === 'gold') {
    if (input.firstGold) {
      return [
        `${racer}: Through the woodcutter's ride?! Nobody's been up there in years. That's the best run I've ever seen.`,
        ...(tip ? [`${racer}: ${tip}`] : []),
      ];
    }
    if (tip) {
      return [`${racer}: So close to PERFECT! ${tip}`];
    }
    return [
      input.hadPerfect
        ? `${racer}: GOLD again. You've done it in ${formatRaceTime(course.perfectMs)} before, so don't look so pleased.`
        : `${racer}: GOLD again. ${formatRaceTime(course.perfectMs)} is as fast as anybody could go - straight through the reeds. Spray a Repel first, or something will jump out.`,
    ];
  }
  if (input.tookShortcut) {
    const missed = input.fightMs > 0 ? 'Stop to fight and you lose it.' : "Don't stop once.";
    return [`${racer}: The ride! I KNEW it. Beat me ${behind}... ${formatRaceTime(course.goldMs)} is in there, you know. ${missed}`];
  }
  return [
    input.beatenBefore ? `${racer}: Again?! Beat me ${behind}. One of these days.` : `${racer}: How?! Beat me ${behind}... fair's fair.`,
    `${racer}: ${input.shortcutOpen ? course.hints.shortcutOpen : course.hints.shortcut}`,
  ];
}

/** The racer over the line first: they say it themselves, and pay the taking part. */
export function racerWonLines(course: RaceCourse, input: RaceResultInput): string[] {
  const racer = course.racer.name;
  const fought = input.fightMs > 0 ? ` (${formatGap(input.fightMs)} of it fighting)` : '';
  // What lost it, the thing nearest the player first: the ride run and fought
  // on, then the way she has learned, then the reeds, then her road.
  const why = input.tookShortcut
    ? input.fightMs > 0
      ? "You found the ride - then stopped to fight in it. I don't stop."
      : 'The ride, and still behind me - by a hair. Come off the mark the moment I say GO.'
    : input.racerKnew
      ? course.hints.learned
      : input.fightMs > 0
        ? course.hints.fights
        : input.offRoad
          ? course.hints.longWay
          : course.hints.road;
  return [
    `${racer}: Beat you ${gapWords(shownGap(input.timeMs, input.racerMs))}! You: ${formatRaceTime(input.timeMs)}${fought}.${input.newBest ? ' A new best, mind.' : ''}`,
    `${racer}: ${why}`,
    `${racer} hands you ${formatMoney(input.prize.money)} for the legs.`,
  ];
}

/** The first PERFECT: what goes with it. */
export function perfectTrophyLine(course: RaceCourse, trophyName: string, again: boolean): string {
  return again
    ? `${course.judge.name}: Another PERFECT - and the ${trophyName.toUpperCase()} again. Get it home this time.`
    : `${course.judge.name}: A PERFECT. I've timed this line forty years and never written one down. Take the ${trophyName.toUpperCase()}.`;
}

/** Said on YES when the player is not on the chalk mark: the count waits for them. */
export function toeTheLineLine(course: RaceCourse, wasRiding: boolean): string {
  return `${course.racer.name}: ${wasRiding ? 'Off the bike! On foot, like everybody. ' : ''}Toe the chalk box beside me - the white one. We go when you're on it.`;
}

/** Talked to while lining up: where the mark is, and whether it is still on. */
export function callItOffQuestion(course: RaceCourse): string {
  return `${course.racer.name}: The white box beside me! Or shall we call it off?`;
}

export const CALL_IT_OFF_ANSWERS: readonly string[] = ['RACE', 'CALL IT OFF'];

/** Called off, by the player or by them wandering away: the racer asks again another time. */
export function calledOffLine(course: RaceCourse): string {
  return `${course.racer.name}: Suit yourself! Ask me again when you've got the legs.`;
}

/** Off the bike on the mark: said before the count. */
export function offTheBikeLine(course: RaceCourse): string {
  return `${course.racer.name}: Off the bike! On foot, like everybody.`;
}

/** How far a GOLD may miss PERFECT and still be told what it was. */
export const NEAR_PERFECT_MS = 200;

/** A start slower than this, after GO, is standing still: a held key goes in a frame or two. */
export const SLOW_START_MS = 60;

/** The floor in steps, which PERFECT is. */
function floorSteps(course: RaceCourse): number {
  return Math.round(course.perfectMs / STEP_DURATION_MS);
}

/**
 * What kept a near GOLD off PERFECT, read off the run rather than guessed: a
 * step over the floor, or a stand at GO. Null when it was neither, or not near.
 */
function perfectTip(course: RaceCourse, input: RaceResultInput): string | null {
  if (input.medal !== 'gold' || input.fightMs > 0 || isPerfect(course, input.timeMs)) return null;
  if (input.timeMs - course.perfectMs > NEAR_PERFECT_MS) return null;
  if (input.steps !== undefined && input.steps > floorSteps(course)) {
    return `A step too many - ${input.steps} where ${floorSteps(course)} will do.`;
  }
  if (input.startLagMs !== undefined && input.startLagMs > SLOW_START_MS) {
    return 'You stood still at GO. Hold your way through my count - go the instant I say it.';
  }
  return null;
}

/** How a run went, from its trail: how many steps, and how long it stood before the first. */
export function raceRunShape(trail: readonly number[]): { steps?: number; startLagMs?: number } {
  const points = trail.length / 3;
  if (points < 2) return {};
  return { steps: points - 1, startLagMs: Math.max(0, trail[5] - STEP_DURATION_MS) };
}

/** A wandered-off line-up, said as what happened: the racer is out of sight. */
export function gaveUpWaitingLine(course: RaceCourse): string {
  return `${course.racer.name} gave up waiting at the chalk mark.`;
}

/** Said when the purse is handed over, before the stone is chosen. */
export function pursePickLine(course: RaceCourse): string {
  return `${course.judge.name}: And today's purse. Which stone?`;
}

/** The course's trophy: the first time it is won, or again for one a wipe took. */
export function trophyLine(course: RaceCourse, trophyName: string, again: boolean): string {
  return again
    ? `${course.judge.name}: The course trophy, the ${trophyName.toUpperCase()}. It's yours once it's home.`
    : `${course.judge.name}: Your first time under ${formatRaceTime(course.silverMs)} on ${course.name} - the course trophy goes with it, the ${trophyName.toUpperCase()}. Put it somewhere people will see.`;
}

/**
 * A prize the pack had no room for waits at the line: with the judge when the
 * player won (the racer is still out on the course), with the racer when they did.
 */
export function heldPrizeLine(course: RaceCourse, byJudge: boolean): string {
  return byJudge
    ? `${course.judge.name}: Your pack's full. I'll keep it by my door - make room and come and see me.`
    : `${course.racer.name}: Your pack's full. I'll hold it here - make room and come back for it.`;
}

/** The judge, spoken to after a race this raid with nothing held: the time, for the pride of hearing it. */
export function judgeAfterLines(course: RaceCourse, timeMs: number | undefined): string[] {
  return timeMs === undefined
    ? [`${course.judge.name}: No time for you today. ${course.racer.name} won't wait for ever.`]
    : [`${course.judge.name}: ${formatRaceTime(timeMs)}. I wrote it down. I write them all down.`];
}

/** Spoken to after the race, with nothing held and nothing left to say. */
export function afterRaceLines(course: RaceCourse, outcome: RaceOutcome | null): string[] {
  const racer = course.racer.name;
  if (outcome === 'won') {
    return [`${racer}: Again next raid. I'll be practising.`];
  }
  return [`${racer}: Again next raid? I'll be waiting by the alley.`];
}

/** Said when the racer gives up waiting and goes home. */
export function goneHomeLine(course: RaceCourse): string {
  return `${course.racer.name} gave up waiting and went home. The race is off.`;
}

/** The race chip: the clock, where the racer is, the line's bearing and distance, and the best to beat. */
export function raceChipLines(input: {
  readonly course: RaceCourse;
  readonly clockMs: number;
  readonly racerPlace: string | null;
  readonly racerHomeMs: number | null;
  readonly waitLeftMs: number | null;
  readonly bearing: string | null;
  readonly tilesToLine: number;
  readonly bestMs: number | undefined;
  /** Still waiting for the player on the chalk mark. */
  readonly liningUp?: boolean;
  /** Shown to a save with a GOLD: the floor, the last thing there is to chase. */
  readonly perfectMs?: number;
}): string[] {
  const racer = input.course.racer.name;
  if (input.liningUp) {
    // Where the chalk box is, not the finish: that is what the player is looking for.
    return ['RACE: TOE THE MARK', `MARK ${input.bearing ? `${input.bearing} ` : ''}${input.tilesToLine}`];
  }
  const lines = [`RACE ${formatRaceTime(input.clockMs)}`];
  if (input.racerHomeMs !== null) {
    lines.push(`${racer} IN ${formatRaceTime(input.racerHomeMs)}`);
    if (input.waitLeftMs !== null) {
      lines.push(`GOES HOME IN ${Math.ceil(input.waitLeftMs / 1000)}s`);
    }
  } else if (input.racerPlace) {
    lines.push(`${racer}: ${input.racerPlace}`);
  }
  lines.push(`LINE ${input.bearing ? `${input.bearing} ` : ''}${input.tilesToLine}`);
  if (input.bestMs !== undefined) {
    lines.push(
      input.perfectMs !== undefined && input.bestMs > input.perfectMs
        ? `BEST ${formatRaceTime(input.bestMs)} PERFECT ${formatRaceTime(input.perfectMs)}`
        : `BEST ${formatRaceTime(input.bestMs)}`,
    );
  }
  return lines;
}

/**
 * A race in progress, or run, this raid (`ActiveRunSession.race`). It is on the
 * session because a fight shuts the world down and builds it again, and the
 * race has to come back exactly where it was - the clock included, which a
 * fight goes on charging (`BattleScene`): the racer does not stop for it.
 */
export interface RaceState {
  readonly courseId: string;
  /** Waiting for the player on the chalk mark, counting down, racing, or done. */
  phase: 'lining-up' | 'countdown' | 'running' | 'over';
  /** How far into the countdown, which no clock is charged for. */
  countdownMs: number;
  /** The race clock (`raceClock.ts`). */
  clockMs: number;
  /**
   * The racer's line, fixed when the race is agreed: the world is rebuilt after
   * every fight, and a line worked out again then - a trainer beaten, a door
   * cut - would move them mid-run.
   */
  readonly line: readonly GridPosition[];
  /** When the racer reaches the line, worked out from their line at GO. */
  racerMs: number;
  outcome?: RaceOutcome;
  /** The race clock when the player crossed. */
  playerMs?: number;
  /** Prizes the racer holds for want of room in the pack. */
  held: { itemId: ItemId; quantity: number }[];
  /** The day's purse is won and its stone not yet chosen. */
  purseToPick: boolean;
  /** What extraction writes down for this course if the raid gets home. */
  bank: { purseDay?: string; trophy?: boolean; perfectTrophy?: boolean };
  /** Game time spent fighting since GO: what the racer ran while the player fought. */
  fightMs: number;
  /** Whether the player has set foot off made ground since GO: who left the racer's road. */
  offRoad: boolean;
  /** Whether the player has come down the shortcut since GO. */
  tookShortcut: boolean;
  /** Where the player has gone since GO, and when (`raceGhost.ts`): kept if it is a best. */
  trail: number[];
  /** Whether the racer ran the reeds' dry way this race (`racerKnowsTheWay`). */
  readonly racerKnew: boolean;
  /** What the racer has to say when they run in behind a player who beat them. */
  arrivalWords?: string[];
}

/** A race the player has just said yes to. */
export function newRace(course: RaceCourse, line: readonly GridPosition[], racerKnew = false): RaceState {
  const crossing = line.findIndex((tile) => crossesLine(course, tile));
  const racerMs = racerTimeMs((crossing < 0 ? line.length - 1 : crossing) + 1);
  return { courseId: course.id, phase: 'countdown', countdownMs: 0, clockMs: 0, line, racerMs, held: [], purseToPick: false, bank: {}, fightMs: 0, offRoad: false, tookShortcut: false, trail: [], racerKnew };
}

/** Charged game time while a fight is on: the racer runs on (`BattleScene` asks this). */
export function chargeFight(race: RaceState | undefined, deltaMs: number): void {
  if (race?.phase === 'running') {
    race.clockMs += Math.max(0, deltaMs);
    race.fightMs += Math.max(0, deltaMs);
  }
}
