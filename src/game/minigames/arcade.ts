import { HARBOUR_BOTS, rngFor, visitBot, visitsAt, type HarbourBot } from '../base/harbourBots';
import type { Direction, GridPosition } from '../movement/gridMovement';
import type { RaidProgress } from '../save/SaveManager';
import type { PaintedPicture } from '../world/minimap';
import { fitLettering, letteringWidth, paintLettering } from './boardLetters';
import { BOARD_GAME_NAMES, boardResult, highScoresFor, regularResult, YOU } from './highScores';
import { BERRY_TICKET_TIERS, JUMP_TICKET_TIERS, NO_GAME_CORNER, today, type TicketSource } from './tickets';

/**
 * THE GAME CORNER as an arcade (the overnight plan's N7): two rows of
 * cabinets where FireRed's slot machines stood - three POKéMON JUMP down the
 * west side in Venusaur's green, three BERRY PICKING down the east in Dodrio's
 * tan - the aisle between them running from the door to the coin counter, and
 * the HIGH SCORES board on the back wall (`highScores.ts`).
 *
 * - **Every cabinet plays.** Three of each is what makes it an arcade, and why
 *   somebody playing one never keeps the player off the game.
 * - **Each cabinet says what today has paid.** Three lamps on its front, one
 *   for each ticket tier the game has paid today (`tickets.ts`): all three lit
 *   is a game that has nothing more to pay until tomorrow.
 * - **The regulars play here.** Who is at the cabinets is a pure function of
 *   the clock, as everything about the regulars is (`base/harbourBots.ts`):
 *   the same people on every screen, changing every `ARCADE_WINDOW_MS`, and
 *   never anybody who is out walking the yard at that moment. Never more than
 *   two at one game's three cabinets, so one is always free, and anybody
 *   waiting stands behind somebody playing, never in the aisle.
 *
 * Phaser-free and pure: the room (`base/rooms.ts`) plants and paints what this
 * says, and `arcade.test.ts` holds it.
 */

/** A cabinet in the room: the game it plays and its top-left tile (each is 2x3, faced from the row under it). */
export interface ArcadeCabinet {
  readonly game: Extract<TicketSource, 'pokemon-jump' | 'berry-picking'>;
  readonly at: GridPosition;
}

/** How tall a cabinet stands, in tiles. */
export const CABINET_HEIGHT = 3;

/** The row the cabinets' tops stand on. */
const CABINET_ROW = 6;

export const ARCADE_CABINETS: readonly ArcadeCabinet[] = [
  { game: 'pokemon-jump', at: { x: 0, y: CABINET_ROW } },
  { game: 'pokemon-jump', at: { x: 2, y: CABINET_ROW } },
  { game: 'pokemon-jump', at: { x: 4, y: CABINET_ROW } },
  { game: 'berry-picking', at: { x: 9, y: CABINET_ROW } },
  { game: 'berry-picking', at: { x: 11, y: CABINET_ROW } },
  { game: 'berry-picking', at: { x: 13, y: CABINET_ROW } },
];

/** Where the HIGH SCORES board hangs: on the back wall right of the coin counter, down to the floor. */
export const HIGH_SCORES_BOARD = { x: 10, y: 0, width: 5, height: 3 } as const;

/** The tiles a cabinet stands on. */
export function cabinetTiles(cabinet: ArcadeCabinet): readonly GridPosition[] {
  return Array.from({ length: 2 * CABINET_HEIGHT }, (_tile, index) => ({ x: cabinet.at.x + (index % 2), y: cabinet.at.y + Math.floor(index / 2) }));
}

/** The two tiles in front of a cabinet, where whoever plays it stands. */
export function cabinetFront(cabinet: ArcadeCabinet): readonly GridPosition[] {
  const y = cabinet.at.y + CABINET_HEIGHT;
  return [
    { x: cabinet.at.x, y },
    { x: cabinet.at.x + 1, y },
  ];
}

// --- who is in -----------------------------------------------------------------

/** How long one lot of regulars stays at the cabinets before the next lot are in. */
export const ARCADE_WINDOW_MS = 120_000;

