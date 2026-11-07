/**
 * THE FIELD-MOVE COURSE drawn as the game draws it, through the real layer
 * builder (`minigames/courseMap.ts`), with its boulders, start and finish
 * marked, and the fastest run each sort of team can make printed under it.
 *
 *   npx vite-node tools/minigames/drawCourse.mts -- out.png [zoom] [--open]
 *
 * `--open` draws it with every obstacle opened, as a Krabby leaves it. It is
 * the look-and-fix loop for a course, as `tools/tileset/renderMap.mts` is for
 * a raid map: the solver says whether the long way round works, the picture
 * says whether the yard reads as a place.
 */
import { readPng, TILE_SIZE, writePng } from '../tileset/tileSheet.mjs';
import { box, canvas, drawTile, upscale } from '../tileset/draw.mjs';
import { COURSE_SOURCES, courseLayers } from '../../src/game/minigames/courseMap';
import { COURSES, courseMovesOf, fastestRun, readCourse } from '../../src/game/minigames/fieldCourse';
import { TOWN_PIECES, TOWN_SHEET } from '../../src/game/world/generated/townPieces';

const args = process.argv.slice(2).filter((value) => value !== '--');
const out = args.find((value) => value.endsWith('.png')) ?? 'course.png';
const zoom = Number(args.find((value) => /^\d+$/.test(value)) ?? 2);
const open = args.includes('--open');

for (const layout of COURSES) {
  const course = readCourse(layout);
  const layers = courseLayers(layout, open ? course.obstacles.map((obstacle) => obstacle.id) : []);
  const spans = COURSE_SOURCES.map((source) => ({
    sheet: readPng(`public/${source.imagePath}`),
    from: source.firstIndex,
    to: source.firstIndex + source.columns * source.rows,
  }));
  const image = canvas(course.width * TILE_SIZE, course.height * TILE_SIZE, [8, 10, 14]);
  for (const layer of [layers.ground, layers.overlay, layers.detail, layers.canopy, layers.brim]) {
    for (let y = 0; y < course.height; y += 1) {
      for (let x = 0; x < course.width; x += 1) {
        const tile = layer.tiles[y][x];
        if (tile < 0) continue;
        const span = spans.find((candidate) => tile >= candidate.from && tile < candidate.to);
        if (!span) throw new Error(`tile ${tile} is on none of the course's sheets`);
        const tint = layer.tints[y][x];
        drawTile(image, span.sheet, tile - span.from, x, y, tint >= 0 ? tint : undefined, layer.flips[y][x]);
      }
    }
  }
  const town = readPng(`public/${TOWN_SHEET.imagePath}`);
  const boulder = TOWN_PIECES.strengthBoulder;
  for (const at of course.boulders) {
    drawTile(image, town, boulder.row * TOWN_SHEET.columns + boulder.column, at.x, at.y);
  }
  // The start and the finish, as the scene flags them.
  box(image, course.start.x * TILE_SIZE + 2, course.start.y * TILE_SIZE + 2, 4, 4, [240, 240, 240]);
  for (const at of course.finish) {
    for (let cell = 0; cell < 4; cell += 1) {
      box(image, at.x * TILE_SIZE + (cell % 2) * 8, at.y * TILE_SIZE + Math.floor(cell / 2) * 8, 8, 8, cell % 3 === 0 ? [248, 248, 248] : [32, 32, 40], 180);
    }
  }
  writePng(out, upscale(image, zoom));
  console.log(`${layout.name}: ${course.width}x${course.height} -> ${out}`);
  const teams: Record<string, readonly string[]> = {
    'KRABBY alone': ['krabby'],
    'BULBASAUR + SQUIRTLE': ['bulbasaur', 'squirtle'],
    BULBASAUR: ['bulbasaur'],
    CHARMANDER: ['charmander'],
    SQUIRTLE: ['squirtle'],
    'PIKACHU + PIDGEOTTO': ['pikachu', 'pidgeotto'],
    'nothing that helps': ['pidgeotto'],
  };
  for (const [name, team] of Object.entries(teams)) {
    const moves = [...new Set(team.flatMap(courseMovesOf))];
    const run = fastestRun(layout, moves);
    console.log(`  ${name.padEnd(22)} ${(moves.join(', ') || 'no field moves').padEnd(34)} ${run ? `${(run.ms / 1000).toFixed(2)} s` : 'cannot finish'}`);
  }
}
