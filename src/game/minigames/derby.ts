import { daySeed, hasAbility, hasType, PokemonType, roller, traits, type PokemonTraits } from './traits';

/**
 * THE PROMENADE DERBY (the harbour arenas plan, section 3.5): this game's own
 * race, once round the front. Six Pokémon - yours and five of the regulars' -
 * run east along the promenade, down the pleasure pier to its head, round it
 * and home, drawn on the harbour's own map. Two forks on the way, and the
 * player picks at each; SPACE, tapped, sprints while the stamina bar lasts.
 *
 * Every rule reads a fact the game already holds (`traits.ts`), never a
 * number typed for a kind:
 *
 * - **Base Speed** is the pace on land (`landPace`).
 * - **Base HP** is the stamina bar: how long a sprint lasts (`staminaSeconds`).
 * - **Size** - four squares, six or nine - is time lost at each of the three
 *   tight corners (`CORNER_LOSS_MS`). A big one may take the WIDE line at the
 *   first fork, longer and with no tight corner in it.
 * - **A Water type** may dive off the pier head and swim THE BAY back to the
 *   beach, and **a Flying type** may take THE AIR LINE straight home over the
 *   huts: the second fork. Everybody else runs back up the pier.
 * - **Swift Swim** swims twice as fast when the going is WET - a day in three
 *   or so, the same for everybody that day (`derbyGoing`).
 * - **Run Away** is never knocked off its line in a bump at a corner, and a
 *   racer that bumps into **Static** or **Poison Point** is slowed again, as
 *   touching one is in a battle.
 *
 * And skill: sprint on the straights, ease off into a corner - a sprint
 * through a tight corner is a stumble (`STUMBLE_MS`) - and pick the right line.
 *
 * Pure and Phaser-free: a race is a value, stepped by milliseconds a frame at a
 * time (sixty a second, as the cabinet's game is), so a 100 ms frame plays the
 * same race six 16 ms ones do, and the tests and `tools/minigames/measure.mts`
 * run thousands of them.
 */

export type DerbySurface = 'land' | 'water' | 'air';

/** A point on the course, in tiles of THE HARBOUR (`base/baseMap.ts`). */
export interface CoursePoint {
  readonly x: number;
  readonly y: number;
}

/** One stretch of the course. */
export interface CourseLeg {
  readonly id: DerbyLegId;
  readonly surface: DerbySurface;
  readonly points: readonly CoursePoint[];
  /** The tight corners on it, by index into `points`. */
  readonly tight: readonly number[];
}

export type DerbyLegId = 'out' | 'inside' | 'wide' | 'pier' | 'back' | 'bay-swim' | 'bay-run' | 'air';

/** The two lines at the first fork and the three at the second. */
export type FirstLine = 'inside' | 'wide';
export type SecondLine = 'pier' | 'bay' | 'air';

const at = (x: number, y: number): CoursePoint => ({ x, y });

/**
 * The course, on the harbour's own tiles: east along the promenade's stone,
 * down the pleasure pier to its head, and home - back up the pier and west
 * along the stone's seaward row, or across the bay and up the beach between
 * the huts, or straight over them. The start and the finish are one line
 * across the stone at `START_X`.
 */
