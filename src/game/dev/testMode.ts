export const TEST_MODE_QUERY = 'testmode';
export const TEST_MODE_ENV = 'VITE_EPTW_TEST_MODE';

/** Ten frames a second: a sixth of the work, and still a game a driver can poll. */
export const TEST_MODE_FPS = 10;

/**
 * Test mode is for the automated checks that drive the real game in a headless
 * browser, several of them at once on one machine. It is asked for by name and
 * by nothing else: `?testmode=1` on a development build, or a build made with
 * `VITE_EPTW_TEST_MODE=1`. A production build ignores the URL, and a plain
 * `npm run dev` sets neither, so nobody plays - or tests - at ten frames a
 * second by accident.
 */
export function isTestModeRequested(
  isDevelopment: boolean = import.meta.env.DEV,
  search: string = typeof window === 'undefined' ? '' : window.location.search,
  env: string | undefined = import.meta.env[TEST_MODE_ENV] as string | undefined,
): boolean {
  if (env === '1') {
    return true;
  }
  return isDevelopment && new URLSearchParams(search).get(TEST_MODE_QUERY) === '1';
}

/**
 * The loop test mode runs: off `setTimeout` at ten frames a second rather than
 * off the display. The game's rules read delta time, so its clocks run true; a
 * walked step still ends on a frame boundary, so walking is slower per tile here.
 */
export const TEST_MODE_LOOP = { target: TEST_MODE_FPS, forceSetTimeOut: true } as const;
