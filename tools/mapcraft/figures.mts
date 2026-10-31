/**
 * The three of `mapStructure.testkit.ts`'s rules a fill breaks most, asked of the
 * stitched vale in about a minute rather than the several the suite takes, and
 * listing every fault rather than the first:
 *
 * - no open tile on the grid's edge but a way out;
 * - no figure the player cannot walk into on a door, at any tile of its beat
 *   (a door is a tile that takes ground away from somebody beside it);
 * - with every figure solid at once and every gate open, all the ground in one piece.
 *
 *   npx vite-node tools/mapcraft/figures.mts [-- <map id>]
 *
 * A coordinate is printed as the plan's cell and the tile inside it, which is
 * what a district's program says. Read the suite on the pull request for the rest.
 */
import { collisionBlocker, doorIndex, doorsFrom } from '../../src/game/world/hunter';
import { extractionPointsOn } from '../../src/game/world/extractionPoints';
import { gateKeys, gatesForMap } from '../../src/game/world/gates';
import { stepDistances } from '../../src/game/world/mapStructure';
import { idleBeatTiles } from '../../src/game/world/npcIdle';
import { playerLinks } from '../../src/game/world/sailing';
import { getWorldMap, type WorldMapId } from '../../src/game/worldMap';

const mapId = (process.argv.slice(2).find((value) => value !== '--') ?? 'greystone-vale') as WorldMapId;
const shut = getWorldMap(mapId);
const open = getWorldMap(mapId, gateKeys(gatesForMap(mapId)));
const where = (x: number, y: number) => `${x},${y} (cell ${Math.floor(x / 64) - 1},${Math.floor(y / 64) - 1} tile ${x % 64},${y % 64})`;
let faults = 0;
const fault = (line: string) => {
  faults += 1;
  console.log(line);
};

const exits = new Set(extractionPointsOn(mapId).map(({ position }) => `${position.x},${position.y}`));
for (let y = 0; y < shut.height; y += 1) {
  for (let x = 0; x < shut.width; x += 1) {
    const edge = x === 0 || y === 0 || x === shut.width - 1 || y === shut.height - 1;
    if (edge && !shut.collision[y][x] && !exits.has(`${x},${y}`)) fault(`open tile on the grid's edge: ${where(x, y)}`);
  }
}

const standing = (map: typeof shut) => map.entities.filter((entity) => !entity.boulder && !entity.barrier);
const bounds = { width: shut.width, height: shut.height, ...(shut.links ? { links: shut.links } : {}) };
const isBlocked = collisionBlocker(shut.collision);
for (const entity of standing(shut)) {
  for (const tile of idleBeatTiles(entity)) {
    const asker = [
      { x: tile.x + 1, y: tile.y },
      { x: tile.x - 1, y: tile.y },
      { x: tile.x, y: tile.y + 1 },
      { x: tile.x, y: tile.y - 1 },
    ].find((step) => !isBlocked(step));
    if (asker && doorsFrom(asker, bounds, isBlocked).doors.has(doorIndex(tile, bounds))) {
      fault(`${entity.id} stands on a door: ${where(tile.x, tile.y)}`);
    }
  }
}

const solid = new Set(standing(open).flatMap((entity) => idleBeatTiles(entity).map((tile) => `${tile.x},${tile.y}`)));
const start = open.collision.flatMap((row, y) => row.flatMap((wall, x) => (!wall && !solid.has(`${x},${y}`) ? [{ x, y }] : [])))[0];
const steps = stepDistances(open.collision, start, solid, playerLinks(open));
for (let y = 0; y < open.height; y += 1) {
  for (let x = 0; x < open.width; x += 1) {
    if (!open.collision[y][x] && !solid.has(`${x},${y}`) && steps[y][x] < 0) fault(`ground cut off by figures: ${where(x, y)}`);
  }
}
console.log(faults === 0 ? 'no faults' : `${faults} faults`);
process.exit(faults === 0 ? 0 : 1);
