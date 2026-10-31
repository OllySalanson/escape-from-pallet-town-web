import type { GridPosition } from '../movement/gridMovement';
import { HarbourCrowd, JUMP_AFTER_STEPS } from '../harbour/harbourCrowd';
import { WAVE_SHOWN_MS, type NamedFigure } from '../harbour/harbourLink';
import { phraseWords } from '../harbour/harbourPhrases';
import { STEP_DURATION_MS } from '../movement/stepClock';
import { HARBOUR_BOTS, botGround, botPath, visitsAt, type HarbourBot, type SharedRoomId } from './harbourBots';
import { botAt, botSayingAt, botWavingAt, directionOf, visitPlan, type BotActivity, type BotWhere } from './harbourActivities';
import { directionBetween, sameTile } from './partner';

/**
 * The harbour's regulars (`harbourBots.ts`, `harbourActivities.ts`) as this
 * browser draws them: the plan says where each one is meant to be and what they
 * are doing, and they are walked there through the same `HarbourCrowd` another
 * player's figure is walked through, so a regular's steps, turns and partner at
 * heel are exactly a player's.
 *
 * What is this browser's own rather than the clock's is how a regular answers
 * whoever is in front of them: one the player walks up to while they are
 * standing about turns to look, and puts a hand up once a visit - as a player
 * who saw somebody coming would. And a step onto a tile the player stands on,
 * or somebody else has got to first, is put off or walked round: they catch up
 * with the plan afterwards, at the pace another player catches up.
 *
 * Nothing can be said to one: the interact key does nothing at a regular.
 *
 * Phaser-free; `BaseScene` ticks it and hands its figures to `HarbourFigures`
 * beside the real players'.
 */

/** How near, in steps, the player has to come for a regular standing about to look at them. */
export const REGULAR_NOTICES_WITHIN = 2;

/** How near for one to wave at the player of their own accord, once a visit. */
export const REGULAR_WAVES_WITHIN = 3;

/** How many steps more than the straight walk a regular will go to get round somebody. */
const LONGEST_WAY_ROUND = 4;

/** How long a regular waits, drawn, for a tile to clear before going round whoever is on it. */
const GO_ROUND_AFTER_MS = 400;

/** The longest they wait with no way round (a one-tile lane) before walking on: more and they would lose the plan. */
const LONGEST_WAIT_MS = 1_400;

/** Where the regulars are drawn: the yard, or a keeper's room they call in (`ROOM_CALLS`). */
export type RegularsPlace = 'yard' | SharedRoomId;

/** Where the player is standing, for the regulars: the place, their tile, and in a room its floor and mat. */
export interface RegularsWatcher {
  readonly place: RegularsPlace;
  readonly player: GridPosition;
  readonly room?: { readonly collision: readonly (readonly boolean[])[]; readonly mat: GridPosition };
}

/** A regular as drawn: a figure as another player's is, plus what they are doing and how far through a door they are. */
export type RegularFigure = NamedFigure<RegularsPlace> & {
  readonly activity: BotActivity;
  readonly fade?: number;
};

export class HarbourRegulars {
  private readonly crowd = new HarbourCrowd<RegularsPlace>();
  private readonly visitOf = new Map<string, number>();
  private readonly wavedAt = new Map<string, number>();
  /** The visits that have already waved at the player unasked. */
  private readonly greeted = new Set<number>();
  /** The walk from a room's mat to where a regular stands in it, by visit. */
  private readonly roomWalks = new Map<string, readonly GridPosition[] | null>();
  /** What the plan has each one doing this frame. */
  private readonly now = new Map<string, { readonly visit: number; readonly at: BotWhere }>();
  /** How long each has been waiting for somebody to get off the tile they want. */
  private readonly waiting = new Map<string, number>();
  /** The clock this frame. */
  private clockMs = 0;
  /** This browser's own milliseconds, for how long a hand stays up. */
  private ms = 0;

