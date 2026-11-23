import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

import { Bag } from '../items';
import { BULBASAUR, Pokemon, PokemonParty } from '../pokemon';
import { WorldScene } from './WorldScene';

/**
 * The overnight retest's veteran (23 Nov 2026) healed in fights and never
 * pressed B, and heard Oak's "worn out! Press B for your pack" after every
 * single fight. It is said once a raid.
 */
describe("Oak's word about healing from the pack", () => {
  it('is said once a raid, however many fights leave somebody worn out', () => {
    const worn = new Pokemon(BULBASAUR, 5);
    worn.currentHp = 2;
    const interrupt = vi.fn<(lines: readonly string[]) => void>();
    const scene = Object.create(WorldScene.prototype) as WorldScene;
    Object.assign(scene as object, {
      runSession: {},
      bag: new Bag({ potion: 2 }),
      party: new PokemonParty([worn]),
      keysLearned: new Set<string>(),
      interrupt,
    });
    const say = (): void => (scene as unknown as { sayFieldHealHint(): void }).sayFieldHealHint();
    say();
    say();
    say();
    expect(interrupt).toHaveBeenCalledTimes(1);
    expect(interrupt.mock.calls[0][0][0]).toMatch(/^OAK: BULBASAUR is worn out! Press B/);
  });
});
