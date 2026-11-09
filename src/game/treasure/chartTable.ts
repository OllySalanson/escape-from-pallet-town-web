import type { RestoredGame } from '../save/SaveManager';
import type { PaintedPicture } from '../world/minimap';
import { RUMOURS } from '../world/rumours';
import { secretById } from '../world/secrets';
import { CHART_INK, chartPicture } from './chartWall';
import {
  CHART_GRID,
  CHART_PIECES,
  CHART_ROOM_NAME,
  chartWhole,
  MARLOW,
  NO_TREASURE_HUNT,
  TREASURE_PLACE,
  type ChartPiece,
  type TreasureHunt,
} from './treasureMap';

/**
 * Professor Oak's CHART TABLE: the lab's half of THE TREASURE MAP
 * (`treasureMap.ts`), on a table across the aisle from the one the starters
 * were chosen at.
 *
 * It is one story with THE CHART ROOM, not a second chart. MARLOW keeps the
 * torn chart, pinned on his board for good; Oak's table is where the hunt is
 * followed from the lab a raid sets out from, and it shows each piece as the
 * hunt has it:
 *
 * - **traced**: on MARLOW's board. He sends Oak a tracing of every piece he
 *   pins, so it is drawn here in pencil, and the dotted course runs through it
 *   in red once the chart is whole.
 * - **here**: home from a raid (or off THE BEACH) and in the vault, not yet
 *   pinned. It lies on the table in its own colours, where it goes, and Oak
 *   sends it on to MARLOW. This is the moment a find is seen at home.
 * - **rumoured**: still out there, but a rumour about its secret has been
 *   heard: a pencilled ring and a question mark where it will go, the same
 *   mark the telescope chalks over the district.
 * - **missing**: an empty slot, pencilled out once MARLOW has shown what shape
 *   the chart is; before then Oak knows no shape and the paper is bare.
 *
 * Nothing is stored for it: it is the hunt (`raidProgress.treasureHunt`), the
 * vault and the rumours heard. Phaser-free.
 */

export type ChartTablePiece = 'traced' | 'here' | 'rumoured' | 'missing';

/** What the table knows: the hunt, what the vault holds, and the rumours heard. */
export interface ChartTableFacts {
  readonly hunt: TreasureHunt | undefined;
  readonly held: (itemId: string) => number;
  readonly rumoursHeard: readonly string[];
}

/** What the chart table is painted from, read off a save. */
export function chartTableFacts(game: Pick<RestoredGame, 'raidProgress' | 'stash'>): ChartTableFacts {
  return {
    hunt: game.raidProgress.treasureHunt,
    held: (itemId) => game.stash.itemCount(itemId),
    rumoursHeard: game.raidProgress.rumoursHeard ?? [],
  };
}

/** The heard rumour about a piece's secret that says where it is, if any. */
export function pieceRumour(piece: ChartPiece, heard: readonly string[]): (typeof RUMOURS)[number] | undefined {
  const source = piece.from;
  if (source.kind !== 'secret') {
    return undefined;
  }
  return RUMOURS.find((rumour) => rumour.secret === source.secretId && rumour.gives.includes('where') && heard.includes(rumour.id));
}

/** How each piece lies on the table, in the chart's own order. */
export function chartTablePieces(facts: ChartTableFacts): readonly { readonly piece: ChartPiece; readonly state: ChartTablePiece }[] {
  const hunt = facts.hunt ?? NO_TREASURE_HUNT;
  return CHART_PIECES.map((piece) => {
    if (hunt.pinned.includes(piece.id)) {
      return { piece, state: 'traced' };
    }
    if (facts.held(piece.itemId) > 0) {
      return { piece, state: 'here' };
    }
    return { piece, state: pieceRumour(piece, facts.rumoursHeard) ? 'rumoured' : 'missing' };
  });
}

/** The caption under the table's name. */
export function chartTableNote(facts: ChartTableFacts): string {
  const pieces = chartTablePieces(facts);
  const here = pieces.filter(({ state }) => state === 'here').length;
  const traced = pieces.filter(({ state }) => state === 'traced').length;
  if (here > 0) {
    return here === 1 ? 'A torn chart lies on it' : `${here} torn charts lie on it`;
  }
  if (traced === 0) {
    return 'Tracing paper, and nothing on it';
  }
  return traced === CHART_PIECES.length ? 'The whole chart, traced' : `${traced} of ${CHART_PIECES.length} pieces traced`;
}

const NUMBER_WORDS = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

/** Where a piece came from, as Oak would put it. */
function foundAt(piece: ChartPiece): string {
  const source = piece.from;
  if (source.kind === 'beach') {
    return 'off THE BEACH';
  }
  return `from ${secretById(source.secretId)?.place ?? 'GREYSTONE VALE'}`;
}

/**
 * What is said at the table, faced: what lies on it, then Oak. A piece here is
 * sent on to MARLOW - the chart is his to keep and the board is where it goes
 * for good - and a rumoured gap names only the place its rumour named.
 */
