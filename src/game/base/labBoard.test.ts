import { describe, expect, it } from 'vitest';
import { baseGame } from './baseGames.testkit';
import { BARE_BOARD_LINE, boardLines, boardNote, boardNotices, boardPoster, slipSeats } from './labBoard';
import { BOARD_TILES, OAK_BOARD, OAK_WALL_MAP, buildRoom, roomNamed } from './rooms';
import { buildContractBoard } from '../hub/contractBoard';
import { getErrand, withErrandAsked } from '../hub/errands';

const lab = roomNamed('oaks-lab')!;

describe("Oak's cork board", () => {
  it('reads one notice a line, saying what the board always said about a contract', () => {
    const game = baseGame();
    const [row] = buildContractBoard(game.raidProgress).rows;
    const lines = boardLines(game);

    expect(lines).toHaveLength(buildContractBoard(game.raidProgress).rows.length);
    expect(lines[0]).toContain(row.name.toUpperCase());
    expect(lines[0]).toContain(row.description);
    expect(lines[0]).toContain(`Reward: ${row.reward}`);
    if (row.asks) {
      expect(lines[0]).toContain(row.asks);
    }
  });

  it('pins a favour in hand under the contracts, saying where it lies and what it costs the pack', () => {
    const game = baseGame({ progress: { errands: withErrandAsked(undefined, 'brocks-crate') } });
    const favour = boardNotices(game).find((notice) => notice.kind === 'errand');

    expect(favour?.line).toContain('for Brock');
    expect(favour?.line).toContain('4 squares of your pack');
    expect(favour?.line).toContain('GREYSTONE PEAKS');
  });

  it('says a favour whose thing is home is to be handed over, not fetched', () => {
    const game = baseGame({ progress: { errands: withErrandAsked(undefined, 'brocks-crate') } });
    game.stash.addItem(getErrand('brocks-crate')!.itemId, 1);

    const favour = boardNotices(game).find((notice) => notice.kind === 'errand');
    expect(favour?.line).toContain('is home. Take it to Brock.');
  });

  it('never reads as a blank when nothing is pinned up', () => {
    const everyContract = baseGame();
    expect(boardLines(everyContract).length).toBeGreaterThan(0);
    expect(BARE_BOARD_LINE).toContain('Nothing pinned up');
  });

  it('counts its notices on its caption', () => {
    const game = baseGame();
    const count = boardNotices(game).length;
    expect(boardNote(game)).toBe(`${count} ${count === 1 ? 'notice' : 'notices'} pinned up`);
  });

  it('hangs on the lab wall beside the map, and is read like it from the floor in front', () => {
    const built = buildRoom(lab, baseGame());
    const thing = built.things.find((each) => each.reads === 'board');

    expect(thing?.tiles).toEqual(BOARD_TILES);
    expect(built.posters).toEqual([{ kind: 'cork-board', area: OAK_BOARD }]);
    expect(OAK_BOARD.x).toBeGreaterThanOrEqual(OAK_WALL_MAP.x + OAK_WALL_MAP.width);
    // Its foot is wall, and there is floor under every tile of it to stand on.
    const foot = OAK_BOARD.y + OAK_BOARD.height - 1;
    for (let x = OAK_BOARD.x; x < OAK_BOARD.x + OAK_BOARD.width; x += 1) {
      expect(built.collision[foot][x]).toBe(true);
      expect(built.collision[foot + 1][x]).toBe(false);
    }
  });

  it('paints a slip for every notice it has a seat for, on a picture exactly its stretch of wall', () => {
    const game = baseGame({ progress: { errands: withErrandAsked(undefined, 'brocks-crate') } });
    const poster = boardPoster(game, OAK_BOARD);

    expect(poster.width).toBe(OAK_BOARD.width * 16);
    expect(poster.height).toBe(OAK_BOARD.height * 16);
    expect(poster.data.length).toBe(poster.width * poster.height * 4);
    // Every pixel is opaque: it hangs over plain wall and shows none of it.
    for (let at = 3; at < poster.data.length; at += 4) {
      expect(poster.data[at]).toBe(255);
    }
    const seats = slipSeats(poster.width, poster.height);
    expect(seats.length).toBeGreaterThanOrEqual(boardNotices(game).length);
    for (const seat of seats) {
      expect(seat.x + 10).toBeLessThanOrEqual(poster.width - 2);
      expect(seat.y + 11).toBeLessThanOrEqual(poster.height - 2);
    }
  });
});
