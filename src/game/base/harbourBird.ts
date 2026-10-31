import type Phaser from 'phaser';
import { CANOPY_BAND, MARKER_BAND } from '../world/depths';

/**
 * A bird gliding over THE HARBOUR now and then: FireRed's own Fly bird, the
 * one that carries a trainer off in its Fly animation, here with nobody on it
 * (`scripts/cut-frlg-fly-bird.mjs`), its shadow sliding across the ground and
 * the water a long way below it. By day and at dusk only - nothing flies over
 * the harbour at night.
 *
 * The flight is a pure function of how far into it the bird is (`birdAt`); the
 * class only draws it and decides when the next one goes.
 */

export const HARBOUR_BIRD_TEXTURE = 'harbour-bird';
export const HARBOUR_BIRD_PATH = 'assets/harbour-bird.png';
/** How long one crossing takes. */
export const BIRD_CROSSING_MS = 9_000;
/** The least time between two crossings; the most is twice it. */
export const BIRD_EVERY_MS = 40_000;
/** How high it flies: how far its shadow falls below it, in pixels. */
const ALTITUDE = 56;
const BIRD_SIZE = 64;

/**
 * Where the bird is, `ms` into a crossing of a harbour `width` by `height`
 * pixels: in from beyond the top right, out past the bottom left, the way its
 * art faces, rising and falling a little on the air. Null before and after.
 */
export function birdAt(
  ms: number,
  width: number,
  height: number,
  crossingMs = BIRD_CROSSING_MS,
): { readonly x: number; readonly y: number } | null {
  if (ms < 0 || ms > crossingMs) {
    return null;
  }
  const t = ms / crossingMs;
  const from = { x: width + BIRD_SIZE, y: height * 0.12 };
  const to = { x: -BIRD_SIZE * 2, y: height * 0.78 };
  return {
    x: Math.round(from.x + (to.x - from.x) * t),
    y: Math.round(from.y + (to.y - from.y) * t + Math.sin(t * Math.PI * 3) * 6),
  };
}

export class HarbourBird {
  private readonly bird: Phaser.GameObjects.Image;
  private readonly shadow: Phaser.GameObjects.Image;
  private flyingMs: number | null = null;
  private untilNextMs: number;

  private readonly world: { readonly width: number; readonly height: number };
  private readonly view: (() => { readonly x: number; readonly y: number }) | undefined;
  private readonly crossingMs: number;
  /** Where this crossing started from: the screen's corner on a map bigger than one. */
  private origin = { x: 0, y: 0 };

  /**
   * @param world what it crosses, in pixels: the whole of the harbour, or a
   *   screen's width of a raid map, which `view` says the corner of as it sets off.
   */
  public constructor(
    scene: Phaser.Scene,
    world: { readonly width: number; readonly height: number },
    view?: () => { readonly x: number; readonly y: number },
    crossingMs = BIRD_CROSSING_MS,
  ) {
    this.world = world;
    this.view = view;
    this.crossingMs = crossingMs;
    const texture = scene.textures.get(HARBOUR_BIRD_TEXTURE);
    if (!texture.has('bird')) {
      texture.add('bird', 0, 0, 0, BIRD_SIZE, BIRD_SIZE);
      texture.add('shadow', 0, BIRD_SIZE, 0, 16, 8);
    }
    this.bird = scene.add.image(0, 0, HARBOUR_BIRD_TEXTURE, 'bird').setOrigin(0.5, 0.5).setDepth(CANOPY_BAND + 0.05).setVisible(false);
    this.shadow = scene.add
      .image(0, 0, HARBOUR_BIRD_TEXTURE, 'shadow')
      .setOrigin(0.5, 0.5)
      .setAlpha(0.32)
      .setDepth(MARKER_BAND + 0.05)
      .setVisible(false);
    // The first one soon after arriving, so a player who stops to look sees one.
    this.untilNextMs = BIRD_EVERY_MS / 4 + Math.random() * (BIRD_EVERY_MS / 4);
  }

  public update(deltaMs: number): void {
    if (this.flyingMs === null) {
      this.untilNextMs -= deltaMs;
      if (this.untilNextMs > 0) return;
      this.flyingMs = 0;
      this.origin = this.view?.() ?? this.origin;
    } else {
      this.flyingMs += deltaMs;
    }
    const at = birdAt(this.flyingMs, this.world.width, this.world.height, this.crossingMs);
    if (!at) {
      this.flyingMs = null;
      this.untilNextMs = BIRD_EVERY_MS + Math.random() * BIRD_EVERY_MS;
      this.bird.setVisible(false);
      this.shadow.setVisible(false);
      return;
    }
    this.bird.setPosition(this.origin.x + at.x, this.origin.y + at.y).setVisible(true);
    this.shadow.setPosition(this.origin.x + at.x - 8, this.origin.y + at.y + ALTITUDE).setVisible(true);
  }

  public destroy(): void {
    this.bird.destroy();
    this.shadow.destroy();
  }
}
