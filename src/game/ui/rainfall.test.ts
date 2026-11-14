import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

import { WeatherId } from '../pokemon/battle/weather';
import { weatherShownAfter } from '../scenes/battlePresentation';
import { BattleScene } from '../scenes/BattleScene';
import { WorldScene } from '../scenes/WorldScene';
import { getWorldMap } from '../worldMap';
import { districtsForMap, weatherAt } from '../world/districts';
import {
  createRainfall,
  RAIN_FALL_PER_SECOND,
  RAIN_SPLASH_MS,
  rainDropCount,
  stepRainfall,
} from './rainfall';

/**
 * The gyms playtest of 14 Nov 2026: the Coast's rain - Misty's whole theme,
 * "Mind the rain past them. It never stops" - was a corner chip and nothing
 * else, on the map and in her fight after "It started to rain!".
 */

describe('the rain as it falls', () => {
  it('is light: about one drop to a thousand pixels, all on screen', () => {
    const rain = createRainfall(320, 240);
    expect(rain.drops).toHaveLength(rainDropCount(320, 240));
    expect(rain.drops.length).toBeGreaterThan(50);
    expect(rain.drops.length).toBeLessThan(120);
    for (const drop of rain.drops) {
      expect(drop.y).toBeGreaterThanOrEqual(0);
      expect(drop.y).toBeLessThanOrEqual(drop.landY);
      expect(drop.landY).toBeLessThanOrEqual(240);
    }
  });

  it('falls down and to the left, lands where it was going, splashes, and falls again from the top', () => {
    const rain = createRainfall(320, 240, 7);
    const drop = rain.drops[0];
    Object.assign(drop, { x: 200, y: 0, landY: 100, splashMs: 0 });
    stepRainfall(rain, 100);
    expect(drop.y).toBeCloseTo(RAIN_FALL_PER_SECOND.y / 10);
    expect(drop.x).toBeCloseTo(200 + RAIN_FALL_PER_SECOND.x / 10);
    // A long frame never carries it past the ground it falls on.
    stepRainfall(rain, 1_000);
    expect(drop.y).toBe(100);
    expect(drop.x).toBeCloseTo(200 + (100 * RAIN_FALL_PER_SECOND.x) / RAIN_FALL_PER_SECOND.y);
    expect(drop.splashMs).toBe(RAIN_SPLASH_MS);
    stepRainfall(rain, RAIN_SPLASH_MS);
    expect(drop.y).toBe(0);
    expect(drop.splashMs).toBe(0);
  });

  it('keeps raining at test mode\'s ten frames a second as it does at sixty', () => {
    const rain = createRainfall(320, 240, 3);
    for (let frame = 0; frame < 600; frame += 1) {
      stepRainfall(rain, 100);
    }
    const falling = rain.drops.filter((drop) => drop.splashMs <= 0);
    expect(falling.length).toBeGreaterThan(rain.drops.length / 2);
    expect(rain.drops.every((drop) => drop.y <= drop.landY)).toBe(true);
  });
});

/** A graphics object that remembers whether it is shown and how much it drew. */
function graphicsStub() {
  const self = {
    visible: false,
    rects: 0,
    setScrollFactor: vi.fn(() => self),
    setDepth: vi.fn(() => self),
    setVisible: vi.fn((shown: boolean) => {
      self.visible = shown;
      return self;
    }),
    clear: vi.fn(() => {
      self.rects = 0;
      return self;
    }),
    fillStyle: vi.fn(() => self),
    fillRect: vi.fn(() => {
      self.rects += 1;
      return self;
    }),
    destroy: vi.fn(),
  };
  return self;
}

