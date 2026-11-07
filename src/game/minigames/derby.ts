import { GENERATED_EVOLUTIONS } from '../pokemon/generated/evolutionRules';
import { DERBY_LEVELS } from './derbyLevels';
import { daySeed, hasAbility, hasType, PokemonType, roller, traits, type PokemonTraits } from './traits';

export { DERBY_LEVELS, THE_FRONT, START_X } from './derbyLevels';

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

export type DerbySurface = 'land' | 'sand' | 'water' | 'air';

/** A point on the course, in tiles of THE HARBOUR (`base/baseMap.ts`). */
export interface CoursePoint {
  readonly x: number;
  readonly y: number;
}

/**
 * A stretch of a leg the waves break over (`derbyLevels.ts`, THE BREAKWATER):
 * between two of its points, a wave every `everyMs` from `offsetMs` after the
 * gun. Two lanes of one stretch of stone share a timing, so one wave soaks both.
 */
export interface WaveZone {
  readonly from: number;
  readonly to: number;
  readonly everyMs: number;
  readonly offsetMs: number;
}

/** One stretch of a line, on one surface. */
export interface CourseLeg {
  readonly id: string;
  readonly surface: DerbySurface;
  readonly points: readonly CoursePoint[];
  /** The tight corners on it, by index into `points`. */
  readonly tight: readonly number[];
  /** The crates on it, by index into `points`: leapt at a sprint, clambered over otherwise. */
  readonly hurdles?: readonly number[];
  /** Where the waves break over it. */
  readonly waves?: readonly WaveZone[];
}

/** One way along a stretch: a fork's line, or the only road. */
export interface DerbyLine {
  readonly id: string;
  /** What the foot of the screen calls it: `PIER`. */
  readonly word: string;
  /** The arrow that chooses it at a fork, or null on a road everybody runs. */
  readonly key: 'up' | 'down' | 'left' | 'right' | null;
  readonly legs: readonly CourseLeg[];
  /** Who may take it: a Water type swims, a Flying type flies. */
  readonly needs?: 'water' | 'flying';
}

/** A run of the course: a fork if it has two lines or more. */
export interface DerbyStretch {
  readonly id: string;
  readonly lines: readonly DerbyLine[];
}

/** A line across the course, drawn chequered: from row `from` to row `to` at column `x`. */
export interface DerbyLineMark {
  readonly x: number;
  readonly from: number;
  readonly to: number;
}

/** A level of the derby (`derbyLevels.ts`): its course, its field, and how long a race may run. */
export interface DerbyLevel {
  /** 1 for the first: the order they open in. */
  readonly number: number;
  readonly id: string;
  readonly name: string;
  /** The course in a sentence. */
  readonly blurb: string;
  /** What is new on it, in a few words each. */
  readonly news: readonly string[];
  readonly stretches: readonly DerbyStretch[];
  readonly start: DerbyLineMark;
  readonly finish: DerbyLineMark;
  /** The part of THE HARBOUR the race is seen in, in tiles. */
  readonly view: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  /** How many regulars race, how much better than their own riding, and how many times their Pokémon have evolved. */
  readonly field: { readonly rivals: number; readonly skill: number; readonly stages: number };
  /** The longest a race may run before it is called. */
  readonly longestMs: number;
}

/** The line chosen at each fork, by the fork's id. */
export type DerbyLines = Readonly<Record<string, string>>;

/** The forks of a level: its stretches with more than one line. */
export function forksOf(level: DerbyLevel): readonly DerbyStretch[] {
  return level.stretches.filter((stretch) => stretch.lines.length > 1);
}

/** The line a choice names at a stretch, or the stretch's first. */
function lineAt(stretch: DerbyStretch, lines: DerbyLines): DerbyLine {
  return stretch.lines.find((candidate) => candidate.id === lines[stretch.id]) ?? stretch.lines[0];
}

