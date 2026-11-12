import { describe, expect, it } from 'vitest';
import { baseGame } from '../base/baseGames.testkit';
import { CHART_TABLE_TILES, OAK_CHART_TABLE, buildRoom, roomNamed } from '../base/rooms';
import { roomPosterPicture } from '../base/roomPosters';
import { stepsFrom } from '../base/baseWalks';
import { CHART_INK, chartPicture } from './chartWall';
import { chartTableFacts, chartTableLines, chartTableNote, chartTablePicture, chartTablePieces, type ChartTableFacts } from './chartTable';
import { CHART_GRID, CHART_PIECES, NO_TREASURE_HUNT, TREASURE_PLACE, type TreasureHunt } from './treasureMap';

/**
 * Oak's CHART TABLE (`chartTable.ts`): the lab's half of the treasure map, one
 * story with THE CHART ROOM - what MARLOW has pinned is traced, what is home
 * and not yet pinned lies on it in colour, and what a rumour has placed is
 * pencilled in.
 */

const lab = roomNamed('oaks-lab')!;
const name = (itemId: string): string => itemId.replace(/-/g, ' ');
const facts = (hunt: TreasureHunt | undefined, held: readonly string[] = [], rumoursHeard: readonly string[] = []): ChartTableFacts => ({
  hunt,
  held: (itemId) => (held.includes(itemId) ? 1 : 0),
  rumoursHeard,
});
const open = (pinned: readonly string[] = []): TreasureHunt => ({ roomOpen: true, pinned, chestOpened: false });

