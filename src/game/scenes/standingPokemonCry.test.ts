import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

const played: { name: string; species?: number }[] = [];
vi.mock('../audio/AudioManager', () => ({
  audioManager: new Proxy(
    {},
    {
      get: (_target, key) =>
        key === 'play'
          ? (name: string, options?: { species?: number }) => played.push({ name, species: options?.species })
          : vi.fn(() => Promise.resolve()),
    },
  ),
}));

import type { WorldEntity } from '../world/npcs';
import { WorldScene } from './WorldScene';

/** A Pokemon a map maker stood one tile north of the player, who faces it. */
function facingAStandingPokemon(entity: Partial<WorldEntity>) {
  const pikachu: WorldEntity = {
    id: 'player-test/pokemon-1',
    mapId: 'player-test',
    kind: 'npc',
    position: { x: 4, y: 3 },
    facing: 'down',
    dialogLines: ['PIKACHU: Pika pika!'],
    pokemon: 'pikachu',
    ...entity,
  };
  const shown: string[] = [];
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    currentMap: { id: 'player-test', warps: [], entities: [pikachu] },
    currentTile: { x: 4, y: 4 },
    facing: 'up',
    idleFigures: [],
    runSession: undefined,
    caughtLegends: [],
    dialogBox: {
      showMessage: (line: string) => shown.push(line),
      showMessages: (lines: string[]) => shown.push(...lines),
    },
    tryCollectLootAt: () => null,
    tryActivatePoiAt: () => null,
    tryFieldMoveAt: () => null,
    tryDigAt: () => null,
    trainersForCurrentMap: () => [],
    faceFigure: () => undefined,
  });
  return { scene: scene as unknown as { tryInteract(): void }, shown };
}

describe('speaking to a Pokemon standing in the world', () => {
  it('sounds its own cry as its line goes up', () => {
    played.length = 0;
    const { scene, shown } = facingAStandingPokemon({});
    scene.tryInteract();
    expect(shown).toEqual(['PIKACHU: Pika pika!']);
    expect(played).toContainEqual({ name: 'cry', species: 25 });
  });

  it('cries before a fight too, when it is one that fights', () => {
    played.length = 0;
    const { scene } = facingAStandingPokemon({ wildLevel: 7 });
    scene.tryInteract();
    expect(played).toContainEqual({ name: 'cry', species: 25 });
  });

  it('leaves a person who is not a Pokemon silent', () => {
    played.length = 0;
    const { scene, shown } = facingAStandingPokemon({ pokemon: undefined, dialogLines: ['Hello.'] });
    scene.tryInteract();
    expect(shown).toEqual(['Hello.']);
    expect(played.filter((sound) => sound.name === 'cry')).toEqual([]);
  });
});