  /**
   * One frame: each regular walked on towards where the plan has them, or
   * turned towards the player standing near. `watcher` is where the player is -
   * null when they are nowhere the regulars go (their own house, a menu) - and
   * a regular calling on a keeper is walked in and out of the room only while
   * the player is in it to see.
   */
  public tick(clockMs: number, deltaMs: number, watcher: RegularsWatcher | null): void {
    this.ms += deltaMs;
    this.clockMs = clockMs;
    this.now.clear();
    const here = new Map<string, number>();
    for (const visit of visitsAt(clockMs)) {
      here.set(visitPlan(visit).bot.id, visit);
    }
    for (const id of this.crowd.ids()) {
      if (!here.has(id)) {
        this.crowd.forget(id);
        this.visitOf.delete(id);
      }
    }
    const placed: { id: string; visit: number; bot: HarbourBot; at: BotWhere & { readonly place: RegularsPlace } }[] = [];
    for (const [id, visit] of here) {
      const plan = visitPlan(visit);
      const where = botAt(plan, clockMs);
      if (!where) {
        // Not out of the door yet: nobody to draw.
        this.crowd.forget(id);
        continue;
      }
      if (this.visitOf.get(id) !== visit) {
        // A new visit: they are where they come in, not walking there from the last one.
        this.crowd.forget(id);
        this.visitOf.set(id, visit);
      }
      const at = where.inside ? this.inRoom(visit, where.inside, clockMs, watcher) : { place: 'yard' as const, ...where };
      if (!at) {
        // Calling on a keeper the player is not in with: nowhere to be drawn.
        this.crowd.forget(id);
        continue;
      }
      this.now.set(id, { visit, at });
      placed.push({ id, visit, bot: plan.bot, at });
    }
    for (const { id, visit, bot, at } of placed) {
      const player = watcher?.place === at.place ? watcher.player : null;
      let facing = at.facing;
      if (!at.walking && player && steps(at.tile, player) <= REGULAR_NOTICES_WITHIN) {
        facing = directionBetween(at.tile, toward(at.tile, player)) ?? facing;
      }
      if (!at.walking && player && steps(at.tile, player) <= REGULAR_WAVES_WITHIN && !this.greeted.has(visit)) {
        this.greeted.add(visit);
        this.wavedAt.set(id, this.ms);
        facing = directionBetween(at.tile, toward(at.tile, player)) ?? facing;
      }
      if (!this.crowd.ids().includes(id)) {
        this.crowd.hear({ from: id, place: at.place, path: [at.tile], facing, partner: bot.partner, look: bot.look });
      }
      // The crowd is told only steps it has not heard, as a player's browser
      // sends them: told the step they are on again every frame, it queued
      // the tile just left as a step back, and walked them to and fro at
      // catch-up pace (the captain, 29 Oct: "one step forward and one step back").
      const heading = this.crowd.headingTo(id)!;
      const target = at.next ?? at.tile;
      const inTheWay = this.occupied(id, at.place, player);
      const path = sameTile(heading, target) ? [heading] : this.stepsTowards(heading, target, inTheWay, at.place, watcher);
      this.crowd.hear({
        from: id,
        place: at.place,
        path,
        // Waiting a step short of somebody, they look at where they are going.
        facing: path.length === 1 && !sameTile(heading, target) ? directionOf(heading, target) : facing,
        partner: bot.partner,
        look: bot.look,
      });
    }
    this.crowd.advance(deltaMs, (id, tile) => this.mayStepOnto(id, tile, deltaMs, placed.find((each) => each.id === id)?.at.place ?? 'yard', watcher));
  }

  /**
   * Whether somebody may set foot on a tile this frame: not while anybody else
   * is on it or stepping onto it, for as long as they can wait without falling
   * too far behind the plan to catch it up.
   */
  private mayStepOnto(id: string, tile: GridPosition, deltaMs: number, place: RegularsPlace, watcher: RegularsWatcher | null): boolean {
    const player = watcher?.place === place ? watcher.player : null;
    if (!this.occupied(id, place, player).some((other) => sameTile(other, tile))) {
      this.waiting.delete(id);
      return true;
    }
    const waited = (this.waiting.get(id) ?? 0) + deltaMs;
    if (waited > LONGEST_WAIT_MS) {
      this.waiting.delete(id);
      return true;
    }
    this.waiting.set(id, waited);
    if (waited >= GO_ROUND_AFTER_MS) {
      this.goRound(id, place, player, watcher);
    }
    return false;
  }

  /** Somebody has waited long enough to see the tile is not clearing: round them, to where the plan has them by now. */
  private goRound(id: string, place: RegularsPlace, player: GridPosition | null, watcher: RegularsWatcher | null): void {
    const doing = this.now.get(id);
    const figure = this.crowd.figuresIn(place).find((each) => each.id === id);
    if (!doing || !figure || figure.toward) {
      return;
    }
    const inTheWay = this.occupied(id, place, player);
    const target = doing.at.next ?? doing.at.tile;
    if (inTheWay.some((tile) => sameTile(tile, target)) || steps(figure.tile, target) > JUMP_AFTER_STEPS) {
      return;
    }
    const room = place === 'yard' ? null : watcher?.room;
    const round = room ? roomWalk(room.collision, figure.tile, target, inTheWay) : yardWalk(figure.tile, target, inTheWay);
    if (round && round.length > 1 && round.length - 1 <= steps(figure.tile, target) + LONGEST_WAY_ROUND) {
      this.crowd.reroute(id, round.slice(1));
      this.waiting.delete(id);
    }
  }