export const START_X = 64;
export const COURSE: Readonly<Record<DerbyLegId, CourseLeg>> = {
  out: { id: 'out', surface: 'land', points: [at(START_X, 13), at(77, 13)], tight: [] },
  // Down the steps beside the pier's foot: short, and a tight turn onto it.
  inside: { id: 'inside', surface: 'land', points: [at(77, 13), at(80, 13), at(80, 20)], tight: [1] },
  // Out past the steps and round onto the pier in a sweep: longer, no tight turn.
  wide: { id: 'wide', surface: 'land', points: [at(77, 13), at(82, 13), at(82, 16), at(81, 18), at(80, 20)], tight: [] },
  pier: { id: 'pier', surface: 'land', points: [at(80, 20), at(80, 28)], tight: [] },
  // Round the pier head and back: two tight turns, at the head and at the pier's foot.
  back: { id: 'back', surface: 'land', points: [at(80, 28), at(81, 29), at(79, 29), at(80, 28), at(80, 14), at(START_X, 14)], tight: [2, 4] },
  // Off the west end of the pier head and in to the beach, wide of the rock.
  'bay-swim': { id: 'bay-swim', surface: 'water', points: [at(80, 28), at(77, 27), at(74, 25), at(73, 22)], tight: [] },
  // Out of the water up the sand - a scramble, and a tight one for a big swimmer - and between the huts.
  'bay-run': { id: 'bay-run', surface: 'land', points: [at(73, 22), at(73, 21), at(73, 14), at(START_X, 14)], tight: [1, 2] },
  air: { id: 'air', surface: 'air', points: [at(80, 28), at(START_X, 14)], tight: [] },
};

/** The legs a racer runs, by the lines they took. */
export function routeOf(first: FirstLine, second: SecondLine): readonly DerbyLegId[] {
  const home: readonly DerbyLegId[] = second === 'pier' ? ['back'] : second === 'bay' ? ['bay-swim', 'bay-run'] : ['air'];
  return ['out', first, 'pier', ...home];
}

function legLength(leg: CourseLeg): number {
  let total = 0;
  for (let index = 1; index < leg.points.length; index += 1) {
    total += Math.hypot(leg.points[index].x - leg.points[index - 1].x, leg.points[index].y - leg.points[index - 1].y);
  }
  return total;
}

/** How far along a leg each of its points is. */
function pointDistances(leg: CourseLeg): readonly number[] {
  const out = [0];
  for (let index = 1; index < leg.points.length; index += 1) {
    out.push(out[index - 1] + Math.hypot(leg.points[index].x - leg.points[index - 1].x, leg.points[index].y - leg.points[index - 1].y));
  }
  return out;
}

const LENGTHS: Readonly<Record<DerbyLegId, number>> = Object.fromEntries(
  Object.values(COURSE).map((leg) => [leg.id, legLength(leg)]),
) as unknown as Record<DerbyLegId, number>;

const CORNERS: Readonly<Record<DerbyLegId, readonly number[]>> = Object.fromEntries(
  Object.values(COURSE).map((leg) => [leg.id, leg.tight.map((index) => pointDistances(leg)[index])]),
) as unknown as Record<DerbyLegId, readonly number[]>;

/** Where along a leg `distance` is, in tiles, and which way it is heading. */
export function pointOnLeg(id: DerbyLegId, distance: number): CoursePoint & { readonly heading: number } {
  const leg = COURSE[id];
  const marks = pointDistances(leg);
  const along = Math.max(0, Math.min(distance, marks[marks.length - 1]));
  for (let index = 1; index < leg.points.length; index += 1) {
    if (along <= marks[index] || index === leg.points.length - 1) {
      const from = leg.points[index - 1];
      const to = leg.points[index];
      const span = marks[index] - marks[index - 1] || 1;
      const share = (along - marks[index - 1]) / span;
      return { x: from.x + (to.x - from.x) * share, y: from.y + (to.y - from.y) * share, heading: Math.atan2(to.y - from.y, to.x - from.x) };
    }
  }
  return { ...leg.points[0], heading: 0 };
}

// --- the racers -------------------------------------------------------------------

/**
 * Tiles a second on land: base Speed, from a Geodude's 3.5 to a Tauros's 5.0 -
 * a narrow spread on purpose, so a well-ridden Charmander can still beat a
 * badly ridden Ponyta.
 */
export function landPace(racer: PokemonTraits): number {
  return 3.2 + racer.speed / 60;
}

/** Tiles a second in the bay, for a Water type: at home in it, so a slow one swims as well as a quick one nearly. */
export function swimPace(racer: PokemonTraits, wet: boolean): number {
  const pace = 3.4 + racer.speed / 80;
  return wet && hasAbility(racer, 'swift-swim') ? pace * 2 : pace;
}

