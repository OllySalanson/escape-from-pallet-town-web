import type { Direction, GridPosition } from '../movement/gridMovement';
import { HarbourCrowd } from '../harbour/harbourCrowd';
import { WAVE_SHOWN_MS, type NamedFigure } from '../harbour/harbourLink';
import { STEP_DURATION_MS } from '../movement/stepClock';
import { HARBOUR_BOTS, botAt, visitPlan, visitsAt, type BotWhere, type HarbourBot, type SharedRoomId } from './harbourBots';
import { directionBetween, sameTile } from './partner';

/**
 * The harbour's regulars (`harbourBots.ts`) as this browser draws them: the
 * schedule says where each one is meant to be, and they are walked there
 * through the same `HarbourCrowd` another player's figure is walked through,
 * so a regular's steps, turns and partner at heel are exactly a player's.
 *
 * What is this browser's own rather than the clock's is how a regular
 * answers whoever is in front of them: one spoken to
 * stands still facing the player until the box is read (`speakTo`), and catches
 * up with the schedule after; and one the player walks up to while they are
 * standing about turns to look, and puts a hand up once a visit - as a player
 * who saw somebody coming would. Waved at or spoken to, they wave back. Two
 * standing about near each other turn to talk, and wave once on meeting.
 *
 * Phaser-free; `BaseScene` ticks it and hands its figures to `HarbourFigures`
 * beside the real players'.
 */

/** How near, in steps, the player has to come for a regular standing about to look at them. */
export const REGULAR_NOTICES_WITHIN = 2;

/** How near for one to wave at the player of their own accord, once a visit. */
export const REGULAR_WAVES_WITHIN = 3;

/** How near two regulars standing about have to be to turn and talk to each other. */
export const REGULARS_CHAT_WITHIN = 3;

/** Where the regulars are drawn: the yard, or a keeper's room they call in (`ROOM_CALLS`). */
export type RegularsPlace = 'yard' | SharedRoomId;

/** Where the player is standing, for the regulars: the place, their tile, and in a room its floor and mat. */
export interface RegularsWatcher {
  readonly place: RegularsPlace;
  readonly player: GridPosition;
  readonly room?: { readonly collision: readonly (readonly boolean[])[]; readonly mat: GridPosition };
}

export class HarbourRegulars {
  private readonly crowd = new HarbourCrowd<RegularsPlace>();
  private readonly visitOf = new Map<string, number>();
  private readonly wavedAt = new Map<string, number>();
  /** The visits that have already waved at the player unasked. */
  private readonly greeted = new Set<number>();
  /** Which visit has waved at which on meeting, so a meeting is one wave each. */
  private readonly met = new Set<string>();
  private readonly spoken = new Map<string, number>();
  /** The walk from a room's mat to where a regular stands in it, by visit. */
  private readonly roomWalks = new Map<string, readonly GridPosition[] | null>();
  private held: { readonly id: string; readonly facing: Direction } | null = null;
  /** This browser's own milliseconds, for how long a hand stays up. */
  private ms = 0;

  /**
   * One frame: each regular walked on towards where the schedule has them,
   * or turned towards the player standing near. `watcher` is where the player
   * is - null when they are nowhere the regulars go (their own house, a menu)
   * - and a regular calling on a keeper is walked in and out of the room
   * only while the player is in it to see.
   */
  public tick(clockMs: number, deltaMs: number, watcher: RegularsWatcher | null): void {
    this.ms += deltaMs;
    if (this.met.size > 2_000) {
      // A page left open all night: meetings that long ago are not waved at again anyway.
      this.met.clear();
    }
    const here = new Map<string, number>();
    for (const visit of visitsAt(clockMs)) {
      here.set(visitPlan(visit).bot.id, visit);
    }
    for (const id of this.crowd.ids()) {
      if (!here.has(id) && this.held?.id !== id) {
        this.crowd.forget(id);
        this.visitOf.delete(id);
      }
    }
    const placed: { id: string; visit: number; bot: HarbourBot; at: BotWhere & { readonly place: RegularsPlace } }[] = [];
    for (const [id, visit] of here) {
      const plan = visitPlan(visit);
      const where = botAt(plan, clockMs);
      if (!where) {
        continue;
      }
      if (this.visitOf.get(id) !== visit) {
        // A new visit: they are where they come in, not walking there from the last one.
        this.crowd.forget(id);
        this.visitOf.set(id, visit);
      }
      if (this.held?.id === id) {
        continue;
      }
      const at = where.inside ? this.inRoom(visit, where.inside, clockMs, watcher) : { place: 'yard' as const, ...where };
      if (!at) {
        // Calling on a keeper the player is not in with: nowhere to be drawn.
        this.crowd.forget(id);
        continue;
      }
      placed.push({ id, visit, bot: plan.bot, at });
    }
    for (const { id, visit, bot, at } of placed) {
      const player = watcher?.place === at.place ? watcher.player : null;
      let facing = at.facing;
      // Two standing about near each other turn to talk, and the first to
      // arrive waves - the other back as the hand comes down - once a meeting.
      const friend = at.walking
        ? undefined
        : placed.find(
            (other) =>
              other.id !== id && !other.at.walking && other.at.place === at.place && steps(other.at.tile, at.tile) <= REGULARS_CHAT_WITHIN,
          );
      if (friend) {
        facing = directionBetween(at.tile, toward(at.tile, friend.at.tile)) ?? facing;
        const meeting = [visit, friend.visit].sort((a, b) => a - b).join(':');
        if (!this.met.has(`${meeting}:${visit}`)) {
          this.met.add(`${meeting}:${visit}`);
          this.wavedAt.set(id, this.ms + (visit < friend.visit ? 0 : WAVE_SHOWN_MS));
        }
      }
      if (!at.walking && player && steps(at.tile, player) <= REGULAR_NOTICES_WITHIN) {
        facing = directionBetween(at.tile, toward(at.tile, player)) ?? facing;
      }
      if (!at.walking && player && steps(at.tile, player) <= REGULAR_WAVES_WITHIN && !this.greeted.has(visit)) {
        this.greeted.add(visit);
        this.wavedAt.set(id, this.ms);
        facing = directionBetween(at.tile, toward(at.tile, player)) ?? facing;
      }
      if (!this.crowd.ids().includes(id)) {
        this.crowd.hear({ from: id, place: at.place, path: [at.tile], facing, partner: bot.partner });
      }
      this.crowd.hear({
        from: id,
        place: at.place,
        path: at.next ? [at.tile, at.next] : [at.tile],
        facing,
        partner: bot.partner,
      });
    }
    this.crowd.advance(deltaMs);
  }