describe("Oak's chart table", () => {
  it('lays each piece as the hunt has it: traced once pinned, here while in the vault, pencilled once rumoured', () => {
    const state = (f: ChartTableFacts) => Object.fromEntries(chartTablePieces(f).map(({ piece, state }) => [piece.id, state]));
    expect(state(facts(undefined))).toEqual({ shore: 'missing', moor: 'missing', hollow: 'missing', fold: 'missing' });
    expect(state(facts(undefined, ['bottled-chart']))).toMatchObject({ shore: 'here' });
    // The long shadow found and home; the lost fold heard of; the shore pinned at MARLOW's.
    expect(state(facts(open(['shore']), ['chart-piece-1'], ['spyglass-lost-fold']))).toEqual({
      shore: 'traced',
      moor: 'here',
      hollow: 'missing',
      fold: 'rumoured',
    });
    // A piece pinned is traced even if another copy of its item were held: the wall wins.
    expect(state(facts(open(['moor']), ['chart-piece-1']))).toMatchObject({ moor: 'traced' });
    // A rumour that does not say where pencils nothing in.
    expect(state(facts(open(), [], ['board-cracked-crag']))).toMatchObject({ moor: 'missing' });
  });

  it('sends a piece that is home on to MARLOW, and before his room is open, to him at the library', () => {
    const before = chartTableLines(facts(undefined, ['bottled-chart']), name);
    expect(before.join(' ')).toContain('BOTTLED CHART');
    expect(before.join(' ')).toContain('THE GREAT LIBRARY');
    const home = chartTableLines(facts(open(['shore']), ['chart-piece-1']), name);
    expect(home.join(' ')).toContain('CHART PIECE 1 from THE GREY STONES');
    expect(home.join(' ')).toContain('THE CHART ROOM');
    expect(home.join(' ')).toContain('One of four');
    expect(chartTableNote(facts(open(['shore']), ['chart-piece-1']))).toBe('A torn chart lies on it');
  });

  it('pencils in only the place a rumour named, and counts what nobody has spoken of', () => {
    const lines = chartTableLines(facts(open(['shore']), [], ['spyglass-lost-fold']), name).join(' ');
    expect(lines).toContain('THE LOST FOLD?');
    expect(lines).toContain('the other two');
    expect(lines).not.toContain('night');
    expect(lines).not.toContain('THE GREY STONES');
  });

  it('says nothing about any chart before there is one, beyond where the sea leaves things', () => {
    const lines = chartTableLines(facts(undefined), name);
    expect(lines.join(' ')).toContain('THE BEACH');
    expect(lines.join(' ')).not.toMatch(/MOOR|HOLLOW|FOLD|COVE|STONES/);
    expect(chartTableNote(facts(undefined))).toBe('Tracing paper, and nothing on it');
  });

  it('follows the course to the cove once the chart is whole, and the chest once it is opened', () => {
    const every = CHART_PIECES.map((piece) => piece.id);
    expect(chartTableLines(facts(open(every)), name).join(' ')).toContain(TREASURE_PLACE);
    expect(chartTableNote(facts(open(every)))).toBe('The whole chart, traced');
    expect(chartTableLines(facts({ roomOpen: true, pinned: every, chestOpened: true }), name).join(' ')).toContain('chest');
  });

  describe('the picture on its top', () => {
    const area = OAK_CHART_TABLE;
    const pixel = (picture: ReturnType<typeof chartTablePicture>, x: number, y: number): string => {
      const at = (y * picture.width + x) * 4;
      return picture.data[at + 3] === 0
        ? 'clear'
        : `#${[0, 1, 2].map((channel) => picture.data[at + channel].toString(16).padStart(2, '0')).join('')}`;
    };
    /** The rectangle of a piece's slot on the table's sheet, as the picture lays it out. */
    const slot = (column: number, row: number) => {
      const inner = { x: 5, y: 4, width: area.width * 16 - 10, height: Math.min(area.height * 16 - 9, 21) - 4 };
      const width = Math.floor(inner.width / CHART_GRID.columns);
      const height = Math.floor(inner.height / CHART_GRID.rows);
      return { inner, x: inner.x + column * width, y: inner.y + row * height, width, height };
    };

    it('is exactly the table, and leaves the table to show round its sheet', () => {
      const picture = chartTablePicture(facts(undefined), area);
      expect([picture.width, picture.height]).toEqual([area.width * 16, area.height * 16]);
      // The legs and the floor at the foot of the table are the table's own.
      expect(pixel(picture, 0, picture.height - 1)).toBe('clear');
      expect(pixel(picture, picture.width - 1, picture.height - 1)).toBe('clear');
      expect(pixel(picture, Math.floor(picture.width / 2), 10)).not.toBe('clear');
    });

    it('draws a piece that is home in its own colours, in its own slot of the one chart', () => {
      const moor = CHART_PIECES.find((piece) => piece.id === 'moor')!;
      const { inner, x, y, width, height } = slot(moor.slot.column, moor.slot.row);
      const chart = chartPicture(inner.width, inner.height);
      const home = chartTablePicture(facts(open(), ['chart-piece-1']), area);
      let same = 0;
      for (let py = y + 1; py < y + height - 1; py += 1) {
        for (let px = x + 1; px < x + width - 1; px += 1) {
          same += pixel(home, px, py) === chart[py - inner.y][px - inner.x] ? 1 : 0;
        }
      }
      expect(same).toBe((width - 2) * (height - 2));
    });

    it('traces a pinned piece in pencil, with no chart colour in it until the chart is whole', () => {
      const moor = CHART_PIECES.find((piece) => piece.id === 'moor')!;
      const { x, y, width, height } = slot(moor.slot.column, moor.slot.row);
      const colours = (hunt: TreasureHunt): Set<string> => {
        const picture = chartTablePicture(facts(hunt), area);
        const seen = new Set<string>();
        for (let py = y; py < y + height; py += 1) for (let px = x; px < x + width; px += 1) seen.add(pixel(picture, px, py));
        return seen;
      };
      const traced = colours(open(['moor']));
      for (const ink of [CHART_INK.land, CHART_INK.sea, CHART_INK.pine, CHART_INK.roof, CHART_INK.red]) {
        expect(traced.has(ink), ink).toBe(false);
      }
      expect(colours({ ...open(CHART_PIECES.map((piece) => piece.id)) }).has('#c83020')).toBe(true);
    });

    it('rings a rumoured gap with a red question mark, and leaves a gap nobody spoke of blank', () => {
      const fold = CHART_PIECES.find((piece) => piece.id === 'fold')!;
      const { x, y, width, height } = slot(fold.slot.column, fold.slot.row);
      const reds = (picture: ReturnType<typeof chartTablePicture>): number => {
        let count = 0;
        for (let py = y; py < y + height; py += 1) for (let px = x; px < x + width; px += 1) count += pixel(picture, px, py) === '#c83020' ? 1 : 0;
        return count;
      };
      expect(reds(chartTablePicture(facts(open(), [], ['spyglass-lost-fold']), area))).toBeGreaterThan(0);
      expect(reds(chartTablePicture(facts(open()), area))).toBe(0);
    });

    it('is what the lab hangs over the table, from the save', () => {
      const game = baseGame({ progress: { treasureHunt: open(['shore']), rumoursHeard: ['spyglass-lost-fold'] } });
      game.stash.addItem('chart-piece-1', 1);
      const hung = roomPosterPicture(game, { kind: 'chart-table', area });
      expect(hung.data).toEqual(chartTablePicture(chartTableFacts(game), area).data);
      expect(chartTableFacts(game).held('chart-piece-1')).toBe(1);
      expect(NO_TREASURE_HUNT.pinned).toEqual([]);
    });
  });

  it('stands across the aisle from the starters, faced from the floor and walked round', () => {
    const built = buildRoom(lab, baseGame());
    const table = built.things.find((thing) => thing.name === 'THE CHART TABLE')!;
    expect(table.tiles).toEqual(CHART_TABLE_TILES);
    expect(built.posters).toContainEqual({ kind: 'chart-table', area: OAK_CHART_TABLE });
    const walks = stepsFrom(built.collision, lab.mat!);
    // Solid, and walked up to from its front.
    for (const tile of CHART_TABLE_TILES) {
      expect(built.collision[tile.y][tile.x]).toBe(true);
    }
    const front = OAK_CHART_TABLE.y + OAK_CHART_TABLE.height;
    for (let x = OAK_CHART_TABLE.x; x < OAK_CHART_TABLE.x + OAK_CHART_TABLE.width; x += 1) {
      expect(Number.isFinite(walks[front][x])).toBe(true);
    }
    // Every floor tile of the lab is still walked to from the mat.
    built.collision.forEach((row, y) =>
      row.forEach((solid, x) => {
        if (!solid) {
          expect([x, y, Number.isFinite(walks[y][x])]).toEqual([x, y, true]);
        }
      }),
    );
  });
});
