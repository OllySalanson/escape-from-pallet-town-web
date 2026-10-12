/**
 * The game's own checks over the approved maps, and the writing of the ones
 * that pass: what `publishApproved.mts -- prepare` runs. See that file.
 */
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { checkMapFile } from '../../src/game/world/mapFileChecks';
import {
  freeMapFileId,
  keepPublishedIds,
  readMapFile,
  type MapFile,
} from '../../src/game/world/mapFile';

/** Where the maps are: the game's own folders, except in a test. */
export interface MapFolders {
  readonly playerMaps: string;
  readonly sampleMaps: string;
  /** Where the checked maps and `outcome.json` are written for the next job. */
  readonly out: string;
}

/** An approved submission, as `projectRequests.mjs fetch` wrote it. */
export interface Approved {
  readonly id: string;
  readonly receipt_code: string;
  readonly map: unknown;
  /** The published map this one replaces, for a fix to a map already in the game. */
  readonly map_file_id: string | null;
  /** For an update: whether the map it replaces is still its own maker's. */
  readonly lineage: boolean | null;
}

export interface Published {
  readonly submission: string;
  readonly receipt: string;
  /** The id it went in as, recorded so a later fix knows what it replaces. */
  readonly id: string;
}

export interface SentBack {
  readonly submission: string;
  readonly receipt: string;
  readonly note: string;
}

/** The map a fix replaces, as it is in the game now, if it is still there. */
function publishedFile(folders: MapFolders, id: string): MapFile | undefined {
  const path = join(folders.playerMaps, `${id}.json`);
  if (!existsSync(path)) {
    return undefined;
  }
  const reading = readMapFile(JSON.parse(readFileSync(path, 'utf8')) as unknown);
  return reading.ok ? reading.file : undefined;
}

/**
 * A file name no bundled map has - published or sample - no map has ever been
 * recorded as in the game under, and no id the game keeps for itself: the
 * map's own id, else that with -2, -3... and never longer than an id may be
 * (`freeMapFileId`). An id a removed map had is never given out again, or a
 * later fix to that map would replace whichever map got it (red team F12).
 */
function freeId(folders: MapFolders, id: string, recorded: readonly string[]): string {
  const taken = new Set([
    ...recorded,
    ...[folders.playerMaps, folders.sampleMaps].flatMap((folder) =>
      readdirSync(folder)
        .filter((name) => name.endsWith('.json'))
        .map((name) => name.replace(/\.json$/, '')),
    ),
  ]);
  return freeMapFileId(id, taken);
}

/** What the game's checks say is wrong with a map, or nothing; never a throw. */
function problemsWith(map: unknown): { readonly file?: MapFile; readonly problems: readonly string[] } {
  try {
    const reading = readMapFile(map);
    if (!reading.ok) {
      return { problems: reading.problems };
    }
    const failed = checkMapFile(reading.file).filter((check) => !check.passed);
    return failed.length > 0
      ? { problems: failed.flatMap((check) => check.problems) }
      : { file: reading.file, problems: [] };
  } catch {
    return { problems: ['The game could not read this map.'] };
  }
}

/**
 * Checks every approved map and writes each that passes, answering what was
 * published and what goes back to its maker. One map the game cannot read is
 * sent back; it never stops the maps behind it.
 */
export function prepareMaps(
  rows: readonly Approved[],
  recorded: readonly string[],
  folders: MapFolders,
): { readonly published: readonly Published[]; readonly sentBack: readonly SentBack[] } {
  const published: Published[] = [];
  const sentBack: SentBack[] = [];
  const sendBack = (row: Approved, note: string): void => {
    sentBack.push({ submission: row.id, receipt: row.receipt_code, note });
    console.log(`${row.receipt_code}: sent back - ${note}`);
  };
  mkdirSync(join(folders.out, 'maps'), { recursive: true });
  for (const row of rows) {
    const { file: read, problems } = problemsWith(row.map);
    if (!read) {
      sendBack(row, `It did not pass the game's checks when it was published: ${problems.slice(0, 5).join(' ')}`);
      continue;
    }
    const replaces = row.map_file_id;
    const before = replaces === null ? undefined : publishedFile(folders, replaces);
    if (replaces !== null && (!before || row.lineage !== true)) {
      sendBack(row, 'The map it updates is no longer in the game, so it cannot replace it. Send it as a new map.');
      continue;
    }
    const id = replaces ?? freeId(folders, read.id, recorded);
    const file: MapFile = before ? keepPublishedIds(before, read) : { ...read, id };
    const path = join(folders.playerMaps, `${id}.json`);
    writeFileSync(path, `${JSON.stringify(file, null, 2)}\n`);
    copyFileSync(path, join(folders.out, 'maps', `${id}.json`));
    published.push({ submission: row.id, receipt: row.receipt_code, id });
    console.log(`${row.receipt_code}: ${path}${replaces === null ? '' : ' (an update)'}`);
  }
  const outcome = { published, sentBack };
  writeFileSync(join(folders.out, 'outcome.json'), `${JSON.stringify(outcome, null, 2)}\n`);
  return outcome;
}