describe('the rain on the map', () => {
  const VALE = getWorldMap('greystone-vale');
  const wet = districtsForMap(VALE.id).find((district) => district.weather === WeatherId.Rain)!;
  const dry = districtsForMap(VALE.id).find((district) => district.weather === undefined || district.weather === null)!;
  const tileOf = (district: typeof wet) => {
    const area = district.areas[0];
    for (let y = area.y; y < area.y + area.height; y += 1) {
      for (let x = area.x; x < area.x + area.width; x += 1) {
        if (weatherAt(VALE.id, { x, y }) === (district.weather ?? null)) {
          return { x, y };
        }
      }
    }
    throw new Error(`no tile in ${district.name}`);
  };

  function sceneOn(tile: { x: number; y: number }) {
    const graphics = graphicsStub();
    const scene = Object.create(WorldScene.prototype) as WorldScene;
    Object.assign(scene as object, {
      currentMap: VALE,
      currentTile: tile,
      currentInterior: null,
      rain: null,
      scale: { width: 320, height: 240 },
      add: { graphics: vi.fn(() => graphics) },
    });
    const update = (deltaMs: number) => (scene as unknown as { updateRain(deltaMs: number): void }).updateRain(deltaMs);
    return { scene, graphics, update };
  }

  it('falls over a place that rains, as soon as the player is in it', () => {
    expect(wet, 'a district of the vale that rains').toBeDefined();
    const { graphics, update } = sceneOn(tileOf(wet));
    update(16);
    expect(graphics.visible).toBe(true);
    // The shade, and a drop or a splash for every drop.
    expect(graphics.rects).toBeGreaterThan(rainDropCount(320, 240));
  });

  it('is not there in a dry place, and stops when the player walks out of the rain', () => {
    const { scene, graphics, update } = sceneOn(tileOf(dry));
    update(16);
    expect((scene as unknown as { rain: unknown }).rain).toBeNull();
    (scene as unknown as { currentTile: unknown }).currentTile = tileOf(wet);
    update(16);
    expect(graphics.visible).toBe(true);
    (scene as unknown as { currentTile: unknown }).currentTile = tileOf(dry);
    update(16);
    expect(graphics.visible).toBe(false);
  });

  it('stays off under a roof', () => {
    const { scene, graphics, update } = sceneOn(tileOf(wet));
    (scene as unknown as { currentInterior: unknown }).currentInterior = { id: 'a-roof' };
    update(16);
    expect(graphics.visible).toBe(false);
  });
});

describe('the rain in a fight', () => {
  it('starts on the line that says it started, and stops on the line that says it stopped', () => {
    expect(weatherShownAfter(null, { type: 'weather-set', weather: WeatherId.Rain, byMove: true })).toBe(WeatherId.Rain);
    expect(weatherShownAfter(WeatherId.Rain, { type: 'weather-ended', weather: WeatherId.Rain })).toBeNull();
    expect(
      weatherShownAfter(WeatherId.Rain, { type: 'weather-damage', user: 'player', weather: WeatherId.Rain, damage: 1 } as never),
    ).toBe(WeatherId.Rain);
  });

  it('falls over the field and nothing else while the screen shows rain', () => {
    const graphics = graphicsStub();
    const scene = Object.create(BattleScene.prototype) as BattleScene;
    Object.assign(scene as object, { rain: null, shownWeather: null, add: { graphics: vi.fn(() => graphics) } });
    const update = (deltaMs: number) => (scene as unknown as { updateRain(deltaMs: number): void }).updateRain(deltaMs);
    update(16);
    expect((scene as unknown as { rain: unknown }).rain).toBeNull();
    (scene as unknown as { shownWeather: unknown }).shownWeather = WeatherId.Rain;
    update(16);
    expect(graphics.visible).toBe(true);
    // Drawn in the field's own pixels, not pinned to a camera that is centred on it.
    expect(graphics.setScrollFactor).toHaveBeenCalledWith(1);
    // The shade covers the field above the text box, not the box.
    expect(graphics.fillRect).toHaveBeenCalledWith(0, 0, 320, 180);
    (scene as unknown as { shownWeather: unknown }).shownWeather = null;
    update(16);
    expect(graphics.visible).toBe(false);
  });
});
