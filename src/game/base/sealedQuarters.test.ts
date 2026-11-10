import { describe, expect, it } from 'vitest';
import { KOGA_BOSS_ID, MISTY_BOSS_ID } from '../world/valeQuarters';
import { heavyCloud, pressedBadge, sealedAt, sealedCard, sealedQuarters } from './sealedQuarters';

describe("the telescope's sealed quarters", () => {
  it('lays each gym’s quarter under a sealed cloud until its leader is beaten, and nothing on any other map', () => {
    const [coast, marsh, ...others] = sealedQuarters('greystone-vale', []);
    expect(others).toEqual([]);
    expect(coast.name).toBe('THE COAST');
    expect(coast.badge.name).toBe('CASCADE BADGE');
    expect(marsh.name).toBe('THE MARSH');
    expect(marsh.badge.name).toBe('SOUL BADGE');
    expect(sealedQuarters('greystone-vale', [MISTY_BOSS_ID]).map((quarter) => quarter.name)).toEqual(['THE MARSH']);
    expect(sealedQuarters('greystone-vale', [MISTY_BOSS_ID, KOGA_BOSS_ID])).toEqual([]);
    expect(sealedQuarters('floodplain-relay', [])).toEqual([]);
  });

  it('covers the Sunken Quarter and the cove, and not the strand her gym stands on', () => {
    const sealed = sealedQuarters('greystone-vale', []);
    const [coast] = sealed;
    for (const area of coast.areas) {
      expect(sealedAt(sealed, { x: area.x + 3, y: area.y + 3 })).toBe(coast);
    }
    // Gull Strand, where Cerulean Gym stands, is open ground.
    expect(sealedAt(sealed, { x: 160, y: 220 })).toBeUndefined();
    expect(sealedAt(sealed, coast.centre)).toBe(coast);
  });

  it('says what opens it, and who holds it', () => {
    const [coast] = sealedQuarters('greystone-vale', []);
    const card = sealedCard(coast);
    expect(card.title).toBe('THE COAST');
    expect(card.lines.join(' ')).toContain('CASCADE BADGE');
    expect(card.lines.join(' ')).toContain('MISTY');
  });

  it('is darker than the cloud it lies on, and leaves the rest of the picture alone', () => {
    const picture = { width: 2, height: 1, data: new Uint8ClampedArray([160, 168, 176, 255, 160, 168, 176, 255]) };
    const heavy = heavyCloud(picture, (x) => x === 0, [160, 168, 176]);
    expect(heavy.data[0]).toBeLessThan(160);
    expect([...heavy.data.slice(4)]).toEqual([160, 168, 176, 255]);
  });

  it("presses the badge's own shape in, with a lit edge beside it", () => {
    const [coast] = sealedQuarters('greystone-vale', []);
    const squares = pressedBadge(coast.badge, 2);
    const filled = coast.badge.art.join('').replace(/\./g, '').length;
    expect(squares.filter((square) => square.ink === 'press')).toHaveLength(filled);
    expect(squares.some((square) => square.ink === 'edge')).toBe(true);
  });
});