interface RouteMeasure {
  readonly legs: readonly CourseLeg[];
  /** Where each stretch starts, by leg. */
  readonly starts: readonly number[];
}

/** Routes worked out once per choice of lines: a runner's choice is one object until it changes. */
const ROUTES = new WeakMap<DerbyLines, Map<DerbyLevel, RouteMeasure>>();

function routeFor(level: DerbyLevel, lines: DerbyLines): RouteMeasure {
  let byLevel = ROUTES.get(lines);
  if (!byLevel) {
    byLevel = new Map();
    ROUTES.set(lines, byLevel);
  }
  const known = byLevel.get(level);
  if (known) return known;
  const starts: number[] = [];
  const legs: CourseLeg[] = [];
  for (const stretch of level.stretches) {
    starts.push(legs.length);
    legs.push(...lineAt(stretch, lines).legs);
  }
  const made = { legs, starts };
  byLevel.set(level, made);
  return made;
}

/** The legs a racer runs, by the lines they took. */
export function routeOf(level: DerbyLevel, lines: DerbyLines): readonly CourseLeg[] {
  return routeFor(level, lines).legs;
}

/** Where each stretch starts in a route, by leg. */
function stretchStarts(level: DerbyLevel, lines: DerbyLines): readonly number[] {
  return routeFor(level, lines).starts;
}

interface LegMeasure {
  readonly marks: readonly number[];
  readonly length: number;
  readonly corners: readonly number[];
  readonly cornerKeys: readonly string[];
  readonly hurdles: readonly number[];
  readonly waves: readonly { readonly from: number; readonly to: number; readonly zone: WaveZone; readonly key: string }[];
}

const MEASURES = new WeakMap<CourseLeg, LegMeasure>();

/** A leg's lengths, worked out once. */
function measure(leg: CourseLeg): LegMeasure {
  const known = MEASURES.get(leg);
  if (known) return known;
  const marks = [0];
  for (let index = 1; index < leg.points.length; index += 1) {
    marks.push(marks[index - 1] + Math.hypot(leg.points[index].x - leg.points[index - 1].x, leg.points[index].y - leg.points[index - 1].y));
  }
  const key = (index: number) => `${leg.points[index].x},${leg.points[index].y}`;
  const made: LegMeasure = {
    marks,
    length: marks[marks.length - 1],
    corners: leg.tight.map((index) => marks[index]),
    // A corner is known by where it is, so two lines through one corner bump there.
    cornerKeys: leg.tight.map(key),
    hurdles: (leg.hurdles ?? []).map((index) => marks[index]),
    waves: (leg.waves ?? []).map((zone) => ({ from: marks[zone.from], to: marks[zone.to], zone, key: `${key(zone.from)}-${key(zone.to)}` })),
  };
  MEASURES.set(leg, made);
  return made;
}

/** A leg's length in tiles. */
export function legLength(leg: CourseLeg): number {
  return measure(leg).length;
}

