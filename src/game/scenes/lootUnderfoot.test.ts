import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

import type { WorldLoot } from '../world/loot';
import { WorldScene } from './WorldScene';

const AT = { x: 237, y: 224 };
const BAG = { id: 'errand-medicine-bag', itemId: 'medicine-bag', quantity: 1, position: AT } as WorldLoot;

interface Driven {
  tryInteract(): void;
  hintHere(): string;
}

/**
 * First-hour playtest, 26 Nov 2026: a friend walked onto Nurse Joy's medicine
 * bag with a full pack and was told to drop something and come back for it.
 * They made room in the PACK, stood where they were and pressed SPACE, and
 * nothing happened: only a step off the tile and back onto it picked it up.
 */
function standingOnTheBag(options: { readonly faced?: 'nobody' | 'somebody'; readonly taken?: boolean } = {}) {
  const said: string[] = [];
  const fished: unknown[] = [];
  const collected = new Set<string>(options.taken ? [BAG.id] : []);
  const somebody = { id: 'farmer', kind: 'npc', position: { x: AT.x, y: AT.y - 1 }, dialogLines: ['Morning.'] };
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    currentMap: { id: 'greystone-vale', warps: [], entities: options.faced === 'somebody' ? [somebody] : [], gates: [] },
    currentTile: AT,
    facing: 'up',
    collectedLootIds: collected,
    isLootAvailable: () => true,
    lootForCurrentMap: () => [BAG],
    collectLootHere: (loot: WorldLoot) => {
      collected.add(loot.id);
      return 'Found Medicine bag!';
    },
    dialogBox: { showMessage: (line: string) => said.push(line), showMessages: (lines: string[]) => said.push(...lines) },
    tryGuardCharge: () => false,
    tryBoard: () => false,
    tryRideLift: () => false,
    tryActivatePoiAt: () => null,
    tryFieldMoveAt: () => null,
    tryOpenBarredExitAt: () => null,
    barredExitAt: () => undefined,
    switchesHere: () => [],
    poisHere: () => [],
    guardsHere: () => [],
    guardGroundBlocked: () => false,
    openedDoorKeys: () => new Set(),
    trainersForCurrentMap: () => [],
    entityHolds: (entity: { position: { x: number; y: number } }, tile: { x: number; y: number }) =>
      entity.position.x === tile.x && entity.position.y === tile.y,
    raceHere: () => null,
    faceFigure: () => undefined,
    askForTrainerChallenge: () => undefined,
    courseOfPerson: () => undefined,
    hunterRival: () => ({ name: 'BLUE' }),
    defeatedBosses: [],
    tryFishAt: (tile: unknown) => fished.push(tile),
  });
  return { scene: scene as unknown as Driven, said, fished, collected };
}

describe('a piece on the tile the player stands on', () => {
  it('is named on the hint line and taken with SPACE when nobody is faced', () => {
    const { scene, said, fished, collected } = standingOnTheBag();

    expect(scene.hintHere()).toBe('[SPACE] MEDICINE BAG');
    scene.tryInteract();

    expect(collected.has(BAG.id)).toBe(true);
    expect(said).toEqual(['Found Medicine bag!']);
    expect(fished).toEqual([]);
  });

  it('is left alone once taken, and SPACE goes on to what it did before', () => {
    const { scene, said, fished } = standingOnTheBag({ taken: true });

    expect(scene.hintHere()).toBe('');
    scene.tryInteract();

    expect(said).toEqual([]);
    expect(fished).toHaveLength(1);
  });

  it('waits while the player faces somebody, who SPACE still talks to', () => {
    const { scene, said, collected } = standingOnTheBag({ faced: 'somebody' });

    expect(scene.hintHere()).toBe('');
    scene.tryInteract();

    expect(collected.has(BAG.id)).toBe(false);
    expect(said).toEqual(['Morning.']);
  });
});
