import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));
vi.mock('../audio/AudioManager', () => ({
  audioManager: new Proxy({}, { get: () => vi.fn(() => Promise.resolve()) }),
}));

import { HUNTER_RIVALS, type HunterRivalId } from '../world/hunters';
import { WORLD_ENTITIES } from '../world/npcs';
import { WorldScene } from './WorldScene';

const flowerGirl = WORLD_ENTITIES.find((entity) => entity.id === 'viridian-flower-girl')!;

/**
 * Viridian's flower girl, faced from the tile below her, on a raid hunted by
 * `rivalId` - the hunter rotates per raid (`rivalForRaid`), so what she says
 * about who is asking after you has to follow it (playtest 6, B1: she spoke of
 * "a trainer in a dark jacket" and "he" on a raid Misty was hunting).
 */
function talkToTheFlowerGirl(rivalId: HunterRivalId): string[] {
  const shown: string[] = [];
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    currentMap: { id: 'viridian-city', warps: [], entities: [flowerGirl] },
    currentTile: { x: flowerGirl.position.x, y: flowerGirl.position.y + 1 },
    facing: 'up',
    idleFigures: [],
    runSession: { plan: { hunter: { rivalId } } },
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
  (scene as unknown as { tryInteract(): void }).tryInteract();
  return shown;
}

describe('a townsperson who has seen the hunter', () => {
  it.each(HUNTER_RIVALS.map((rival) => [rival.id, rival.name] as const))(
    'names this raid\'s rival, %s, and nobody else',
    (rivalId, name) => {
      const lines = talkToTheFlowerGirl(rivalId);
      expect(lines.length).toBeGreaterThan(0);
      expect(lines.join(' ')).toContain(name);
      for (const other of HUNTER_RIVALS.filter((rival) => rival.id !== rivalId)) {
        expect(lines.join(' ')).not.toContain(other.name);
      }
      // Nothing about how the rival looks or which word fits them.
      expect(lines.join(' ')).not.toMatch(/\b(he|she|him|her|his|jacket)\b/i);
      expect(lines.join(' ')).not.toContain('{');
    },
  );
});
