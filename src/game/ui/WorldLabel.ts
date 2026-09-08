import type Phaser from 'phaser';
import { drawPixelWindow } from './pixelWindow';

/**
 * A caption pinned above something on the map.
 *
 * Map captions used to be `Text` objects with a `backgroundColor`, which draws a
 * hard rectangle with no frame - a second visual language beside the raid HUD's
 * windows, and one that ran off the edge of the screen whenever the thing it
 * named sat near it. This is the same drawn window as the HUD, in a darker
 * weight so world annotation reads as quieter than screen furniture, and it
 * knows how to stay inside the view.
 */

export interface WorldLabelTone {
  readonly fill: number;
  readonly border: number;
  readonly ink: string;
}

const PADDING_X = 3;
const PADDING_Y = 2;
/** Kept off the very edge so a clamped caption still reads as a window. */
const VIEW_INSET = 3;

export class WorldLabel {
  private readonly frame: Phaser.GameObjects.Graphics;
  private readonly label: Phaser.GameObjects.Text;
  private readonly anchorX: number;
  private readonly anchorY: number;
  private tone: WorldLabelTone;

  public constructor(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    tone: WorldLabelTone,
    depth: number,
  ) {
    this.anchorX = x;
    this.anchorY = y;
    this.tone = tone;
    this.frame = scene.add.graphics().setDepth(depth);
    this.label = scene.add
      .text(x, y, text, { fontFamily: 'monospace', fontSize: '7px', color: tone.ink, lineSpacing: 1 })
      .setOrigin(0.5, 1)
      .setDepth(depth + 0.0005);
    this.redraw(x);
  }

  public setText(text: string, tone: WorldLabelTone): void {
    this.label.setText(text);
    this.tone = tone;
    this.label.setColor(tone.ink);
    this.redraw(this.label.x);
  }

  /** Slides the caption along its row so the whole window stays on screen. */
  public clampInto(left: number, right: number): void {
    const halfWidth = this.windowWidth() / 2;
    const minimum = left + VIEW_INSET + halfWidth;
    const maximum = right - VIEW_INSET - halfWidth;
    const x = maximum < minimum
      ? Math.round((left + right) / 2)
      : Math.round(Math.min(Math.max(this.anchorX, minimum), maximum));
    if (x !== this.label.x) {
      this.redraw(x);
    }
  }

  public destroy(): void {
    this.frame.destroy();
    this.label.destroy();
  }

  private windowWidth(): number {
    return Math.ceil(this.label.width) + PADDING_X * 2;
  }

  private redraw(x: number): void {
    this.label.setX(x);
    const width = this.windowWidth();
    const height = Math.ceil(this.label.height) + PADDING_Y * 2;
    this.frame.clear();
    drawPixelWindow(
      this.frame,
      { x: Math.round(x - width / 2), y: Math.round(this.anchorY - height), width, height },
      { fill: this.tone.fill, border: this.tone.border },
    );
    this.label.setY(Math.round(this.anchorY - PADDING_Y));
  }
}
