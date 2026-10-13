import { describe, expect, it } from 'vitest';
import { PHRASE_SHOWN_MS, PING_EVERY_MS, PING_SHOWN_MS, ROOM_PHRASES, SAY_EVERY_MS, TalkBoard, encodeTalk, readTalk } from './roomTalk';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';

describe('talking in a raid room', () => {
  it('is six phrases and a ping, read back exactly', () => {
    expect(ROOM_PHRASES).toHaveLength(6);
    expect(readTalk(encodeTalk({ kind: 'say', from: A, phrase: 1 }))).toEqual({ kind: 'say', from: A, phrase: 1 });
    expect(readTalk(encodeTalk({ kind: 'ping', from: B, tile: { x: 300, y: 4 } }))).toEqual({ kind: 'ping', from: B, tile: { x: 300, y: 4 } });
  });

  it('is never words of anybody’s own', () => {
    for (const bad of [
      null,
      { k: 's', u: A, n: 6 },
      { k: 's', u: A, n: -1 },
      { k: 's', u: A, n: 'hello' },
      { k: 's', u: A, t: 'free text' },
      { k: 'g', u: A, x: 1.5, y: 2 },
      { k: 'g', u: A, x: 1, y: 99_999 },
      { k: 's', u: 'ASH', n: 0 },
    ]) {
      expect(readTalk(bad)).toBeNull();
    }
  });

  it('shows a phrase on its speaker for a while, and a ping on its tile for longer', () => {
    const board = new TalkBoard();
    board.hear({ kind: 'say', from: A, phrase: 1 }, 1_000);
    board.hear({ kind: 'ping', from: B, tile: { x: 5, y: 6 } }, 1_000);
    expect(board.saying(A, 1_000 + PHRASE_SHOWN_MS - 1)).toBe('HUNTER COMING!');
    expect(board.saying(A, 1_000 + PHRASE_SHOWN_MS)).toBeNull();
    expect(board.pings(1_000 + PING_SHOWN_MS - 1)).toEqual(new Map([[B, { x: 5, y: 6 }]]));
    expect(board.pings(1_000 + PING_SHOWN_MS)).toEqual(new Map());
  });

  it('drops talk that comes faster than the room allows, whoever sends it', () => {
    const board = new TalkBoard();
    expect(board.hear({ kind: 'say', from: A, phrase: 0 }, 0)).toBe(true);
    expect(board.hear({ kind: 'say', from: A, phrase: 5 }, SAY_EVERY_MS - 1)).toBe(false);
    expect(board.saying(A, SAY_EVERY_MS - 1)).toBe('OVER HERE!');
    expect(board.hear({ kind: 'say', from: B, phrase: 5 }, 1)).toBe(true);
    expect(board.hear({ kind: 'say', from: A, phrase: 5 }, SAY_EVERY_MS)).toBe(true);
    expect(board.hear({ kind: 'ping', from: A, tile: { x: 1, y: 1 } }, 0)).toBe(true);
    expect(board.hear({ kind: 'ping', from: A, tile: { x: 2, y: 2 } }, PING_EVERY_MS - 1)).toBe(false);
    board.forget(A);
    expect(board.pings(1)).toEqual(new Map());
  });
});
