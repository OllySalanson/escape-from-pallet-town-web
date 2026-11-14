import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

import type { WorldEntity } from '../world/npcs';
import { WorldScene } from './WorldScene';

/**
 * A secret's Pokemon goes into its fight tagged with the secret it is
 * (`WildEncounter.secret`), and the fight puts that tag on it (`BattleScene`
 * sets `Pokemon.fromSecret`), which is what banking it records as found - never
 * its species (the gyms playtest of 14 Nov 2026).
 */
describe('a secret Pokemon is met as that secret', () => {
  function scene(secrets: readonly { id: string; reward: unknown }[]) {
    const world = Object.create(WorldScene.prototype) as WorldScene;
    Object.assign(world as object, {
      runSession: {
        plan: { secrets, conditions: {} },
        manager: { snapshot: () => ({ elapsedMs: 0 }) },
        pokemonMet: [],
      },
      stoodStillMs: 0,
      dialogBox: { showMessages: vi.fn() },
    });
    return world as unknown as {
      meetPokemon(entity: WorldEntity, species: string, level: number): void;
      pendingWildBattle?: { speciesId: string; secret?: string };
    };
  }

  it('a standing secret Pokemon carries its secret into the fight', () => {
    const world = scene([{ id: 'the-kite-thief', reward: { kind: 'meet', speciesId: 'kingler', level: 30 } }]);
    const entity = { id: 'greystone-vale/pokemon-1', secret: 'the-kite-thief', dialogLines: ['...'] } as unknown as WorldEntity;
    world.meetPokemon(entity, 'kingler', 30);
    expect(world.pendingWildBattle?.secret).toBe('the-kite-thief/kingler');
  });

  it('an ordinary standing Pokemon of the same kind carries none', () => {
    const world = scene([]);
    const entity = { id: 'greystone-vale/pokemon-2', dialogLines: ['...'] } as unknown as WorldEntity;
    world.meetPokemon(entity, 'lapras', 10);
    expect(world.pendingWildBattle?.speciesId).toBe('lapras');
    expect(world.pendingWildBattle?.secret).toBeUndefined();
  });
});