  /** The regulars to draw in a place, by the names on their plates. */
  public figures(place: RegularsPlace = 'yard'): readonly RegularFigure[] {
    return this.crowd.figuresIn(place).flatMap((figure) => {
      const bot = HARBOUR_BOTS.find((each) => each.id === figure.id);
      const doing = this.now.get(figure.id);
      if (!bot || !doing) {
        return [];
      }
      const plan = visitPlan(doing.visit);
      const waved = this.wavedAt.get(figure.id);
      const waving = (waved !== undefined && this.ms >= waved && this.ms - waved < WAVE_SHOWN_MS) || botWavingAt(plan, this.clockMs);
      const phrase = botSayingAt(plan, this.clockMs);
      return [
        {
          ...figure,
          name: bot.name,
          activity: doing.at.activity,
          ...(waving ? { waving: true } : {}),
          ...(phrase ? { saying: phraseWords(phrase) } : {}),
          ...(doing.at.fade === undefined ? {} : { fade: doing.at.fade }),
        },
      ];
    });
  }

  /** How many are being drawn, for a playtest to read. */
  public get count(): number {
    return this.crowd.ids().length;
  }

  /** The tiles somebody else is on or stepping onto, in a place: the player, and every other regular. */
  private occupied(id: string, place: RegularsPlace, player: GridPosition | null): readonly GridPosition[] {
    return [
      ...(player ? [player] : []),
      ...this.crowd.figuresIn(place).flatMap((other) => (other.id === id ? [] : [other.tile, ...(other.toward ? [other.toward] : [])])),
    ];
  }

  /**
   * The steps from the last tile the crowd heard to where the plan has them
   * now: none while somebody is on the very tile they want, and round whoever
   * is in the way when the plan has got ahead of them. The plan is never told.
   */
  private stepsTowards(
    from: GridPosition,
    to: GridPosition,
    inTheWay: readonly GridPosition[],
    place: RegularsPlace,
    watcher: RegularsWatcher | null,
  ): readonly GridPosition[] {
    if (steps(from, to) > JUMP_AFTER_STEPS) {
      // Back from a menu, or a page asleep: simply there.
      return [to];
    }
    const taken = inTheWay.some((tile) => sameTile(tile, to));
    if (steps(from, to) === 1) {
      return taken ? [from] : [from, to];
    }
    const room = place === 'yard' ? null : watcher?.room;
    const others = inTheWay.filter((tile) => !sameTile(tile, to));
    const round = room ? roomWalk(room.collision, from, to, others) : yardWalk(from, to, others);
    if (!round || round.length - 1 > steps(from, to) + LONGEST_WAY_ROUND) {
      // No way round worth the name: they wait, rather than setting off across the harbour.
      return [from];
    }
    // Somebody is on the very tile the plan has them on: as far as the tile behind.
    return taken ? round.slice(0, -1) : round;
  }

  /** Where a regular calling on a keeper is in the room, if the player is in it to see them. */
  private inRoom(
    visit: number,
    call: CallOnAKeeper,
    clockMs: number,
    watcher: RegularsWatcher | null,
  ): (BotWhere & { readonly place: RegularsPlace }) | null {
    if (watcher?.place !== call.room || !watcher.room) {
      return null;
    }
    const key = `${visit}:${call.room}`;
    if (!this.roomWalks.has(key)) {
      this.roomWalks.set(key, roomWalk(watcher.room.collision, watcher.room.mat, call.spot.tile));
      // Calls long over are not walked again.
      for (const old of this.roomWalks.keys()) {
        if (Number(old.split(':')[0]) < visit - 40) this.roomWalks.delete(old);
      }
    }
    return { place: call.room, ...callAt(call, clockMs, this.roomWalks.get(key) ?? null) };
  }
}

type CallOnAKeeper = NonNullable<BotWhere['inside']>;

/**
 * Where a regular calling on a keeper is at a moment: in off the mat, a step
 * at a time to where they stand, standing there as long as the call lasts,
 * and back across to the mat to be on it as the call ends - or, with no walk
 * across (`walk` null) or no time for one, simply standing there.
 */
