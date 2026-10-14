import { MAP_FILE_FORMAT, readMapFile, type MapFile } from '../world/mapFile';

/**
 * What the map maker says when it opens a file from disk (playtest 39 B8).
 *
 * `readMapFile` lists its problems in the format's own words - `'ground' has
 * 30 rows`, a trainer's team id, the format number - which suit a reviewer
 * and a test, never a maker who chose a file. A maker can do one of three
 * things about a file that will not open, so there are three answers: it is
 * not a map at all, it is a map from a newer game (reload to update), or it is
 * a map that has been damaged. Every problem is still counted, so a file with
 * several faults never reads as one fault away from opening.
 */
export type OpenedFile =
  | { readonly ok: true; readonly file: MapFile }
  | { readonly ok: false; readonly says: string };

export function openMapFileText(text: string, name: string): OpenedFile {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return notAMap(name);
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return notAMap(name);
  }
  const format = (parsed as { readonly format?: unknown }).format;
  if (typeof format === 'number' && Number.isSafeInteger(format) && format > MAP_FILE_FORMAT) {
    return {
      ok: false,
      says: `${name} was made with a newer version of the game. Reload the page to update, then open it again.`,
    };
  }
  if (!('format' in parsed)) return notAMap(name);
  const reading = readMapFile(parsed, { draft: true });
  if (reading.ok) return { ok: true, file: reading.file };
  const count = reading.problems.length;
  return {
    ok: false,
    says: `${name} is a damaged map file, so it cannot be opened (${count === 1 ? 'one problem' : `${count} problems`} found).`,
  };
}

const notAMap = (name: string): OpenedFile => ({ ok: false, says: `${name} is not a map file.` });
