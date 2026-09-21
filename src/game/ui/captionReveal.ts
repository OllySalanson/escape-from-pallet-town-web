import type { GridPosition } from '../movement/gridMovement';
import { RAID_CLOCK_URGENT_MS } from '../scenes/raidHud';

/**
 * Whether a map caption speaks at all.
 *
 * `labelPlacement.ts` answers *where* a caption may sit, and answered it well
 * enough that the real fault went unseen for four rounds of fixes: the map drew
 * a permanent window over every exit, landmark, gate, drop-in, contract stop and
 * route boundary in view, and on a 400x256 stage seven of them left no map. A
 * player walking Route 1's outpost apron had the whole top third of the screen
 * and both bottom corners under writing, and the one at Oak's Field Station was
 * standing *under* a three-line window naming an exit they were already beside.
 * No seating rule fixes that, because every one of those captions had found a
 * legal seat. The question was never where they go. It is whether they belong
 * on the screen.
 *
 * A caption is an answer, not a signpost, and the map answers four questions:
 *
 * - *What is this thing I have walked up to?* A name speaks while the player is
 *   within `CAPTION_NEAR_STEPS` of it and is silent otherwise. Everything a name
 *   used to carry permanently is already screen furniture - the objective chip
 *   names the contract stop and its bearing, the arrival plate names the
 *   district, the field guide lists the exits and what opens them - so a
 *   permanent window was the same fact said twice, over the map.
 * - *What is on this screen?* The look (`[L]`) is a deliberate glance: while it
 *   is held every caption whose subject is in view speaks, and the map goes
 *   quiet again when it is let go. This is the map-editor view the permanent
 *   captions were, asked for rather than imposed.
 * - *What is about to cost me something?* A warning is not a name and cannot be
 *   asked for after the fact: a trainer's watch says `CANNOT BE FLED` about the
 *   step the player is deciding to take, so it speaks whenever the trainer is in
 *   view, at any distance. An exit that is *open* joins it once the raid clock
 *   goes red (`RAID_CLOCK_URGENT_MS`), because in the last of a raid the only
 *   question on the screen is which way out, and a sealed one is no answer to it.
 * - *What is worth going over there for?* A prize - a rare find, the thing a
 *   raid can be *for* - speaks whenever it is in view, for the same reason a
 *   warning does. It is the one caption that exists to be read from across a
 *   clearing, because the whole of it is the question "that is over there and my
 *   clock is running".
 *
 * Phaser-free, so the rule is testable rather than eyeballed, in the manner of
 * `labelPlacement.ts` and `raidHud.ts`.
 */

/** What a caption is for, which is what decides when it is on the screen. */
export type CaptionVoice =
  /** A place: a landmark, a gate, a drop-in, a contract stop, a route boundary. */
  | 'name'
  /** A way out. A name, until the clock makes it the question. */
  | 'exit'
  /** A price about to be paid: the trainer watch, and nothing else so far. */
  | 'warning'
  /**
   * A rare find on the ground (`../world/loot.ts`), and the fourth question the
   * map answers: *what is worth going over there for?*
   *
   * It speaks whenever it is in view, at any distance, for the same reason a
   * warning does - both are a decision the player makes before they are in it,
   * and both are worthless once they are. A name asks to be walked up to; a
   * prize is the thing you have to decide *not* to walk up to, with the clock
   * running, and a decision made by somebody who cannot see the cost is not a
   * decision. A Potion on the grass says nothing, because nobody's heart rate
   * ever rose over a Potion.
   */
  | 'prize';

export interface CaptionSpeech {
  readonly voice: CaptionVoice;
  /**
   * The tiles this caption is about: the thing itself, and for a caption naming
   * more than one of something (a keeper's two doors) all of them, so it speaks
   * as soon as any one of them is walked up to.
   */
  readonly tiles: readonly GridPosition[];
  /** For an `exit`: whether it can be left by right now. A sealed one is only a name. */
  readonly open?: boolean;
}

export interface CaptionAudience {
  readonly player: GridPosition;
  /** True while the look key is held - see `isLooking`. */
  readonly looking: boolean;
  readonly raidRemainingMs: number;
}

/**
 * How near a name has to be before it says itself, in walking steps - the unit
 * every other distance in this game is measured in.
 *
 * Steps rather than the greater of the two axis distances, which was tried
 * first and is wrong: a square reach makes a thing four across *and* four down
 * - eight steps away, most of a screen - as near as one four steps along the
 * road, and Route 1's station apron named three things at once because of it.
 * Five steps is "the thing I have walked up to" and not "the things on this
 * screen", which is what the look is for.
 *
 * Counted straight across the grid rather than along a route, so the far bank
 * of the river still names itself across the water - water is this map's
 * sightline as well as its wall, and a name you can see but not reach yet is
 * the reason to come back.
 */
export const CAPTION_NEAR_STEPS = 5;

/**
 * How long a tapped look lasts. A held key is the intended gesture, but a tap
 * is what a hand does and what a playtest driver sends, and one frame of
 * writing is no answer - so a press opens the look for a glance whether or not
 * the key is still down.
 */
export const CAPTION_LOOK_MS = 1_200;

/**
 * When every open exit starts calling: the moment the raid clock goes red. The
 * two are one number on purpose - the colour change and the map naming its ways
 * out are the same fact about the same second.
 */
export const EXIT_CALL_MS = RAID_CLOCK_URGENT_MS;

/** Steps from the player to the nearest tile a caption is about, straight across the grid. */
export function stepsToNearest(from: GridPosition, tiles: readonly GridPosition[]): number {
  return tiles.reduce(
    (nearest, tile) => Math.min(nearest, Math.abs(tile.x - from.x) + Math.abs(tile.y - from.y)),
    Number.POSITIVE_INFINITY,
  );
}

/**
 * Whether this caption is on the screen this frame. Being in view is the
 * placement's business (`labelPlacement.ts` hides a caption whose subject has
 * scrolled off), so a warning that is always true here is still only drawn
 * while its trainer can be seen.
 */
export function captionSpeaks(speech: CaptionSpeech, audience: CaptionAudience): boolean {
  if (speech.voice === 'warning' || speech.voice === 'prize' || audience.looking) {
    return true;
  }
  if (speech.voice === 'exit' && speech.open === true && audience.raidRemainingMs <= EXIT_CALL_MS) {
    return true;
  }
  return stepsToNearest(audience.player, speech.tiles) <= CAPTION_NEAR_STEPS;
}

/**
 * The look's own clock, advanced once a frame. A press restarts it; nothing
 * else keeps it alive, because a held key is asked about separately - see
 * `isLooking`.
 */
export function advanceLookMs(remainingMs: number, pressed: boolean, deltaMs: number): number {
  return pressed ? CAPTION_LOOK_MS : Math.max(0, remainingMs - deltaMs);
}

/** Held, or still inside the glance a press bought. */
export function isLooking(remainingMs: number, held: boolean): boolean {
  return held || remainingMs > 0;
}