/** Tiles a second on the air line: a flyer's own pace, less the climb up over the huts and the glide down. */
export function airPace(racer: PokemonTraits): number {
  return landPace(racer) * 0.7;
}

/** How long a full stamina bar sprints for, in ms: base HP. */
export function staminaMs(racer: PokemonTraits): number {
  return Math.round((0.8 + racer.hp / 45) * 1000);
}

/** A sprint is this much faster. */
export const SPRINT_PACE = 1.5;
/** A tap of SPACE sprints this long; tapping again keeps it going. */
export const SPRINT_TAP_MS = 320;
/** The bar fills back this many ms a second while not sprinting. */
export const STAMINA_BACK_PER_SECOND = 300;
/** Sprinting through a tight corner is a stumble. */
export const STUMBLE_MS = 600;
/** Time lost at a tight corner by size: four squares, six, nine. */
export const CORNER_LOSS_MS: Readonly<Record<number, number>> = { 4: 0, 6: 450, 9: 1000 };
/** A bump at a corner: the one behind is knocked off its line... */
export const BUMP_MS = 350;
/** ...and slowed again by Static or Poison Point on the one it bumped. */
export const ZAP_MS = 450;
/** Two racers this close in time at a tight corner bump. */
export const BUMP_WINDOW_MS = 280;
/** How long the start's count is, before anybody moves. */
export const COUNTDOWN_MS = 2400;
/** The race's frame, as FireRed's games count. */
export const DERBY_FRAME_MS = 1000 / 60;
/** The longest a race may run before it is called: nobody is still out at a minute. */
export const LONGEST_RACE_MS = 60_000;

/** Which lines a racer may take at the second fork: the pier always, the bay a Water type, the air a Flying type. */
export function linesOpenTo(racer: PokemonTraits): readonly SecondLine[] {
  return [
    'pier',
    ...(hasType(racer, PokemonType.Water) ? (['bay'] as const) : []),
    ...(hasType(racer, PokemonType.Flying) ? (['air'] as const) : []),
  ];
}

/** How long a line takes at a racer's plain pace, with its corners: what a regular judges a line by. */
export function lineMs(racer: PokemonTraits, legs: readonly DerbyLegId[], wet: boolean): number {
  return legs.reduce((total, id) => {
    const leg = COURSE[id];
    const pace = leg.surface === 'water' ? swimPace(racer, wet) : leg.surface === 'air' ? airPace(racer) : landPace(racer);
    return total + (LENGTHS[id] / pace) * 1000 + CORNERS[id].length * (CORNER_LOSS_MS[racer.squares] ?? 0);
  }, 0);
}

/** The quicker line at each fork for a racer, as a regular reckons it. */
export function bestLines(racer: PokemonTraits, wet: boolean): { readonly first: FirstLine; readonly second: SecondLine } {
  const first: FirstLine = lineMs(racer, ['inside'], wet) <= lineMs(racer, ['wide'], wet) ? 'inside' : 'wide';
  const options = linesOpenTo(racer);
  const second = options.reduce((best, line) =>
    lineMs(racer, routeOf(first, line).slice(3), wet) < lineMs(racer, routeOf(first, best).slice(3), wet) ? line : best,
  );
  return { first, second };
}

// --- the field ------------------------------------------------------------------

/** A regular who races, and what they race: a Pokémon that fits their handle. */
export interface DerbyEntrant {
  readonly handle: string;
  readonly species: string;
  /** How well they ride it: how often they sprint when they should, and keep off it into a corner. */
  readonly skill: number;
}

/**
 * The regulars who race, from `base/harbourBots.ts`'s handles, each with a
 * Pokémon of the kind the arenas plan gives them (section 2.4).
 */
