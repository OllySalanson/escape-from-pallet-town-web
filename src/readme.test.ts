import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { RAID_KEY_LETTERS, YARD_KEY_WORDS } from './game/input/keyBindings';
import { MACHINE_DEFINITIONS } from './game/pokemon/machines';

/**
 * The front page is held to the game by the rule that a change making one of
 * its claims untrue updates it in the same change. Two of them drifted anyway:
 * it promised eight discs after HM04 made nine, and its controls left the look
 * out of the home column while the yard's own hint line teaches `[L] LOOK`.
 * These are the claims that are numbers or keys, read back against the tables.
 */
const README = readFileSync(new URL('../README.md', import.meta.url), 'utf8');

const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];

/** The cell of the controls table for one key, in the given column (1: raid, 2: home). */
function controlCell(key: string, column: 1 | 2): string | undefined {
  const row = README.split('\n').find((line) => line.startsWith(`| <kbd>${key}</kbd>`));
  return row?.split('|').map((cell) => cell.trim())[1 + column];
}

describe('README', () => {
  it('counts the discs the game ships', () => {
    const claim = /^- (\w+) TMs and HMs to /m.exec(README)?.[1];
    expect(claim?.toLowerCase()).toBe(NUMBER_WORDS[MACHINE_DEFINITIONS.length]);
  });

  it('names every raid key in the controls table', () => {
    for (const letter of Object.values(RAID_KEY_LETTERS)) {
      expect(controlCell(letter, 1), letter).toBeTruthy();
    }
  });

  it('names every letter the yard teaches in the home column', () => {
    const letters = YARD_KEY_WORDS.map(([, key]) => key).filter((key) => /^[A-Z]$/.test(key));
    expect(letters.length).toBeGreaterThan(0);
    for (const letter of letters) {
      expect(controlCell(letter, 2), letter).toBeTruthy();
    }
  });
});
