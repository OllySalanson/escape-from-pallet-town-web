import { tileReader } from '../world/tileset/catalogue';
import { ARENA_HALL_SHEET } from './generated/arenaHallTiles';

/**
 * THE RAID ARENA's great hall, painted by `scripts/draw-arena-hall.mts` onto
 * `public/assets/arena-hall.png`. Numbered from 20000, clear of every other
 * sheet the loader fetches (`catalogue.test.ts` holds the whole list apart).
 */
export const ARENA_HALL_SOURCE = tileReader({ textureKey: 'arenaHall', ...ARENA_HALL_SHEET }, 20000);
