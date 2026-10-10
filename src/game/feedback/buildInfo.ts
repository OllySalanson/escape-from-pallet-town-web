/**
 * Which build of the game is running, so a message about a bug says which
 * code had it. `vite.config.ts` stamps both at build time (the commit and the
 * moment); a test or a local server has neither and says `dev`.
 */
export const BUILD_VERSION: string = (import.meta.env.VITE_BUILD_VERSION as string | undefined) || 'dev';
export const BUILD_DATE: string = (import.meta.env.VITE_BUILD_DATE as string | undefined) || '';
