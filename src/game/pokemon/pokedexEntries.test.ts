import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// The generator is the contract the committed file is held to, so it is
// imported rather than described; importing it writes nothing.
import { generated } from '../../../tools/pokedex/generate.mjs';
import { POKEDEX_ENTRIES } from './generated/pokedexEntries';
import { ALL_SPECIES } from './species';

const REPO = join(__dirname, '..', '..', '..');

describe("FireRed's Pokédex entries", () => {
  /** `node tools/pokedex/generate.mjs --check` as a test. */
  it('are what the generator would write from the committed snapshot', () => {
    for (const { path, contents } of generated()) {
      expect(readFileSync(join(REPO, path), 'utf8'), `${path} is stale`).toBe(contents);
    }
  });

  it('hold one page for every one of the 151, in dex order', () => {
    expect(POKEDEX_ENTRIES.map((entry) => entry.dexId)).toEqual(ALL_SPECIES.map((species) => species.dexId));
  });

  it('give every kind a category, a size and words the screen can print', () => {
    for (const entry of POKEDEX_ENTRIES) {
      expect(entry.category, `No. ${entry.dexId}`).toMatch(/^[A-Z ]+$/);
      expect(entry.heightDm, `No. ${entry.dexId}`).toBeGreaterThan(0);
      expect(entry.weightHg, `No. ${entry.dexId}`).toBeGreaterThan(0);
      // The cartridge's own three lines or fewer, and nothing it would need a control code for.
      expect(entry.text.split('\n').length, `No. ${entry.dexId}`).toBeLessThanOrEqual(3);
      expect(entry.text, `No. ${entry.dexId}`).toMatch(/^[A-Za-z0-9é“” ,.'\-\n]+$/);
    }
  });

  it("is FireRed's, not LeafGreen's: Pikachu's cheeks, Charizard's 4,600 feet", () => {
    expect(POKEDEX_ENTRIES[24]).toEqual({
      dexId: 25,
      category: 'MOUSE',
      heightDm: 4,
      weightHg: 60,
      text: 'It has small electric sacs on both its\ncheeks. If threatened, it looses electric\ncharges from the sacs.',
    });
    expect(POKEDEX_ENTRIES[5].text).toContain('4,600 feet');
  });
});
