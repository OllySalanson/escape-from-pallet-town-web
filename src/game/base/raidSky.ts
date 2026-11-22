import { formatRecoveryClock } from '../hub/recovery';
import { isDawn, windowLight, type WindowLight } from './homeClock';

/**
 * Waiting on the rim for a darker sky.
 *
 * A raid's sky is the player's own clock (`homeClock.ts`), and two pieces of
 * the treasure map wait on it: THE LONG SHADOW at dusk on the moor and THE LOST
 * FOLD at night (`../world/secrets.ts`). A player who only ever plays in the
 * afternoon could never reach either, and the 20 Nov AI playtesters sat through
 * whole sessions of the wrong sky (#39, #63, #95). Olly's pick of 22 Nov: keep
 * the hour, and let a second route reach it - the rim lets a raid wait for
 * dusk or for dark.
 *
 * Waiting is paid for in raid clock, as Nurse Joy's healing is (`../hub/recovery`):
 * a minute off the next raid, whichever sky is waited for, so the real dusk is
 * still the cheaper one and the wait is a choice rather than a setting. It is
 * only ever later in the evening: a raid waits for the dark, never for the day.
 */

/** What waiting on the rim takes off the raid's clock. */
export const WAIT_FOR_DARK_MS = 60_000;

/** The skies a raid jumped now could wait for, darkest last: none at night. */
export function waitableSkies(now: Date): readonly WindowLight[] {
  const light = windowLight(now);
  if (light === 'night') {
    return [];
  }
  // The morning's twilight is the sun coming up: the next dusk is the evening's.
  return light === 'dusk' && !isDawn(now) ? ['night'] : ['dusk', 'night'];
}

/** The sky a raid jumped now will have: the one waited for, if it can be, else the clock's. */
export function raidSky(now: Date, waited: WindowLight | undefined): WindowLight {
  return waited !== undefined && waitableSkies(now).includes(waited) ? waited : windowLight(now);
}

/** What waiting for a sky costs, off a raid clock of `clockMs`. */
export function clockAfterWaiting(clockMs: number, waited: boolean): number {
  return waited ? Math.max(0, clockMs - WAIT_FOR_DARK_MS) : clockMs;
}

/** The rim's Sky line for a sky waited for. */
export function waitedSkyNote(light: WindowLight): string {
  return `${light === 'night' ? 'night' : 'dusk'}: you wait on the rim for it. It costs ${formatRecoveryClock(WAIT_FOR_DARK_MS)} of the raid clock`;
}

/** What the button that waits for a sky says. */
export function waitButtonLabel(light: WindowLight): string {
  return light === 'night' ? 'Wait for dark' : 'Wait for dusk';
}