export function chartTableLines(facts: ChartTableFacts, itemName: (itemId: string) => string): readonly string[] {
  const hunt = facts.hunt ?? NO_TREASURE_HUNT;
  const pieces = chartTablePieces(facts);
  const here = pieces.filter(({ state }) => state === 'here');
  const traced = pieces.filter(({ state }) => state === 'traced').length;
  const rumoured = pieces.filter(({ state }) => state === 'rumoured');
  const missing = pieces.filter(({ state }) => state === 'missing').length;
  if (hunt.chestOpened) {
    return [
      'The whole chart, traced, with the dotted line running all the way to an X.',
      `OAK: The chart that led to a smugglers' chest! ${MARLOW.name} has not stopped talking about it.`,
    ];
  }
  if (chartWhole(hunt)) {
    return [
      'The whole chart, traced in pencil, and the dotted course inked over in red.',
      `OAK: ${MARLOW.name} sent the last tracing over himself. Off the sea, over the moor, through the pines... to ${TREASURE_PLACE}.`,
      'Whatever is under that X, it is behind MISTY\'s sandbags. Be ready for her.',
    ];
  }
  const lines: string[] = [];
  if (here.length === 0 && traced === 0) {
    lines.push('A big table under a sheet of tracing paper, pinned flat. Nothing is drawn on it yet.');
  }
  for (const { piece } of here) {
    lines.push(
      piece.from.kind === 'beach'
        ? `The ${itemName(piece.itemId).toUpperCase()} is spread out on the table, still smelling of the sea.`
        : `The ${itemName(piece.itemId).toUpperCase()} ${foundAt(piece)} is lying on the table, where it goes on the chart.`,
    );
  }
  if (here.length > 0) {
    lines.push(
      hunt.roomOpen
        ? `OAK: ${MARLOW.name} will want ${here.length === 1 ? 'that' : 'those'} pinned on his board. ${CHART_ROOM_NAME}, behind THE GREAT LIBRARY's end bookcase.`
        : `OAK: An old chart! That is ${MARLOW.name}'s line, not mine. Take it to him at THE GREAT LIBRARY, up past THE GREEN.`,
    );
  }
  if (traced > 0) {
    lines.push(`OAK: ${MARLOW.name} sends me a tracing of every piece he pins. ${traced === 1 ? 'One' : NUMBER_WORDS[traced][0].toUpperCase() + NUMBER_WORDS[traced].slice(1)} of ${NUMBER_WORDS[CHART_PIECES.length]}, so far.`);
  }
  for (const { piece } of rumoured) {
    lines.push(`Pencilled in where a piece is missing: ${pieceRumour(piece, facts.rumoursHeard)?.names.toUpperCase()}?`);
  }
  if (hunt.roomOpen && missing > 0) {
    lines.push(
      rumoured.length > 0
        ? `OAK: And nobody has said a word about the ${missing === 1 ? 'last one' : `other ${NUMBER_WORDS[missing]}`}. Keep your ears open in the harbour.`
        : `OAK: ${NUMBER_WORDS[missing][0].toUpperCase() + NUMBER_WORDS[missing].slice(1)} still out in GREYSTONE VALE. The board, the sailors and BILL hear things.`,
    );
  }
  if (here.length === 0 && traced === 0 && !hunt.roomOpen) {
    lines.push('OAK: I keep it for charts, and nobody has brought me one. The sea throws old things up on THE BEACH, now and then.');
  }
  return lines;
}

// -- the picture --------------------------------------------------------------

const TILE = 16;

const INK = {
  paper: '#f8f0d0',
  paperShade: '#d8c898',
  paperEdge: '#a89060',
  shadow: '#506850',
  pencil: '#888070',
  pencilLight: '#c0b498',
  red: '#c83020',
  brass: '#e8b838',
  brassShade: '#a87818',
  glass: '#c8e8f0',
  outline: '#383020',
  torn: '#d8b880',
} as const;

/**
 * The chart as it lies on the table, in the table's own `area`: a sheet of
 * tracing paper over the felt, hanging a little over its front edge, each piece
 * on it as `chartTablePieces` says, and Oak's magnifying glass on a corner.
 * Every pixel outside the sheet and the glass is left clear, so the table shows
 * round it. The table is FireRed's lab table, its top three tiles wide and
 * about a tile deep; the sheet covers the top.
 */