export const DERBY_ENTRANTS: readonly DerbyEntrant[] = [
  { handle: 'FINNY2011', species: 'ponyta', skill: 0.35 },
  { handle: 'SKYEZARD', species: 'pidgeotto', skill: 0.5 },
  { handle: 'TESS-SWIMS', species: 'horsea', skill: 0.55 },
  { handle: 'XKITX', species: 'meowth', skill: 0.45 },
  { handle: 'OZ-HIKES', species: 'geodude', skill: 0.7 },
  { handle: 'KARPKING', species: 'magikarp', skill: 0.4 },
  { handle: 'BEEBEE22', species: 'beedrill', skill: 0.45 },
  { handle: 'DEXHUNTER', species: 'rattata', skill: 0.5 },
  { handle: 'BULBALUV', species: 'bulbasaur', skill: 0.75 },
  { handle: 'OG-NELL', species: 'doduo', skill: 0.35 },
  { handle: 'TOISE4LIFE', species: 'squirtle', skill: 0.6 },
  { handle: '1MORERAID', species: 'pikachu', skill: 0.4 },
];

/** How many regulars line up beside the player. */
export const FIELD_SIZE = 5;

/** The going, by the day: WET about one day in three, the same for everybody. */
export function derbyGoing(day: string): 'dry' | 'wet' {
  return daySeed(`going:${day}`) % 3 === 0 ? 'wet' : 'dry';
}

/** The day's field: five of the regulars, the same five for everybody that day. */
export function derbyField(day: string): readonly DerbyEntrant[] {
  const roll = roller(daySeed(`field:${day}`));
  const pool = [...DERBY_ENTRANTS];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(roll() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }
  return pool.slice(0, FIELD_SIZE);
}

// --- a race -----------------------------------------------------------------------

export interface DerbyRunner {
  /** The player's racer is 0; the regulars follow. */
  readonly index: number;
  readonly name: string;
  readonly racer: PokemonTraits;
  readonly skill: number;
  readonly first: FirstLine;
  readonly second: SecondLine;
  /** Which leg of its route it is on, and how far along it. */
  readonly leg: number;
  readonly along: number;
  readonly stamina: number;
  /** Sprinting until this many ms into the race. */
  readonly sprintUntil: number;
  /** Stalled - a corner, a stumble, a bump - until this many ms into the race. */
  readonly stalledUntil: number;
  /** Its time over the line, from the gun, once it is home. */
  readonly finishedMs: number | null;
}

export type DerbyEvent =
  | { readonly kind: 'go' }
  | { readonly kind: 'corner'; readonly runner: number; readonly lostMs: number }
  | { readonly kind: 'stumble'; readonly runner: number }
  | { readonly kind: 'bump'; readonly runner: number; readonly into: number; readonly lostMs: number; readonly zapped: boolean }
  | { readonly kind: 'line'; readonly runner: number; readonly line: FirstLine | SecondLine }
  | { readonly kind: 'finish'; readonly runner: number; readonly place: number; readonly ms: number };

export interface DerbyRace {
  readonly wet: boolean;
  /** Ms since the start's count began. */
  readonly clock: number;
  readonly runners: readonly DerbyRunner[];
  /** Who went through which corner when: a corner's key is `leg:index`. */
  readonly cornerTimes: Readonly<Record<string, readonly { readonly runner: number; readonly ms: number }[]>>;
  readonly finishers: readonly number[];
  readonly over: boolean;
  readonly seed: number;
  /** Ms owed to the next frame. */
  readonly carryMs: number;
  readonly events: readonly DerbyEvent[];
}

/** What the player does on a frame: tap SPACE, or choose a line for the fork ahead. */
export interface DerbyInput {
  readonly tap?: boolean;
  readonly first?: FirstLine;
  readonly second?: SecondLine;
}

