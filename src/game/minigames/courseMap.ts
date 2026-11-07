import { MapSketch } from '../world/mapGrid';
import { buildMapLayers, type MapLayers } from '../world/tiles';
import { PLAYER_MAP_TILESET, type PlayerMapPropName } from '../world/tileset/playerMapTileset';
import type { TileSource } from '../world/tileset/catalogue';
import { readCourse, type CourseLayout } from './fieldCourse';

/**
 * THE FIELD-MOVE COURSE drawn in the game's own tiles: the map maker's
 * catalogue (`PLAYER_MAP_TILESET`), because its doors are the ones the
 * course practises - FireRed's small tree, its cracked rock and a pond that
 * SURF turns into water shallow enough to wade, exactly as `fileDoorGates`
 * lays them on a player's map. The boulder is not a tile: it moves, so the
 * scene draws it as a figure, as `WorldScene.createBoulder` does.
 *
 * A course's own letters are read as the map's materials here and nowhere
 * else, so the course module knows walls and ground and this one knows tiles.
 */

/** The map letter each course letter is drawn as (`MATERIAL_CHARS`). */
const GROUND_OF: Readonly<Record<string, string>> = {
  T: 'T',
  '#': '#',
  F: 'F',
  V: 'W',
  '.': '.',
  ',': ',',
  g: 'g',
  d: 'd',
  S: ',',
  E: ',',
  x: '.',
  o: ',',
  O: ',',
};

/** The landmark a course's standing things are, each drawn on the ground round it. */
const STANDING: Readonly<Record<string, PlayerMapPropName>> = { r: 'rockClear', n: 'sack', i: 'signTips' };

/** The ground most of a tile's neighbours are, for what stands on it. */
function groundUnder(layout: CourseLayout, x: number, y: number): string {
  const counts = new Map<string, number>();
  for (const [dx, dy] of [[0, -1], [0, 1], [-1, 0], [1, 0]] as const) {
    const ground = GROUND_OF[layout.rows[y + dy]?.[x + dx] ?? ''];
    if (ground && '.,dg'.includes(ground)) counts.set(ground, (counts.get(ground) ?? 0) + 1);
  }
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '.';
}

export const COURSE_SOURCES: readonly TileSource[] = PLAYER_MAP_TILESET.sources;

/** The course's layers with these obstacles open (by `CourseObstacle.id`). */
export function courseLayers(layout: CourseLayout, opened: readonly string[]): MapLayers {
  const course = readCourse(layout);
  const sketch = new MapSketch<PlayerMapPropName>({ width: course.width, height: course.height, fill: 'T' });
  sketch.draw(
    0,
    0,
    layout.rows.map((row, y) =>
      [...row].map((char, x) => (char in STANDING ? groundUnder(layout, x, y) : char === 'W' ? 'W' : (GROUND_OF[char] ?? '.'))).join(''),
    ),
  );
  layout.rows.forEach((row, y) =>
    [...row].forEach((char, x) => {
      if (char in STANDING) sketch.plant(x, y, STANDING[char]);
    }),
  );
  for (const obstacle of course.obstacles) {
    const open = opened.includes(obstacle.id);
    if (obstacle.kind === 'pond') {
      if (open) {
        for (const tile of obstacle.tiles) sketch.draw(tile.x, tile.y, ['w']);
      }
      continue;
    }
    if (!open) {
      const [tile] = obstacle.tiles;
      sketch.plant(tile.x, tile.y, obstacle.kind === 'cut' ? 'cutTree' : 'smashRock');
    }
  }
  return buildMapLayers(sketch, PLAYER_MAP_TILESET);
}
