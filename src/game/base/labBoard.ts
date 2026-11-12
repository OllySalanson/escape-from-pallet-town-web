import { buildContractBoard, type ContractBoardRow } from '../hub/contractBoard';
import { errandPlace, errandSquares, errandThing, errandsInHand, type Errand } from '../hub/errands';
import { formatRecoveryClock, raidClockAfterRecovery, teamCondition } from '../hub/recovery';
import { RAID_DURATION_MS } from '../run/raidClock';
import type { RestoredGame } from '../save/SaveManager';
import type { Rect } from '../ui/labelPlacement';
import type { PaintedPicture } from '../world/minimap';
import { worldMapName } from '../worldMap';
import { RUMOURS } from '../world/rumours';
import { secretById, secretSpent } from '../world/secrets';

/**
 * Oak's cork board: the work on offer, pinned to the wall of his lab.
 *
 * It used to be a screen - the playtest's "dark blue spreadsheet", opened from
 * the door mat without taking a step, of rows that all did nothing when chosen,
 * because a contract is taken by choosing where to drop in. All it ever was is
 * something to read, so it is read: one notice a line in the room's dialogue
 * box, walked up to as the wall map beside it is, or read out by Oak from the
 * mat (`BaseScene.readTheBoard`).
 *
 * Nothing is stored. The words come from what the board's rows already were
 * (`hub/contractBoard.ts`), so the board, a door's caption and the Gym Guide
 * cannot disagree, and the picture is painted from the same list: one slip a
 * notice, so a player can count what is on it from across the room.
 */

/**
 * One thing pinned up. A contract, a favour and a rumour look different on the
 * wall: a rumour is a torn scrap with a green pin, pinned in its own corner.
 */
export interface BoardNotice {
  readonly kind: 'contract' | 'errand' | 'rumour';
  readonly line: string;
}

/** What Oak says before the rumours, so a line about a tarn is not read as a job. */
export const RUMOURS_PINNED_LINE = 'Rumours you have heard, pinned up in the corner:';

/** What the board says when nothing is pinned to it. */
export const BARE_BOARD_LINE = 'Nothing pinned up. Raids from here are for supplies, Pokémon and whatever the maps still hold.';

function contractNotice(row: ContractBoardRow): BoardNotice {
  const asks = row.asks ? ` ${row.asks}.` : '';
  // Where it is, unless its own sentence has said: choosing a contract is
  // choosing where to drop in, and the board may hold one for every map.
  const map = worldMapName(row.mapId);
  const where = row.description.includes(map) ? '' : ` On ${map}.`;
  return {
    kind: 'contract',
    line: `${row.name.toUpperCase()}: ${row.description}.${where}${asks} Reward: ${row.reward}`,
  };
}

function errandNotice(errand: Errand, home: boolean): BoardNotice {
  const thing = errandThing(errand);
  if (home) {
    return { kind: 'errand', line: `${thing} is home. Take it to ${errand.name}.` };
  }
  const squares = errandSquares(errand);
  return {
    kind: 'errand',
    line: `${thing} for ${errand.name}: in ${errandPlace(errand)}. ${squares} ${squares === 1 ? 'square' : 'squares'} of your pack. Reward: ${errand.reward.summary}.`,
  };
}

/**
 * Every rumour heard about a secret that still holds something, as it was
 * heard (`world/rumours.ts`): a collection that grows as the harbour talks and
 * comes down a scrap at a time as each is run to ground in the vale.
 */
export function rumourNotices(raidProgress: RestoredGame['raidProgress']): readonly BoardNotice[] {
  const known = { secretsFound: raidProgress.secretsFound ?? [], giftsReceived: raidProgress.giftsReceived };
  return (raidProgress.rumoursHeard ?? []).flatMap((id) => {
    const rumour = RUMOURS.find((each) => each.id === id);
    const secret = rumour && secretById(rumour.secret);
    return rumour && secret && !secretSpent(secret, known)
      ? [{ kind: 'rumour' as const, line: rumour.line.replace(/^RUMOUR:\s*/, '') }]
      : [];
  });
}

