import { describe, expect, it } from 'vitest';
import {
  HARBOUR_PATH_MAX,
  encodeHarbourMove,
  encodeHarbourNudge,
  encodeHarbourPresence,
  encodeHarbourWave,
  housePlace,
  isHarbourPlace,
  readHarbourMove,
  readHarbourNudge,
  readHarbourPresence,
  readHarbourWave,
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

describe('the partner at a player\'s heel, as the harbour hears it', () => {
  const withPartner: HarbourMove = { ...move, partner: 'bulbasaur' };

  it('reads back the kind of Pokemon walking with them', () => {
    expect(encodeHarbourMove(withPartner)).toMatchObject({ k: 'bulbasaur' });
    expect(readHarbourMove(encodeHarbourMove(withPartner))).toEqual(withPartner);
  });

  it('says nothing about a partner a player does not have', () => {
    expect('k' in encodeHarbourMove(move)).toBe(false);
    expect(readHarbourMove(encodeHarbourMove(move))).toEqual(move);
  });

  it('believes only a partner the game has walking art for, and still believes the steps', () => {
    const sent = encodeHarbourMove(move);
    for (const k of ['mewtwo', 'constructor', 'toString', '__proto__', '<img src=x>', 'BULBASAUR', 42, null, ['bulbasaur'], {}]) {
      expect(readHarbourMove({ ...sent, k })).toEqual(move);
    }
  });
});

describe('a wave, as the harbour hears it', () => {
  const OLLY = '1a2b3c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';

  it('reads back a wave at somebody, and a wave at nobody in particular', () => {
    expect(readHarbourWave(encodeHarbourWave({ from: AMY, place: 'yard', to: OLLY }))).toEqual({ from: AMY, place: 'yard', to: OLLY });
    expect(readHarbourWave(encodeHarbourWave({ from: AMY, place: 'oaks-lab' }))).toEqual({ from: AMY, place: 'oaks-lab' });
  });

  it('carries no words: anything said beside it is dropped', () => {
    expect(Object.keys(encodeHarbourWave({ from: AMY, place: 'yard', to: OLLY })).sort()).toEqual(['p', 't', 'u']);
    expect(readHarbourWave({ u: AMY, p: 'yard', name: 'SOMEBODY', words: 'hi' })).toEqual({ from: AMY, place: 'yard' });
  });

  it('drops a wave from nobody or from nowhere, and reads a target that is not a player as nobody', () => {
    for (const bad of [null, 'wave', { u: 'OLLY', p: 'yard' }, { u: AMY, p: 'the moon' }, { u: AMY }]) {
      expect(readHarbourWave(bad)).toBeNull();
    }
    expect(readHarbourWave({ u: AMY, p: 'yard', t: 'constructor' })).toEqual({ from: AMY, place: 'yard' });
  });
});