export function callAt(call: CallOnAKeeper, clockMs: number, walk: readonly GridPosition[] | null): BotWhere {
  const standing: BotWhere = { tile: call.spot.tile, next: null, facing: call.spot.facing, walking: false, activity: 'call-in' };
  if (!walk || walk.length < 2 || (walk.length - 1) * 2 * STEP_DURATION_MS > call.to - call.from) {
    return standing;
  }
  const across = (walk.length - 1) * STEP_DURATION_MS;
  const walking = (path: readonly GridPosition[], since: number, fadesOn: 'first' | 'last'): BotWhere => {
    const step = Math.min(path.length - 1, Math.floor(since / STEP_DURATION_MS));
    const next = path[step + 1] ?? null;
    const progress = (since - step * STEP_DURATION_MS) / STEP_DURATION_MS;
    const fade = fadesOn === 'first' && step === 0 ? progress : fadesOn === 'last' && next !== null && step === path.length - 2 ? 1 - progress : undefined;
    return {
      tile: path[step],
      next,
      facing: next ? (directionBetween(path[step], next) ?? 'up') : call.spot.facing,
      walking: next !== null,
      activity: 'call-in',
      ...(fade === undefined ? {} : { fade }),
    };
  };
  if (clockMs - call.from < across) {
    return walking(walk, clockMs - call.from, 'first');
  }
  if (clockMs >= call.to - across) {
    return walking([...walk].reverse(), clockMs - (call.to - across), 'last');
  }
  return standing;
}

/** The shortest walk across the yard round these tiles. */
function yardWalk(from: GridPosition, to: GridPosition, round: readonly GridPosition[]): readonly GridPosition[] | null {
  const { width, height } = botGround();
  const avoid = new Uint8Array(width * height);
  for (const tile of round) {
    avoid[tile.y * width + tile.x] = 1;
  }
  return botPath(from, to, avoid);
}

/** The shortest walk across a room's floor, round these tiles. */
function roomWalk(
  collision: readonly (readonly boolean[])[],
  from: GridPosition,
  to: GridPosition,
  round: readonly GridPosition[] = [],
): readonly GridPosition[] | null {
  const cameFrom = new Map<string, GridPosition | null>([[`${from.x},${from.y}`, null]]);
  let frontier: GridPosition[] = [from];
  while (frontier.length > 0 && !cameFrom.has(`${to.x},${to.y}`)) {
    const next: GridPosition[] = [];
    for (const tile of frontier) {
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ]) {
        const step = { x: tile.x + dx, y: tile.y + dy };
        if (collision[step.y]?.[step.x] !== false || cameFrom.has(`${step.x},${step.y}`) || round.some((other) => sameTile(other, step))) continue;
        cameFrom.set(`${step.x},${step.y}`, tile);
        next.push(step);
      }
    }
    frontier = next;
  }
  if (!cameFrom.has(`${to.x},${to.y}`)) {
    return null;
  }
  const path: GridPosition[] = [];
  for (let at: GridPosition | null = to; at; at = cameFrom.get(`${at.x},${at.y}`) ?? null) {
    path.unshift(at);
  }
  return path;
}

const steps = (a: GridPosition, b: GridPosition): number => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/** The neighbouring tile of `from` that is the first step towards `to`, along the longer way. */
function toward(from: GridPosition, to: GridPosition): GridPosition {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.abs(dx) >= Math.abs(dy) ? { x: from.x + Math.sign(dx), y: from.y } : { x: from.x, y: from.y + Math.sign(dy) };
}

/** Where the regulars' clock starts in test mode: a fixed moment, so a stepped harbour is the same every time. */
export const TEST_CLOCK_ORIGIN_MS = Date.UTC(2026, 9, 29, 12, 0, 0);

let testClockMs = TEST_CLOCK_ORIGIN_MS;

/**
 * The regulars' clock this frame: the wall clock, so every browser sees the
 * same regulars in the same places - or, in test mode, a clock that moves only
 * by the game time stepped, from a fixed start, so a check is the same every time.
 */
export function regularsClock(deltaMs: number, testMode: boolean): number {
  if (!testMode) {
    return Date.now();
  }
  testClockMs += deltaMs;
  return testClockMs;
}

let regulars: HarbourRegulars | null | undefined;

/** The URL word that leaves the regulars out, for a check or a picture of the harbour without them. */
export const REGULARS_OFF_QUERY = 'regulars=off';

/** This page's regulars, kept for its life; null where the page asked for none. */
export function harbourRegulars(search: string = typeof window === 'undefined' ? '' : (window.location?.search ?? '')): HarbourRegulars | null {
  if (regulars !== undefined) {
    return regulars;
  }
  regulars = new URLSearchParams(search).get('regulars') === 'off' ? null : new HarbourRegulars();
  return regulars;
}
