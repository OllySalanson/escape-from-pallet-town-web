/**
 * Publishes approved player maps: the last step of the map maker's pipeline.
 *
 *   npx --no-install vite-node tools/maps/publishApproved.mts -- collect <out.json>
 *   npx --no-install vite-node tools/maps/publishApproved.mts -- mark <out.json>
 *
 * `collect` reads every submission the reviewer approved, runs the game's own
 * `readMapFile` and `checkMapFile` on it - the same checks the editor showed
 * its maker, so a map that passed there is never refused here for a reason
 * nobody showed them - and writes each that passes to `src/maps/player/` as
 * one file, which is the whole of adding a map to the game. A map that fails
 * is sent back to its maker with the reasons, rather than published broken.
 * It writes what it published to <out.json> for `mark`, which runs only after
 * the change has been tested and merged, and records each as `published`.
 *
 * It runs in the `publish-player-maps` workflow with the project's service-role
 * key, which never leaves GitHub's secrets: it is the one credential that may
 * read the inbox without being the reviewer.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { checkMapFile } from '../../src/game/world/mapFileChecks';
import { freeMapFileId, readMapFile, type MapFile } from '../../src/game/world/mapFile';
import { SUBMISSIONS_URL } from '../../src/game/maker/submitConfig';

const PLAYER_MAPS = 'src/maps/player';
const SAMPLE_MAPS = 'src/maps/sample';

interface Approved {
  readonly id: string;
  readonly receipt_code: string;
  readonly maker_name: string;
  readonly map: unknown;
}

interface Published {
  readonly submission: string;
  readonly receipt: string;
  readonly file: string;
}

const [mode, out] = process.argv.slice(2).filter((argument) => argument !== '--');
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
/** The project, unless a run points it elsewhere (a local stand-in, to try the script). */
const projectUrl = process.env.SUPABASE_URL ?? SUBMISSIONS_URL;
/**
 * No key is a broken run, never a quiet one: a run that read nothing and said
 * "nothing to publish" in green looks exactly like a run with nothing approved,
 * and every map a reviewer approved would sit unpublished with nobody told.
 */
if (!key) {
  console.error(
    '::error::No SUPABASE_SERVICE_ROLE_KEY: the approved maps cannot be read, so none can be published. ' +
      'Add the service-role key as the repository secret SUPABASE_SERVICE_ROLE_KEY.',
  );
  process.exit(1);
}

async function rest(path: string, init: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${projectUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
      ...init.headers,
    },
  });
  if (!response.ok) {
    throw new Error(`${init.method ?? 'GET'} ${path}: ${response.status} ${await response.text()}`);
  }
  return response;
}

async function setStatus(id: string, status: string, note?: string): Promise<void> {
  await rest(`map_submissions?id=eq.${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status, ...(note === undefined ? {} : { owner_note: note }) }),
  });
}

/**
 * A file name no bundled map has - published or sample - and no id the game
 * keeps for itself: the map's own id, else that with -2, -3... and never
 * longer than an id may be (`freeMapFileId`).
 */
function freeId(id: string): string {
  const taken = new Set(
    [PLAYER_MAPS, SAMPLE_MAPS].flatMap((folder) =>
      readdirSync(folder)
        .filter((name) => name.endsWith('.json'))
        .map((name) => name.replace(/\.json$/, '')),
    ),
  );
  return freeMapFileId(id, taken);
}

async function collect(): Promise<void> {
  const rows = (await (
    await rest(
      'map_submissions?status=eq.approved&select=id,receipt_code,maker_name,map&order=updated_at',
    )
  ).json()) as Approved[];
  const published: Published[] = [];
  for (const row of rows) {
    const reading = readMapFile(row.map);
    const failed = reading.ok
      ? checkMapFile(reading.file).filter((check) => !check.passed)
      : [{ problems: reading.problems }];
    if (!reading.ok || failed.length > 0) {
      const reasons = failed
        .flatMap((check) => check.problems)
        .slice(0, 5)
        .join(' ');
      await setStatus(
        row.id,
        'sent_back',
        `It did not pass the game's checks when it was published: ${reasons}`,
      );
      console.log(`${row.receipt_code}: sent back - ${reasons}`);
      continue;
    }
    const id = freeId(reading.file.id);
    const file: MapFile = { ...reading.file, id };
    const path = `${PLAYER_MAPS}/${id}.json`;
    writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
    published.push({ submission: row.id, receipt: row.receipt_code, file: path });
    console.log(`${row.receipt_code}: ${path}`);
  }
  writeFileSync(out, `${JSON.stringify(published, null, 2)}\n`);
}

async function mark(): Promise<void> {
  const published = JSON.parse(readFileSync(out, 'utf8')) as Published[];
  for (const entry of published) {
    if (existsSync(entry.file)) {
      await setStatus(entry.submission, 'published');
      console.log(`${entry.receipt}: published`);
    }
  }
}

if (mode === 'collect') {
  await collect();
} else if (mode === 'mark') {
  await mark();
} else {
  throw new Error('usage: publishApproved.mts -- collect|mark <out.json>');
}
