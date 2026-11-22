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

describe('a room with an arch in it', () => {
  it('names the way through it, beside the way out', () => {
    // The veteran run pushed at THE END BOOKCASE (14,1) for the chart room it
    // had opened, while the arch beside it (13,1) went unlisted.
    const library = {
      scenes: ['base'],
      texts: [],
      scene: {
        base: {
          place: 'GREAT LIBRARY',
          room: 'great-library',
          tile: { x: 13, y: 2 },
          facing: 'up',
          near: { exit: { x: 7, y: 11 }, ways: [{ to: 'THE CHART ROOM', tile: { x: 13, y: 1 }, push: 'up' }] },
        },
      },
    };

    expect(renderScreen(library, { events: [] })).toContain('way out of the room 7,11; way through to THE CHART ROOM 13,1');
  });
});

describe("THE RAID ARENA's telescope", () => {
  it('is shown while somebody is looking through it, with what it says and its keys', () => {
    // 22 Nov 2026: four AI runs reported the telescope as never opening and the
    // player as stuck after SPACE - the glass was up, and nothing said so.
    const hall = {
      scenes: ['base'],
      texts: [],
      scene: {
        base: {
          place: 'THE RAID ARENA',
          room: 'raid-arena',
          tile: { x: 30, y: 53 },
          facing: 'up',
          telescope: { open: true, wayIn: 'millbrook', card: { title: 'MILLBROOK', body: 'Walked 40%' }, keys: ['ARROWS MOVE', 'SPACE BACK'] },
        },
      },
    };

    const shown = renderScreen(hall, { events: [] });

    expect(shown).toContain('LOOKING THROUGH THE TELESCOPE: the cursor is on the way in millbrook');
    expect(shown).toContain('THE GLASS SAYS: "MILLBROOK - Walked 40%"');
    expect(shown).toContain('TELESCOPE KEYS: ARROWS MOVE · SPACE BACK');
  });
});

describe('THE BOLTHOLE being decorated', () => {
  it('shows what is in hand and why it will not go down', () => {
    // 22 Nov 2026: PUT DOWN in front of the telly 'did nothing at all - no
    // message why'. The reason was in the decorating panel, which the AI could not read.
    const house = {
      scenes: ['base'],
      texts: [],
      scene: {
        base: {
          place: 'THE BOLTHOLE',
          room: 'bolthole',
          tile: { x: 5, y: 2 },
          facing: 'up',
          decorating: { title: 'POT PLANT', status: 'NOT IN FRONT OF THE TELLY', holding: true },
        },
      },
    };
    expect(renderScreen(house, { events: [] })).toContain('DECORATING: POT PLANT - NOT IN FRONT OF THE TELLY (holding it)');
  });
});