/** Everything pinned to the board: the contracts, then the favours in hand, then the rumours heard. */
export function boardNotices(game: Pick<RestoredGame, 'raidProgress' | 'stash'>): readonly BoardNotice[] {
  return [
    ...buildContractBoard(game.raidProgress).rows.map(contractNotice),
    ...errandsInHand(game.raidProgress).map((errand) => errandNotice(errand, game.stash.itemCount(errand.itemId) > 0)),
    ...rumourNotices(game.raidProgress),
  ];
}

/** What is read off the board, a line a notice, the rumours after a line saying they are rumours. */
export function boardLines(game: Pick<RestoredGame, 'raidProgress' | 'stash'>): readonly string[] {
  const notices = boardNotices(game);
  if (notices.length === 0) {
    return [BARE_BOARD_LINE];
  }
  const work = notices.filter((notice) => notice.kind !== 'rumour').map((notice) => notice.line);
  const rumours = notices.filter((notice) => notice.kind === 'rumour').map((notice) => notice.line);
  return [...work, ...(rumours.length === 0 ? [] : [RUMOURS_PINNED_LINE, ...rumours])];
}

/** The line under the board's caption: how much is on it. */
export function boardNote(game: Pick<RestoredGame, 'raidProgress' | 'stash'>): string {
  const notices = boardNotices(game);
  const count = notices.filter((notice) => notice.kind !== 'rumour').length;
  const rumours = notices.length - count;
  const work = count === 0 ? (rumours === 0 ? 'Nothing pinned up' : '') : `${count} ${count === 1 ? 'notice' : 'notices'} pinned up`;
  const heard = rumours === 0 ? '' : `${rumours} ${rumours === 1 ? 'rumour' : 'rumours'}`;
  return [work, heard].filter((part) => part !== '').join(', ');
}

/**
 * What Oak has to say before he reads the board: who is hurt, and what the
 * Center has already taken off the next raid. The screen's two cards used to say
 * so; it is the one fact that decides whether to set off at all.
 */
export function oakNews(game: Pick<RestoredGame, 'stash' | 'pendingRecoveryMs'>, free = false): readonly string[] {
  const condition = teamCondition(game.stash);
  const pending = game.pendingRecoveryMs;
  return [
    ...(condition ? [`${condition}. NURSE JOY is across the yard.`] : []),
    ...(pending > 0 && !free
      ? [
          `Your next raid runs ${formatRecoveryClock(raidClockAfterRecovery(RAID_DURATION_MS, pending))}: ${formatRecoveryClock(pending)} went on recovery.`,
        ]
      : []),
  ];
}

const CORK = {
  outline: '#2e2016',
  frame: '#a86f3a',
  frameLight: '#cf9a5c',
  cork: '#b98a54',
  corkFleck: '#a57743',
  corkShade: '#94683a',
  paper: '#f4eed2',
  paperEdge: '#c9bf95',
  favour: '#d6e4ec',
  favourEdge: '#9fb4c0',
  writing: '#6f6a58',
  pin: '#d8342c',
  favourPin: '#2f5fb8',
  scrap: '#e8d8a0',
  scrapEdge: '#b8a068',
  scrapWriting: '#887050',
  rumourPin: '#38a048',
} as const;

/** The frame, as the wall map's board has it: an outline and a wooden edge. */
const BOARD_BORDER = 2;
const SLIP_WIDTH = 10;
const SLIP_HEIGHT = 11;
const SLIP_GAP = 2;

/** A rumour's scrap: smaller than a notice, torn off something else. */
const SCRAP_WIDTH = 6;
const SCRAP_HEIGHT = 6;
const SCRAP_GAP = 1;

/** How many slips fit across a board this wide, with no rumours pinned. */
function slipsAcrossBoard(width: number): number {
  return Math.floor((width - BOARD_BORDER * 2 - SLIP_GAP) / (SLIP_WIDTH + SLIP_GAP));
}

