import { formatRaidClock } from '../run/raidClock';
import { PLAYTEST_CLOCK_LABEL } from '../dev/playtestMode';
import { weatherLabel, type WeatherId } from '../pokemon/battle/weather';

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
  playtest = false,
): RaidClockView {
  // An explorer run's clock is eight hours long, which is a number nobody
  // wants counted down in the corner of a map they are looking at. The chip
  // says which game this is instead - the one thing about the corner of the
  // screen that is still worth saying in that mode.
  if (playtest) {
    return { label: PLAYTEST_CLOCK_LABEL, tone: 'calm', pulses: false };
  }
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

export const FIELD_GUIDE_HINT = '[O] GUIDE';
/**
 * The look: every name on the screen while it is held. The map does not caption
 * itself any more (`ui/captionReveal.ts`), so this is the key that answers
 * "what is all of this called" - and the chip is where it is taught, because a
 * key nothing on the screen names is a key nobody presses.
 */
export const LOOK_HINT = '[L] LOOK';

/**
 * The two keys the raid screen is read with, on one line: it is what the
 * detail row is for, and two short hints fit where `[O] FIELD GUIDE` sat.
 */
export const RAID_KEY_HINTS = `${FIELD_GUIDE_HINT}  ${LOOK_HINT}`;

/**
 * The explorer run's third key. It is taught here for the same reason the look
 * is: a key nothing on the screen names is a key nobody presses.
 */
export const RUN_HINT = '[SHIFT] RUN';

/**
 * The objective chip is one line by default and only opens up when the thing it
 * says has just changed - which is the only moment the extra line is news.
 *
 * The leading marker is not a character: it is drawn as the game's menu cursor,
 * because every arrow glyph a browser might substitute for `►` at eight pixels
 * came out as a dash.
 */
export function objectiveChipLines(
  cue: string,
  showDetail: boolean,
  playtest = false,
): readonly string[] {
  const hints = playtest ? `${RAID_KEY_HINTS}  ${RUN_HINT}` : RAID_KEY_HINTS;
  return showDetail ? [cue, hints] : [cue];
}

/**
 * How long a place's name stays up after the player walks into it. The games
 * this one is dressed as name a place as you arrive and then get out of the
 * way, and so does this: long enough to read two words without stopping, and
 * gone before it is the thing being looked at instead of the road.
 */
export const PLACE_PLATE_MS = 3_500;

/**
 * The arrival plate: the name of the district just walked into, while it is
 * news. Null once it has been read, and on a map that names no districts.
 */
export function placePlateLine(name: string | null, remainingMs: number): string | null {
  return name !== null && remainingMs > 0 ? name : null;
}

/**
 * What the chip says once no objective is left to name. It said EXTRACT WITH
 * YOUR HAUL to a player carrying nothing, which is an instruction to bank an
 * empty pack; with nothing found yet the raid's business is still the finding.
 */
export function openRaidCue(carried: { readonly items: number; readonly pokemon: number }): string {
  return carried.items + carried.pokemon > 0 ? 'EXTRACT WITH YOUR HAUL' : 'FIND LOOT, THEN EXTRACT';
}

/**
 * The weather of the place the player is standing in, or null.
 *
 * It is its own chip rather than a second line on the arrival plate because the
 * two answer different questions and last for different lengths of time: the
 * plate says where you have just arrived and is gone in three and a half
 * seconds, and the weather is a thing you need to know when you walk into tall
 * grass a minute later. Map captions cannot do this job either - a caption now
 * speaks only within five steps of the thing it names (`ui/captionReveal.ts`),
 * and weather is not a thing on the map with tiles to stand near; it is the
 * whole district.
 *
 * It is the name and nothing else. What rain does to a Fire move is a battle's
 * business and the battle says it in words; the chip's job is to make sure the
 * player was never surprised by it.
 */
export function weatherChipLine(weather: WeatherId | null): string | null {
  return weather === null ? null : weatherLabel(weather);
}

/** Tiles between the player and the hunter at which the hunter chip appears. */
export const HUNTER_ALERT_DISTANCE = 8;

export type HunterChipTone = 'lost-you' | 'closing' | 'intel';

export interface HunterChipView {
  readonly label: string;
  readonly tone: HunterChipTone;
  /** The radio mast's line, under whatever the chip was already saying. */
  readonly detail?: string;
}

/** What the radio mast knows. Mirrors `HunterIntel` in `../world/hunter`. */
export interface HunterChipIntel {
  readonly level: number;
  readonly teamSize: number;
  readonly next: { readonly level: number; readonly teamSize: number; readonly inMs: number } | null;
}

export interface HunterChipInput {
  /** True while an escape is still holding the hunter off the trail. */
  readonly searching: boolean;
  readonly searchRemainingMs?: number;
  /** Steps between the player and the hunter, or null when it is elsewhere. */
  readonly distance: number | null;
  /** Compass letters from the player toward the hunter, e.g. `NW`. */
  readonly direction: string;
  /**
   * Present only on a raid deployed from a base with the radio mast, and only
   * while there is still a hunter to report on.
   */
  readonly intel?: HunterChipIntel;
}

/** One hunter team in the fewest characters that still name it: `LV9 x2`. */
function hunterTeamLabel(team: { readonly level: number; readonly teamSize: number }): string {
  return `LV${team.level} x${team.teamSize}`;
}

/**
 * The mast's one line: the next team and when, or that this is the last.
 *
 * It is information and nothing else - it does not slow the hunter or soften
 * its team - so what it changes is routing: whether there is time for one more
 * stop before the fight waiting outside gets worse.
 */
export function hunterIntelLine(intel: HunterChipIntel): string {
  return intel.next === null
    ? 'FINAL TEAM'
    : `${hunterTeamLabel(intel.next)} IN ${formatRaidClock(intel.next.inMs)}`;
}

/**
 * Null means show nothing.
 *
 * The old HUD only ever spoke about the hunter after an escape, so a hunter
 * walking in from off screen was announced once in a dialogue box and then went
 * quiet. This shows it whenever it is actually near, and says which way.
 */
export function hunterChipView(input: HunterChipInput): HunterChipView | null {
  const view = hunterContactView(input);
  if (!input.intel) {
    return view;
  }
  // With the mast the chip is never empty while a hunter is in the raid: when
  // there is nothing nearer to say, it says who is coming. The mast's line
  // rides under a contact warning rather than replacing it, because which way
  // the hunter is matters more than what it is carrying.
  return view
    ? { ...view, detail: `${hunterTeamLabel(input.intel)}, ${hunterIntelLine(input.intel)}` }
    : {
      label: `HUNTER ${hunterTeamLabel(input.intel)}`,
      tone: 'intel',
      detail: hunterIntelLine(input.intel),
    };
}

function hunterContactView(input: HunterChipInput): HunterChipView | null {
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
