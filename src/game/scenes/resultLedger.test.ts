import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
  },
}));
vi.mock('../audio/AudioManager', () => ({ audioManager: { play: vi.fn() } }));

import sampleLane from '../../maps/sample/sample-lane.json';
import { setActiveSaveSlot, setTryItRules } from '../dev/playtestMode';
import { beginTry, endTry } from '../maker/tryIt';
import type { ExtractionReport } from '../run/extractionReport';
import type { MapFile } from '../world/mapFile';
import { CHARMANDER, Pokemon } from '../pokemon';
import {
  fitsItsBox,
  foldedRows,
  hasMoreBelow,
  moreLabel,
  READ_STEP_UNITS,
  readOn,
  rowPieces,
  SCROLL_ROWS,
  scrollCoverHeight,
  scrollEntries,
  scrollTopCoverHeight,
  settledScrollTop,
} from '../ui/MenuOverlay';
import { pokemonDossier } from '../ui/pokemonDossier';
import { ExtractionScene } from './ExtractionScene';

/**
 * Playtest 4: the first level-up of a save was below the fold of the result
 * screen's ledger, under a four-line contract row, in a pane with nothing to say
 * it scrolled.
 */
describe('the result screen ledger', () => {
  it('lists field experience above a contract left unpaid', () => {
    const scene = Object.create(ExtractionScene.prototype) as ExtractionScene;
    const report = {
      outcome: 'ESCAPED',
      ledger: { pokemon: [], items: [] },
      ledgerFound: { pokemon: [], items: [] },
      ledgerPaid: { pokemon: [], items: [] },
      ledgerHeading: 'Banked',
      ledgerEmptyText: 'Nothing.',
      contract: { description: 'Recover the lost field kit', complete: false, reward: 'It stays on the board.' },
      progress: [
        { name: 'Charmander', fromLevel: 5, toLevel: 6, experienceGained: 40, experienceToNextLevel: 20 },
      ],
      gear: [],
      gearSummary: null,
      pack: null,
      packSummary: null,
    } as unknown as ExtractionReport;
    Object.assign(scene as object, { report });

    const html = (scene as unknown as { ledgerPanel(): string }).ledgerPanel();

    expect(html).toContain('Level 5 to 6');
    expect(html.indexOf('Field experience')).toBeLessThan(html.indexOf('Contract unpaid'));
  });

  it('leads with a contract banked, so what it paid for good is never under the fold (playtest 47)', () => {
    const scene = Object.create(ExtractionScene.prototype) as ExtractionScene;
    const report = {
      outcome: 'ESCAPED',
      ledger: { pokemon: [], items: [{ itemId: 'mooring-rope', label: 'Mooring rope', quantity: 1 }] },
      ledgerHeading: 'Banked',
      ledgerEmptyText: 'Nothing.',
      contract: { description: 'Recover the lost field kit', complete: true, reward: 'Four more insertions are permanently unlocked.' },
      progress: [
        { name: 'Charmander', fromLevel: 5, toLevel: 6, experienceGained: 40, experienceToNextLevel: 20 },
      ],
      gear: [],
      gearSummary: null,
      pack: { itemId: 'satchel', name: 'Satchel', squares: 12, fate: 'kept' },
      packSummary: 'Your Satchel came home, all 12 squares of it.',
    } as unknown as ExtractionReport;
    Object.assign(scene as object, { report });

    const html = (scene as unknown as { ledgerPanel(): string }).ledgerPanel();
    const at = (words: string) => html.indexOf(words);

    // The payoff first, the level gained in the field straight under it, and
    // then what was banked beside them - still under a heading of its own.
    expect(at('Contract complete')).toBeGreaterThan(-1);
    expect(at('Contract complete')).toBeLessThan(at('Field experience'));
    expect(at('Four more insertions')).toBeLessThan(at('Field experience'));
    expect(at('Field experience')).toBeLessThan(at('Mooring rope'));
    expect(at('Field experience')).toBeLessThan(at('Satchel'));
  });

  it('stars a shiny in the field experience rows, as every list naming a Pokemon does', () => {
    const scene = Object.create(ExtractionScene.prototype) as ExtractionScene;
    const report = {
      outcome: 'ESCAPED',
      ledger: { pokemon: [], items: [] },
      ledgerFound: { pokemon: [], items: [] },
      ledgerPaid: { pokemon: [], items: [] },
      ledgerHeading: 'Banked',
      ledgerEmptyText: 'Nothing.',
      progress: [
        { name: 'Charmander', fromLevel: 5, toLevel: 6, experienceGained: 40, experienceToNextLevel: 20, shiny: true },
        { name: 'Pidgey', fromLevel: 4, toLevel: 4, experienceGained: 10, experienceToNextLevel: 30 },
      ],
      gear: [],
      gearSummary: null,
      pack: null,
      packSummary: null,
    } as unknown as ExtractionReport;
    Object.assign(scene as object, { report });

    const html = (scene as unknown as { ledgerPanel(): string }).ledgerPanel();
    const rows = html.split('<div class="px-row').slice(1);

    expect(rows.find((row) => row.includes('Charmander'))).toContain('px-shiny');
    expect(rows.find((row) => row.includes('Pidgey'))).not.toContain('px-shiny');
  });

  it("says what a Pokemon that did not level is short of in the dossier's own words", () => {
    // "Level 5 · 1 to go" left a player to guess one what: a raid, a fight, a
    // level. The stash's dossier says the same fact as "1 XP to Lv 6".
    const scene = Object.create(ExtractionScene.prototype) as ExtractionScene;
    const report = {
      outcome: 'ESCAPED',
      ledger: { pokemon: [], items: [] },
      ledgerFound: { pokemon: [], items: [] },
      ledgerPaid: { pokemon: [], items: [] },
      ledgerHeading: 'Banked',
      ledgerEmptyText: 'Nothing.',
      progress: [
        { name: 'Bulbasaur', fromLevel: 5, toLevel: 5, experienceGained: 43, experienceToNextLevel: 1 },
        { name: 'Charizard', fromLevel: 60, toLevel: 60, experienceGained: 900, experienceToNextLevel: 12345 },
      ],
      gear: [],
      gearSummary: null,
      pack: null,
      packSummary: null,
    } as unknown as ExtractionReport;
    Object.assign(scene as object, { report });

    const html = (scene as unknown as { ledgerPanel(): string }).ledgerPanel();

    expect(html).toContain('Level 5 · 1 XP to Lv 6');
    expect(html).toContain('Level 60 · 12,345 XP to Lv 61');
    expect(html).not.toContain('to go');
  });

  it('keeps a Pokemon\'s HP figure and its unit on one line in the gamble pane', () => {
    // At 1200 wide a level 99 Charizard's row read "Level 99 · 186/186" with
    // "HP" alone on the line under it (gnhf 20, out over Stormcrown's Cloud Stair).
    const scene = Object.create(ExtractionScene.prototype) as ExtractionScene;
    const report = {
      outcome: 'ESCAPED',
      secured: { pokemon: [], items: [] },
      securedEmptyText: 'Nothing.',
      risked: { pokemon: [{ name: 'Charizard', dexId: 6, level: 99, currentHp: 186, maxHp: 186 }], items: [] },
      gambleVerdict: 'It did not happen this time.',
    } as unknown as ExtractionReport;
    Object.assign(scene as object, { report });

    const html = (scene as unknown as { gamblePanel(): string }).gamblePanel();

    expect(html).toContain('186/186\u00a0HP');
    expect(html).not.toMatch(/\d HP/);
  });

  it('knows a pane has more below the fold, and that a rounding error is not more', () => {
    expect(hasMoreBelow({ scrollHeight: 180, clientHeight: 110, scrollTop: 0 })).toBe(true);
    expect(hasMoreBelow({ scrollHeight: 180, clientHeight: 110, scrollTop: 70 })).toBe(false);
    expect(hasMoreBelow({ scrollHeight: 110.6, clientHeight: 110, scrollTop: 0 })).toBe(false);
    // Rounding is a fraction of a *game* pixel, so how many screen pixels that
    // is depends on the scale: half a game pixel at 4x is two screen pixels and
    // is still not a row.
    expect(hasMoreBelow({ scrollHeight: 112, clientHeight: 110, scrollTop: 0 }, 4)).toBe(false);
    expect(hasMoreBelow({ scrollHeight: 126, clientHeight: 110, scrollTop: 0 }, 4)).toBe(true);
  });

  it('puts a pane that only overflows by its rounding back at the top', () => {
    // The Pokemon Center's list at 2x: 92 pixels of pane, a line of text one
    // pixel past its last row, and the cursor's scroll padding scrolling it by
    // that pixel - which cut the strip over the rows and hid its words.
    expect(settledScrollTop({ scrollHeight: 93, clientHeight: 92, scrollTop: 1 }, 2)).toBe(0);
    expect(settledScrollTop({ scrollHeight: 94, clientHeight: 92, scrollTop: 2 }, 4)).toBe(0);
    // A pane with a row out of sight stays wherever it was scrolled to.
    expect(settledScrollTop({ scrollHeight: 180, clientHeight: 92, scrollTop: 1 }, 2)).toBe(1);
    expect(settledScrollTop({ scrollHeight: 180, clientHeight: 92, scrollTop: 88 }, 2)).toBe(88);
    expect(settledScrollTop({ scrollHeight: 92, clientHeight: 92, scrollTop: 0 }, 2)).toBe(0);
  });

  it('draws no scrollbar for a pane that only overflows by its rounding, whatever scrollbars it has grown', () => {
    // The final check's LOST IF YOU WIPE at 2x, in a browser that draws its
    // scrollbars: three entries in three columns, 52 pixels of pane, and the
    // last line of text a pixel past it. The scrollbar it grew pushed the
    // columns 6 pixels past the pane and a second bar took 8 pixels of height -
    // and it is the box, not the room left inside the bars, that is asked.
    expect(fitsItsBox({ scrollHeight: 53, scrollWidth: 1484, boxHeight: 52, boxWidth: 1484 }, 2)).toBe(true);
    expect(fitsItsBox({ scrollHeight: 55, scrollWidth: 1484, boxHeight: 54, boxWidth: 1484 }, 2)).toBe(true);
    // The loadout's pack: its grid 206 pixels wide in a pane of 208 with a
    // scrollbar in it, and a pixel of the WEARING row's text below.
    expect(fitsItsBox({ scrollHeight: 237, scrollWidth: 206, boxHeight: 236, boxWidth: 208 }, 2)).toBe(true);
    // A pane with a row out of sight keeps its scrollbar, as does one whose
    // contents really are wider than it.
    expect(fitsItsBox({ scrollHeight: 181, scrollWidth: 1568, boxHeight: 180, boxWidth: 1568 }, 1)).toBe(true);
    expect(fitsItsBox({ scrollHeight: 260, scrollWidth: 200, boxHeight: 228, boxWidth: 200 }, 2)).toBe(false);
    expect(fitsItsBox({ scrollHeight: 52, scrollWidth: 230, boxHeight: 52, boxWidth: 200 }, 2)).toBe(false);
  });

  it('covers a row the pane would cut through, whole, and leaves a clean cut alone', () => {
    const pane = { top: 0, bottom: 168 };
    // The strip is thirteen game pixels of three screen pixels each - a line of
    // the one type size, plus its rule - so a row spanning the line 39px above
    // the edge is taken in full, to a whole game pixel.
    expect(scrollCoverHeight(pane, [{ top: 0, bottom: 78 }, { top: 81, bottom: 159 }], 3)).toBe(87);
    expect(scrollCoverHeight(pane, [{ top: 0, bottom: 78 }, { top: 81, bottom: 128 }], 3)).toBe(39);
    // A row that would swallow most of the pane is cut rather than hide it.
    expect(scrollCoverHeight(pane, [{ top: 20, bottom: 300 }], 3)).toBe(39);
  });

  it('never leaves a heading as the last thing above the strip', () => {
    // The drop-in screen at 1200x768, a save with errands in hand: the pane's
    // last whole line above the MORE strip was the ERRANDS band, with every
    // errand under the fold - a heading over nothing.
    const pane = { top: 0, bottom: 168 };
    const contract = { top: 40, bottom: 78 };
    const errands = { top: 104, bottom: 126, heading: true };
    const firstErrand = { top: 128, bottom: 176 };
    expect(scrollCoverHeight(pane, [contract, errands, firstErrand], 3)).toBe(66);
    // With a row of its own drawn under it, the heading stays.
    expect(scrollCoverHeight(pane, [contract, { ...errands, top: 80, bottom: 96 }, { top: 98, bottom: 126 }], 3)).toBe(39);
    // A row beside it in the other column is something of its part drawn too.
    expect(scrollCoverHeight(pane, [contract, errands, { top: 100, bottom: 124 }, firstErrand], 3)).toBe(42);
    // Two headings in a row go together.
    expect(scrollCoverHeight(pane, [contract, { top: 80, bottom: 100, heading: true }, errands, firstErrand], 3)).toBe(
      90,
    );
  });

  it("folds between the lines of a wrapped row rather than hiding the contract under the strip", () => {
    // The result screen at 1200x768 (2x), a Route 1 survey banked, measured off
    // the live screen: the contract row's reward runs four lines and the pane
    // overflowed by its last. Taken whole, the row and its CONTRACT heading went
    // under a blank strip the moment the MORE cue arrived.
    type Node = { name: string; wrap?: boolean; button?: boolean; children?: Node[] };
    const tree = {
      children: (node: Node) => node.children ?? [],
      wraps: (node: Node) => node.wrap === true,
      holdsWrap: function holds(node: Node): boolean {
        return (node.children ?? []).some((child) => child.wrap === true || holds(child));
      },
      isTextRow: (node: Node) => node.button !== true,
    };
    const icon = { name: 'icon' };
    const title = { name: 'title', wrap: true };
    const reward = { name: 'reward', wrap: true };
    const contract = { name: 'contract', children: [icon, { name: 'main', children: [title, reward] }] };
    expect(rowPieces(contract, tree).map((piece) => piece.name)).toEqual(['icon', 'title', 'reward']);
    // A control stays whole, and so does a row with no wrapped copy in it.
    const control = { name: 'board row', button: true, children: [{ name: 'main', children: [title] }] };
    expect(rowPieces(control, tree)).toEqual([control]);
    const potion = { name: 'potion', children: [icon, { name: 'main', children: [{ name: 'name' }] }] };
    expect(rowPieces(potion, tree)).toEqual([potion]);

    const pane = { top: 182, bottom: 610 };
    const heading = { top: 462, bottom: 490, heading: true };
    const lines = [
      { top: 496, bottom: 528 },
      { top: 496, bottom: 520 },
      { top: 520, bottom: 544 },
      { top: 544, bottom: 568 },
      { top: 568, bottom: 592 },
      { top: 592, bottom: 616 },
    ];
    expect(scrollCoverHeight(pane, [heading, { top: 494, bottom: 618 }], 2)).toBe(148);
    expect(scrollCoverHeight(pane, [heading, ...lines], 2)).toBe(42);
    expect(foldedRows(pane, lines, pane.bottom - 42)).toEqual([]);
  });

  it('leaves out the line beside a covered row that the fold would cut, in either column', () => {
    // Bill's shelf at 2x, measured off the live screen: the Poke Ball's pane
    // is two columns, and covering the price's second row whole (from 496)
    // put the strip's edge through "1 square in the pack." (488-512) on the
    // left, which was drawn with its bottom half missing.
    const shelf = { top: 408, bottom: 556 };
    const note = { top: 488, bottom: 512 };
    const shelfRows = [
      { top: 412, bottom: 436 },
      { top: 438, bottom: 462 },
      { top: 462, bottom: 486 },
      note,
      { top: 412, bottom: 436 },
      { top: 438, bottom: 494 },
      { top: 496, bottom: 544 },
    ];
    const shelfCover = scrollCoverHeight(shelf, shelfRows, 2);
    expect(shelfCover).toBe(60);
    expect(foldedRows(shelf, shelfRows, shelf.bottom - shelfCover)).toEqual([note]);
    // His barter table's lines interlock all the way up, so no fold short of
    // the labels is clean: the price row the fold falls in ("1x Cable coil" over
    // "1 in the vault") is the one left out.
    const table = { top: 468, bottom: 644 };
    const price = { top: 556, bottom: 612 };
    const tableRows = [
      { top: 498, bottom: 522 },
      { top: 522, bottom: 546 },
      { top: 546, bottom: 570 },
      { top: 572, bottom: 596 },
      { top: 596, bottom: 620 },
      { top: 498, bottom: 554 },
      price,
    ];
    const tableCover = scrollCoverHeight(table, tableRows, 2);
    expect(tableCover).toBe(48);
    expect(foldedRows(table, tableRows, table.bottom - tableCover)).toEqual([price]);
    // A clean fold leaves everything alone, and a row cut higher than the
    // strip may reach is the one the strip leaves cut rather than hide the pane.
    expect(foldedRows(shelf, [{ top: 412, bottom: 436 }, { top: 438, bottom: 462 }], 500)).toEqual([]);
    expect(foldedRows(shelf, [{ top: 420, bottom: 540 }], 500)).toEqual([]);
  });

  it("measures a dossier's stats as lines, so the fold never cuts one through", () => {
    const markup = pokemonDossier({
      pokemon: new Pokemon(CHARMANDER, 20),
      id: 'charmander-1',
      first: true,
      holding: 'Holding nothing',
      deeds: { label: 'Keeping', chips: () => '' },
    });
    // Each stat is a cell of the stats grid - a `dt` and a `dd` in a `div`,
    // with no `small` for the fold to find - so the pane's foot once came to
    // rest across `Attack 7 Defense 16 Sp. Atk 8` in the Pokémon Center.
    expect(markup).toMatch(/<dl class="summary-stats"><div><dt>Attack<\/dt><dd>\d+<\/dd><\/div>/);
    expect(SCROLL_ROWS).toContain('.px-dossier-body :is(small, .summary-stats > div)');
  });

  it('hides a row the top of a scrolled pane cuts through, down to the first whole row', () => {
    // Brock's ladder, walked down with the arrow keys: the pane scrolled 188px
    // and left SECURE LOCKER I with 32 of its 56 pixels showing.
    const pane = { top: 200, bottom: 516 };
    const rows = [
      { top: 176, bottom: 232 },
      { top: 234, bottom: 314 },
    ];
    expect(scrollTopCoverHeight(pane, 0, rows, 3)).toBe(33);
    // A line that falls between two rows leaves nothing to hide.
    expect(scrollTopCoverHeight(pane, 0, [{ top: 120, bottom: 200 }, ...rows.slice(1)], 3)).toBe(0);
    // Under a sticky head, the cut is measured at the head's foot.
    expect(scrollTopCoverHeight(pane, 34, rows, 3)).toBe(0);
    expect(scrollTopCoverHeight(pane, 40, rows, 3)).toBe(75);
    // A row that would swallow most of the pane is cut rather than hide it.
    expect(scrollTopCoverHeight(pane, 0, [{ top: 100, bottom: 480 }], 3)).toBe(0);
    // A pane scrolled by one screen pixel at 3x has cut nothing: the box strip
    // over the Pokémon Center's list was hidden whole by that pixel.
    expect(scrollTopCoverHeight(pane, 0, [{ top: 199, bottom: 231 }, ...rows.slice(1)], 3)).toBe(0);
    // A whole game pixel off its top is a cut.
    expect(scrollTopCoverHeight(pane, 0, [{ top: 197, bottom: 231 }, ...rows.slice(1)], 3)).toBe(33);
  });

  it('counts what is under the strip rather than only saying there is something', () => {
    // A pane whose fold is at 100: two rows are under it, and the third is the
    // one the strip is covering, so it is not yet read.
    expect(moreLabel([{ bottom: 40 }, { bottom: 80 }, { bottom: 120 }, { bottom: 160 }], 100)).toBe('2 MORE');
    expect(moreLabel([{ bottom: 40 }, { bottom: 100 }], 100)).toBe('MORE');
  });

  it('counts a row with a count selector in it once, not once a button (playtest 6 B6)', () => {
    // The loadout's supplies: seven rows, each a `.px-row` holding a minus and
    // a plus. Bill's shelf: a `.px-pair` of the row's own button and the pair.
    interface Node {
      readonly classes: readonly string[];
      readonly parent: Node | null;
      readonly bottom: number;
    }
    const node = (classes: readonly string[], parent: Node | null, bottom = 0): Node => ({ classes, parent, bottom });
    // The DOM's own rules: a node is its own closest match and contains itself.
    const lineage = (node: Node | null): Node[] => (node === null ? [] : [node, ...lineage(node.parent)]);
    const closest = (node: Node, selector: string) =>
      lineage(node).find((up) => up.classes.includes(selector.replace(/^\./, ''))) ?? null;
    const contains = (outer: Node, inner: Node) => lineage(inner).includes(outer);
    const pane = node(['px-list', 'px-scroll'], null);
    const controls: Node[] = [];
    for (let row = 0; row < 7; row += 1) {
      const supply = node(['px-row'], pane, 100 + row * 20);
      const stepper = node(['px-stepper'], supply);
      controls.push(node(['px-step'], stepper, supply.bottom), node(['px-step'], stepper, supply.bottom));
    }
    const pair = node(['px-pair'], pane, 300);
    controls.push(node(['px-row'], pair, 300), node(['px-step'], pair, 300), node(['px-step'], pair, 300));
    const back = node(['px-button'], pane, 320);
    controls.push(back);

    const entries = scrollEntries(controls, pane, closest, contains);
    expect(entries).toHaveLength(9);
    // Everything is below a fold at 90: seven supplies, the shelf row and the button.
    expect(moreLabel(entries, 90)).toBe('9 MORE');
  });
});