/** The rumours' scraps that fit in a corner of this many slip columns, in rows. */
function cornerSeats(width: number, height: number, columns: number): readonly { readonly x: number; readonly y: number }[] {
  const left = BOARD_BORDER + SLIP_GAP + (slipsAcrossBoard(width) - columns) * (SLIP_WIDTH + SLIP_GAP);
  const room = width - BOARD_BORDER - left;
  // The rows are stacked edge to edge, so the corner holds a row more - ten rumours want ten
  // scraps, and with a gap between the rows Oak's board had nine (#488 and #489 together).
  // Across, a scrap sits a pixel off its neighbours' line wherever there is a pixel to spare;
  // where the row fills its room exactly the last scrap keeps the line, which is what lets two
  // columns of slips hold twenty rumours rather than sixteen (the third wave of secrets made
  // seventeen, and a third column would have left the notices two slips).
  const across = Math.floor((room + SCRAP_GAP) / (SCRAP_WIDTH + SCRAP_GAP));
  const spare = room - (across * SCRAP_WIDTH + (across - 1) * SCRAP_GAP);
  const down = Math.floor((height - BOARD_BORDER * 2 - SLIP_GAP) / SCRAP_HEIGHT);
  const seats: { x: number; y: number }[] = [];
  for (let row = 0; row < down; row += 1) {
    for (let column = 0; column < across; column += 1) {
      seats.push({
        x: left + column * (SCRAP_WIDTH + SCRAP_GAP) + ((spare > 0 || column < across - 1) && (row * 2 + column) % 3 === 0 ? 1 : 0),
        y: BOARD_BORDER + SLIP_GAP + row * SCRAP_HEIGHT,
      });
    }
  }
  return seats;
}

/**
 * How many columns of the board's slips give way to the rumours' corner: one
 * whenever any rumour is pinned, and another each time the scraps would not
 * fit - so a board with a dozen rumours on it looks as it always did, and the
 * thirteenth takes a column of slips rather than going unpinned. The slips
 * always keep one column.
 */
function cornerColumns(width: number, height: number, rumours: number): number {
  if (rumours <= 0) {
    return 0;
  }
  let columns = 1;
  while (columns < slipsAcrossBoard(width) - 1 && cornerSeats(width, height, columns).length < rumours) {
    columns += 1;
  }
  return columns;
}

/**
 * Where each slip is pinned on a board this size, left to right along two
 * rows; the board holds what fits. With rumours pinned up the last columns are
 * their corner (`scrapSeats`), so the slips keep the rest.
 */
export function slipSeats(width: number, height: number, rumours = 0): readonly { readonly x: number; readonly y: number }[] {
  const across = slipsAcrossBoard(width) - cornerColumns(width, height, rumours);
  const down = Math.floor((height - BOARD_BORDER * 2 - SLIP_GAP) / (SLIP_HEIGHT + SLIP_GAP));
  const seats: { x: number; y: number }[] = [];
  for (let row = 0; row < down; row += 1) {
    for (let column = 0; column < across; column += 1) {
      // A slip a pixel off its neighbour's line, every other one, because
      // nobody pins notices up with a ruler.
      seats.push({
        x: BOARD_BORDER + SLIP_GAP + column * (SLIP_WIDTH + SLIP_GAP),
        y: BOARD_BORDER + SLIP_GAP - 1 + row * (SLIP_HEIGHT + SLIP_GAP) + ((row + column) % 2),
      });
    }
  }
  return seats;
}

/** Where this many rumours' scraps are pinned: the board's right-hand corner, in rows, past the slips. */
export function scrapSeats(width: number, height: number, rumours: number): readonly { readonly x: number; readonly y: number }[] {
  return cornerSeats(width, height, Math.max(1, cornerColumns(width, height, rumours)));
}

