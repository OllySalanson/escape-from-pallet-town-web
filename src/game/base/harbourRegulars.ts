import type { Direction, GridPosition } from '../movement/gridMovement';
import { HarbourCrowd } from '../harbour/harbourCrowd';
import { WAVE_SHOWN_MS, type NamedFigure } from '../harbour/harbourLink';
import { HARBOUR_BOTS, botAt, visitPlan, visitsAt, type HarbourBot } from './harbourBots';
import { directionBetween, sameTile } from './partner';

/**
 * The harbour's regulars (`harbourBots.ts`) as this browser draws them: the
 * schedule says where each one is meant to be, and they are walked there
 * through the same `HarbourCrowd` another player's figure is walked through,
 * so a regular's steps, turns and partner at heel are exactly a player's.
 *
 * Only two things here are this browser's own rather than the clock's, and
 * both are how a regular answers the player in front of them: one spoken to
 * stands still facing the player until the box is read (`speakTo`), and catches
 * up with the schedule after; and one the player walks up to while they are
 * standing about turns to look, and puts a hand up once a visit - as a player
 * who saw somebody coming would. Waved at or spoken to, they wave back.
 *
 * Phaser-free; `BaseScene` ticks it and hands its figures to `HarbourFigures`
 * beside the real players'.
 */

/** How near, in steps, the player has to come for a regular standing about to look at them. */
export const REGULAR_NOTICES_WITHIN = 2;

/** How near for one to wave at the player of their own accord, once a visit. */
export const REGULAR_WAVES_WITHIN = 3;

export class HarbourRegulars {
  private readonly crowd = new HarbourCrowd<'yard'>();
  private readonly visitOf = new Map<string, number>();
  private readonly wavedAt = new Map<string, number>();
  /** The visits that have already waved at the player unasked. */
  private readonly greeted = new Set<number>();
  private readonly spoken = new Map<string, number>();
  private held: { readonly id: string; readonly facing: Direction } | null = null;
  /** This browser's own milliseconds, for how long a hand stays up. */
  private ms = 0;

  /**
   * One frame: each regular walked on towards where the schedule has them,
   * or turned towards the player standing near (`player`, null when the
   * player is not in the yard).
   */
  public tick(clockMs: number, deltaMs: number, player: GridPosition | null): void {
    this.ms += deltaMs;
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
    for (const [id, visit] of here) {
      const plan = visitPlan(visit);
      const at = botAt(plan, clockMs);
      if (!at) {
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
      let facing = at.facing;
      if (!at.walking && player && steps(at.tile, player) <= REGULAR_NOTICES_WITHIN) {
        facing = directionBetween(at.tile, toward(at.tile, player)) ?? facing;
      }
      if (!at.walking && player && steps(at.tile, player) <= REGULAR_WAVES_WITHIN && !this.greeted.has(visit)) {
        this.greeted.add(visit);
        this.wavedAt.set(id, this.ms);
        facing = directionBetween(at.tile, toward(at.tile, player)) ?? facing;
      }
      const bot = plan.bot;
      if (!this.crowd.ids().includes(id)) {
        this.crowd.hear({ from: id, place: 'yard', path: [at.tile], facing, partner: bot.partner });
      }
      this.crowd.hear({
        from: id,
        place: 'yard',
        path: at.next ? [at.tile, at.next] : [at.tile],
        facing,
        partner: bot.partner,
      });
    }
    this.crowd.advance(deltaMs);
  }

  /** The regulars to draw in the yard, by the names on their plates. */
  public figures(): readonly NamedFigure<'yard'>[] {
    return this.crowd.figuresIn('yard').flatMap((figure) => {
      const bot = HARBOUR_BOTS.find((each) => each.id === figure.id);
      if (!bot) {
        return [];
      }
      const waved = this.wavedAt.get(figure.id);
      const waving = waved !== undefined && this.ms >= waved && this.ms - waved < WAVE_SHOWN_MS;
      return [{ ...figure, name: bot.name, ...(waving ? { waving: true } : {}) }];
    });
  }

  /** The regular standing on, or stepping onto, a tile. */
  public at(tile: GridPosition): HarbourBot | null {
    const figure = this.crowd.figuresIn('yard').find((each) => sameTile(each.toward ?? each.tile, tile));
    return HARBOUR_BOTS.find((bot) => bot.id === figure?.id) ?? null;
  }

  /**
   * The player speaks to (or waves at) a regular from `from`: they stop,
   * turn to the player, wave back, and say their next line - which is
   * returned, for the box. They stand there until `release`.
   */
  public speakTo(bot: HarbourBot, from: GridPosition): string {
    const figure = this.crowd.figuresIn('yard').find((each) => each.id === bot.id);
    const standing = figure ? (figure.toward ?? figure.tile) : from;
    const facing = directionBetween(standing, from) ?? 'down';
    this.held = { id: bot.id, facing };
    this.crowd.hear({ from: bot.id, place: 'yard', path: [standing], facing, partner: bot.partner });
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
