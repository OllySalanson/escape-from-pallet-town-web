import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

vi.mock('../audio/AudioManager', () => ({
  audioManager: new Proxy({}, { get: () => vi.fn() }),
}));

/** Every caption the scene stands up, by what it says. */
const captions: string[] = [];
vi.mock('../ui/WorldLabel', () => ({
  WorldLabel: class {
    public constructor(_scene: unknown, spec: { readonly text: string }) {
      captions.push(spec.text);
    }
  },
}));

import type { RunTrainerEncounter } from '../world/trainers';
import { createRunTrainerEncounters } from '../world/trainers';
import { TRAINER_WATCH_WARNING } from '../world/trainerEngagement';
import { trainerSightTiles } from '../world/trainerSight';
import { getWorldMap } from '../worldMap';
import { WorldScene } from './WorldScene';

interface Driven {
  createTrainerWatch(encounter: RunTrainerEncounter): void;
}

/** The caption the real scene hangs over one trainer's watch on its own map. */
function watchCaptionOf(encounter: RunTrainerEncounter): string | undefined {
  captions.length = 0;
  const map = getWorldMap(encounter.mapId);
  const graphics: object = new Proxy({}, { get: (): (() => object) => () => graphics });
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    currentMap: map,
    collisionData: map.collision.map((row) => [...row]),
    add: { graphics: () => graphics },
    mapObjects: [],
    watchedGround: [],
    worldLabels: [],
  });
  (scene as unknown as Driven).createTrainerWatch(encounter);
  return captions[0];
}

/**
 * Every trainer whose watch has ground to shade on a fresh save's map. One
 * whose lane is shut (Foreman Rudd's, behind a gate) draws no watch at all.
 */
const WATCHERS = createRunTrainerEncounters().filter((encounter) => {
  const map = getWorldMap(encounter.mapId);
  return trainerSightTiles(encounter, (tile) => map.collision[tile.y]?.[tile.x] !== false).length > 0;
});

/**
 * The caption over a watch said `WATCHING W` - a lone letter after a verb,
 * which reads as a word cut off rather than as a heading. It says the whole
 * word now, as every other sentence in the game does.
 */
describe('the caption over a watching trainer', () => {
  it.each(WATCHERS.map((encounter) => [encounter.trainer.name, encounter] as const))(
    '%s says which way they face in a whole word',
    (_name, encounter) => {
      const word = { up: 'NORTH', down: 'SOUTH', left: 'WEST', right: 'EAST' }[encounter.facing];
      expect(watchCaptionOf(encounter)).toBe(
        `${encounter.trainer.name}\nFACING ${word}\n${TRAINER_WATCH_WARNING}`,
      );
    },
  );

  it('is drawn for nearly every trainer with a watch', () => {
    expect(WATCHERS.length).toBeGreaterThan(10);
  });

  it('is never made wider by the bearing: the warning is still the longest line it adds', () => {
    // Measured in the game's own face at caption size, FACING NORTH is 74
    // pixels and CANNOT BE FLED 84, so the window is the width it was.
    for (const encounter of WATCHERS) {
      const [, bearing, warning] = watchCaptionOf(encounter)!.split('\n');
      expect(bearing.length).toBeLessThan(warning.length);
    }
  });
});
