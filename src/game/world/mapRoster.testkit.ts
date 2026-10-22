import { retireMapsForTests } from './mapRoster';

/**
 * Every test file runs with no map retired (`vitest.config.ts` loads this
 * before each file). The retired maps are kept so they can come back, and the
 * only way to know they still could is to go on asking every rule of them that
 * is asked of a map in play. `mapRoster.test.ts` puts the shipped list back to
 * ask what a player is actually offered.
 */
retireMapsForTests([]);
