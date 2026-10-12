/**
 * The inner loop of drawing a map with a program: compile it, check it, measure
 * it, advise on it, and draw it as the game draws it - so the next edit is made
 * looking at the picture, not imagining it.
 *
 *   npx vite-node tools/mapcraft/look.mts -- <program.ts> <out-base> [--seed=N]
 *
 * A program is a module whose default export takes a seed and returns a
 * `MapcraftResult` (`report.ts`): the map file, the part of it the program drew,
 * and the brief's walking rules. `look` writes:
 *
 *   <out-base>.json        the map file (open it in MAKE A MAP, or TRY IT)
 *   <out-base>.png         the district as the game draws it
 *   <out-base>.grid.png    the same, with tile numbers every four
 *   <out-base>.moves.png   the same, with the design moves washed in colour
 *
 * and prints the hard checks, the design moves and the pattern-language advice.
 * It exits non-zero when a hard check fails.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { writePng } from '../tileset/tileSheet.mjs';
import { formatReport, reportOn, type MapcraftResult } from './report';
import { griddedPicture, mapPicture, movesPicture } from './picture.mts';

const args = process.argv.slice(2);
const [programPath, outBase] = args.filter((value) => !value.startsWith('--'));
if (!programPath || !outBase) {
  console.error(
    'usage: npx vite-node tools/mapcraft/look.mts -- <program.ts> <out-base> [--seed=N]',
  );
  process.exit(2);
}
const seed = Number(args.find((value) => value.startsWith('--seed='))?.slice(7) ?? 1);

const module = (await import(pathToFileURL(resolve(programPath)).href)) as {
  default: (seed: number) => MapcraftResult;
};
const result = module.default(seed);
const report = reportOn(result);

mkdirSync(dirname(resolve(outBase)), { recursive: true });
writeFileSync(`${outBase}.json`, `${JSON.stringify(result.file, null, 1)}\n`);
console.log(formatReport(report));

if (report.checks[0]?.passed) {
  const crop = result.district;
  const picture = mapPicture(result.file, crop);
  writePng(`${outBase}.png`, picture);
  writePng(`${outBase}.grid.png`, griddedPicture(picture, crop ?? { x: 0, y: 0 }));
  writePng(
    `${outBase}.moves.png`,
    movesPicture(picture, result.file, report.moves, result.file.name, crop),
  );
  console.log(`\npictures: ${outBase}.png ${outBase}.grid.png ${outBase}.moves.png`);
}
process.exit(report.passed ? 0 : 1);