export function chartTablePicture(facts: ChartTableFacts, area: { readonly width: number; readonly height: number }): PaintedPicture {
  const width = area.width * TILE;
  const height = area.height * TILE;
  const data = new Uint8ClampedArray(width * height * 4);
  const plot = (x: number, y: number, ink: string): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    const rgb = [1, 3, 5].map((at) => Number.parseInt(ink.slice(at, at + 2), 16));
    data.set([rgb[0], rgb[1], rgb[2], 255], (y * width + x) * 4);
  };
  const fill = (x: number, y: number, w: number, h: number, ink: string): void => {
    for (let py = y; py < y + h; py += 1) for (let px = x; px < x + w; px += 1) plot(px, py, ink);
  };
  const hunt = facts.hunt ?? NO_TREASURE_HUNT;
  const whole = chartWhole(hunt);
  // The sheet: over the felt, a little proud of the table's front edge, with its shadow under it.
  const sheet = { x: 3, y: 2, width: width - 6, height: Math.min(height - 9, 21) };
  fill(sheet.x + 1, sheet.y + sheet.height, sheet.width, 1, INK.shadow);
  fill(sheet.x, sheet.y, sheet.width, sheet.height, INK.paper);
  fill(sheet.x, sheet.y + sheet.height - 1, sheet.width, 1, INK.paperShade);
  fill(sheet.x + sheet.width - 1, sheet.y, 1, sheet.height, INK.paperShade);
  const inner = { x: sheet.x + 2, y: sheet.y + 2, width: sheet.width - 4, height: sheet.height - 4 };
  const chart = chartPicture(inner.width, inner.height);
  const slotWidth = Math.floor(inner.width / CHART_GRID.columns);
  const slotHeight = Math.floor(inner.height / CHART_GRID.rows);
  const pieces = chartTablePieces(facts);
  // A pencil hatch for the sea and a pencil line for everything drawn, the
  // tracing of what is on MARLOW's board; red only for the course once whole.
  const traced = (x: number, y: number, colour: string): string | null => {
    if (colour === CHART_INK.red || colour === CHART_INK.redLight) return whole ? INK.red : INK.pencil;
    if (colour === CHART_INK.sea || colour === CHART_INK.seaWave) return (x + y) % 3 === 0 ? INK.pencilLight : null;
    if (colour === CHART_INK.land || colour === CHART_INK.landShade) return null;
    return INK.pencil;
  };
  for (const { piece, state } of pieces) {
    const sx = inner.x + piece.slot.column * slotWidth;
    const sy = inner.y + piece.slot.row * slotHeight;
    const right = piece.slot.column === CHART_GRID.columns - 1 ? inner.x + inner.width : sx + slotWidth;
    const bottom = piece.slot.row === CHART_GRID.rows - 1 ? inner.y + inner.height : sy + slotHeight;
    if (state === 'traced') {
      for (let y = sy; y < bottom; y += 1)
        for (let x = sx; x < right; x += 1) {
          const ink = traced(x, y, chart[y - inner.y][x - inner.x]);
          if (ink) plot(x, y, ink);
        }
    } else if (state === 'here') {
      // The piece itself, in its own colours, lying a pixel proud with its shadow and a torn edge.
      fill(sx + 1, bottom, right - sx, 1, INK.paperShade);
      fill(right, sy + 1, 1, bottom - sy, INK.paperShade);
      for (let y = sy; y < bottom; y += 1)
        for (let x = sx; x < right; x += 1) {
          const onEdge = x === sx || y === sy || x === right - 1 || y === bottom - 1;
          plot(x, y, onEdge ? ((x * 3 + y) % 4 === 0 ? INK.paper : INK.torn) : chart[y - inner.y][x - inner.x]);
        }
    } else if (hunt.roomOpen || state === 'rumoured') {
      // An empty slot, pencilled out: a dotted edge.
      for (let x = sx + 1; x < right - 1; x += 2) {
        plot(x, sy, INK.pencilLight);
        plot(x, bottom - 1, INK.pencilLight);
      }
      for (let y = sy + 1; y < bottom - 1; y += 2) {
        plot(sx, y, INK.pencilLight);
        plot(right - 1, y, INK.pencilLight);
      }
      if (state === 'rumoured') {
        // The telescope's chalk ring, in pencil, round a question mark.
        const cx = Math.floor((sx + right) / 2);
        const cy = Math.floor((sy + bottom) / 2);
        for (const [dx, dy] of [[-3, -1], [-3, 0], [-3, 1], [3, -1], [3, 0], [3, 1], [-2, -2], [2, -2], [-2, 2], [2, 2], [-1, -3], [1, -3], [-1, 3], [1, 3], [0, -3], [0, 3]] as const) {
          plot(cx + dx, cy + dy, INK.pencil);
        }
        for (const [dx, dy] of [[-1, -1], [0, -2], [1, -1], [0, 0], [0, 2]] as const) {
          plot(cx + dx, cy + dy, INK.red);
        }
      }
    }
  }
  // Oak's magnifying glass, on the sheet's front corner and over its edge.
  const gx = sheet.x + sheet.width - 6;
  const gy = sheet.y + sheet.height - 5;
  for (const [dx, dy] of [[-1, -2], [0, -2], [1, -2], [-2, -1], [2, -1], [-2, 0], [2, 0], [-2, 1], [2, 1], [-1, 2], [0, 2], [1, 2]] as const) {
    plot(gx + dx, gy + dy, dy > 0 || dx > 1 ? INK.brassShade : INK.brass);
  }
  fill(gx - 1, gy - 1, 3, 3, INK.glass);
  plot(gx - 1, gy - 1, INK.paper);
  plot(gx + 3, gy + 3, INK.outline);
  plot(gx + 4, gy + 4, INK.outline);
  plot(gx + 3, gy + 4, INK.brassShade);
  return { width, height, data };
}
