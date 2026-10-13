import { readFileSync, readdirSync } from 'node:fs';
import type Phaser from 'phaser';
import { describe, expect, it, vi } from 'vitest';
import { FLASH_PEAK_ALPHA, flashScreen, type FlashingCamera } from './screenFlash';

type Flash = Phaser.Cameras.Scene2D.Effects.Flash;

/** Phaser's own flash effect, read straight out of Phaser rather than imitated. */
const { default: Flash } = await vi.importActual<{ default: typeof Phaser.Cameras.Scene2D.Effects.Flash }>(
  'phaser/src/cameras/2d/effects/Flash.js',
);

/** A camera carrying Phaser's own flash effect, so the fade is Phaser's arithmetic. */
function cameraWithPhasersFlash(): FlashingCamera & { readonly flashEffect: Flash } {
  const camera = { emit: () => undefined, scene: {} } as unknown as FlashingCamera & { flashEffect: Flash };
  const effect = new Flash(camera as unknown as Phaser.Cameras.Scene2D.Camera);
  camera.flashEffect = effect;
  camera.flash = (duration, red, green, blue, force) => effect.start(duration, red, green, blue, force);
  return camera;
}

describe('a flash of the screen', () => {
  // Playtest 6: a pickup was a frame of solid yellow with no map in it, at
  // every pickup of every raid, because Phaser's flash starts fully opaque.
  it('never covers more than the peak of the screen, and fades to nothing', () => {
    const camera = cameraWithPhasersFlash();
    flashScreen(camera, 100, [250, 204, 21]);
    camera.flashEffect.update(0, 0);
    expect(camera.flashEffect.isRunning).toBe(true);
    expect(camera.flashEffect.alpha).toBeLessThanOrEqual(FLASH_PEAK_ALPHA);
    expect(camera.flashEffect.alpha).toBeGreaterThan(0);
    camera.flashEffect.update(0, 50);
    expect(camera.flashEffect.alpha).toBeCloseTo(FLASH_PEAK_ALPHA / 2, 5);
    camera.flashEffect.update(0, 60);
    expect(camera.flashEffect.isRunning).toBe(false);
  });

  it('is as gentle the second time as the first', () => {
    const camera = cameraWithPhasersFlash();
    flashScreen(camera, 100, [255, 255, 255]);
    camera.flashEffect.update(0, 200);
    flashScreen(camera, 100, [239, 68, 68]);
    camera.flashEffect.update(0, 0);
    expect(camera.flashEffect.alpha).toBeLessThanOrEqual(FLASH_PEAK_ALPHA);
  });

  it('still leaves enough colour to read', () => {
    expect(FLASH_PEAK_ALPHA).toBeGreaterThanOrEqual(0.2);
    expect(FLASH_PEAK_ALPHA).toBeLessThanOrEqual(0.5);
  });

  it('is the only way any scene flashes the screen', () => {
    const scenes = new URL('../scenes/', import.meta.url);
    const direct = readdirSync(scenes)
      .filter((name) => name.endsWith('.ts') && !name.endsWith('.test.ts'))
      .filter((name) => /cameras\.main\s*\.flash\(/.test(readFileSync(new URL(name, scenes), 'utf8')));
    expect(direct).toEqual([]);
  });
});
