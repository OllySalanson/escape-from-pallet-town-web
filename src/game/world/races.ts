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
  };
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
  /** The trophy the first GOLD ever adds. */
  readonly trophy: ItemId;
  /**
   * What the racer says next time it is worth knowing: to a loser who stuck to
   * their road, to one who left it and fought, to one who left it and was
   * slower anyway, and to a winner who has not found the shortcut.
   */
  readonly hints: { readonly road: string; readonly fights: string; readonly longWay: string; readonly shortcut: string };
}

/**
 * THE MERE DASH: LINNET, from the alley mouth below Mill Square to THE LAST
 * HOUSE at the far end of the reeds. Her road goes down the lane and round the
 * whole mere on the boardwalk (154 steps); the reeds' dry way leaves the lane
 * across the wildfowlers' meadow (104 steps, five of them wild grass); the Cut
 * line goes west of the millpond, through the woodcutter's glade and down the
 * woodcutter's ride (68). See `races.test.ts` for the measurements.
 */
export const MERE_DASH: RaceCourse = {
  id: 'mere-dash',
  mapId: 'greystone-vale',
  name: 'THE MERE DASH',
  racer: { name: 'LINNET', design: 'picnicker', stands: { x: 84, y: 169 }, waits: { x: 70, y: 220 } },
  finish: {
    name: 'THE LAST HOUSE',
    where: 'at the far end of the reeds, where the Mere Path leaves the vale',
    tiles: [
      { x: 72, y: 218 },
      { x: 72, y: 219 },
    ],
  },
  silverMs: 16_500,
  goldMs: 11_000,
  trophy: 'silver-shield',
  hints: {
    road: 'You stuck to my boardwalk. Everybody does! The reeds have a dry way through, if you look.',
    fights: "The reeds are quick - but I don't stop while you fight in them. Find the dry way, or pack a Repel.",
    longWay: "You left my boardwalk and still came in behind me? The dry way through the reeds is straighter than that.",
    shortcut:
      "Nobody gets under 0:11.0 through the reeds. There's an old ride through the pines behind the woodcutter's - grown shut. Bring a Cut.",
  },
};

export const RACE_COURSES: readonly RaceCourse[] = [MERE_DASH];

