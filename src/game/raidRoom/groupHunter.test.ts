import { describe, expect, it } from 'vitest';
import { HunterBoard, encodeHunterSignal, hunterKeeper, nearestQuarry, readHunterSignal, type SharedHunter } from './groupHunter';

const A = '11111111-1111-4111-8111-111111111111';
const B = '22222222-2222-4222-8222-222222222222';
const C = '33333333-3333-4333-8333-333333333333';

const hunter: SharedHunter = { spawned: true, defeated: false, position: { x: 40, y: 12 }, facing: 'left', searchMs: 0, rivalId: 'misty', returned: false };

describe('the room’s one hunter', () => {
  it('is kept by the lowest id on the map that is not in a fight', () => {
    expect(hunterKeeper(B, [A, C], new Set())).toBe(A);
    expect(hunterKeeper(B, [A, C], new Set([A]))).toBe(B);
    expect(hunterKeeper(C, [A, B], new Set([A, B]))).toBe(C);
    expect(hunterKeeper(A, [B], new Set(), true)).toBe(B);
  });

  it('chases whoever is nearest, a tie to the lowest id', () => {
    const players = [
      { id: B, tile: { x: 10, y: 10 } },
      { id: A, tile: { x: 14, y: 10 } },
      { id: C, tile: { x: 12, y: 13 } },
    ];
    expect(nearestQuarry({ x: 15, y: 10 }, players)?.id).toBe(A);
    expect(nearestQuarry({ x: 12, y: 10 }, players)?.id).toBe(A);
    expect(nearestQuarry({ x: 12, y: 10 }, [])).toBeNull();
  });

  it('reads back every signal the game sends', () => {
    for (const signal of [
      { kind: 'hunter', from: A, hunter } as const,
      { kind: 'after', from: B, hunter: { ...hunter, position: null, defeated: true, searchMs: 18_000 } } as const,
      { kind: 'busy', from: C, busy: true, withHunter: true } as const,
      { kind: 'busy', from: C, busy: false, withHunter: false } as const,
      { kind: 'away', from: A, away: true } as const,
      { kind: 'away', from: A, away: false } as const,
    ]) {
      expect(readHunterSignal(encodeHunterSignal(signal))).toEqual(signal);
    }
  });

  it('drops anything else whole', () => {
    const good = encodeHunterSignal({ kind: 'hunter', from: A, hunter });
    for (const bad of [
      null,
      { ...good, u: 'ASH' },
      { ...good, k: 'x' },
      { ...good, r: 'giovanni' },
      { ...good, f: 'north' },
      { ...good, x: 1.5 },
      { ...good, x: 99_999 },
      { ...good, x: -1 },
      { ...good, q: -5 },
      { ...good, q: 1e9 },
      { ...good, s: true },
      { k: 'b', u: A, b: 2, h: 0 },
    ]) {
      expect(readHunterSignal(bad)).toBeNull();
    }
  });

  it('holds the hunter while anybody fights it, and lets go when the fight ends or the fighter leaves', () => {
    const board = new HunterBoard();
    board.hear({ kind: 'busy', from: B, busy: true, withHunter: false });
    expect(board.busy).toEqual(new Set([B]));
    expect(board.hunterHeld).toBe(false);
    board.hear({ kind: 'busy', from: C, busy: true, withHunter: true });
    expect(board.hunterHeld).toBe(true);
    expect([board.fightOf(B), board.fightOf(C), board.fightOf(A)]).toEqual(['wild', 'hunter', null]);
    board.hear({ kind: 'after', from: C, hunter });
    expect(board.hunterHeld).toBe(false);
    expect(board.latest).toMatchObject({ from: C, after: true, hunter });
    board.forget(B);
    expect(board.busy).toEqual(new Set());
  });

  it('orders what it hears and says, however close together', () => {
    const board = new HunterBoard();
    board.hear({ kind: 'hunter', from: A, hunter });
    const first = board.latest!.at;
    board.said({ ...hunter, position: { x: 39, y: 12 } }, B);
    expect(board.latest!.at).toBeGreaterThan(first);
    expect(board.latest!.from).toBe(B);
  });

  /**
   * The multiplayer bug hunt of 12 Nov 2026: two friends caught at once each
   * fought the hunter; one beat it, the other fled, and the flee's word -
   * the fleer's own raid's hunter, which never saw the win - stood it back up
   * and set it on the winner again. Beaten for one is beaten for all, for the
   * rest of the raid, whatever is said after.
   */
  it('keeps a beaten hunter beaten, whoever speaks after', () => {
    const beaten = { ...hunter, defeated: true, position: null };
    const board = new HunterBoard();
    board.hear({ kind: 'after', from: A, hunter: beaten });
    board.hear({ kind: 'after', from: B, hunter: { ...hunter, searchMs: 18_000 } });
    expect(board.latest).toMatchObject({ from: B, after: true, hunter: { defeated: true } });
    board.hear({ kind: 'hunter', from: C, hunter });
    expect(board.latest!.hunter.defeated).toBe(true);

    // The same when this browser's own fight was the win.
    const mine = new HunterBoard();
    mine.said(beaten, A);
    mine.hear({ kind: 'after', from: B, hunter });
    expect(mine.latest!.hunter.defeated).toBe(true);

    // A room left is a fresh hunter for the next raid.
    mine.clear();
    mine.hear({ kind: 'hunter', from: B, hunter });
    expect(mine.latest!.hunter.defeated).toBe(false);
  });

  it('lets the enrage bring a beaten hunter back once, and keeps that one beaten too', () => {
    const board = new HunterBoard();
    board.hear({ kind: 'after', from: A, hunter: { ...hunter, defeated: true } });
    // The keeper's clock ran out: the hunter beaten before it is back for the enrage.
    board.hear({ kind: 'hunter', from: A, hunter: { ...hunter, returned: true } });
    expect(board.latest!.hunter.defeated).toBe(false);
    // A word about its first life, late, still says that one is beaten.
    board.hear({ kind: 'after', from: B, hunter });
    expect(board.latest!.hunter.defeated).toBe(true);
    // Beaten again, it stays beaten whoever flees it after.
    board.hear({ kind: 'after', from: A, hunter: { ...hunter, returned: true, defeated: true } });
    board.hear({ kind: 'after', from: B, hunter: { ...hunter, returned: true } });
    expect(board.latest!.hunter.defeated).toBe(true);
  });

  it('reads a word from a build that did not say which life it is as the first', () => {
    const older: Record<string, unknown> = encodeHunterSignal({ kind: 'hunter', from: A, hunter: { ...hunter, returned: true } });
    delete older.e;
    expect(readHunterSignal(older)).toEqual({ kind: 'hunter', from: A, hunter });
  });

  /**
   * The multiplayer bug hunt of 12 Nov 2026: the keeper opened FEEDBACK, its
   * world paused, and the room's hunter stood frozen beside the friend still
   * walking, for as long as the menu stayed open. A player whose world is
   * paused under a menu keeps nothing and is nobody's quarry until it runs again.
   */
  it('passes the keeping on while its keeper is away in a menu, and takes it back after', () => {
    const board = new HunterBoard();
    board.hear({ kind: 'away', from: A, away: true });
    expect(hunterKeeper(B, [A], board.busy)).toBe(B);
    expect(board.fightOf(A)).toBeNull();
    expect(board.hunterHeld).toBe(false);
    board.hear({ kind: 'away', from: A, away: false });
    expect(hunterKeeper(B, [A], board.busy)).toBe(A);
    // A fight is not undone by a word about a menu.
    board.hear({ kind: 'busy', from: A, busy: true, withHunter: true });
    board.hear({ kind: 'away', from: A, away: false });
    expect(board.fightOf(A)).toBe('hunter');
  });
});