/** A new race: the player's racer in lane 0 and the field beside it, on their best lines. */
export function startDerby(
  player: { readonly name: string; readonly racer: PokemonTraits },
  field: readonly DerbyEntrant[],
  wet: boolean,
  seed: number,
): DerbyRace {
  const runner = (index: number, name: string, racer: PokemonTraits, skill: number): DerbyRunner => {
    const lines = bestLines(racer, wet);
    return {
      index,
      name,
      racer,
      skill,
      // The player's own choice: the inside line and back up the pier until they say otherwise.
      first: index === 0 ? 'inside' : lines.first,
      second: index === 0 ? 'pier' : lines.second,
      leg: 0,
      along: 0,
      stamina: staminaMs(racer),
      sprintUntil: 0,
      stalledUntil: COUNTDOWN_MS,
      finishedMs: null,
    };
  };
  return {
    wet,
    clock: 0,
    runners: [
      runner(0, player.name, player.racer, 1),
      ...field.map((entrant, index) => runner(index + 1, entrant.handle, traits(entrant.species), entrant.skill)),
    ],
    cornerTimes: {},
    finishers: [],
    over: false,
    seed: seed >>> 0,
    carryMs: 0,
    events: [],
  };
}

/** The leg a runner is on now. */
export function legOf(runner: DerbyRunner): DerbyLegId {
  const route = routeOf(runner.first, runner.second);
  return route[Math.min(runner.leg, route.length - 1)];
}

/** Where a runner is on the harbour's map, in tiles, and which way it faces. */
export function whereIs(runner: DerbyRunner): CoursePoint & { readonly heading: number; readonly surface: DerbySurface } {
  const id = legOf(runner);
  return { ...pointOnLeg(id, runner.along), surface: COURSE[id].surface };
}

/** How far a runner is from the next tight corner on its route, in tiles: Infinity with none ahead on its leg. */
export function toNextCorner(runner: DerbyRunner): number {
  const ahead = CORNERS[legOf(runner)].filter((corner) => corner > runner.along);
  return ahead.length > 0 ? Math.min(...ahead) - runner.along : Number.POSITIVE_INFINITY;
}

/** Which fork is next for a runner: the first until the pier, the second until it is past the pier head. */
export function nextFork(runner: DerbyRunner): 'first' | 'second' | null {
  if (runner.leg === 0) return 'first';
  if (runner.leg <= 2) return 'second';
  return null;
}

