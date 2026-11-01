import { formatRaidClock } from '../run/raidClock';
import { PLAYTEST_CLOCK_LABEL } from '../dev/playtestMode';
import { weatherLabel, type WeatherId } from '../pokemon/battle/weather';
import {
  keyHint,
  RAID_KEY_LETTERS,
  RAID_KEY_WORDS,
  raidKeyHintLine,
  raidKeysToName,
  READING_KEYS,
} from '../input/keyBindings';
import type { GridPosition } from '../movement/gridMovement';
import { placedAreaAt, type PlacedArea } from '../world/mapAreas';

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
  // A night raid (`world/nightRaids.ts`) says so on the clock and nowhere
  // else: the world is drawn at one brightness, and the one word is the whole
  // of the marker, on the chip a player already reads every few seconds.
  night = false,
): RaidClockView {
  // An explorer run's clock is eight hours long, which is a number nobody
  // wants counted down in the corner of a map they are looking at. The chip
  // says which game this is instead - the one thing about the corner of the
  // screen that is still worth saying in that mode - and whether it is night,
  // which the explorer's final check promised and nothing else in the world says.
  if (playtest) {
    return { label: night ? `NIGHT ${PLAYTEST_CLOCK_LABEL}` : PLAYTEST_CLOCK_LABEL, tone: 'calm', pulses: false };
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

  const label = `${night ? 'NIGHT RAID' : 'RAID'} ${formatRaidClock(remainingMs)}`;
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

export const FIELD_GUIDE_HINT = keyHint(RAID_KEY_LETTERS.objectives, 'OAK');
/**
 * The look: every name on the screen while it is held. The map does not caption
 * itself any more (`ui/captionReveal.ts`), so this is the key that answers
 * "what is all of this called" - and the chip is where it is taught, because a
 * key nothing on the screen names is a key nobody presses.
 */
export const LOOK_HINT = keyHint(RAID_KEY_LETTERS.look, 'LOOK');

/**
 * The two keys the raid screen is read with, on one line: it is what the
 * detail row is for, and two short hints fit where `[O] FIELD GUIDE` sat.
 */
export const RAID_KEY_HINTS = raidKeyHintLine(READING_KEYS);

/**
 * The explorer run's third key. It is taught here for the same reason the look
 * is: a key nothing on the screen names is a key nobody presses.
 */
export const RUN_HINT = '[SHIFT] RUN';

/**
 * The objective chip is one line by default and only opens up when the thing it
 * says has just changed - which is the only moment the extra line is news.
 *
 * The exception is a key the save has never pressed (`input/keyBindings.ts`):
 * it stays named on the second line until it has been used once, because a
 * newcomer who missed the row while the briefing was up had no way to find the
 * bag again (playtest 43). Once every key is learned the chip is what it was.
 *
 * The leading marker is not a character: it is drawn as the game's menu cursor,
 * because every arrow glyph a browser might substitute for `►` at eight pixels
 * came out as a dash.
 */
export function objectiveChipLines(
  cue: string,
  showDetail: boolean,
  playtest = false,
  learned: ReadonlySet<string> = EVERY_KEY_LEARNED,
): readonly string[] {
  const keys = raidKeyHintLine(raidKeysToName(showDetail, learned));
  const hints = playtest && showDetail ? `${keys}  ${RUN_HINT}` : keys;
  return hints ? [cue, hints] : [cue];
}

/** A save that has pressed every raid key: the chip as it was before keys were taught. */
const EVERY_KEY_LEARNED: ReadonlySet<string> = new Set(RAID_KEY_WORDS.map(([id]) => id));

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
 *
 * With a haul it names the nearest open exit and which way it is, as every
 * stop before it was named: the chip read LOST KIT: S and then, the moment the
 * kit was found, an instruction with no direction in it (playtest 47). Only
 * with no open exit in reach does it fall back on the bare instruction.
 */
export function openRaidCue(
  carried: { readonly items: number; readonly pokemon: number },
  exit?: { readonly label: string; readonly heading: string },
): string {
  if (carried.items + carried.pokemon === 0) {
    // The way out from the first frame: nothing else says where a raid ends.
    return exit ? `FIND LOOT, OUT BY ${exit.label.toUpperCase()}: ${exit.heading}` : 'FIND LOOT, THEN EXTRACT';
  }
  return exit ? `EXTRACT VIA ${exit.label.toUpperCase()}: ${exit.heading}` : 'EXTRACT WITH YOUR HAUL';
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

/**
 * How long the chip shouts who has picked up the trail, once the hunter
 * arrives. That shout is all that is left of the arrival's dialogue box, which
 * stopped the player dead (`world/hunterWarning.ts`): the edge glow says that
 * something is on the player's tail, the chip says who.
 */
export const HUNTER_SHOUT_MS = 3_000;

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
  /** The rival hunting this raid, as their name is printed: `BLUE`. Absent reads `HUNTER`. */
  readonly who?: string;
  /**
   * For `HUNTER_SHOUT_MS` after the hunter arrives: whether it has just arrived
   * or come back for the enrage - or, after a hunter of the pack gives up on
   * the player, that it has lost them.
   */
  readonly shout?: 'arrived' | 'back' | 'lost' | null;
  /** True while an escape is still holding the hunter off the trail. */
  readonly searching: boolean;
  readonly searchRemainingMs?: number;
  /** Steps between the player and the hunter, or null when it is elsewhere. */
  readonly distance: number | null;
  /** Compass letters from the player toward the hunter, e.g. `NW`. */
  readonly direction: string;
  /**
   * True while the player is under a roof and the hunter is chasing a sighting
   * that is no longer true (`interiors.ts`). It outranks the distance warning:
   * how near the hunter is matters less than the fact that it does not know
   * where you are, which is the whole reason to be standing in a cave.
   */
  readonly offTheScent?: boolean;
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
      label: `${input.who ?? 'HUNTER'} ${hunterTeamLabel(input.intel)}`,
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
    return { label: `${input.who ?? 'HUNTER'} LOST YOU ${seconds}s`, tone: 'lost-you' };
  }
  if (input.offTheScent === true) {
    // Named for the hunter, as the line above it is: what the player wants to
    // know standing in the dark is not where they are, it is that the thing
    // outside is looking somewhere else.
    return { label: `${input.who ?? 'HUNTER'} OFF THE SCENT`, tone: 'lost-you' };
  }
  const who = input.who ?? 'HUNTER';
  // A getaway is said as plainly as an arrival: the chase is over, and which
  // hunter gave up is what the player wants to read in the moment it does.
  if (input.shout === 'lost') {
    return { label: `${who} LOST YOU`, tone: 'lost-you' };
  }
  // The shout outranks the distance (the hunter arrives inside it) but not the
  // two lines above, which are only true after it has been fled or lost.
  if (input.shout) {
    return { label: input.shout === 'back' ? `${who} IS BACK` : `${who} ON YOUR TAIL`, tone: 'closing' };
  }
  if (input.distance === null || input.distance > HUNTER_ALERT_DISTANCE) {
    return null;
  }
  return { label: `${who} ${input.direction} ${input.distance}`, tone: 'closing' };
}

// ---------------------------------------------------------------------------
// The prize chip
// ---------------------------------------------------------------------------

/**
 * What the map is holding that a raid could be *for*, once the player has seen
 * it: the thing's own name, which way it lies, and how many steps it is.
 *
 * Why it is a chip and not only a caption. A caption is drawn over the map and
 * only while its subject is on screen, so the moment a player turns away from a
 * Fire Stone the game stops asking. That is exactly the wrong moment to stop
 * asking: the whole of greed is "I know it is back there, and my clock is
 * running", and a decision that is only offered once is not a decision, it is a
 * reflex. So the chip is the caption's memory - it appears the first frame the
 * prize is in view and stays for the rest of the raid, counting the steps back
 * to it, until it is picked up or the raid ends.
 *
 * It is never shown for a prize that has not been seen. The dark on the drop-in
 * map is the same rule: a vast map is built so that finding out what is in it
 * costs something, and a HUD that named every rarity at 0:00 would hand that
 * over for nothing.
 */
export interface PrizeChipInput {
  /** What the find is called, as the item catalogue names it. */
  readonly name: string;
  /** Compass letters from the player toward it, e.g. `SE`. */
  readonly direction: string;
  /** Steps between the player and it. */
  readonly distance: number;
}

export interface PrizeChipView {
  readonly label: string;
  /** The line under it: how far, and which way. */
  readonly detail: string;
}

/**
 * Null means show nothing - nothing seen yet, or it is already in the pack.
 *
 * Two lines rather than one, because the two halves are read at different
 * moments: the name is what the player is deciding about and the distance is
 * what they are deciding it against, and squeezing them onto one line put the
 * number where the eye goes last.
 */
export function prizeChipView(input: PrizeChipInput | null): PrizeChipView | null {
  if (input === null) {
    return null;
  }
  return {
    label: input.name.toUpperCase(),
    detail: `${input.direction} ${input.distance}`,
  };
}

// ---------------------------------------------------------------------------
// The friend chip
// ---------------------------------------------------------------------------

/** One other player in a raid room, as the raid knows them (`raidRoom/friendRoom.ts`). */
export interface FriendChipFriend {
  readonly name: string;
  /** Still getting ready at base. */
  readonly atLab: boolean;
  /** Which way to go for them - straight at them, or at the door between - once they are seen. */
  readonly heading: string | null;
  /** Tiles away, on the same place of the map; null in another place, or not yet seen. */
  readonly distance: number | null;
  /** Where they are when it is another place of the map than the player's. */
  readonly elsewhere: 'indoors' | 'outdoors' | null;
  /** In a fight: the room's hunter's, or any other. Optional, so a raid with no hunter to share says nothing of it. */
  readonly fighting?: 'hunter' | 'wild' | null;
  /** Which way, and how far, to the tile they pinged, while their ping shows. */
  readonly ping?: FriendChipPing;
}

/** A friend's ping as the chip says it: which way, and how far on the player's own place of the map. */
export interface FriendChipPing {
  readonly heading: string;
  /** Tiles away, on the same place of the map; null in another place. */
  readonly distance: number | null;
  /** Where the pinged tile is when it is another place of the map than the player's. */
  readonly elsewhere: 'indoors' | 'outdoors' | null;
}

/**
 * Where `tile` is when it is another place of the map than the one `from` is
 * in, or null on the same place (or a map with no insides). A map's insides
 * are laid east of the outdoors on one grid (`mapAreas.ts`), so steps counted
 * across that grid between two places are no walk anybody can take: a line
 * about somebody or something in another place says which place and which
 * door, never a number.
 */
export function placeApart(
  areas: readonly PlacedArea[] | undefined,
  from: GridPosition,
  tile: GridPosition,
): 'indoors' | 'outdoors' | null {
  if (!areas || areas.length === 0) {
    return null;
  }
  const mine = placedAreaAt(areas, from) ?? areas[0];
  const theirs = placedAreaAt(areas, tile) ?? areas[0];
  return theirs === mine ? null : theirs === areas[0] ? 'outdoors' : 'indoors';
}

/** A friend's ping, read from where the player stands (`heading` is the way to it, door-aware). */
export function friendChipPing(
  areas: readonly PlacedArea[] | undefined,
  from: GridPosition,
  tile: GridPosition,
  heading: string,
): FriendChipPing {
  const elsewhere = placeApart(areas, from, tile);
  return {
    heading,
    distance: elsewhere ? null : Math.abs(tile.x - from.x) + Math.abs(tile.y - from.y),
    elsewhere,
  };
}

export interface FriendChipInput {
  /** The room's code, said while nobody else is in it so it can be read out. */
  readonly code: string;
  /** Somebody came or went just now, or did something worth saying (`line`). */
  readonly news: { readonly name: string; readonly came: boolean; readonly line?: string } | null;
  /** Everybody else in the room. */
  readonly friends: readonly FriendChipFriend[];
}

/**
 * The friend chip: who else is raiding this map and which way each of them is,
 * a line each (a room holds four, so at most three).
 *
 * It answers the one question a vast map asks of players raiding together -
 * where did they go - in the hunter chip's own words (a name, a heading, how
 * far), and says the moment one of them leaves, whichever way they went: an
 * exit, a loss and a closed tab all look the same from here, and all mean the
 * raid carries on. While nobody else is in, it is the room's code, which is
 * the thing to read out to a friend.
 */
export function friendChipLines(input: FriendChipInput): readonly string[] {
  const news = input.news
    ? [input.news.line ?? (input.news.came ? `${input.news.name} IS IN THE ROOM` : `${input.news.name} LEFT THE RAID`)]
    : [];
  const friends = input.friends
    .filter((friend) => !(input.news?.came && !input.news.line && input.news.name === friend.name))
    .map(friendLine);
  const lines = [...news, ...friends];
  return lines.length > 0 ? lines : [`ROOM ${input.code}`];
}

function friendLine(friend: FriendChipFriend): string {
  if (friend.atLab) {
    return `${friend.name} GETTING READY`;
  }
  if (friend.ping) {
    const { heading, distance, elsewhere } = friend.ping;
    return elsewhere
      ? `${friend.name} PING ${elsewhere.toUpperCase()} ${heading}`
      : `${friend.name} PING ${heading} ${distance ?? ''}`.trimEnd();
  }
  if (friend.fighting === 'hunter') {
    return `${friend.name} FIGHTS THE HUNTER`;
  }
  if (friend.fighting === 'wild') {
    return `${friend.name} IN A FIGHT`;
  }
  if (friend.heading === null) {
    return `${friend.name} ON THE MAP`;
  }
  if (friend.elsewhere) {
    return `${friend.name} ${friend.elsewhere.toUpperCase()} ${friend.heading}`;
  }
  if (friend.distance !== null && friend.distance <= 1) {
    return `${friend.name} BESIDE YOU`;
  }
  return `${friend.name} ${friend.heading} ${friend.distance ?? ''}`.trimEnd();
}