/** The most who play one game's cabinets at once: one of its three is always free. */
export const MOST_AT_A_GAME = 2;

/** A regular at the cabinets: playing one, or waiting behind somebody who is. */
export interface ArcadeRegular {
  readonly bot: HarbourBot;
  readonly game: ArcadeCabinet['game'];
  readonly tile: GridPosition;
  readonly facing: Direction;
  readonly playing: boolean;
}

/** The regulars out walking the yard at a moment: they cannot also be at a cabinet. */
function outInTheYard(nowMs: number): ReadonlySet<string> {
  return new Set(visitsAt(nowMs).map((visit) => visitBot(visit).id));
}

/**
 * Who is at the cabinets at a moment, and where: up to two at each game, each
 * standing at a cabinet's front facing it, and now and then somebody waiting
 * behind one of them for a go.
 */
export function arcadeRegularsAt(nowMs: number): readonly ArcadeRegular[] {
  const window = Math.floor(nowMs / ARCADE_WINDOW_MS);
  const rng = rngFor(44, window);
  const yard = outInTheYard(nowMs);
  const free = rng.shuffle(HARBOUR_BOTS.filter((bot) => !yard.has(bot.id)));
  const regulars: ArcadeRegular[] = [];
  for (const game of ['pokemon-jump', 'berry-picking'] as const) {
    const playing = Math.min(rng.int(0, MOST_AT_A_GAME), free.length);
    const cabinets = rng.shuffle(ARCADE_CABINETS.filter((cabinet) => cabinet.game === game)).slice(0, playing);
    for (const cabinet of cabinets) {
      const bot = free.shift();
      if (!bot) break;
      const tile = cabinetFront(cabinet)[rng.int(0, 1)];
      regulars.push({ bot, game, tile, facing: 'up', playing: true });
      if (rng.chance(0.35) && free.length > 0) {
        const next = free.shift() as HarbourBot;
        regulars.push({ bot: next, game, tile: { x: tile.x, y: tile.y + 1 }, facing: 'up', playing: false });
      }
    }
  }
  return regulars;
}

/** What a regular at the cabinets says when spoken to: their own score today, the board's word for it. */
export function arcadeRegularLine(regular: ArcadeRegular, progress: Pick<RaidProgress, 'gameCorner'>, now: Date): string {
  const lines = highScoresFor(regular.game, progress, now);
  const at = lines.findIndex((line) => line.name === regular.bot.name);
  const game = BOARD_GAME_NAMES[regular.game];
  if (!regular.playing) {
    return `${regular.bot.name}: Next go is mine. Watch the board.`;
  }
  if (at < 0) {
    return `${regular.bot.name}: Not on the board yet today. Shh - this is the one.`;
  }
  const score = boardResult(regular.game, regularResult(regular.bot, regular.game, now));
  return at === 0
    ? `${regular.bot.name}: ${score} at ${game} - top of the board. Beat that.`
    : `${regular.bot.name}: ${score} at ${game} so far. Not top yet.`;
}

// --- what the cabinets and the board show ----------------------------------------

/** How many of a game's ticket tiers it has paid today: the lamps lit on its cabinets. */
export function tiersPaidToday(game: ArcadeCabinet['game'], progress: Pick<RaidProgress, 'gameCorner'>, now: Date): number {
  const paid = today(progress.gameCorner ?? NO_GAME_CORNER, now).paid[game] ?? 0;
  const tiers = game === 'pokemon-jump' ? JUMP_TICKET_TIERS : BERRY_TICKET_TIERS;
  return tiers.filter((tier) => paid >= tier.tickets).length;
}

type Rgb = readonly [number, number, number];

const hex = (value: string): Rgb => [1, 3, 5].map((at) => Number.parseInt(value.slice(at, at + 2), 16)) as unknown as Rgb;

/** The board's and the lamps' colours: the cabinets' own marquee night and neon, GBA values. */
const INK = {
  outline: hex('#404868'),
  dark: hex('#282838'),
  night: hex('#302050'),
  nightLight: hex('#483070'),
  neon: hex('#f860b0'),
  bulb: hex('#f8e070'),
  bulbHot: hex('#fff8d0'),
  bulbOff: hex('#705018'),
  bulbOffEdge: hex('#483010'),
  white: hex('#f8f8f8'),
  cyan: hex('#88d0f8'),
  gold: hex('#f8c840'),
  green: hex('#70e888'),
} as const;

