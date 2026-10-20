import { readFile } from 'node:fs/promises';
import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
  },
}));

import { Pokemon } from '../pokemon';
import { getSpeciesById } from '../pokemon/species';
import { headsWhatFollows, scrollCoverHeight } from './MenuOverlay';
import { pokemonDossier } from './pokemonDossier';

const stylesheet = await readFile(new URL('../../style.css', import.meta.url), 'utf8');

const BLOCKS = ['figure', 'vitals', 'growth', 'moves', 'deeds'] as const;
type Block = (typeof BLOCKS)[number];

/** The `order` the stylesheet gives each of the dossier's blocks at the smallest stage. */
function tightOrder(): Record<Block, number> {
  const order: Record<Block, number> = { figure: 0, vitals: 0, growth: 0, moves: 0, deeds: 0 };
  const css = stylesheet.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const [, selectors, body] of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const value = /(?:^|[\s;])order:\s*(-?\d+)\s*;/.exec(body)?.[1];
    if (value === undefined) continue;
    for (const selector of selectors.split(',')) {
      const block = /\.px-dossier-(figure|vitals|growth|moves|deeds)\b/.exec(selector)?.[1] as Block | undefined;
      if (block && selector.includes("[data-room='tight']")) order[block] = Number(value);
    }
  }
  return order;
}

/**
 * Each block's rows in game pixels as the raid's party pane draws them at
 * 640x480 (measured there): a row is one thing the fold may not cut through,
 * with the room above it. The portrait is one row 64 pixels tall.
 */
const ROWS: Record<Block, readonly (readonly [gapAbove: number, height: number])[]> = {
  figure: [[0, 64]],
  vitals: [[0, 12], [12, 12], [1, 12]],
  deeds: [[0, 12], [0, 14]],
  growth: [[0, 12], [6, 12], [1, 12], [1, 12], [0, 12]],
  moves: [[0, 12], [1, 12], [3, 12]],
};
const BLOCK_GAP = 2;
/** Which of those rows are a block's `.px-label` (EXPERIENCE, STATS, MOVES, the deeds' label). */
const LABELS: Record<Block, readonly number[]> = { figure: [], vitals: [], deeds: [0], growth: [0, 3], moves: [0] };
/** The dossier pane under the party list at 640x480, in game pixels. */
const PANE = { top: 0, bottom: 139 };
/** The MORE strip when it covers nothing: a line and its rule (`MORE_STRIP_UNITS`). */
const BARE_STRIP = 13;

describe("the dossier's fold at the smallest stage", () => {
  it('fills the pane to its MORE strip rather than leaving a blank band where the portrait was', () => {
    const markup = pokemonDossier({
      pokemon: new Pokemon(getSpeciesById('bulbasaur')!, 5),
      id: 'member-0',
      first: true,
      holding: 'Holding Leftovers',
      deeds: { label: 'Gear', chips: () => '<button>Take Leftovers</button>' },
    });
    const order = tightOrder();
    // A flex column: by `order`, then by where each block is in the markup.
    const stacked = [...BLOCKS].sort(
      (a, b) => order[a] - order[b] || markup.indexOf(`px-dossier-${a}`) - markup.indexOf(`px-dossier-${b}`),
    );
    const rows: { top: number; bottom: number }[] = [];
    let y = PANE.top;
    stacked.forEach((block, index) => {
      y += index === 0 ? 0 : BLOCK_GAP;
      for (const [gap, height] of ROWS[block]) {
        y += gap;
        rows.push({ top: y, bottom: y + height });
        y += height;
      }
    });

    const cover = scrollCoverHeight(PANE, rows, 1);
    // Whatever the strip is raised past its own line is pane the player sees
    // nothing in. Less than a line of it is the fold falling between rows; a
    // band 51 pixels deep was the portrait taken whole.
    expect(cover - BARE_STRIP).toBeLessThan(13);
    // And the strip still has something under it to count.
    expect(rows.some((row) => row.bottom > PANE.bottom - cover)).toBe(true);
  });

  it('never leaves a label such as STATS as the last line above the strip', () => {
    // The same pane stacked at the smallest stage, but a little taller (the
    // pane takes the room the list leaves it): the fold falls through the
    // stats themselves, and taken alone that left STATS over the strip.
    const stacked: Block[] = ['vitals', 'deeds', 'growth', 'moves', 'figure'];
    const rows: { top: number; bottom: number; heading: boolean; name: string }[] = [];
    let y = 0;
    stacked.forEach((block, index) => {
      y += index === 0 ? 0 : BLOCK_GAP;
      ROWS[block].forEach(([gap, height], row) => {
        y += gap;
        const classes = LABELS[block].includes(row) ? ['px-label'] : [];
        rows.push({
          top: y,
          bottom: y + height,
          heading: headsWhatFollows({ contains: (name) => classes.includes(name) }),
          name: `${block}:${row}`,
        });
        y += height;
      });
    });
    const pane = { top: 0, bottom: 152 };

    const cover = scrollCoverHeight(pane, rows, 1);
    const fold = pane.bottom - cover;
    const lastAbove = rows.filter((row) => row.bottom <= fold + 0.5).at(-1)!;
    expect(lastAbove.name).not.toBe('growth:3');
    expect(lastAbove.heading).toBe(false);
  });
});
