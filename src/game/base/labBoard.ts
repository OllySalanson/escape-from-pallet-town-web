import { buildContractBoard, type ContractBoardRow } from '../hub/contractBoard';
import { errandPlace, errandSquares, errandThing, errandsInHand, type Errand } from '../hub/errands';
import { formatRecoveryClock, raidClockAfterRecovery, teamCondition } from '../hub/recovery';
import { RAID_DURATION_MS } from '../run/raidClock';
import type { RestoredGame } from '../save/SaveManager';
import type { Rect } from '../ui/labelPlacement';
import type { PaintedPicture } from '../world/minimap';
import { worldMapName } from '../worldMap';

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

/** One thing pinned up. A contract and a favour look different on the wall. */
export interface BoardNotice {
  readonly kind: 'contract' | 'errand';
  readonly line: string;
}

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

/** Everything pinned to the board: the contracts, then the favours in hand. */
export function boardNotices(game: Pick<RestoredGame, 'raidProgress' | 'stash'>): readonly BoardNotice[] {
  return [
    ...buildContractBoard(game.raidProgress).rows.map(contractNotice),
    ...errandsInHand(game.raidProgress).map((errand) => errandNotice(errand, game.stash.itemCount(errand.itemId) > 0)),
  ];
}

/** What is read off the board, a line a notice. */
export function boardLines(game: Pick<RestoredGame, 'raidProgress' | 'stash'>): readonly string[] {
  const notices = boardNotices(game);
  return notices.length === 0 ? [BARE_BOARD_LINE] : notices.map((notice) => notice.line);
}

/** The line under the board's caption: how much is on it. */
export function boardNote(game: Pick<RestoredGame, 'raidProgress' | 'stash'>): string {
  const count = boardNotices(game).length;
  return count === 0 ? 'Nothing pinned up' : `${count} ${count === 1 ? 'notice' : 'notices'} pinned up`;
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
} as const;

/** The frame, as the wall map's board has it: an outline and a wooden edge. */
const BOARD_BORDER = 2;
const SLIP_WIDTH = 10;
const SLIP_HEIGHT = 11;
const SLIP_GAP = 2;

/** Where each slip is pinned on a board this size, left to right along two rows; the board holds what fits. */
export function slipSeats(width: number, height: number): readonly { readonly x: number; readonly y: number }[] {
  const across = Math.floor((width - BOARD_BORDER * 2 - SLIP_GAP) / (SLIP_WIDTH + SLIP_GAP));
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
  const seats = slipSeats(width, height);
  boardNotices(game)
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