  /** The regulars to draw in a place, by the names on their plates. */
  public figures(place: RegularsPlace = 'yard'): readonly NamedFigure<RegularsPlace>[] {
    return this.crowd.figuresIn(place).flatMap((figure) => {
      const bot = HARBOUR_BOTS.find((each) => each.id === figure.id);
      if (!bot) {
        return [];
      }
      const waved = this.wavedAt.get(figure.id);
      const waving = waved !== undefined && this.ms >= waved && this.ms - waved < WAVE_SHOWN_MS;
      return [{ ...figure, name: bot.name, ...(waving ? { waving: true } : {}) }];
    });
  }

  /** The regular standing on, or stepping onto, a tile of a place. */
  public at(tile: GridPosition, place: RegularsPlace = 'yard'): HarbourBot | null {
    const figure = this.crowd.figuresIn(place).find((each) => sameTile(each.toward ?? each.tile, tile));
    return HARBOUR_BOTS.find((bot) => bot.id === figure?.id) ?? null;
  }

  /**
   * The player speaks to (or waves at) a regular from `from`: they stop,
   * turn to the player, wave back, and say their next line - which is
   * returned, for the box. They stand there until `release`.
   */
  public speakTo(bot: HarbourBot, from: GridPosition, place: RegularsPlace = 'yard'): string {
    const figure = this.crowd.figuresIn(place).find((each) => each.id === bot.id);
    const standing = figure ? (figure.toward ?? figure.tile) : from;
    const facing = directionBetween(standing, from) ?? 'down';
    this.held = { id: bot.id, facing };
    this.crowd.halt(bot.id, facing);
    // Their hand goes up as the player's comes down: both at once are drawn
    // on the one spot over their plate, and read as one wave.
    this.wavedAt.set(bot.id, this.ms + WAVE_SHOWN_MS);
    const said = this.spoken.get(bot.id) ?? 0;
    this.spoken.set(bot.id, said + 1);
    return bot.lines[said % bot.lines.length];
  }

  /** The box is read: whoever was spoken to goes back about their business. */
  public release(): void {
    this.held = null;
  }

  /** How many are being drawn, for a playtest to read. */
  public get count(): number {
    return this.crowd.ids().length;
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
  const standing: BotWhere = { tile: call.spot.tile, next: null, facing: call.spot.facing, walking: false };
  if (!walk || walk.length < 2 || (walk.length - 1) * 2 * STEP_DURATION_MS > call.to - call.from) {
    return standing;
  }
  const across = (walk.length - 1) * STEP_DURATION_MS;
  const walking = (path: readonly GridPosition[], since: number): BotWhere => {
    const step = Math.min(path.length - 1, Math.floor(since / STEP_DURATION_MS));
    const next = path[step + 1] ?? null;
    return {
      tile: path[step],
      next,
      facing: next ? (directionBetween(path[step], next) ?? 'up') : call.spot.facing,
      walking: next !== null,
    };
  };
  if (clockMs - call.from < across) {
    return walking(walk, clockMs - call.from);
  }
  if (clockMs >= call.to - across) {
    return walking([...walk].reverse(), clockMs - (call.to - across));
  }
  return standing;
}

/** The shortest walk across a room's floor. */
function roomWalk(
  collision: readonly (readonly boolean[])[],
  from: GridPosition,
  to: GridPosition,
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
        if (collision[step.y]?.[step.x] !== false || cameFrom.has(`${step.x},${step.y}`)) continue;
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