function canvas(width: number, height: number): { picture: PaintedPicture; plot: (x: number, y: number, ink: Rgb) => void; fill: (x: number, y: number, w: number, h: number, ink: Rgb) => void } {
  const data = new Uint8ClampedArray(width * height * 4);
  const plot = (x: number, y: number, ink: Rgb): void => {
    if (x < 0 || y < 0 || x >= width || y >= height) return;
    data.set([ink[0], ink[1], ink[2], 255], (y * width + x) * 4);
  };
  const fill = (x: number, y: number, w: number, h: number, ink: Rgb): void => {
    for (let py = y; py < y + h; py += 1) for (let px = x; px < x + w; px += 1) plot(px, py, ink);
  };
  return { picture: { width, height, data }, plot, fill };
}

/**
 * The lamps on one cabinet, painted over its front where the coin slot is:
 * three, lit for each tier its game has paid today. Everything else in the
 * picture is clear, so the cabinet shows through.
 */
export function cabinetLampsPicture(lit: number): PaintedPicture {
  const { picture, plot, fill } = canvas(32, 48);
  [8, 14, 20].forEach((x, index) => {
    const on = index < lit;
    fill(x, 36, 4, 4, on ? INK.bulb : INK.bulbOff);
    // Round the corners, and an edge round the lamp.
    for (const [cx, cy] of [
      [x, 36],
      [x + 3, 36],
      [x, 39],
      [x + 3, 39],
    ]) {
      plot(cx, cy, on ? INK.gold : INK.bulbOffEdge);
    }
    if (on) {
      plot(x + 1, 37, INK.bulbHot);
    }
  });
  return picture;
}

/**
 * The HIGH SCORES board: TODAY'S BEST in lights, then each cabinet's game, the
 * score at the top of the board today and whose it is - gold when it is the
 * player's. A ring of bulbs round it, as round the Game Corner's own marquee.
 */
export function highScoresPicture(progress: Pick<RaidProgress, 'gameCorner'>, now: Date): PaintedPicture {
  const width = HIGH_SCORES_BOARD.width * 16;
  const height = HIGH_SCORES_BOARD.height * 16;
  const { picture, plot, fill } = canvas(width, height);
  // The frame and the field, with a row of bulbs round the edge.
  fill(0, 1, width, height - 3, INK.outline);
  fill(1, 2, width - 2, height - 5, INK.dark);
  fill(2, 3, width - 4, height - 7, INK.night);
  for (let x = 4; x < width - 3; x += 4) {
    plot(x, 2, (x / 4) % 2 === 0 ? INK.bulbHot : INK.bulb);
    plot(x, height - 4, (x / 4) % 2 === 0 ? INK.bulb : INK.bulbHot);
  }
  // Two legs to the floor.
  fill(6, height - 2, 2, 2, INK.outline);
  fill(width - 8, height - 2, 2, 2, INK.outline);
  const centred = (text: string, y: number, ink: Rgb): void => {
    paintLettering(text, Math.floor((width - letteringWidth(text)) / 2), y, (x, py) => plot(x, py, ink));
  };
  centred('TODAY’S BEST', 5, INK.bulb);
  fill(4, 12, width - 8, 1, INK.nightLight);
  const inner = width - 12;
  (['pokemon-jump', 'berry-picking'] as const).forEach((game, index) => {
    const top = 16 + index * 13;
    const [best] = highScoresFor(game, progress, now);
    paintLettering(BOARD_GAME_NAMES[game], 6, top, (x, y) => plot(x, y, INK.neon));
    const result = boardResult(game, best.result);
    paintLettering(result, width - 6 - letteringWidth(result), top, (x, y) => plot(x, y, best.yours ? INK.gold : INK.white));
    const name = fitLettering(best.name, inner);
    paintLettering(name, 6, top + 6, (x, y) => plot(x, y, best.name === YOU ? INK.gold : INK.cyan));
  });
  return picture;
}