/**
 * Played to the end of a Route 1 raid at 1200x768: the BANKED pane ran past its
 * fold and held no control, so the arrow keys never reached it and the rest of
 * the contract could only be read with the mouse wheel.
 */
describe('reading the result screen with the keyboard', () => {
  const report = {
    outcome: 'ESCAPED',
    ledger: { pokemon: [], items: [] },
    ledgerFound: { pokemon: [], items: [] },
    ledgerPaid: { pokemon: [], items: [] },
    ledgerHeading: 'Banked',
    ledgerEmptyText: 'Nothing.',
    contract: { description: 'Survey the braid', complete: true, reward: 'A long reward.' },
    secured: { pokemon: [], items: [] },
    risked: { pokemon: [], items: [] },
    securedEmptyText: 'Nothing secured.',
    gambleVerdict: 'Nothing was at risk.',
    progress: [],
    gear: [],
    gearSummary: null,
    pack: null,
    packSummary: null,
  } as unknown as ExtractionReport;

  it('marks both panes of words as ones the arrow keys read through', () => {
    const scene = Object.create(ExtractionScene.prototype) as ExtractionScene;
    Object.assign(scene as object, { report });
    const panels = scene as unknown as { ledgerPanel(): string; gamblePanel(): string };

    expect(panels.ledgerPanel()).toContain('px-scroll" data-reads');
    expect(panels.gamblePanel()).toContain('px-scroll" data-reads');
  });

  it('hands the arrow keys to the cursor once the screen answers, and leaves on Enter as before', () => {
    const scene = Object.create(ExtractionScene.prototype) as ExtractionScene;
    const moveCursor = vi.fn((key: string) => key.startsWith('Arrow'));
    const leave = vi.fn();
    Object.assign(scene as object, { report, locked: false, sequencePlaying: false, overlay: { moveCursor }, leave });
    const press = (key: string) => {
      const preventDefault = vi.fn();
      (scene as unknown as { handleKey(event: KeyboardEvent): void }).handleKey({ key, preventDefault } as unknown as KeyboardEvent);
      return preventDefault;
    };

    expect(press('ArrowDown')).toHaveBeenCalled();
    expect(moveCursor).toHaveBeenCalledWith('ArrowDown');
    expect(leave).not.toHaveBeenCalled();
    press('Enter');
    expect(leave).toHaveBeenCalledTimes(1);

    Object.assign(scene as object, { locked: true });
    moveCursor.mockClear();
    press('ArrowUp');
    expect(moveCursor).not.toHaveBeenCalled();
  });

  it('reads on a row at a time, and lets the cursor leave only at the end', () => {
    // The live BANKED pane: 439 pixels of rows in a 428-pixel window, at 2x.
    const unit = 2;
    const pane = { scrollTop: 0, scrollHeight: 439 * unit, clientHeight: 400 * unit };
    expect(readOn(pane, 'up', unit)).toBeNull();
    expect(readOn(pane, 'down', unit)).toBe(READ_STEP_UNITS * unit);
    expect(readOn({ ...pane, scrollTop: 32 * unit }, 'down', unit)).toBe(39 * unit);
    expect(readOn({ ...pane, scrollTop: 39 * unit }, 'down', unit)).toBeNull();
    expect(readOn({ ...pane, scrollTop: 39 * unit }, 'up', unit)).toBe(23 * unit);
    expect(readOn({ ...pane, scrollTop: 10 * unit }, 'up', unit)).toBe(0);
  });
});

