import { isPlaytestRun } from './playtestMode';

/**
 * The hour an explorer run is played at, when the PLAYTEST BOARD has set one
 * (`dev/playtestBoard.ts`).
 *
 * The harbour keeps the player's own clock (`base/homeClock.ts`), which is the
 * right thing for a player and the wrong one for somebody checking how the
 * yard looks at night at half past two in the afternoon. So the board can set
 * the light by hand, and `windowLight` - the one question everything that
 * keeps the clock asks, the night raid included - answers with it.
 *
 * Only in the explorer run: the ordinary game asks `isPlaytestRun()` and gets
 * no, so nothing set here can reach a real save's harbour or a real raid.
 * Nothing is stored either; a reload is the player's own clock again.
 */
export type PlaytestHour = 'day' | 'dusk' | 'night';

let hour: PlaytestHour | null = null;

/** The hour the board set, or null to keep the player's own clock. */
export function setPlaytestHour(next: PlaytestHour | null): void {
  hour = next;
}

/** The hour set by the board, while it applies: in the explorer run only. */
export function playtestHour(): PlaytestHour | null {
  return hour !== null && isPlaytestRun() ? hour : null;
}
