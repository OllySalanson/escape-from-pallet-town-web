import { describe, expect, it } from 'vitest';
import { stepsFrom } from '../base/baseWalks';
import { baseGame } from '../base/baseGames.testkit';
import { BASE_ROOMS, buildRoom } from '../base/rooms';
import { visitBot, visitsAt } from '../base/harbourBots';
import type { GridPosition } from '../movement/gridMovement';
import {
  ARCADE_CABINETS,
  ARCADE_WINDOW_MS,
  arcadeRegularLine,
  arcadeRegularsAt,
  cabinetFront,
  cabinetLampsPicture,
  cabinetTiles,
  HIGH_SCORES_BOARD,
  highScoresPicture,
  MOST_AT_A_GAME,
  tiersPaidToday,
} from './arcade';
import { berryCabinetNote, jumpCabinetNote } from './gameCornerTalk';
import { NO_GAME_CORNER, payGame } from './tickets';

const ROOM = BASE_ROOMS.find((room) => room.id === 'game-corner');
if (!ROOM) throw new Error('no game corner');
const key = (tile: GridPosition): string => `${tile.x},${tile.y}`;
const NOW = new Date(2026, 10, 7, 15, 0);
/** A day's worth of windows to look through. */
const WINDOWS = Array.from({ length: 720 }, (_window, index) => index * ARCADE_WINDOW_MS + NOW.getTime());

