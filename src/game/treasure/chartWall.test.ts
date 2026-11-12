import { describe, expect, it } from 'vitest';
import { CHART_WALL } from '../base/rooms';
import { builtInFileMap } from '../world/playerMaps';
import { districtAt } from '../world/districts';
import { getWorldMap } from '../worldMap';
import {
  CHART_GROUND,
  CHART_INK,
  chartGround,
  chartNameWidth,
  chartPicture,
  chartPointOf,
  chartWallPicture,
  pieceSlotAt,
  tearAcross,
  tearDown,
} from './chartWall';
import { CHART_GRID, CHART_PIECES, NO_TREASURE_HUNT, TREASURE_PLACE, TREASURE_SECRET_ID, type TreasureHunt } from './treasureMap';

/**
 * THE CHART ROOM's board (`chartWall.ts`), held to what the owner asked of it
 * on 12 Nov 2026: the four pieces are one picture, the picture is a place in
 * the game, and the X on it is where the chest is.
 */

const VALE = 'greystone-vale';
const every = CHART_PIECES.map((piece) => piece.id);
const pinned = (ids: readonly string[]): TreasureHunt => ({ ...NO_TREASURE_HUNT, roomOpen: true, pinned: ids });

/** The board's sheet: inside the frame and a pixel in from the baize's edge, as `chartWallPicture` lays it. */
const BOARD = { width: CHART_WALL.width * 16, height: CHART_WALL.height * 16 };
const SHEET = { x: 5, y: 5, width: BOARD.width - 10, height: BOARD.height - 10 };

const pixel = (picture: ReturnType<typeof chartWallPicture>, x: number, y: number): string => {
  const at = (y * picture.width + x) * 4;
  return `#${[0, 1, 2].map((offset) => picture.data[at + offset].toString(16).padStart(2, '0')).join('')}`;
};

const slotOf = (id: string) => CHART_PIECES.find((piece) => piece.id === id)!.slot;