/** How far through the whole race a runner is, 0 to 1: for the order on the board. */
export function progressOf(runner: DerbyRunner): number {
  if (runner.finishedMs !== null) return 1;
  const route = routeOf(runner.first, runner.second);
  const total = route.reduce((sum, id) => sum + LENGTHS[id], 0);
  const done = route.slice(0, runner.leg).reduce((sum, id) => sum + LENGTHS[id], 0) + runner.along;
  return done / total;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

function paceOf(runner: DerbyRunner, wet: boolean): number {
  const surface = COURSE[legOf(runner)].surface;
  return surface === 'water' ? swimPace(runner.racer, wet) : surface === 'air' ? airPace(runner.racer) : landPace(runner.racer);
}

/** A regular's tap this frame: on a straight with breath to spare, as often as their skill. */
function regularTaps(runner: DerbyRunner, roll: () => number, clock: number): boolean {
  if (runner.index === 0 || runner.finishedMs !== null || clock < runner.stalledUntil) return false;
  if (clock < runner.sprintUntil - SPRINT_TAP_MS / 2) return false;
  const reserve = 300;
  const corner = toNextCorner(runner);
  // A less skilled rider forgets to ease off into a corner now and then.
  const careless = roll() > runner.skill + 0.25;
  if (corner < 1.6 && !careless) return false;
  // A regular taps now and then rather than hammering the key, and the more skilled the more often.
  return runner.stamina > reserve && roll() < runner.skill * 0.06;
}

/** One frame of the race. */
export function stepDerby(previous: DerbyRace, input: DerbyInput = {}): DerbyRace {
  if (previous.over) {
    return { ...previous, events: [] };
  }
  const race: Mutable<DerbyRace> = { ...previous, events: [] };
  const events: DerbyEvent[] = [];
  const before = race.clock;
  race.clock += DERBY_FRAME_MS;
  const clock = race.clock;
  if (before < COUNTDOWN_MS && clock >= COUNTDOWN_MS) events.push({ kind: 'go' });
  let seed = race.seed;
  const roll = (): number => {
    seed = (Math.imul(1103515245, seed) + 24691) >>> 0;
    return (seed >>> 8) / 2 ** 24;
  };
  const cornerTimes: Record<string, { runner: number; ms: number }[]> = Object.fromEntries(
    Object.entries(race.cornerTimes).map(([key, list]) => [key, [...list]]),
  );
  const finishers = [...race.finishers];
  const runners = race.runners.map((previousRunner) => {
    const runner: Mutable<DerbyRunner> = { ...previousRunner };
    // The player's lines, chosen ahead of each fork.
    if (runner.index === 0) {
      if (input.first && runner.leg === 0) runner.first = input.first;
      if (input.second && runner.leg <= 2 && linesOpenTo(runner.racer).includes(input.second)) runner.second = input.second;
    }
    if (runner.finishedMs !== null) return runner;
    const tapped = runner.index === 0 ? Boolean(input.tap) : regularTaps(runner, roll, clock);
    if (tapped && clock >= COUNTDOWN_MS && runner.stamina > 0) {
      runner.sprintUntil = clock + SPRINT_TAP_MS;
    }
    if (clock < runner.stalledUntil) {
      runner.stamina = Math.min(staminaMs(runner.racer), runner.stamina + (STAMINA_BACK_PER_SECOND * DERBY_FRAME_MS) / 1000);
      return runner;
    }
    const sprinting = clock < runner.sprintUntil && runner.stamina > 0;
    if (sprinting) {
      runner.stamina = Math.max(0, runner.stamina - DERBY_FRAME_MS);
    } else {
      runner.stamina = Math.min(staminaMs(runner.racer), runner.stamina + (STAMINA_BACK_PER_SECOND * DERBY_FRAME_MS) / 1000);
    }
    let step = (paceOf(runner, race.wet) * (sprinting ? SPRINT_PACE : 1) * DERBY_FRAME_MS) / 1000;
    while (step > 0 && runner.finishedMs === null) {
      const id = legOf(runner);
      const corners = CORNERS[id];
      const end = LENGTHS[id];
      const corner = corners.find((distance) => distance > runner.along && distance <= runner.along + step);
      if (corner !== undefined) {
        // Through a tight corner: what it costs, and whether anybody was in it.
        step -= corner - runner.along;
        runner.along = corner;
        const key = `${id}:${corners.indexOf(corner)}`;
        let lost = CORNER_LOSS_MS[runner.racer.squares] ?? 0;
        if (lost > 0) events.push({ kind: 'corner', runner: runner.index, lostMs: lost });
        if (sprinting) {
          lost += STUMBLE_MS;
          events.push({ kind: 'stumble', runner: runner.index });
        }
        const ahead = (cornerTimes[key] ?? []).filter((other) => clock - other.ms < BUMP_WINDOW_MS && other.runner !== runner.index);
        const into = ahead[ahead.length - 1];
        if (into) {
          const other = race.runners[into.runner].racer;
          const zapped = hasAbility(other, 'static') || hasAbility(other, 'poison-point');
          const knocked = (hasAbility(runner.racer, 'run-away') ? 0 : BUMP_MS) + (zapped ? ZAP_MS : 0);
          if (knocked > 0) {
            lost += knocked;
            events.push({ kind: 'bump', runner: runner.index, into: into.runner, lostMs: knocked, zapped });
          }
        }
        cornerTimes[key] = [...(cornerTimes[key] ?? []), { runner: runner.index, ms: clock }];
        if (lost > 0) {
          runner.stalledUntil = clock + lost;
          runner.sprintUntil = 0;
          break;
        }
        continue;
      }
      if (runner.along + step < end) {
        runner.along += step;
        step = 0;
        break;
      }
      step -= end - runner.along;
      const route = routeOf(runner.first, runner.second);
      if (runner.leg + 1 >= route.length) {
        runner.along = end;
        runner.finishedMs = clock - COUNTDOWN_MS;
        finishers.push(runner.index);
        events.push({ kind: 'finish', runner: runner.index, place: finishers.length, ms: runner.finishedMs });
        break;
      }
      runner.leg += 1;
      runner.along = 0;
      if (runner.leg === 1) events.push({ kind: 'line', runner: runner.index, line: runner.first });
      if (runner.leg === 3) events.push({ kind: 'line', runner: runner.index, line: runner.second });
    }
    return runner;
  });
  race.runners = runners;
  race.cornerTimes = cornerTimes;
  race.finishers = finishers;
  race.seed = seed;
  race.over = runners[0].finishedMs !== null && finishers.length === runners.length;
  if (clock - COUNTDOWN_MS > LONGEST_RACE_MS) race.over = true;
  race.events = events;
  return race;
}

/**
 * The race moved on by `ms` of real time: spent a frame at a time, the rest
 * kept for the next, so the frame rate never changes a race. A tap in this
 * time is read on its first frame, never lost; a line chosen holds.
 */
export function advanceDerby(race: DerbyRace, ms: number, input: DerbyInput = {}): DerbyRace {
  let next: DerbyRace = { ...race, events: [] };
  let carry = race.carryMs + Math.max(0, ms);
  const events: DerbyEvent[] = [];
  let first = true;
  while (carry >= DERBY_FRAME_MS && !next.over) {
    carry -= DERBY_FRAME_MS;
    next = stepDerby(next, first ? input : { ...input, tap: false });
    first = false;
    events.push(...next.events);
  }
  if (first && (input.first || input.second)) {
    // Not a whole frame yet: the choice still holds.
    next = stepLines(next, input);
  }
  return { ...next, carryMs: next.over ? 0 : carry, events };
}

/** A line chosen between frames, held for the next. */
function stepLines(race: DerbyRace, input: DerbyInput): DerbyRace {
  const runners = race.runners.map((runner) => {
    if (runner.index !== 0) return runner;
    return {
      ...runner,
      first: input.first && runner.leg === 0 ? input.first : runner.first,
      second: input.second && runner.leg <= 2 && linesOpenTo(runner.racer).includes(input.second) ? input.second : runner.second,
    };
  });
  return { ...race, runners };
}

/** Where the player came: 1 to 6, or null if they had not finished when it was called. */
export function playerPlace(race: DerbyRace): number | null {
  const place = race.finishers.indexOf(0);
  return place >= 0 ? place + 1 : null;
}

/** The race's score for the day's ledger: higher is better, six for a win down to one for last. */
export function derbyScore(place: number | null, runners: number): number {
  return place === null ? 0 : Math.max(0, runners + 1 - place);
}

/** What a racer is like, in a few words, for the choosing screen. */
export function racerNotes(racer: PokemonTraits, wet: boolean): readonly string[] {
  const notes: string[] = [];
  const pace = landPace(racer);
  notes.push(pace >= 4.75 ? 'Fast' : pace >= 4.1 ? 'Quick' : pace >= 3.6 ? 'Steady' : 'Slow');
  if (hasType(racer, PokemonType.Water)) notes.push(wet && hasAbility(racer, 'swift-swim') ? 'Swims the bay x2' : 'Swims the bay');
  if (hasType(racer, PokemonType.Flying)) notes.push('Flies home');
  if (racer.squares === 9) notes.push('Big: slow round corners');
  else if (racer.squares === 6) notes.push('Bulky at corners');
  if (hasAbility(racer, 'run-away')) notes.push('Never bumped');
  if (hasAbility(racer, 'static') || hasAbility(racer, 'poison-point')) notes.push('Stings a bumper');
  return notes;
}

/** A race time, as the board says it: `14.36s`. */
export function raceTime(ms: number): string {
  return `${(ms / 1000).toFixed(2)}s`;
}