/** The board, painted from the save onto its stretch of wall. */
export function boardPoster(game: Pick<RestoredGame, 'raidProgress' | 'stash'>, area: Rect): PaintedPicture {
  const width = area.width * 16;
  const height = area.height * 16;
  const data = new Uint8ClampedArray(width * height * 4);
  const fill = (x: number, y: number, w: number, h: number, ink: string): void => {
    const rgb = [1, 3, 5].map((at) => Number.parseInt(ink.slice(at, at + 2), 16));
    for (let py = Math.max(0, y); py < Math.min(height, y + h); py += 1) {
      for (let px = Math.max(0, x); px < Math.min(width, x + w); px += 1) {
        data.set([rgb[0], rgb[1], rgb[2], 255], (py * width + px) * 4);
      }
    }
  };
  fill(0, 0, width, height, CORK.outline);
  fill(1, 1, width - 2, height - 2, CORK.frame);
  fill(1, 1, width - 2, 1, CORK.frameLight);
  fill(1, 1, 1, height - 2, CORK.frameLight);
  const inner = width - BOARD_BORDER * 2;
  const innerHeight = height - BOARD_BORDER * 2;
  fill(BOARD_BORDER, BOARD_BORDER, inner, innerHeight, CORK.cork);
  // Cork's flecks: a fixed scatter, so the board looks the same every visit.
  for (let y = 0; y < innerHeight; y += 1) {
    for (let x = 0; x < inner; x += 1) {
      if ((x * 7 + y * 13) % 11 === 0) {
        fill(BOARD_BORDER + x, BOARD_BORDER + y, 1, 1, CORK.corkFleck);
      }
    }
  }
  fill(BOARD_BORDER, BOARD_BORDER, inner, 1, CORK.corkShade);
  fill(BOARD_BORDER, BOARD_BORDER, 1, innerHeight, CORK.corkShade);
  const notices = boardNotices(game);
  const rumours = notices.filter((notice) => notice.kind === 'rumour');
  const seats = slipSeats(width, height, rumours.length);
  const scraps = scrapSeats(width, height, rumours.length);
  rumours.slice(0, scraps.length).forEach((_rumour, index) => {
    const { x, y } = scraps[index];
    fill(x, y, SCRAP_WIDTH, SCRAP_HEIGHT, CORK.scrap);
    // Torn: a bite out of its foot, and the edge it was torn along shaded.
    fill(x + (index % 2 === 0 ? 3 : 1), y + SCRAP_HEIGHT - 1, 2, 1, CORK.cork);
    fill(x, y + SCRAP_HEIGHT - 1, 1, 1, CORK.scrapEdge);
    fill(x + SCRAP_WIDTH - 1, y + 1, 1, SCRAP_HEIGHT - 1, CORK.scrapEdge);
    fill(x + 1, y + 3, SCRAP_WIDTH - 2, 1, CORK.scrapWriting);
    fill(x + 1, y + 4, SCRAP_WIDTH - 3, 1, CORK.scrapWriting);
    fill(x + 2, y, 2, 2, CORK.rumourPin);
  });
  notices
    .filter((notice) => notice.kind !== 'rumour')
    .slice(0, seats.length)
    .forEach((notice, index) => {
      const { x, y } = seats[index];
      const favour = notice.kind === 'errand';
      fill(x, y, SLIP_WIDTH, SLIP_HEIGHT, favour ? CORK.favour : CORK.paper);
      fill(x, y + SLIP_HEIGHT - 1, SLIP_WIDTH, 1, favour ? CORK.favourEdge : CORK.paperEdge);
      fill(x + SLIP_WIDTH - 1, y, 1, SLIP_HEIGHT, favour ? CORK.favourEdge : CORK.paperEdge);
      for (const row of [3, 5, 7]) {
        fill(x + 2, y + row, row === 7 ? SLIP_WIDTH - 6 : SLIP_WIDTH - 4, 1, CORK.writing);
      }
      fill(x + Math.floor(SLIP_WIDTH / 2) - 1, y, 2, 2, favour ? CORK.favourPin : CORK.pin);
    });
  return { width, height, data };
}
