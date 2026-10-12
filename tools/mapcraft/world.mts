/**
 * A huge map's inner loop: stitch the districts drawn so far into one map,
 * check every seam and the whole map, report on each district, and draw the
 * plan and the map.
 *
 *   npx vite-node tools/mapcraft/world.mts -- <world.ts> <out-base> [--seed=N] [--shrink=N]
 *
 * A world program is a module whose default export takes a seed and returns a
 * `WorldResult` (`worldReport.ts`): the world plan and a `MapcraftResult` for
 * every district drawn so far. It writes:
 *
 *   <out-base>.json             the stitched map file (TRY IT plays it)
 *   <out-base>.plan.png         the world plan, drawn districts in green
 *   <out-base>.png              the whole map as the game draws it (shrunk by --shrink, default 2)
 *   <out-base>-<district>.png   each drawn district, and its .moves.png
 *   <out-base>-<cave floor>.png each cave floor and inside
 *
 * It exits non-zero when anything is failing.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writePng } from '../tileset/tileSheet.mjs';
import { formatWorldReport, reportOnWorld, type WorldResult } from './worldReport';
import { areaPicture, mapPicture, movesPicture, planPicture, shrunk } from './picture.mts';
import { districtRect } from './worldPlan';

const args = process.argv.slice(2);
const [programPath, outBase] = args.filter((value) => !value.startsWith('--'));
if (!programPath || !outBase) {
  console.error(
    'usage: npx vite-node tools/mapcraft/world.mts -- <world.ts> <out-base> [--seed=N] [--shrink=N]',
  );
  process.exit(2);
}
const flag = (name: string, fallback: number) =>
  Number(args.find((value) => value.startsWith(`--${name}=`))?.split('=')[1] ?? fallback);

const module = (await import(pathToFileURL(resolve(programPath)).href)) as {
  default: (seed: number) => WorldResult;
};
const world = module.default(flag('seed', 1));
const report = reportOnWorld(world);
mkdirSync(dirname(resolve(outBase)), { recursive: true });
const { file } = report.stitched;
writeFileSync(`${outBase}.json`, `${JSON.stringify(file, null, 1)}\n`);
console.log(formatWorldReport(world, report));

writePng(`${outBase}.plan.png`, planPicture(world.plan, new Set(Object.keys(world.districts))));
if (report.checks[0]?.passed) {
  const whole = mapPicture(file);
  const factor = flag('shrink', 2);
  writePng(`${outBase}.png`, factor > 1 ? shrunk(whole, factor) : whole);
  for (const [id, result] of Object.entries(world.districts)) {
    const rect = districtRect(world.plan, id);
    const picture = mapPicture(file, rect);
    writePng(`${outBase}-${id}.png`, picture);
    writePng(
      `${outBase}-${id}.moves.png`,
      movesPicture(picture, result.file, report.districts[id].moves, result.file.name),
    );
  }
  for (const area of file.areas ?? [])
    writePng(`${outBase}-${area.id}.png`, areaPicture(file, area.id));
}
console.log(`\npictures: ${outBase}.plan.png ${outBase}.png ${outBase}-<district>.png`);
process.exit(report.passed ? 0 : 1);