describe('THE GAME CORNER as an arcade', () => {
  it('stands three cabinets of each game in rows, where the slot machines were, each faced from the floor', () => {
    const built = buildRoom(ROOM, baseGame(), NOW);
    expect(ARCADE_CABINETS.filter((cabinet) => cabinet.game === 'pokemon-jump')).toHaveLength(3);
    expect(ARCADE_CABINETS.filter((cabinet) => cabinet.game === 'berry-picking')).toHaveLength(3);
    for (const cabinet of ARCADE_CABINETS) {
      const thing = built.things.find((each) => each.tiles.some((tile) => key(tile) === key(cabinet.at)));
      expect(thing?.opens).toBe(cabinet.game);
      for (const tile of cabinetTiles(cabinet)) {
        expect(built.collision[tile.y][tile.x]).toBe(true);
      }
    }
    expect(built.things.some((thing) => thing.name === 'THE SLOTS')).toBe(false);
  });

  it('keeps the aisle from the door to the counter clear', () => {
    const mat = ROOM.mat as GridPosition;
    for (const nowMs of WINDOWS) {
      const built = buildRoom(ROOM, baseGame(), new Date(nowMs));
      for (let y = 4; y <= mat.y; y += 1) {
        for (const x of [6, 7, 8]) {
          expect([nowMs, x, y, built.collision[y][x]]).toEqual([nowMs, x, y, false]);
        }
      }
    }
  });

  it('never leaves a pocket of floor nobody can reach, and always leaves a cabinet of each game free to play', () => {
    const mat = ROOM.mat as GridPosition;
    for (const nowMs of WINDOWS) {
      const built = buildRoom(ROOM, baseGame(), new Date(nowMs));
      const steps = stepsFrom(built.collision, mat);
      for (let y = 0; y < ROOM.height; y += 1) {
        for (let x = 0; x < ROOM.width; x += 1) {
          // The attendant's own tile, inside the counter's L.
          if (built.collision[y][x] || (x === ROOM.keeper?.position.x && y === ROOM.keeper?.position.y)) continue;
          expect([nowMs, x, y, Number.isFinite(steps[y][x])]).toEqual([nowMs, x, y, true]);
        }
      }
      const regulars = arcadeRegularsAt(nowMs);
      for (const game of ['pokemon-jump', 'berry-picking'] as const) {
        expect(regulars.filter((regular) => regular.game === game && regular.playing).length).toBeLessThanOrEqual(MOST_AT_A_GAME);
        const free = ARCADE_CABINETS.filter(
          (cabinet) => cabinet.game === game && cabinetFront(cabinet).every((tile) => !regulars.some((regular) => key(regular.tile) === key(tile))),
        );
        expect([nowMs, game, free.length > 0]).toEqual([nowMs, game, true]);
      }
    }
  });

  it('stands nobody at a cabinet who is out walking the yard at that moment, and nobody twice', () => {
    for (const nowMs of WINDOWS) {
      const yard = new Set(visitsAt(nowMs).map((visit) => visitBot(visit).id));
      const regulars = arcadeRegularsAt(nowMs);
      expect(new Set(regulars.map((regular) => regular.bot.id)).size).toBe(regulars.length);
      for (const regular of regulars) {
        expect([nowMs, regular.bot.id, yard.has(regular.bot.id)]).toEqual([nowMs, regular.bot.id, false]);
      }
    }
  });

  it('has somebody at the cabinets most of the time, playing or waiting behind somebody who is', () => {
    const busy = WINDOWS.filter((nowMs) => arcadeRegularsAt(nowMs).length > 0).length;
    expect(busy / WINDOWS.length).toBeGreaterThan(0.6);
    for (const nowMs of WINDOWS) {
      const regulars = arcadeRegularsAt(nowMs);
      for (const waiting of regulars.filter((regular) => !regular.playing)) {
        expect(regulars.some((regular) => regular.playing && regular.tile.x === waiting.tile.x && regular.tile.y === waiting.tile.y - 1)).toBe(true);
      }
      for (const regular of regulars) {
        expect(regular.facing).toBe('up');
        const line = arcadeRegularLine(regular, { gameCorner: NO_GAME_CORNER }, new Date(nowMs));
        expect(line.startsWith(`${regular.bot.name}: `)).toBe(true);
        expect(line.length).toBeLessThanOrEqual(68);
      }
    }
  });

  it('draws whoever is at the cabinets in the room, solid, each with something to say', () => {
    const nowMs = WINDOWS.find((at) => arcadeRegularsAt(at).length >= 2) as number;
    const built = buildRoom(ROOM, baseGame(), new Date(nowMs));
    const regulars = arcadeRegularsAt(nowMs);
    expect(built.people?.map((person) => person.id)).toEqual(regulars.map((regular) => regular.bot.id));
    for (const regular of regulars) {
      expect(built.collision[regular.tile.y][regular.tile.x]).toBe(true);
      expect(built.things.find((thing) => thing.name === regular.bot.name)?.lines).toHaveLength(1);
    }
  });

  it('lights a lamp on every cabinet of a game for each ticket tier it has paid today', () => {
    const progress = (score: number, game: 'pokemon-jump' | 'berry-picking' = 'pokemon-jump') => ({
      gameCorner: payGame(NO_GAME_CORNER, game, score, NOW).record,
    });
    expect(tiersPaidToday('pokemon-jump', { gameCorner: NO_GAME_CORNER }, NOW)).toBe(0);
    expect(tiersPaidToday('pokemon-jump', progress(300), NOW)).toBe(1);
    expect(tiersPaidToday('pokemon-jump', progress(2600), NOW)).toBe(2);
    expect(tiersPaidToday('pokemon-jump', progress(9000), NOW)).toBe(3);
    expect(tiersPaidToday('berry-picking', progress(9000), NOW)).toBe(0);
    expect(tiersPaidToday('berry-picking', progress(3100, 'berry-picking'), NOW)).toBe(2);
    // A new day, nothing paid.
    expect(tiersPaidToday('pokemon-jump', progress(9000), new Date(2026, 10, 8, 9, 0))).toBe(0);
    const lit = (picture: ReturnType<typeof cabinetLampsPicture>) => {
      let count = 0;
      for (let at = 0; at < picture.data.length; at += 4) {
        if (picture.data[at] === 0xf8 && picture.data[at + 1] === 0xe0) count += 1;
      }
      return count;
    };
    expect(lit(cabinetLampsPicture(0))).toBe(0);
    expect(lit(cabinetLampsPicture(2))).toBe(lit(cabinetLampsPicture(1)) * 2);
    const built = buildRoom(ROOM, baseGame(), NOW);
    expect(built.posters.filter((poster) => poster.kind === 'cabinet-lamps')).toHaveLength(ARCADE_CABINETS.length);
  });

  it("says on each cabinet's caption what its game has paid today", () => {
    const record = payGame(NO_GAME_CORNER, 'pokemon-jump', 2600, NOW).record;
    expect(jumpCabinetNote({ gameCorner: record }, NOW)).toBe('Today 2,600 · paid 20 today');
    const full = payGame(record, 'pokemon-jump', 7000, NOW).record;
    expect(jumpCabinetNote({ gameCorner: full }, NOW)).toBe('Today 7,000 · paid all 30 today');
    expect(jumpCabinetNote({ gameCorner: full }, new Date(2026, 10, 8, 9, 0))).toBe('Your best 7,000');
    expect(berryCabinetNote({ gameCorner: full }, NOW)).toBe('Bring a DODRIO');
  });

  it('hangs the HIGH SCORES board on the back wall beside the counter, faced from the floor in front of it', () => {
    const built = buildRoom(ROOM, baseGame(), NOW);
    const board = built.things.find((thing) => thing.name === 'HIGH SCORES');
    // Its caption already says HIGH SCORES, so what is read starts on a score (playtest wave 3).
    expect(board?.lines?.[0]).toMatch(/^JUMP: /);
    expect(built.posters.find((poster) => poster.kind === 'high-scores')?.area).toEqual(HIGH_SCORES_BOARD);
    for (let x = HIGH_SCORES_BOARD.x; x < HIGH_SCORES_BOARD.x + HIGH_SCORES_BOARD.width; x += 1) {
      expect(built.collision[HIGH_SCORES_BOARD.y + HIGH_SCORES_BOARD.height][x]).toBe(false);
    }
    const picture = highScoresPicture({ gameCorner: NO_GAME_CORNER }, NOW);
    expect([picture.width, picture.height]).toEqual([HIGH_SCORES_BOARD.width * 16, HIGH_SCORES_BOARD.height * 16]);
  });

  it('paints the score just made in gold once it tops the board', () => {
    const gold = (picture: ReturnType<typeof highScoresPicture>) => {
      let count = 0;
      for (let at = 0; at < picture.data.length; at += 4) {
        if (picture.data[at] === 0xf8 && picture.data[at + 1] === 0xc8 && picture.data[at + 2] === 0x40) count += 1;
      }
      return count;
    };
    expect(gold(highScoresPicture({ gameCorner: NO_GAME_CORNER }, NOW))).toBe(0);
    const record = payGame(NO_GAME_CORNER, 'pokemon-jump', 9990, NOW).record;
    expect(gold(highScoresPicture({ gameCorner: record }, NOW))).toBeGreaterThan(0);
  });
});
