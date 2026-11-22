// What the AI playtester is shown of what happened since its last action.
import { describe, expect, it } from 'vitest';
import { STORY_LINES, renderScreen } from './render.mjs';

const screen = { scenes: ['battle'], scene: {}, texts: [] };
const said = (count) => Array.from({ length: count }, (_, i) => ({ n: i + 1, kind: 'talked', text: `line ${i + 1}` }));

describe('renderScreen', () => {
  it("shows every line of a long fight, so a turn's move is never cut from above its damage", () => {
    // A trainer fight of a dozen turns says about five lines a turn.
    const fight = renderScreen(screen, { events: said(60) });

    expect(fight).toContain('talked: line 1\n');
    expect(fight).toContain('talked: line 60');
    expect(fight).not.toContain('not shown');
  });

  it('says how many earlier lines it left out, and how to read them', () => {
    const long = renderScreen(screen, { events: said(STORY_LINES + 5) });

    expect(long).toContain('(5 earlier lines not shown: act.mjs events 5)');
    expect(long).not.toContain('talked: line 5\n');
    expect(long).toContain('talked: line 6\n');
  });
});

describe('a cache being searched', () => {
  it('is shown, with the keys that take from it and why a take was refused', () => {
    // The veteran run (20 Nov 2026) stood on four caches and waited, never
    // knowing a search panel was up: its words were canvas text the world's
    // screen did not show, and it reported the caches as paying nothing.
    const world = {
      scenes: ['world'],
      texts: [],
      scene: {
        world: {
          mapName: 'Greystone Vale',
          place: "THE BURNERS' ROAD",
          tile: { x: 177, y: 185 },
          facing: 'up',
          search: { title: 'CHARCOAL STACK', rows: ['[1] Lamp oil'], footer: ['No room for Lamp oil.', '[1] TAKE [SPACE] ALL', 'WALK AWAY TO LEAVE'] },
        },
      },
    };

    const shown = renderScreen(world, { events: [] });

    expect(shown).toContain('SEARCHING CHARCOAL STACK: [1] Lamp oil | No room for Lamp oil. · [1] TAKE [SPACE] ALL · WALK AWAY TO LEAVE');
  });
});
