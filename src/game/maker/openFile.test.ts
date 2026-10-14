import { describe, expect, it } from 'vitest';
import { blankMap } from './draft';
import { mapFileText } from './drafts';
import { openMapFileText } from './openFile';
import type { MapFile } from '../world/mapFile';

/** A map as the maker writes it to disk, read back as plain data. */
const savedText = (): MapFile => JSON.parse(mapFileText(blankMap(20, 16, 'Mossy Lane'))) as MapFile;

describe('opening a map file in the maker (playtest 39 B8)', () => {
  it('opens a map the maker saved', () => {
    const file = blankMap(20, 16, 'Mossy Lane');
    const opened = openMapFileText(mapFileText(file), 'mossy-lane.json');
    expect(opened.ok).toBe(true);
  });

  it('says one thing for anything that is not a map, whatever the reason', () => {
    for (const text of ['hello there', '[1, 2]', '{"photo": true}', 'null']) {
      expect(openMapFileText(text, 'notes.txt')).toEqual({ ok: false, says: 'notes.txt is not a map file.' });
    }
  });

  it('tells a map from a newer game to reload, never a format number', () => {
    const file = { ...savedText(), format: 2 };
    const opened = openMapFileText(JSON.stringify(file), 'mossy-lane.json');
    expect(opened).toEqual({
      ok: false,
      says: 'mossy-lane.json was made with a newer version of the game. Reload the page to update, then open it again.',
    });
  });

  it('calls a broken map damaged, counts every problem and names no field of the format', () => {
    const saved = savedText();
    const file = { ...saved, ground: [...saved.ground, ...saved.ground], id: 'Not An Id!' };
    const opened = openMapFileText(JSON.stringify(file), 'mossy-lane.json');
    expect(opened.ok).toBe(false);
    if (opened.ok) return;
    expect(opened.says).toBe('mossy-lane.json is a damaged map file, so it cannot be opened (2 problems found).');
    expect(opened.says).not.toMatch(/'ground'|'id'|format/);
  });
});