/** The course whose racer stands on this tile, if any. */
export function courseStartedAt(mapId: WorldMapId, tile: GridPosition): RaceCourse | undefined {
  return RACE_COURSES.find(
    (course) => course.mapId === mapId && course.racer.stands.x === tile.x && course.racer.stands.y === tile.y,
  );
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
/** P for beating them. */
export const WINNING_MONEY = 30;

/** The five stones the day's purse can be, in Bill's order. */
export const PURSE_STONES: readonly ItemId[] = ['thunder-stone', 'fire-stone', 'water-stone', 'leaf-stone', 'moon-stone'];

/** What a crossing pays, given what this save has already had. */
export interface RacePrize {
  readonly money: number;
  /** The day's purse: a stone the player chooses. */
  readonly purse: boolean;
  /** The course's trophy, for the first GOLD ever. */
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
  const gold = medal === 'gold';
  return {
    money: outcome === 'won' ? WINNING_MONEY : TAKING_PART_MONEY,
    purse: gold && !record.purseTakenToday,
    trophy: gold && !record.trophyBanked,
  };
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
}

// -- What the racer says ---------------------------------------------------------

/** The offer, up to the question: who, where the line is, and what each finish pays. */
export function raceOfferLines(course: RaceCourse, record: RaceRecord | undefined, purseTakenToday: boolean): string[] {
  const racer = course.racer.name;
  const lines = [
    record && record.runs > 0
      ? `${racer}: Back for more? Same line - ${course.finish.name}, ${course.finish.where}.`
      : `${racer}: I'll race you! First to ${course.finish.name}, ${course.finish.where}. The line's on the planks by its door.`,
    `Beat me: ${formatMoney(WINNING_MONEY)}. Just get there before I go home: ${formatMoney(TAKING_PART_MONEY)} for trying. And no bikes - on foot!`,
    `Under ${formatRaceTime(course.silverMs)} is SILVER. Under ${formatRaceTime(course.goldMs)} is GOLD, and ${
      purseTakenToday ? "today's purse is gone - come back tomorrow for it" : "GOLD takes today's purse: an evolution stone, your pick"
    }.`,
  ];
  if (record?.bestMs !== undefined) {
    lines.push(`Your best: ${formatRaceTime(record.bestMs)}${record.medal ? ` (${MEDAL_WORDS[record.medal]})` : ''}.`);
  }
  return lines;
}

/** The captain's question, word for word. */
export function raceQuestion(course: RaceCourse): string {
  return `Do you want to race ${course.racer.name} to ${course.finish.name}?`;
}

export const RACE_ANSWERS: readonly string[] = ['YES', 'NO'];

export function raceDeclinedLine(course: RaceCourse): string {
  return `${course.racer.name}: Scared? I'll be here.`;
}

/** Said as the countdown begins. */
export function raceReadyLine(course: RaceCourse, wasRiding: boolean): string {
  return wasRiding
    ? `${course.racer.name}: Off the bike! On foot, like everybody. On your marks...`
    : `${course.racer.name}: On your marks...`;
}

export interface RaceResultInput {
  readonly outcome: RaceOutcome;
  /** Game time spent fighting on the way. */
  readonly fightMs: number;
  /** Whether the player left the racer's road. */
  readonly offRoad: boolean;
  readonly timeMs: number;
  readonly racerMs: number;
  readonly medal: RaceMedal | null;
  readonly newBest: boolean;
  readonly prize: RacePrize;
}

/** What is said at the line: the result, the mark, and what the next race wants. */
export function raceResultLines(course: RaceCourse, input: RaceResultInput): string[] {
  const racer = course.racer.name;
  const lines: string[] = [];
  const fought = input.fightMs > 0 ? ` (${formatGap(input.fightMs)} of it fighting)` : '';
  if (input.outcome === 'won') {
    lines.push(`You crossed first! ${formatRaceTime(input.timeMs)}${fought} - ${racer} was ${formatGap(input.racerMs - input.timeMs)} behind.`);
  } else {
    lines.push(`${racer} crossed first, ${formatGap(input.timeMs - input.racerMs)} ahead. Your time: ${formatRaceTime(input.timeMs)}${fought}.`);
  }
  if (input.medal) {
    lines.push(`${MEDAL_WORDS[input.medal]}!${input.newBest ? ' A new best.' : ''}`);
  } else if (input.newBest) {
    lines.push('A new best.');
  }
  if (input.outcome === 'won') {
    lines.push(
      input.medal === 'gold'
        ? `${racer}: Through the woodcutter's ride?! Nobody's been up there in years. That's the best run I've ever seen.`
        : `${racer}: How?! Fine. Fair's fair.`,
    );
  } else {
    const why = input.fightMs > 0 ? course.hints.fights : input.offRoad ? course.hints.longWay : course.hints.road;
    lines.push(`${racer}: ${why}`);
  }
  lines.push(`${racer} hands you ${formatMoney(input.prize.money)}.`);
  if (input.outcome === 'won' && input.medal !== 'gold') {
    lines.push(`${racer}: ${course.hints.shortcut}`);
  }
  return lines;
}

/** Said when the purse is handed over, before the stone is chosen. */
export function pursePickLine(course: RaceCourse): string {
  return `${course.racer.name}: And today's purse. Which stone?`;
}

export function trophyLine(course: RaceCourse, trophyName: string): string {
  return `${course.racer.name}: First GOLD on ${course.name}! The ${trophyName} is yours - put it somewhere people will see.`;
}

/** The racer has a prize the pack had no room for: they hold it at the line. */
export function heldPrizeLine(course: RaceCourse): string {
  return `${course.racer.name}: Your pack's full. I'll hold it here - make room and come back for it.`;
}

/** Spoken to after the race, with nothing held. */
export function afterRaceLines(course: RaceCourse, outcome: RaceOutcome | null): string[] {
  const racer = course.racer.name;
  if (outcome === 'late') {
    return [`${racer}: You took so long I nearly went home! Race you next time.`];
  }
  if (outcome === 'won') {
    return [`${racer}: Again next time. I'll be practising.`];
  }
  return [`${racer}: Again next time? I'll be waiting by the alley.`];
}

/** Said when the racer gives up waiting, if the player is in earshot of the box. */
export function goneHomeLine(course: RaceCourse): string {
  return `${course.racer.name} has gone home. The race is off.`;
}

/** The race chip: the clock, where the racer is, the line's bearing, and the best to beat. */
export function raceChipLines(input: {
  readonly course: RaceCourse;
  readonly clockMs: number;
  readonly racerPlace: string | null;
  readonly racerHomeMs: number | null;
  readonly waitLeftMs: number | null;
  readonly bearing: string | null;
  readonly bestMs: number | undefined;
}): string[] {
  const racer = input.course.racer.name;
  const lines = [`RACE ${formatRaceTime(input.clockMs)}`];
  if (input.racerHomeMs !== null) {
    lines.push(`${racer} IN ${formatRaceTime(input.racerHomeMs)}`);
    if (input.waitLeftMs !== null) {
      lines.push(`GOES HOME IN ${Math.ceil(input.waitLeftMs / 1000)}s`);
    }
  } else if (input.racerPlace) {
    lines.push(`${racer}: ${input.racerPlace}`);
  }
  lines.push(`LINE: ${input.course.finish.name}${input.bearing ? ` ${input.bearing}` : ''}`);
  if (input.bestMs !== undefined) {
    lines.push(`BEST ${formatRaceTime(input.bestMs)}`);
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
  phase: 'countdown' | 'running' | 'over';
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
  bank: { purseDay?: string; trophy?: boolean };
  /** Game time spent fighting since GO: what the racer ran while the player fought. */
  fightMs: number;
  /** Whether the player has set foot off made ground since GO: who left the racer's road. */
  offRoad: boolean;
  /** Where the player has gone since GO, and when (`raceGhost.ts`): kept if it is a best. */
  trail: number[];
}

/** A race the player has just said yes to. */
export function newRace(course: RaceCourse, line: readonly GridPosition[]): RaceState {
  const crossing = line.findIndex((tile) => crossesLine(course, tile));
  const racerMs = racerTimeMs((crossing < 0 ? line.length - 1 : crossing) + 1);
  return { courseId: course.id, phase: 'countdown', countdownMs: 0, clockMs: 0, line, racerMs, held: [], purseToPick: false, bank: {}, fightMs: 0, offRoad: false, trail: [] };
}

/** Charged game time while a fight is on: the racer runs on (`BattleScene` asks this). */
export function chargeFight(race: RaceState | undefined, deltaMs: number): void {
  if (race?.phase === 'running') {
    race.clockMs += Math.max(0, deltaMs);
    race.fightMs += Math.max(0, deltaMs);
  }
}
