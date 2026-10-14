import { describe, expect, it } from 'vitest';
import {
  HARBOUR_PATH_MAX,
  encodeHarbourMove,
  encodeHarbourNudge,
  encodeHarbourPresence,
  housePlace,
  isHarbourPlace,
  readHarbourMove,
  readHarbourNudge,
  readHarbourPresence,
  type HarbourMove,
} from './harbourProtocol';

const AMY = '0b6c2f4e-1d2a-4c3b-9e8f-7a6b5c4d3e2f';

const move: HarbourMove = { from: AMY, place: 'yard', path: [{ x: 16, y: 13 }, { x: 17, y: 13 }], facing: 'right' };

describe('what the harbour hears', () => {
  it('reads back exactly the move the game sends', () => {
    expect(readHarbourMove(encodeHarbourMove(move))).toEqual(move);
  });

  it('knows the yard, the keepers rooms and a player house, and nowhere else', () => {
    expect(isHarbourPlace('yard')).toBe(true);
    expect(isHarbourPlace('oaks-lab')).toBe(true);
    expect(isHarbourPlace(housePlace(AMY))).toBe(true);
    expect(isHarbourPlace(housePlace(AMY, true))).toBe(true);
    expect(isHarbourPlace('bolthole')).toBe(false);
    expect(isHarbourPlace('house:not-an-id')).toBe(false);
    expect(isHarbourPlace(`house:${AMY}:down`)).toBe(false);
    expect(isHarbourPlace(42)).toBe(false);
  });

  it('drops anything that is not a move the game sends, whole', () => {
    const sent = encodeHarbourMove(move);
    for (const bad of [
      null,
      'move',
      { ...sent, u: 'OLLY' },
      { ...sent, p: 'the moon' },
      { ...sent, f: 'sideways' },
      { ...sent, s: [] },
      { ...sent, s: [[1.5, 2]] },
      { ...sent, s: [[-1, 2]] },
      { ...sent, s: [[1, 999]] },
      { ...sent, s: [['1', 2]] },
      { ...sent, s: [[1, 2, 3]] },
      { ...sent, s: Array.from({ length: HARBOUR_PATH_MAX + 1 }, (_, x) => [x, 1]) },
    ]) {
      expect(readHarbourMove(bad)).toBeNull();
    }
  });

  it('never carries a name: the name over a figure is the database answer, not the sender', () => {
    expect(Object.keys(encodeHarbourMove(move)).sort()).toEqual(['f', 'p', 's', 'u']);
    expect(readHarbourMove({ ...encodeHarbourMove(move), name: 'SOMEBODY' })).toEqual(move);
  });

  it('sends only the last steps of a long walk', () => {
    const long = { ...move, path: Array.from({ length: 20 }, (_, x) => ({ x, y: 1 })) };
    expect(readHarbourMove(encodeHarbourMove(long))?.path).toHaveLength(HARBOUR_PATH_MAX);
  });

  it('reads a nudge as two player ids and nothing else', () => {
    const nudge = { from: AMY, to: '11111111-1111-4111-8111-111111111111' };
    expect(readHarbourNudge(encodeHarbourNudge(nudge))).toEqual(nudge);
    expect(readHarbourNudge({ u: AMY, t: 'OLLY' })).toBeNull();
    expect(readHarbourNudge(null)).toBeNull();
  });

  it('reads a presence as the place it says, and nothing else', () => {
    expect(readHarbourPresence(encodeHarbourPresence('pokemon-centre'))).toBe('pokemon-centre');
    expect(readHarbourPresence({ p: 'nowhere' })).toBeNull();
    expect(readHarbourPresence(undefined)).toBeNull();
  });
  it('carries a stopped knock by its id, and reads anything else in its place as only "look now"', () => {
    const gone = { from: AMY, to: '11111111-1111-4111-8111-111111111111', gone: '22222222-2222-4222-8222-222222222222' };
    expect(readHarbourNudge(encodeHarbourNudge(gone))).toEqual(gone);
    expect(readHarbourNudge({ u: gone.from, t: gone.to, g: 'not a knock' })).toEqual({ from: gone.from, to: gone.to });
  });
});
