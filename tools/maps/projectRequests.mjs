/**
 * The two ends of publishing that hold the service-role key: reading the
 * approved maps out of the project, and recording what became of them.
 *
 *   node tools/maps/projectRequests.mjs fetch <dir>
 *   node tools/maps/projectRequests.mjs mark <fetched dir> <verified dir> <merged: true|false>
 *
 * It imports nothing but Node's own modules, and the workflow runs it in jobs
 * of their own that never install a package (red team F2): GitHub Actions
 * steps of one job share a machine, so a key handed to one step was within
 * reach of every dependency the lint, test and build steps ran. Everything in
 * between - the game's own checks, the suite, the build - runs in a job with
 * no secret at all (`publishApproved.mts -- prepare`), and what it hands back
 * is read here as untrusted: every submission it names must be one this
 * script fetched, and every id is held to its pattern before it is put in a
 * request.
 *
 * `fetch` writes, with no player's id in either:
 * - `approved.json`: every approved submission, each update marked with
 *   whether the map it replaces is still its own maker's (`lineage`), and
 * - `recorded-ids.json`: every file id the project has ever recorded, so a
 *   new map is never given one an older map was in the game as (red team F12).
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

/** The project. `publishWorkflow.test.ts` holds it to the game's own `SUBMISSIONS_URL`. */
export const PROJECT_URL = 'https://ejdazksxwwiubudkkvaj.supabase.co';
/** The Data API's own ceiling on one response: every read is paged at it. */
export const PAGE = 1000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const FILE_ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const NOTE_LIMIT = 2000;

/**
 * Whether each update still replaces its own maker's map: the newest
 * published row recorded under the file it carries must be the same maker's.
 * A file id is never given out twice (`recorded-ids.json`), so this only
 * refuses something that should not have happened - but an update that
 * would overwrite another maker's map is not published on the strength of
 * that.
 */
export function withLineage(approved, recorded) {
  const newestPublished = new Map();
  for (const row of recorded) {
    if (row.status !== 'published') {
      continue;
    }
    const held = newestPublished.get(row.map_file_id);
    if (!held || held.updated_at < row.updated_at) {
      newestPublished.set(row.map_file_id, row);
    }
  }
  return approved.map((row) => ({
    id: row.id,
    receipt_code: row.receipt_code,
    map: row.map,
    map_file_id: row.map_file_id,
    lineage:
      row.map_file_id === null ? null : newestPublished.get(row.map_file_id)?.maker_uid === row.maker_uid,
  }));
}

/**
 * The requests `mark` makes, worked out from what `fetch` read (trusted) and
 * what the job with no secret says it did (not trusted): only submissions
 * that were fetched as approved, only ids of the right shape, a file id only
 * where it is the one an update already carried or a new map's own, and
 * `published` only once the merge has happened.
 */
export function markRequests(approved, outcome, merged) {
  const fetched = new Map(approved.map((row) => [row.id, row]));
  const known = (entry) =>
    entry !== null &&
    typeof entry === 'object' &&
    typeof entry.submission === 'string' &&
    UUID.test(entry.submission) &&
    fetched.has(entry.submission);
  const requests = [];
  const sentBack = Array.isArray(outcome?.sentBack) ? outcome.sentBack : [];
  for (const entry of sentBack.filter(known)) {
    const note = typeof entry.note === 'string' ? entry.note.slice(0, NOTE_LIMIT) : 'It did not pass the game\'s checks when it was published.';
    requests.push({ submission: entry.submission, body: { status: 'sent_back', owner_note: note } });
  }
  const published = merged && Array.isArray(outcome?.published) ? outcome.published : [];
  for (const entry of published.filter(known)) {
    const carried = fetched.get(entry.submission).map_file_id;
    if (typeof entry.id !== 'string' || !FILE_ID.test(entry.id) || (carried !== null && entry.id !== carried)) {
      continue;
    }
    requests.push({ submission: entry.submission, body: { status: 'published', map_file_id: entry.id } });
  }
  return requests;
}

function serviceKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  // No key is a broken run, never a quiet one: a run that read nothing and
  // said "nothing to publish" in green looks exactly like a run with nothing
  // approved, and every map a reviewer approved would sit unpublished.
  if (!key) {
    console.error(
      '::error::No SUPABASE_SERVICE_ROLE_KEY: the approved maps cannot be read, so none can be published. ' +
        'Add the service-role key as the repository secret SUPABASE_SERVICE_ROLE_KEY.',
    );
    process.exit(1);
  }
  return key;
}

async function rest(key, path, init = {}) {
  // A run may point at a local stand-in to try the script.
  const response = await fetch(`${process.env.SUPABASE_URL ?? PROJECT_URL}/rest/v1/${path}`, {
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

/** Every row a query matches, a page at a time: an unpaged read stops at the Data API's ceiling. */
async function readAll(key, query) {
  const rows = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await (await rest(key, `${query}&limit=${PAGE}&offset=${offset}`)).json();
    rows.push(...page);
    if (page.length < PAGE) {
      return rows;
    }
  }
}

async function fetchApproved(dir) {
  const key = serviceKey();
  const approved = await readAll(
    key,
    'map_submissions?status=eq.approved&select=id,receipt_code,maker_uid,map,map_file_id&order=updated_at,id',
  );
  const recorded = await readAll(
    key,
    'map_submissions?map_file_id=not.is.null&select=maker_uid,map_file_id,status,updated_at&order=id',
  );
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'approved.json'), `${JSON.stringify(withLineage(approved, recorded))}\n`);
  writeFileSync(
    join(dir, 'recorded-ids.json'),
    `${JSON.stringify([...new Set(recorded.map((row) => row.map_file_id))].sort())}\n`,
  );
  console.log(`${approved.length} approved`);
}

async function markOutcome(fetchedDir, verifiedDir, merged) {
  const key = serviceKey();
  const approved = JSON.parse(readFileSync(join(fetchedDir, 'approved.json'), 'utf8'));
  const outcome = JSON.parse(readFileSync(join(verifiedDir, 'outcome.json'), 'utf8'));
  for (const request of markRequests(approved, outcome, merged)) {
    // Only a row still approved is changed: a reviewer's later decision stands.
    await rest(key, `map_submissions?id=eq.${request.submission}&status=eq.approved`, {
      method: 'PATCH',
      body: JSON.stringify(request.body),
    });
    console.log(`${request.submission}: ${request.body.status}`);
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [mode, ...args] = process.argv.slice(2);
  if (mode === 'fetch' && args.length === 1) {
    await fetchApproved(args[0]);
  } else if (mode === 'mark' && args.length === 3) {
    await markOutcome(args[0], args[1], args[2] === 'true');
  } else {
    throw new Error('usage: projectRequests.mjs fetch <dir> | mark <fetched dir> <verified dir> <merged>');
  }
}
