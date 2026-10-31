import { tileReader } from '../world/tileset/catalogue';
import { ARENA_HALL_SHEET } from './generated/arenaHallTiles';

/**
 * THE RAID ARENA's great hall, painted by `scripts/draw-arena-hall.mts` onto
 * `public/assets/arena-hall.png`. Numbered from 23000, last of the sheets the
 * loader fetches and clear of every other (`catalogue.test.ts` holds the whole
 * list apart), because it is the one sheet that grows whenever the hall does: at
 * 20000 the hall's wider walks ran it through the boardwalk's planks at 22000.
 */
export const ARENA_HALL_SOURCE = tileReader({ textureKey: 'arenaHall', ...ARENA_HALL_SHEET }, 23000);