describe('the chart is a place in the game', () => {
  const cove = chartGround();
  const file = builtInFileMap(VALE)!;
  const map = getWorldMap(VALE);

  it('is SMUGGLERS’ COVE, read off the vale’s own map', () => {
    for (const tile of [cove.spot, cove.landing]) {
      expect(districtAt(VALE, tile)?.name, JSON.stringify(tile)).toBeDefined();
    }
    // The ground it draws is the district the treasure's secret names.
    const districts = new Set(
      [cove.spot, cove.landing, ...cove.houses].map((tile) => file.file.districts?.find((district) => district.name === TREASURE_PLACE && tile.x >= district.x && tile.y >= district.y && tile.x < district.x + district.width && tile.y < district.y + district.height)?.name),
    );
    expect([...districts]).toEqual([TREASURE_PLACE]);
    // And it is all inside the vale.
    expect(CHART_GROUND.x).toBeGreaterThanOrEqual(0);
    expect(CHART_GROUND.x + CHART_GROUND.width).toBeLessThanOrEqual(map.width);
    expect(CHART_GROUND.y + CHART_GROUND.height).toBeLessThanOrEqual(map.height);
  });

  it('puts the X on the tile the chest is dug up at', () => {
    const nook = file.loot.find((piece) => piece.secret === TREASURE_SECRET_ID)!;
    expect(cove.spot).toEqual(nook.position);
    const chart = chartPicture(SHEET.width, SHEET.height);
    const at = chartPointOf(cove.spot, SHEET.width, SHEET.height);
    expect(chart[at.y][at.x]).toBe(CHART_INK.red);
    // Nothing else on the chart is an X: red is the course, its ring and the cross.
    const board = chartWallPicture(pinned(every), CHART_WALL);
    expect(pixel(board, SHEET.x + at.x, SHEET.y + at.y)).toBe(CHART_INK.red);
  });

  it('draws the cove two pixels to a tile, so a shed is a shed and the jetty is the jetty', () => {
    expect(SHEET.width / CHART_GROUND.width).toBe(2);
    expect(SHEET.height / CHART_GROUND.height).toBe(2);
    expect(cove.houses.length).toBeGreaterThanOrEqual(2);
    expect(cove.boats.length).toBeGreaterThanOrEqual(1);
    // Sea, sand and cliff are all on it: it is a cove.
    const grounds = new Set(cove.ground.flat());
    for (const kind of ['sea', 'sand', 'cliff', 'plank'] as const) expect(grounds.has(kind), kind).toBe(true);
  });

  it('runs its red course along a walk a raid can make, from a landing to the X', () => {
    expect(file.insertions.some((insertion) => insertion.position.x === cove.landing.x && insertion.position.y === cove.landing.y)).toBe(true);
    expect(cove.course[0]).toEqual(cove.landing);
    expect(cove.course[cove.course.length - 1]).toEqual(cove.spot);
    cove.course.forEach((tile, index) => {
      expect(map.collision[tile.y][tile.x], JSON.stringify(tile)).toBe(false);
      if (index > 0) {
        const before = cove.course[index - 1];
        expect(Math.abs(before.x - tile.x) + Math.abs(before.y - tile.y), JSON.stringify(tile)).toBe(1);
      }
    });
  });

  it('letters the cove’s name on open water, where it lies over nothing', () => {
    expect(chartNameWidth()).toBeLessThan(SHEET.width / 2);
    const chart = chartPicture(SHEET.width, SHEET.height);
    const lettered: [number, number][] = [];
    for (let y = Math.round(SHEET.height * 0.75); y < SHEET.height; y += 1) {
      for (let x = 0; x < Math.round(SHEET.width * 0.04) + chartNameWidth(); x += 1) {
        if (chart[y][x] === CHART_INK.ink) lettered.push([x, y]);
      }
    }
    expect(lettered.length).toBeGreaterThan(60);
    for (const [x, y] of lettered) {
      const tile = {
        x: Math.floor((x * CHART_GROUND.width) / SHEET.width),
        y: Math.floor((y * CHART_GROUND.height) / SHEET.height),
      };
      expect(cove.ground[tile.y][tile.x], `${x},${y}`).toBe('sea');
    }
  });
});