/** Where along a leg `distance` is, in tiles, and which way it is heading. */
export function pointOnLeg(leg: CourseLeg, distance: number): CoursePoint & { readonly heading: number } {
  const marks = measure(leg).marks;
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

/** Where each crate on a leg stands, in tiles. */
export function hurdlesOn(leg: CourseLeg): readonly CoursePoint[] {
  return (leg.hurdles ?? []).map((index) => leg.points[index]);
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
/** The longest THE FRONT may run before it is called: nobody is still out at a minute. Each level says its own. */
export const LONGEST_RACE_MS = 60_000;

/** Sand is this much slower than stone, for anybody but a Ground type: it is their own going. */
export const SAND_PACE = 0.6;
/** Time lost clambering over a crate by size, not sprinting: four squares, six, nine. */
export const CLAMBER_MS: Readonly<Record<number, number>> = { 4: 500, 6: 750, 9: 1100 };
/** Time lost leaping a crate at a sprint: nothing, unless it is a big one that takes the crate with it. */
export const LEAP_MS: Readonly<Record<number, number>> = { 4: 0, 6: 0, 9: 400 };
/** A wave says it is coming this long before it breaks. */
export const WAVE_WARN_MS = 1300;
/** A wave is seen breaking for this long. */
export const WAVE_SHOW_MS = 500;
/** A wave knocks a racer it catches back this long, by size: a big one stands firmer. */
export const WAVE_MS: Readonly<Record<number, number>> = { 4: 1100, 6: 950, 9: 600 };

/** Tiles a second on sand: a Ground type's own going, everybody else slowed. */
export function sandPace(racer: PokemonTraits): number {
  return hasType(racer, PokemonType.Ground) ? landPace(racer) : landPace(racer) * SAND_PACE;
}

/** A Flying type, or one that floats (Levitate), sails over a crate without breaking stride. */
export function sailsOverCrates(racer: PokemonTraits): boolean {
  return hasType(racer, PokemonType.Flying) || hasAbility(racer, 'levitate');
}

/** A Water type rides a wave out and loses nothing to it. */
export function ridesWaves(racer: PokemonTraits): boolean {
  return hasType(racer, PokemonType.Water);
}

/** Whether a racer may take a line: the bay a Water type, the air a Flying type, the rest anybody. */
export function mayTake(racer: PokemonTraits, line: DerbyLine): boolean {
  if (line.needs === 'water') return hasType(racer, PokemonType.Water);
  if (line.needs === 'flying') return hasType(racer, PokemonType.Flying);
  return true;
}

/** Which lines a racer may take at a fork, by id. */
export function linesOpenTo(racer: PokemonTraits, fork: DerbyStretch): readonly string[] {
  return fork.lines.filter((line) => mayTake(racer, line)).map((line) => line.id);
}

function paceOn(surface: DerbySurface, racer: PokemonTraits, wet: boolean): number {
  if (surface === 'water') return swimPace(racer, wet);
  if (surface === 'air') return airPace(racer);
  if (surface === 'sand') return sandPace(racer);
  return landPace(racer);
}

/**
 * How long a line takes at a racer's plain pace, with its corners and its
 * crates (half of them clambered, as a rider leaps some and not others): what a
 * regular judges a line by.
 */
export function lineMs(racer: PokemonTraits, legs: readonly CourseLeg[], wet: boolean): number {
  return legs.reduce((total, leg) => {
    const measured = measure(leg);
    const crates = sailsOverCrates(racer) ? 0 : measured.hurdles.length * ((CLAMBER_MS[racer.squares] ?? 0) / 2);
    return total + (measured.length / paceOn(leg.surface, racer, wet)) * 1000 + measured.corners.length * (CORNER_LOSS_MS[racer.squares] ?? 0) + crates;
  }, 0);
}

/** The quicker line at each fork for a racer, as a regular reckons it: by the fork's id. Ties go to the line listed first. */
export function bestLines(level: DerbyLevel, racer: PokemonTraits, wet: boolean): DerbyLines {
  const chosen: Record<string, string> = {};
  for (const fork of forksOf(level)) {
    const open = fork.lines.filter((line) => mayTake(racer, line));
    const best = open.reduce((quickest, line) => (lineMs(racer, line.legs, wet) < lineMs(racer, quickest.legs, wet) ? line : quickest));
    chosen[fork.id] = best.id;
  }
  return chosen;
}

/** How long a racer takes round a level on its best lines at its plain pace: how a kind is judged a racer. */
export function plainLapMs(level: DerbyLevel, racer: PokemonTraits, wet: boolean): number {
  return lineMs(racer, routeOf(level, bestLines(level, racer, wet)), wet);
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

/** How many regulars line up beside the player on THE FRONT. */
export const FIELD_SIZE = 5;

/** The best a regular rides: nobody never slips. */
export const BEST_RIDING = 0.95;

/** The going, by the day: WET about one day in three, the same for everybody. */
export function derbyGoing(day: string): 'dry' | 'wet' {
  return daySeed(`going:${day}`) % 3 === 0 ? 'wet' : 'dry';
}

/** A kind evolved `stages` times along its own line, as far as the line goes: the first evolution FireRed lists. */
export function evolvedFor(species: string, stages: number): string {
  let kind = species;
  for (let stage = 0; stage < stages; stage += 1) {
    const next = GENERATED_EVOLUTIONS.find((rule) => rule.from === kind);
    if (!next) break;
    kind = next.to;
  }
  return kind;
}

/**
 * The day's field on a level, the same for everybody that day: THE FRONT's
 * five as they always were, and on a later level more of the regulars, riding
 * better, on their Pokémon evolved as many times as the level says.
 */
export function derbyField(level: DerbyLevel, day: string): readonly DerbyEntrant[] {
  const roll = roller(daySeed(level.number === 1 ? `field:${day}` : `field:${level.id}:${day}`));
  const pool = [...DERBY_ENTRANTS];
  for (let index = pool.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(roll() * (index + 1));
    [pool[index], pool[swap]] = [pool[swap], pool[index]];
  }
  return pool.slice(0, level.field.rivals).map((entrant) => fieldEntrant(level, entrant));
}

/** A regular as they turn out for a level: evolved and riding as the level asks. */
export function fieldEntrant(level: DerbyLevel, entrant: DerbyEntrant): DerbyEntrant {
  if (level.field.skill === 0 && level.field.stages === 0) return entrant;
  return {
    ...entrant,
    species: evolvedFor(entrant.species, level.field.stages),
    skill: Math.min(BEST_RIDING, entrant.skill + level.field.skill),
  };
}

// --- a race -----------------------------------------------------------------------

export interface DerbyRunner {
  /** The player's racer is 0; the regulars follow. */
  readonly index: number;
  readonly name: string;
  readonly racer: PokemonTraits;
  readonly skill: number;
  /** The line it means to take at each fork, by the fork's id. */
  readonly lines: DerbyLines;
  /** Which leg of its route it is on, and how far along it. */
  readonly leg: number;
  readonly along: number;
  readonly stamina: number;
  /** Sprinting until this many ms into the race. */
  readonly sprintUntil: number;
  /** Stalled - a corner, a stumble, a bump, a crate, a wave - until this many ms into the race. */
  readonly stalledUntil: number;
  /** Its time over the line, from the gun, once it is home. */
  readonly finishedMs: number | null;
}

export type DerbyEvent =
  | { readonly kind: 'go' }
  | { readonly kind: 'corner'; readonly runner: number; readonly lostMs: number }
  | { readonly kind: 'stumble'; readonly runner: number }
  | { readonly kind: 'bump'; readonly runner: number; readonly into: number; readonly lostMs: number; readonly zapped: boolean }
  | { readonly kind: 'leap'; readonly runner: number; readonly lostMs: number }
  | { readonly kind: 'clamber'; readonly runner: number; readonly lostMs: number }
  | { readonly kind: 'sail'; readonly runner: number }
  | { readonly kind: 'wave'; readonly zone: string }
  | { readonly kind: 'soaked'; readonly runner: number; readonly lostMs: number }
  | { readonly kind: 'rode-wave'; readonly runner: number }
  | { readonly kind: 'line'; readonly runner: number; readonly line: string }
  | { readonly kind: 'finish'; readonly runner: number; readonly place: number; readonly ms: number };

export interface DerbyRace {
  readonly level: DerbyLevel;
  readonly wet: boolean;
  /** Ms since the start's count began. */
  readonly clock: number;
  readonly runners: readonly DerbyRunner[];
  /** Who went through which corner when: a corner is known by where it is, `x,y`. */
  readonly cornerTimes: Readonly<Record<string, readonly { readonly runner: number; readonly ms: number }[]>>;
  readonly finishers: readonly number[];
  readonly over: boolean;
  readonly seed: number;
  /** Ms owed to the next frame. */
  readonly carryMs: number;
  readonly events: readonly DerbyEvent[];
}

/** What the player does on a frame: tap SPACE, or choose lines for the forks ahead, by fork id. */
export interface DerbyInput {
  readonly tap?: boolean;
  readonly lines?: DerbyLines;
}

/** A new race on a level: the player's racer in lane 0 and the field beside it, on their best lines. */
export function startDerby(
  level: DerbyLevel,
  player: { readonly name: string; readonly racer: PokemonTraits },
  field: readonly DerbyEntrant[],
  wet: boolean,
  seed: number,
): DerbyRace {
  const runner = (index: number, name: string, racer: PokemonTraits, skill: number): DerbyRunner => ({
    index,
    name,
    racer,
    skill,
    // The player's own choice: the first line of each fork until they say otherwise.
    lines: index === 0 ? Object.fromEntries(forksOf(level).map((fork) => [fork.id, fork.lines[0].id])) : bestLines(level, racer, wet),
    leg: 0,
    along: 0,
    stamina: staminaMs(racer),
    sprintUntil: 0,
    stalledUntil: COUNTDOWN_MS,
    finishedMs: null,
  });
  return {
    level,
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
export function legOf(level: DerbyLevel, runner: DerbyRunner): CourseLeg {
  const route = routeOf(level, runner.lines);
  return route[Math.min(runner.leg, route.length - 1)];
}

/** Where a runner is on the harbour's map, in tiles, and which way it faces. */
export function whereIs(level: DerbyLevel, runner: DerbyRunner): CoursePoint & { readonly heading: number; readonly surface: DerbySurface } {
  const leg = legOf(level, runner);
  return { ...pointOnLeg(leg, runner.along), surface: leg.surface };
}

/** How far a runner is from the next tight corner on its leg, in tiles: Infinity with none ahead. */
export function toNextCorner(level: DerbyLevel, runner: DerbyRunner): number {
  const ahead = measure(legOf(level, runner)).corners.filter((corner) => corner > runner.along);
  return ahead.length > 0 ? Math.min(...ahead) - runner.along : Number.POSITIVE_INFINITY;
}

/** How far a runner is from the next crate on its leg, in tiles: Infinity with none ahead. */
export function toNextHurdle(level: DerbyLevel, runner: DerbyRunner): number {
  const ahead = measure(legOf(level, runner)).hurdles.filter((hurdle) => hurdle > runner.along);
  return ahead.length > 0 ? Math.min(...ahead) - runner.along : Number.POSITIVE_INFINITY;
}

/** When a wave zone next breaks, in ms of the race clock, at or after `clock`. */
export function nextBreak(zone: WaveZone, clock: number): number {
  const first = COUNTDOWN_MS + zone.offsetMs;
  if (clock <= first) return first;
  return first + Math.ceil((clock - first) / zone.everyMs) * zone.everyMs;
}

/** What the waves on a leg are doing now: each zone, how long until it breaks, and whether it has just broken. */
export function wavesOn(leg: CourseLeg, clock: number): readonly { readonly from: number; readonly to: number; readonly key: string; readonly inMs: number; readonly breaking: boolean }[] {
  return measure(leg).waves.map((wave) => {
    const next = nextBreak(wave.zone, clock);
    const last = next - wave.zone.everyMs;
    return { from: wave.from, to: wave.to, key: wave.key, inMs: next - clock, breaking: clock >= COUNTDOWN_MS + wave.zone.offsetMs && clock - last < WAVE_SHOW_MS };
  });
}

/** Whether a wave is about to break where a runner is, or just ahead of it on its leg (`tiles` ahead). */
export function waveThreat(level: DerbyLevel, runner: DerbyRunner, clock: number, tiles = 4): boolean {
  const leg = legOf(level, runner);
  if (!leg.waves) return false;
  return wavesOn(leg, clock).some((wave) => wave.inMs <= WAVE_WARN_MS && runner.along < wave.to && runner.along + tiles > wave.from);
}

/** The fork whose line the player may still choose, nearest first: the stretches not yet reached. */
export function forksAhead(level: DerbyLevel, runner: DerbyRunner): readonly DerbyStretch[] {
  const starts = stretchStarts(level, runner.lines);
  // A fork at the very start is open until the runner has set off on it.
  const notSetOff = runner.leg === 0 && runner.along === 0;
  return level.stretches.filter((stretch, index) => stretch.lines.length > 1 && (runner.leg < starts[index] || (index === 0 && notSetOff)));
}

/** The next fork ahead of a runner, or null with none left. */
export function nextFork(level: DerbyLevel, runner: DerbyRunner): DerbyStretch | null {
  return forksAhead(level, runner)[0] ?? null;
}

/**
 * What an arrow chooses for the player now: the line on that arrow at the
 * nearest fork ahead that has one, if the racer may take it. Null if it
 * chooses nothing.
 */
export function lineForKey(level: DerbyLevel, runner: DerbyRunner, key: 'up' | 'down' | 'left' | 'right'): { readonly fork: string; readonly line: string } | null {
  for (const fork of forksAhead(level, runner)) {
    const line = fork.lines.find((candidate) => candidate.key === key);
    if (line) return mayTake(runner.racer, line) ? { fork: fork.id, line: line.id } : null;
  }
  return null;
}

/** How far through the whole race a runner is, 0 to 1: for the order on the board. */
export function progressOf(level: DerbyLevel, runner: DerbyRunner): number {
  if (runner.finishedMs !== null) return 1;
  const route = routeOf(level, runner.lines);
  const total = route.reduce((sum, leg) => sum + measure(leg).length, 0);
  const done = route.slice(0, runner.leg).reduce((sum, leg) => sum + measure(leg).length, 0) + runner.along;
  return done / total;
}

type Mutable<T> = { -readonly [K in keyof T]: T[K] };

/** A regular's tap this frame: on a straight with breath to spare, as often as their skill - and at a crate or a wave, if they see it. */
function regularTaps(level: DerbyLevel, runner: DerbyRunner, roll: () => number, clock: number): boolean {
  if (runner.index === 0 || runner.finishedMs !== null || clock < runner.stalledUntil) return false;
  if (clock < runner.sprintUntil - SPRINT_TAP_MS / 2) return false;
  const reserve = 300;
  const crate = !sailsOverCrates(runner.racer) && toNextHurdle(level, runner) < 1.2;
  if (crate || (!ridesWaves(runner.racer) && waveThreat(level, runner, clock))) {
    // Into a crate or past a wave at a sprint, as often as they ride well.
    return runner.stamina > 0 && roll() < runner.skill * 0.25;
  }
  const corner = toNextCorner(level, runner);
  // A less skilled rider forgets to ease off into a corner now and then.
  const careless = roll() > runner.skill + 0.25;
  if (corner < 1.6 && !careless) return false;
  // A regular taps now and then rather than hammering the key, and the more skilled the more often.
  return runner.stamina > reserve && roll() < runner.skill * 0.06;
}

/** The lines a runner means to take, with what the player chose for the forks not yet reached. */
function choose(level: DerbyLevel, runner: DerbyRunner, lines: DerbyLines | undefined): DerbyLines {
  if (!lines || runner.index !== 0) return runner.lines;
  let chosen: DerbyLines = runner.lines;
  for (const fork of forksAhead(level, runner)) {
    const wanted = fork.lines.find((line) => line.id === lines[fork.id]);
    if (wanted && mayTake(runner.racer, wanted) && chosen[fork.id] !== wanted.id) chosen = { ...chosen, [fork.id]: wanted.id };
  }
  return chosen;
}

/** One frame of the race. */
export function stepDerby(previous: DerbyRace, input: DerbyInput = {}): DerbyRace {
  if (previous.over) {
    return { ...previous, events: [] };
  }
  const level = previous.level;
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
    runner.lines = choose(level, runner, input.lines);
    if (runner.finishedMs !== null) return runner;
    const tapped = runner.index === 0 ? Boolean(input.tap) : regularTaps(level, runner, roll, clock);
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
    let step = (paceOn(legOf(level, runner).surface, runner.racer, race.wet) * (sprinting ? SPRINT_PACE : 1) * DERBY_FRAME_MS) / 1000;
    while (step > 0 && runner.finishedMs === null) {
      const leg = legOf(level, runner);
      const measured = measure(leg);
      const end = measured.length;
      const corner = measured.corners.find((distance) => distance > runner.along && distance <= runner.along + step);
      const hurdle = measured.hurdles.find((distance) => distance > runner.along && distance <= runner.along + step);
      if (hurdle !== undefined && (corner === undefined || hurdle < corner)) {
        // At a crate: over it at a sprint, over the top of it otherwise.
        step -= hurdle - runner.along;
        runner.along = hurdle;
        let lost = 0;
        if (sailsOverCrates(runner.racer)) {
          events.push({ kind: 'sail', runner: runner.index });
        } else if (sprinting) {
          lost = LEAP_MS[runner.racer.squares] ?? 0;
          events.push({ kind: 'leap', runner: runner.index, lostMs: lost });
        } else {
          lost = CLAMBER_MS[runner.racer.squares] ?? 0;
          events.push({ kind: 'clamber', runner: runner.index, lostMs: lost });
        }
        if (lost > 0) {
          runner.stalledUntil = clock + lost;
          runner.sprintUntil = 0;
          break;
        }
        continue;
      }
      if (corner !== undefined) {
        // Through a tight corner: what it costs, and whether anybody was in it.
        step -= corner - runner.along;
        runner.along = corner;
        const key = measured.cornerKeys[measured.corners.indexOf(corner)];
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
      const route = routeOf(level, runner.lines);
      if (runner.leg + 1 >= route.length) {
        runner.along = end;
        runner.finishedMs = clock - COUNTDOWN_MS;
        finishers.push(runner.index);
        events.push({ kind: 'finish', runner: runner.index, place: finishers.length, ms: runner.finishedMs });
        break;
      }
      runner.leg += 1;
      runner.along = 0;
      const starts = stretchStarts(level, runner.lines);
      const entered = level.stretches.findIndex((stretch, index) => starts[index] === runner.leg && stretch.lines.length > 1);
      if (entered >= 0) {
        const fork = level.stretches[entered];
        events.push({ kind: 'line', runner: runner.index, line: lineAt(fork, runner.lines).id });
      }
    }
    return runner;
  });
  // The waves that break this frame, over whoever is on the stone under them.
  breakWaves(level, before, clock, runners, events);
  race.runners = runners;
  race.cornerTimes = cornerTimes;
  race.finishers = finishers;
  race.seed = seed;
  race.over = runners[0].finishedMs !== null && finishers.length === runners.length;
  if (clock - COUNTDOWN_MS > level.longestMs) race.over = true;
  race.events = events;
  return race;
}

/** Every wave that breaks between `before` and `clock`, and who it catches: a Water type rides it, anybody else is knocked back. */
function breakWaves(level: DerbyLevel, before: number, clock: number, runners: Mutable<DerbyRunner>[], events: DerbyEvent[]): void {
  const broken = new Set<string>();
  for (const runner of runners) {
    if (runner.finishedMs !== null) continue;
    const leg = legOf(level, runner);
    if (!leg.waves) continue;
    for (const wave of measure(leg).waves) {
      const breaks = nextBreak(wave.zone, before + 0.001);
      if (breaks > clock) continue;
      if (!broken.has(wave.key)) {
        broken.add(wave.key);
        events.push({ kind: 'wave', zone: wave.key });
      }
      if (runner.along < wave.from || runner.along > wave.to) continue;
      if (ridesWaves(runner.racer)) {
        events.push({ kind: 'rode-wave', runner: runner.index });
        continue;
      }
      const lost = WAVE_MS[runner.racer.squares] ?? 0;
      runner.stalledUntil = Math.max(runner.stalledUntil, clock + lost);
      runner.sprintUntil = 0;
      events.push({ kind: 'soaked', runner: runner.index, lostMs: lost });
    }
  }
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
  if (first && input.lines) {
    // Not a whole frame yet: the choice still holds.
    const lines = input.lines;
    next = { ...next, runners: next.runners.map((runner) => (runner.index === 0 ? { ...runner, lines: choose(next.level, runner, lines) } : runner)) };
  }
  return { ...next, carryMs: next.over ? 0 : carry, events };
}

/** Where the player came: 1 to the field's size, or null if they had not finished when it was called. */
export function playerPlace(race: DerbyRace): number | null {
  const place = race.finishers.indexOf(0);
  return place >= 0 ? place + 1 : null;
}

/** The places that pay and open the next level: the podium. */
export const PODIUM = 3;

/**
 * The race's score for the day's ledger, on every level alike: six for a win,
 * five for second, four for third, down to nothing - so the tickets a place
 * pays (`DERBY_TICKET_TIERS`) are the same whatever the field's size.
 */
export function derbyScore(place: number | null): number {
  return place === null ? 0 : Math.max(0, 7 - place);
}

/** What a racer is like on a level, in a few words, for the choosing screen. */
export function racerNotes(racer: PokemonTraits, wet: boolean, level: DerbyLevel = DERBY_LEVELS[0]): readonly string[] {
  const notes: string[] = [];
  const pace = landPace(racer);
  const legs = level.stretches.flatMap((stretch) => stretch.lines.flatMap((line) => line.legs));
  notes.push(pace >= 4.75 ? 'Fast' : pace >= 4.1 ? 'Quick' : pace >= 3.6 ? 'Steady' : 'Slow');
  if (hasType(racer, PokemonType.Water)) notes.push(wet && hasAbility(racer, 'swift-swim') ? 'Swims the bay x2' : 'Swims the bay');
  if (hasType(racer, PokemonType.Flying)) notes.push('Flies home');
  if (legs.some((leg) => leg.surface === 'sand') && hasType(racer, PokemonType.Ground)) notes.push('At home on sand');
  if (legs.some((leg) => leg.hurdles) && hasAbility(racer, 'levitate') && !hasType(racer, PokemonType.Flying)) notes.push('Floats over crates');
  if (legs.some((leg) => leg.waves) && hasType(racer, PokemonType.Water)) notes.push('Rides the waves');
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

/** Place words, as the board says them. */
export const PLACE_WORDS: readonly string[] = ['1ST', '2ND', '3RD', '4TH', '5TH', '6TH', '7TH', '8TH'];

// --- the levels, one after another --------------------------------------------------

/** How many levels a save has on the podium of, in order, as stored: 0 for none. */
export function readDerbyCleared(value: unknown): number | undefined {
  return Number.isInteger(value) && (value as number) > 0 ? Math.min(value as number, DERBY_LEVELS.length) : undefined;
}

/** Whether a level is open: the first always, and each after it once the one before has been finished on the podium. */
export function derbyLevelOpen(level: DerbyLevel, cleared: number): boolean {
  return level.number <= cleared + 1;
}

/** The level a finished race opens, if it does: the next one, on a podium of a level not yet cleared. */
export function derbyLevelOpened(level: DerbyLevel, place: number | null, cleared: number): DerbyLevel | null {
  if (place === null || place > PODIUM || level.number <= cleared) return null;
  return DERBY_LEVELS[level.number] ?? null;
}

/** The levels cleared after a race: one more if it was a podium on the newest open level. */
export function derbyClearedAfter(level: DerbyLevel, place: number | null, cleared: number): number {
  return place !== null && place <= PODIUM && level.number === cleared + 1 ? level.number : cleared;
}
