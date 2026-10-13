import { describe, expect, it } from 'vitest';
import { encodeWon, readWon, roomOpenedDoors } from './roomBosses';

const A = '11111111-1111-4111-8111-111111111111';

describe('a boss beaten in a raid room', () => {
  it('is said by id and read back exactly', () => {
    expect(readWon(encodeWon({ from: A, bossId: 'sluice-keeper' }))).toEqual({ from: A, bossId: 'sluice-keeper' });
    for (const bad of [null, { k: 'w', u: 'ASH', b: 'x' }, { k: 'w', u: A, b: '<b>' }, { k: 'w', u: A }, { k: 'x', u: A, b: 'x' }]) {
      expect(readWon(bad)).toBeNull();
    }
  });

  it('opens only the doors this map has for that boss', () => {
    const won = new Map([['sluice-keeper', A], ['nobody-real', A]]);
    expect(roomOpenedDoors(won, ['sluice-keeper', 'warden-holt'])).toEqual(['sluice-keeper']);
    expect(roomOpenedDoors(new Map(), ['sluice-keeper'])).toEqual([]);
  });
});
