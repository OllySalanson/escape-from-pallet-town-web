import type Phaser from 'phaser';
import { prefersReducedMotion } from './reducedMotion';
import {
  createRainfall,
  RAIN_SHADE,
  RAIN_STREAK,
  RAIN_STREAK_COLOUR,
  stepRainfall,
  type Rainfall,
} from './rainfall';

/** The part of the screen the rain falls over, in pixels. */
export interface RainView {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/**
 * The rain, drawn: one graphics object pinned to the camera, cleared and drawn
 * again each frame it is raining (`rainfall.ts` is the falling). The world puts
 * it over a place that rains and the battle over a fight in the rain.
 *
 * For a player who asks the browser for reduced motion it is still rain, and
 * still shown - the shade and the streaks - but nothing moves: the drops stand
 * where they were first drawn, as the title screen and the harbour hold still.
 */
export class RainOverlay {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private readonly still = prefersReducedMotion();
  private rain: Rainfall | null = null;
  private drawnStill = false;

  /**
   * `pinned` is drawn in screen pixels, whatever the camera is looking at (the
   * world, which scrolls under it); otherwise in the scene's own, for a scene
   * whose camera is placed once (the battle, centred on its field).
   */
  public constructor(scene: Phaser.Scene, depth: number, pinned = true) {
    this.graphics = scene.add.graphics().setScrollFactor(pinned ? 0 : 1).setDepth(depth).setVisible(false);
  }

  /** Whether any rain is on screen now. */
  public get showing(): boolean {
    return this.graphics.visible;
  }

  /** Rains over `view` for another `deltaMs`, or puts the rain away. */
  public update(deltaMs: number, raining: boolean, view: RainView): void {
    if (!raining) {
      this.graphics.setVisible(false);
      return;
    }
    if (!this.rain || this.rain.width !== view.width || this.rain.height !== view.height) {
      this.rain = createRainfall(view.width, view.height);
      this.drawnStill = false;
    }
    this.graphics.setVisible(true);
    if (this.still) {
      if (!this.drawnStill) {
        this.draw(view);
        this.drawnStill = true;
      }
      return;
    }
    stepRainfall(this.rain, deltaMs);
    this.draw(view);
  }

  public destroy(): void {
    this.graphics.destroy();
  }

  private draw(view: RainView): void {
    const g = this.graphics;
    const rain = this.rain!;
    g.clear();
    g.fillStyle(RAIN_SHADE.colour, RAIN_SHADE.alpha);
    g.fillRect(view.x, view.y, view.width, view.height);
    g.fillStyle(RAIN_STREAK_COLOUR.colour, RAIN_STREAK_COLOUR.alpha);
    // Every pixel is kept inside the view: the battle's field has a frame
    // round it, and a streak starting just above the top drew over it.
    const right = view.x + view.width;
    const bottom = view.y + view.height;
    const pixels = (x: number, y: number, width: number, height: number): void => {
      const left = Math.max(x, view.x);
      const top = Math.max(y, view.y);
      const across = Math.min(x + width, right) - left;
      const down = Math.min(y + height, bottom) - top;
      if (across > 0 && down > 0) {
        g.fillRect(left, top, across, down);
      }
    };
    for (const drop of rain.drops) {
      const x = view.x + Math.round(drop.x);
      const y = view.y + Math.round(drop.y);
      if (drop.splashMs > 0) {
        // FireRed's splash: a pixel either side, one up, where it hit.
        pixels(x - 2, y - 1, 1, 1);
        pixels(x + 1, y - 1, 1, 1);
        pixels(x - 1, y, 2, 1);
        continue;
      }
      // The streak, a pixel wide, stepping one to the right halfway up: drawn
      // as two runs of pixels rather than a line, so it is as crisp as the art.
      const half = RAIN_STREAK.y / 2;
      pixels(x, y - half + 1, 1, half);
      pixels(x - RAIN_STREAK.x / 2, y - RAIN_STREAK.y + 1, 1, half);
    }
  }
}
