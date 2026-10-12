/**
 * Gets approved player maps ready to publish: the middle of the map maker's
 * pipeline, and the only part that runs the game's own code.
 *
 *   npx --no-install vite-node tools/maps/publishApproved.mts -- prepare <fetched dir> <out dir>
 *
 * It reads what `projectRequests.mjs fetch` read out of the project, runs the
 * game's own `readMapFile` and `checkMapFile` on every approved map - the same
 * checks the editor showed its maker, so a map that passed there is never
 * refused here for a reason nobody showed them - and writes each that passes
 * to `src/maps/player/` as one file, which is the whole of adding a map to the
 * game, and a copy into `<out dir>/maps/` for the job that commits it. A map
 * that fails, or that the game cannot even read, is listed to be sent back to
 * its maker with the reasons, rather than published broken or stopping every
 * map behind it (red team F1). `<out dir>/outcome.json` is that list, which
 * `projectRequests.mjs mark` records once the change is tested and merged.
 *
 * A fix the maker sent in to a map already in the game arrives carrying that
 * map's file id, and **replaces** it: the same file, the same id, and every
 * drop-in the published map had keeping its id however the fix renamed or
 * moved it (`keepPublishedIds`), so the survey, raid record and landings a
 * player holds on the map are still theirs (the owner's call on playtest 35,
 * option a). A fix is never published as a second copy beside the first, and
 * never over a map that is no longer its maker's or no longer in the game
 * (red team F12).
 *
 * It holds no key and asks the project nothing: it runs in the workflow job
 * that installs the game's dependencies, which is why that job has no secret
 * (red team F2).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { prepareMaps, type Approved } from './prepareMaps';

const [mode, fetchedDir, outDir] = process.argv.slice(2).filter((argument) => argument !== '--');
if (mode !== 'prepare' || !fetchedDir || !outDir) {
  throw new Error('usage: publishApproved.mts -- prepare <fetched dir> <out dir>');
}
prepareMaps(
  JSON.parse(readFileSync(join(fetchedDir, 'approved.json'), 'utf8')) as Approved[],
  JSON.parse(readFileSync(join(fetchedDir, 'recorded-ids.json'), 'utf8')) as string[],
  { playerMaps: 'src/maps/player', sampleMaps: 'src/maps/sample', out: outDir },
);
