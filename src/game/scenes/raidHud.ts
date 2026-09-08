import { formatRaidClock } from '../run/raidClock';

/**
 * What the in-raid overlays say, as data.
 *
 * The raid HUD is the only thing drawn on top of the map the player is trying
 * to read, so every decision about what it shows - and about when it is allowed
 * to take more room - lives here where it can be tested without Phaser, in the
 * same way `battlePresentation.ts` owns the battle screen's wording.
 */

/** Colour ramp shown in the corner as the raid runs out. */
export type RaidClockTone = 'calm' | 'caution' | 'urgent' | 'enraged';

/**
 * The clock escalates in two steps before it starts alarming.
 *
 * `CAUTION` is a silent colour change: the last fifth of the raid should look
 * different without adding an interruption. `URGENT` keeps the threshold the
 * flash and the low-HP sting have always fired on, so the alert schedule is
 * unchanged by the redesign.
 */
export const RAID_CLOCK_CAUTION_MS = 60_000;
export const RAID_CLOCK_URGENT_MS = 30_000;

export interface RaidClockView {
  readonly label: string;
  readonly tone: RaidClockTone;
  /** Alarm states breathe; calm ones hold still so they stay ignorable. */
  readonly pulses: boolean;
}

export function raidClockView(
  remainingMs: number,
  isEnraged: boolean,
  enrageGraceRemainingMs: number,
): RaidClockView {
  if (isEnraged) {
    // The raid clock is spent, but the grace period is the number that now
    // decides whether the player gets out, so it is what the chip counts down.
    return {
      label: `ENRAGED ${formatRaidClock(enrageGraceRemainingMs)}`,
      tone: 'enraged',
      pulses: true,
    };
  }

  const label = `RAID ${formatRaidClock(remainingMs)}`;
  if (remainingMs <= RAID_CLOCK_URGENT_MS) {
    return { label, tone: 'urgent', pulses: true };
  }
  if (remainingMs <= RAID_CLOCK_CAUTION_MS) {
    return { label, tone: 'caution', pulses: false };
  }
  return { label, tone: 'calm', pulses: false };
}

/** The threat tier the flash and warning sting fire on. Enrage is separate. */
export function raidClockAlertTier(remainingMs: number): 'normal' | 'urgent' {
  return remainingMs <= RAID_CLOCK_URGENT_MS ? 'urgent' : 'normal';
}

/**
 * How long a changed objective stays expanded before collapsing back to its
 * one-line cue. Long enough to read two short lines, short enough that the
 * panel is not what you are looking at while you walk.
 */
export const OBJECTIVE_DETAIL_MS = 4_500;

export const FIELD_GUIDE_HINT = '[O] FIELD GUIDE';

/**
 * The objective chip is one line by default and only opens up when the thing it
 * says has just changed - which is the only moment the extra line is news.
 *
 * The leading marker is not a character: it is drawn as the game's menu cursor,
 * because every arrow glyph a browser might substitute for `►` at eight pixels
 * came out as a dash.
 */
export function objectiveChipLines(cue: string, showDetail: boolean): readonly string[] {
  return showDetail ? [cue, FIELD_GUIDE_HINT] : [cue];
}

/** Tiles between the player and the hunter at which the hunter chip appears. */
export const HUNTER_ALERT_DISTANCE = 8;

export type HunterChipTone = 'lost-you' | 'closing';

export interface HunterChipView {
  readonly label: string;
  readonly tone: HunterChipTone;
}

export interface HunterChipInput {
  /** True while an escape is still holding the hunter off the trail. */
  readonly searching: boolean;
  readonly searchRemainingMs?: number;
  /** Steps between the player and the hunter, or null when it is elsewhere. */
  readonly distance: number | null;
  /** Compass letters from the player toward the hunter, e.g. `NW`. */
  readonly direction: string;
}

/**
 * Null means show nothing.
 *
 * The old HUD only ever spoke about the hunter after an escape, so a hunter
 * walking in from off screen was announced once in a dialogue box and then went
 * quiet. This shows it whenever it is actually near, and says which way.
 */
export function hunterChipView(input: HunterChipInput): HunterChipView | null {
  if (input.searching) {
    // The subject of this chip is the hunter, not the player. `OFF TRAIL` named
    // neither and read as a warning about where the player had wandered to, when
    // what it counts down is how long the thing chasing them stays blind.
    const seconds = Math.max(0, Math.ceil((input.searchRemainingMs ?? 0) / 1_000));
    return { label: `HUNTER LOST YOU ${seconds}s`, tone: 'lost-you' };
  }
  if (input.distance === null || input.distance > HUNTER_ALERT_DISTANCE) {
    return null;
  }
  return { label: `HUNTER ${input.direction} ${input.distance}`, tone: 'closing' };
}