describe('the four pieces are one picture', () => {
  it('has a piece for every part of the sheet, and each piece shows what MARLOW says it does', () => {
    const cove = chartGround();
    const slotAt = (tile: { readonly x: number; readonly y: number }) => {
      const at = chartPointOf(tile, SHEET.width, SHEET.height);
      return pieceSlotAt(at.x, at.y, SHEET.width, SHEET.height);
    };
    // The red line starts on the piece that says so, and the X is on the piece that says so.
    expect(slotAt(cove.landing)).toEqual(slotOf('moor'));
    expect(CHART_PIECES.find((piece) => piece.id === 'moor')!.pinnedLines.join(' ')).toContain('red line starts');
    expect(slotAt(cove.spot)).toEqual(slotOf('fold'));
    expect(CHART_PIECES.find((piece) => piece.id === 'fold')!.pinnedLines.join(' ')).toContain('an X');
    // The name is on the piece that reads it out.
    expect(pieceSlotAt(Math.round(SHEET.width * 0.1), Math.round(SHEET.height * 0.85), SHEET.width, SHEET.height)).toEqual(slotOf('hollow'));
    expect(CHART_PIECES.find((piece) => piece.id === 'hollow')!.pinnedLines.join(' ')).toContain(TREASURE_PLACE);
  });

  it('tears the sheet along two lines every piece shares, close to its middle', () => {
    for (let y = 0; y < SHEET.height; y += 1) {
      expect(Math.abs(tearDown(y, SHEET.width) - SHEET.width / 2)).toBeLessThanOrEqual(3);
    }
    for (let x = 0; x < SHEET.width; x += 1) {
      expect(Math.abs(tearAcross(x, SHEET.height) - SHEET.height / 2)).toBeLessThanOrEqual(3);
    }
    const slots = new Set<string>();
    for (let y = 0; y < SHEET.height; y += 1) {
      for (let x = 0; x < SHEET.width; x += 1) {
        const slot = pieceSlotAt(x, y, SHEET.width, SHEET.height);
        slots.add(`${slot.column},${slot.row}`);
      }
    }
    expect(slots.size).toBe(CHART_GRID.columns * CHART_GRID.rows);
  });

  it('leaves no board showing between pieces that are pinned side by side', () => {
    const whole = chartWallPicture(pinned(every), CHART_WALL);
    const baize = new Set<string>([CHART_INK.baize, CHART_INK.baizeDeep, CHART_INK.dash]);
    // Everywhere but the sheet's own worn outer edge is paper.
    for (let y = SHEET.y + 1; y < SHEET.y + SHEET.height - 1; y += 1) {
      for (let x = SHEET.x + 1; x < SHEET.x + SHEET.width - 1; x += 1) {
        expect(baize.has(pixel(whole, x, y)), `${x},${y}`).toBe(false);
      }
    }
    // And two neighbours alone meet along their tear: nothing but paper either side of it.
    const pair = chartWallPicture(pinned(['shore', 'moor']), CHART_WALL);
    for (let y = 2; y < Math.floor(SHEET.height / 2) - 4; y += 1) {
      const tear = tearDown(y, SHEET.width);
      for (const x of [tear - 1, tear, tear + 1]) {
        expect(baize.has(pixel(pair, SHEET.x + x, SHEET.y + y)), `${x},${y}`).toBe(false);
      }
    }
  });

  it('shows only what is pinned: a missing piece is board, chalked out, and the X waits for its own piece', () => {
    const cove = chartGround();
    const cross = chartPointOf(cove.spot, SHEET.width, SHEET.height);
    const withoutFold = chartWallPicture(pinned(['shore', 'moor', 'hollow']), CHART_WALL);
    expect(pixel(withoutFold, SHEET.x + cross.x, SHEET.y + cross.y)).not.toBe(CHART_INK.red);
    const inks = (picture: ReturnType<typeof chartWallPicture>): Set<string> => {
      const seen = new Set<string>();
      for (let y = 0; y < picture.height; y += 1) for (let x = 0; x < picture.width; x += 1) seen.add(pixel(picture, x, y));
      return seen;
    };
    // An empty board is all chalk and no chart; a whole one is all chart and no chalk.
    const empty = inks(chartWallPicture(undefined, CHART_WALL));
    expect(empty.has(CHART_INK.dash)).toBe(true);
    expect(empty.has(CHART_INK.sea)).toBe(false);
    const whole = inks(chartWallPicture(pinned(every), CHART_WALL));
    expect(whole.has(CHART_INK.dash)).toBe(false);
    expect(whole.has(CHART_INK.sea)).toBe(true);
    // Each piece adds to the picture, whatever order they go up in.
    let before = Buffer.from(chartWallPicture(pinned([]), CHART_WALL).data);
    const up: string[] = [];
    for (const id of ['fold', 'shore', 'hollow', 'moor']) {
      up.push(id);
      const after = Buffer.from(chartWallPicture(pinned(up), CHART_WALL).data);
      expect(after.equals(before), id).toBe(false);
      before = after;
    }
  });

  it('gilds the frame only once the chart is whole', () => {
    const three = chartWallPicture(pinned(['shore', 'moor', 'hollow']), CHART_WALL);
    const whole = chartWallPicture(pinned(every), CHART_WALL);
    expect([whole.width, whole.height]).toEqual([BOARD.width, BOARD.height]);
    expect(pixel(three, 20, 2)).not.toBe(CHART_INK.gilt);
    expect(pixel(whole, 20, 2)).toBe(CHART_INK.gilt);
  });
});
