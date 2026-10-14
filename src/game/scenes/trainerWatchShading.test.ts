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

vi.mock('../ui/WorldLabel', () => ({ WorldLabel: class {} }));

import type { RunTrainerEncounter } from '../world/trainers';
import { createRunTrainerEncounters } from '../world/trainers';
import { trainerSightTiles } from '../world/trainerSight';
import { getWorldMap, TILE_SIZE } from '../worldMap';
import { WorldScene } from './WorldScene';

interface Driven {
  createTrainerWatch(encounter: RunTrainerEncounter): void;
}

type Rgb = readonly [number, number, number];

/** A sand road and a lawn, the two grounds playtest 40 measured the watch on. */
const GROUNDS: Record<string, Rgb> = { sand: [0xe0, 0xc8, 0x90], grass: [0x70, 0xc0, 0x60] };

/**
 * The real scene draws one trainer's watch onto a recording canvas laid over
 * plain ground, and hands back each watched tile as its pixels' colours.
 */
function paintedWatch(encounter: RunTrainerEncounter, ground: Rgb): Rgb[][] {
  const map = getWorldMap(encounter.mapId);
  const canvas = new Map<string, Rgb>();
  let style: { colour: Rgb; alpha: number } = { colour: [0, 0, 0], alpha: 0 };
  const graphics = {
    setDepth: () => graphics,
    fillStyle: (colour: number, alpha: number) => {
      style = { colour: [(colour >> 16) & 0xff, (colour >> 8) & 0xff, colour & 0xff], alpha };
      return graphics;
    },
    fillRect: (x: number, y: number, width: number, height: number) => {
      for (let py = y; py < y + height; py += 1) {
        for (let px = x; px < x + width; px += 1) {
          const under = canvas.get(`${px},${py}`) ?? ground;
          const over = under.map(
            (channel, index) => channel * (1 - style.alpha) + style.colour[index] * style.alpha,
          ) as unknown as Rgb;
          canvas.set(`${px},${py}`, over);
        }
      }
      return graphics;
    },
  };
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
  const watched = trainerSightTiles(encounter, (tile) => map.collision[tile.y]?.[tile.x] !== false);
  return watched.map((tile) => {
    const pixels: Rgb[] = [];
    for (let py = 0; py < TILE_SIZE; py += 1) {
      for (let px = 0; px < TILE_SIZE; px += 1) {
        pixels.push(canvas.get(`${tile.x * TILE_SIZE + px},${tile.y * TILE_SIZE + py}`) ?? ground);
      }
    }
    return pixels;
  });
}

/** CIE L*, the lightness an achromat sees and nothing else. */
function lightness([r, g, b]: Rgb): number {
  const linear = (channel: number) => {
    const c = channel / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const y = 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
  return y > 216 / 24389 ? 116 * Math.cbrt(y) - 16 : (24389 / 27) * y;
}

const WATCHERS = createRunTrainerEncounters().filter((encounter) => {
  const map = getWorldMap(encounter.mapId);
  return trainerSightTiles(encounter, (tile) => map.collision[tile.y]?.[tile.x] !== false).length > 0;
});

/**
 * Playtest 40, finding 1: the watch was a pale red wash, a change of hue with
 * almost no change of light, so in greyscale (and nearly so for red-green
 * colour blindness) the ground a trainer charges a fight for was not there.
 * The shading has to say so in lightness alone.
 */
describe('the ground a trainer is watching', () => {
  it.each(Object.entries(GROUNDS))('stands out from bare %s in lightness alone, on every watched tile', (_name, ground) => {
    const bare = lightness(ground);
    for (const encounter of WATCHERS) {
      for (const tile of paintedWatch(encounter, ground)) {
        const marked = tile.filter((pixel) => bare - lightness(pixel) >= 15);
        // A pattern, not a wash: a share of the tile is marked darker, and the
        // rest is left near the ground's own light so the marks read as marks.
        expect(marked.length / tile.length).toBeGreaterThanOrEqual(0.12);
        expect(tile.some((pixel) => bare - lightness(pixel) < 8)).toBe(true);
      }
    }
  });
});