/**
 * Playtest 46: a try of a map in the map maker ended on THE GAMBLE - "a wipe
 * would have cost you Charizard, Blastoise, Venusaur" - under a level 99 try
 * team in a save of its own, where nothing was ever at stake.
 */
describe('the result screen of a map maker try', () => {
  const gamble = (outcome: 'ESCAPED' | 'WIPED') => {
    const scene = Object.create(ExtractionScene.prototype) as ExtractionScene;
    const report = {
      outcome,
      secured: { pokemon: [], items: [] },
      risked: { pokemon: [], items: [{ itemId: 'potion', label: 'Potion', quantity: 5 }] },
      securedEmptyText: 'You protected nothing.',
      gambleVerdict: 'A wipe would have cost you Charizard and 5 Potions. It did not happen this time.',
    } as unknown as ExtractionReport;
    Object.assign(scene as object, { report });
    return (scene as unknown as { gamblePanel(): string }).gamblePanel();
  };

  afterEach(() => {
    endTry();
    setTryItRules(false);
    setActiveSaveSlot('normal');
  });

  it('says whether the walk counts instead of what a wipe would have cost', () => {
    beginTry('draft-a', sampleLane as MapFile, 'walk');
    setActiveSaveSlot('try-it');

    const escaped = gamble('ESCAPED');
    expect(escaped).toContain('Your try');
    expect(escaped).toContain('The walk counts');
    expect(escaped).toContain('your saved game was not touched');
    expect(escaped).not.toContain('The gamble');
    expect(escaped).not.toContain('A wipe would have cost you');

    const lost = gamble('WIPED');
    expect(lost).toContain('The walk does not count yet');
    expect(lost).not.toContain('The gamble');
  });

  it('says what happened on the map under the headline instead of what rode out unprotected', () => {
    const verdict = (outcome: 'ESCAPED' | 'WIPED', cause?: 'timer' | 'defeated') => {
      const scene = Object.create(ExtractionScene.prototype) as ExtractionScene;
      const report = {
        outcome,
        cause,
        summary: '3 Potions and your Raid pack rode out unprotected and came home.',
      } as unknown as ExtractionReport;
      Object.assign(scene as object, { report });
      return (scene as unknown as { verdictSummary(): string }).verdictSummary();
    };
    expect(verdict('ESCAPED')).toContain('rode out unprotected');

    beginTry('draft-a', sampleLane as MapFile, 'walk');
    setActiveSaveSlot('try-it');
    const name = (sampleLane as MapFile).name;

    expect(verdict('ESCAPED')).toBe(`You walked out of ${name} by an exit.`);
    expect(verdict('WIPED', 'defeated')).toBe(`The try team went down inside ${name}.`);
    expect(verdict('WIPED', 'timer')).toBe(`The clock ran out before you found a way out of ${name}.`);
  });

  it('says how long a walked try took rather than counting it against the eight-hour stand-in clock', () => {
    const aside = () => {
      const scene = Object.create(ExtractionScene.prototype) as ExtractionScene;
      const report = { clockLabel: '0:07 of 480:00', elapsedMs: 7_000, durationMs: 480 * 60_000 } as unknown as ExtractionReport;
      Object.assign(scene as object, { report });
      return (scene as unknown as { clockAside(): string }).clockAside();
    };
    expect(aside()).toBe('Raid clock 0:07 of 480:00');

    beginTry('draft-a', sampleLane as MapFile, 'walk');
    setTryItRules(true);
    setActiveSaveSlot('try-it');
    expect(aside()).toBe('Time taken 0:07');

    // RAID IT plays under the game's own clock, so it still reads as one.
    setTryItRules(false);
    expect(aside()).toBe('Raid clock 0:07 of 480:00');
  });

  it('still lays out the gamble on a raid of the game', () => {
    const html = gamble('ESCAPED');
    expect(html).toContain('The gamble');
    expect(html).toContain('A wipe would have cost you Charizard');
  });
});
