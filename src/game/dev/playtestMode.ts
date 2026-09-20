/**
 * The explorer run: a second, separate game the captain plays to *look* at the
 * maps rather than to survive them.
 *
 * Four maps have just grown to roughly four times the ground they shipped in,
 * and the way to judge new country is to walk it - unhurried, with nothing to
 * lose and every door already open. A raid is the opposite of that by
 * construction: five minutes, a hunter, and a party that can be deleted.
 *
 * So this is a *mode*, not a difficulty. What it changes is stated once here
 * and read wherever it belongs:
 *
 * - it is **its own save** (`PLAYTEST_SAVE_KEY`), so the ordinary game is never
 *   read, written or erased by any of it - `SaveManager` resolves its key
 *   through `activeSaveSlot()`, so nothing else had to learn there are two;
 * - the player's side **cannot be knocked out** (`battleEngine.ts` floors their
 *   HP at one), so no fight, hunter or wild roll can end the run;
 * - the raid clock is `PLAYTEST_RAID_DURATION_MS`, long enough that it is never
 *   what ends a wander, while the hunter still arrives on its ordinary
 *   schedule - the escalation is measured from the raid's start, not from its
 *   length, so the mode keeps the thing worth testing and drops only the
 *   deadline;
 * - every extraction is open from the first second, and every gate with it
 *   (`playtestSave.ts`);
 * - and walking is three times faster while a shift key is held, because a
 *   64x72 map is 150ms a tile from one corner to the other.
 *
 * The flag is a module variable rather than anything stored: a reload lands on
 * the title screen, which sets it - to `normal` on every ordinary path and to
 * `playtest` on the one row that asks for it. That is what makes "no way to
 * reach it by accident" true by construction rather than by care.
 *
 * Nothing here imports anything, so the battle engine can read it without
 * pulling a save, a scene or a catalogue in behind it.
 */

/** Where an explorer run is kept. Never the key the ordinary game is kept under. */
export const PLAYTEST_SAVE_KEY = 'escape-from-pallet-town.save.playtest.v1';

export type SaveSlot = 'normal' | 'playtest';

let slot: SaveSlot = 'normal';

export function activeSaveSlot(): SaveSlot {
  return slot;
}

/** Set by `TitleScene` on every way into the game, and by nothing else in play. */
export function setActiveSaveSlot(next: SaveSlot): void {
  slot = next;
}

/** Whether the game running right now is an explorer run. */
export function isPlaytestRun(): boolean {
  return slot === 'playtest';
}

/**
 * The explorer run's clock. Eight hours rather than no clock at all: the hunter
 * arrives, the tiers escalate and every timed thing in a raid still happens on
 * its own schedule, which is what keeps the mode a game rather than a viewer.
 * What it can no longer do is end a wander.
 */
export const PLAYTEST_RAID_DURATION_MS = 8 * 60 * 60 * 1000;

/** What the raid clock chip says instead of counting eight hours down. */
export const PLAYTEST_CLOCK_LABEL = 'PLAYTEST';

/** How much faster a held shift walks. A tile is 150ms, so this is 50ms. */
export const PLAYTEST_RUN_DIVISOR = 3;

/** Said wherever a screen has to make clear which of the two games this is. */
export const PLAYTEST_PLACE_LABEL = 'Playtest';
