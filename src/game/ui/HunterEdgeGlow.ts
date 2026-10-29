import type Phaser from 'phaser';
import { HUNTER_GLOW_BAND_ALPHAS, HUNTER_GLOW_BAND_PX } from '../world/hunterWarning';

/**
 * The red rim round the screen that says the hunter is on the player's tail
 * (`world/hunterWarning.ts` decides how strong). Fixed to the camera, under
 * the raid HUD's chips and the dialogue box so neither is tinted, and over the
 * map and anything a search puts on it.
 */
export const HUNTER_GLOW_DEPTH = 99;
const GLOW_COLOUR = 0xd01c1c;

export class HunterEdgeGlow {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private drawn: { strength: number; width: number; height: number } | null = null;

  constructor(scene: Phaser.Scene) {
    this.graphics = scene.add.graphics().setScrollFactor(0).setDepth(HUNTER_GLOW_DEPTH);
  }

  /** Draws the rim at `strength` (0 to 1) round a `width` by `height` screen. */
  render(strength: number, width: number, height: number): void {
    // A glow is redrawn only when it changes, and strengths a hair apart are one
    // drawing: twenty steps is finer than a band's alpha can show.
    const stepped = Math.round(Math.max(0, Math.min(1, strength)) * 20) / 20;
    if (this.drawn && this.drawn.strength === stepped && this.drawn.width === width && this.drawn.height === height) {
      return;
    }
    this.drawn = { strength: stepped, width, height };
    this.graphics.clear();
    if (stepped === 0) {
      return;
    }
    HUNTER_GLOW_BAND_ALPHAS.forEach((alpha, index) => {
      const inset = index * HUNTER_GLOW_BAND_PX;
      const band = HUNTER_GLOW_BAND_PX;
      const innerWidth = width - inset * 2;
      const innerHeight = height - inset * 2;
      if (innerWidth <= band * 2 || innerHeight <= band * 2) {
        return;
      }
      this.graphics.fillStyle(GLOW_COLOUR, alpha * stepped);
      // Top and bottom run the band's full width; the sides fill between them,
      // so no corner pixel is painted twice and darker than its neighbours.
      this.graphics.fillRect(inset, inset, innerWidth, band);
      this.graphics.fillRect(inset, height - inset - band, innerWidth, band);
      this.graphics.fillRect(inset, inset + band, band, innerHeight - band * 2);
      this.graphics.fillRect(width - inset - band, inset + band, band, innerHeight - band * 2);
    });
  }

  destroy(): void {
    this.graphics.destroy();
  }
}
