import { describe, expect, it } from 'vitest';
import { baseGame } from './baseGames.testkit';
import { BARE_BOARD_LINE, RUMOURS_PINNED_LINE, boardLines, boardNote, boardNotices, boardPoster, scrapSeats, slipSeats } from './labBoard';
import { BOARD_TILES, OAK_BOARD, OAK_CHART_TABLE, OAK_WALL_MAP, buildRoom, roomNamed } from './rooms';
import { RUMOURS } from '../world/rumours';
import { SECRETS, rewardKey } from '../world/secrets';
import { buildContractBoard } from '../hub/contractBoard';
import { getErrand, withErrandAsked } from '../hub/errands';

const lab = roomNamed('oaks-lab')!;
/** A raid behind it: nothing is pinned up for anybody yet to go on one. */
const BEEN_OUT = { raidRecord: { 'greystone-vale': { deployed: 1, extracted: 1, wiped: 0 } } };

describe("Oak's cork board", () => {
  it('reads one notice a line, saying what the board always said about a contract', () => {
    const game = baseGame({ progress: BEEN_OUT });
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
    const game = baseGame({ progress: BEEN_OUT });
    const count = boardNotices(game).length;
    expect(boardNote(game)).toBe(`${count} ${count === 1 ? 'notice' : 'notices'} pinned up`);
  });

  it('hangs on the lab wall beside the map, and is read like it from the floor in front', () => {
    const built = buildRoom(lab, baseGame());
    const thing = built.things.find((each) => each.reads === 'board');

    expect(thing?.tiles).toEqual(BOARD_TILES);
    expect(built.posters).toEqual([
      { kind: 'cork-board', area: OAK_BOARD },
      { kind: 'chart-table', area: OAK_CHART_TABLE },
    ]);
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

  describe('rumour slips', () => {
    const shadow = SECRETS.find((secret) => secret.id === 'the-long-shadow')!;
    const heard = ['board-long-shadow', 'angler-red-one', 'spyglass-lost-fold'];

    it('pins every rumour heard as a scrap of its own, read after the work under a line saying what they are', () => {
      const game = baseGame({ progress: { ...BEEN_OUT, rumoursHeard: heard } });
      const rumours = boardNotices(game).filter((notice) => notice.kind === 'rumour');
      expect(rumours).toHaveLength(3);
      // The board's own heading is dropped: the board says they are rumours once, before them.
      expect(rumours[0].line).not.toMatch(/^RUMOUR:/);
      expect(rumours[0].line).toContain('THE GREY STONES');
      const lines = boardLines(game);
      const at = lines.indexOf(RUMOURS_PINNED_LINE);
      expect(at).toBe(lines.length - 4);
      expect(lines.slice(at + 1)).toEqual(rumours.map((notice) => notice.line));
      expect(boardNote(game)).toContain('3 rumours');
    });

    it('takes a scrap down once its secret has nothing left to find', () => {
      const game = baseGame({
        progress: { ...BEEN_OUT, rumoursHeard: heard, secretsFound: [rewardKey(shadow, shadow.rewards[0])] },
      });
      const rumours = boardNotices(game).filter((notice) => notice.kind === 'rumour');
      expect(rumours.map((notice) => notice.line).join(' ')).not.toContain('THE GREY STONES');
      expect(rumours).toHaveLength(2);
    });

    it('reads as rumours alone when nothing else is pinned up, never as the bare board', () => {
      const game = baseGame({ progress: { rumoursHeard: ['angler-red-one'] } });
      expect(boardLines(game)[0]).toBe(RUMOURS_PINNED_LINE);
      expect(boardNote(game)).toBe('1 rumour');
    });

    it('has a corner for every rumour there is, clear of the slips beside it and inside the frame', () => {
      const width = OAK_BOARD.width * 16;
      const height = OAK_BOARD.height * 16;
      const scraps = scrapSeats(width, height, RUMOURS.length);
      const slips = slipSeats(width, height, RUMOURS.length);
      expect(scraps.length).toBeGreaterThanOrEqual(RUMOURS.length);
      expect(slips.length).toBeGreaterThanOrEqual(4);
      const slipsEnd = Math.max(...slips.map((seat) => seat.x + 10));
      for (const scrap of scraps) {
        expect(scrap.x).toBeGreaterThan(slipsEnd);
        expect(scrap.x + 6).toBeLessThanOrEqual(width - 2);
        expect(scrap.y + 6).toBeLessThanOrEqual(height - 2);
      }
      // And no scrap is pinned over another.
      scraps.forEach((a, i) =>
        scraps.slice(i + 1).forEach((b) => expect(a.x + 6 <= b.x || b.x + 6 <= a.x || a.y + 6 <= b.y || b.y + 6 <= a.y).toBe(true)),
      );
      // Without rumours the slips keep the whole board, as they always had it,
      // and a dozen rumours take one column of it, as they always did.
      expect(slipSeats(width, height).length).toBeGreaterThan(slipSeats(width, height, 12).length);
      expect(scrapSeats(width, height, 12)).toEqual(scrapSeats(width, height, 1));
      expect(slipSeats(width, height, 12).length).toBeGreaterThan(slips.length);
    });

    it('paints a green-pinned scrap for each, on the same opaque board', () => {
      const game = baseGame({ progress: { rumoursHeard: heard } });
      const poster = boardPoster(game, OAK_BOARD);
      const pins = scrapSeats(poster.width, poster.height, heard.length).map(({ x, y }) => {
        const at = (y * poster.width + x + 2) * 4;
        return [poster.data[at], poster.data[at + 1], poster.data[at + 2]].join(',');
      });
      expect(pins.filter((pin) => pin === '56,160,72')).toHaveLength(3);
      for (let at = 3; at < poster.data.length; at += 4) {
        expect(poster.data[at]).toBe(255);
      }
    });
  });
});
