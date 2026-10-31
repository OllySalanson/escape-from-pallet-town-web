import type Phaser from 'phaser';
import { GAME_FONT } from '../ui/gameFont';
import { CHIP_FONT_SIZE } from '../ui/screenType';
import type { PaintedPicture } from '../world/minimap';
import { ensureTexture } from './arenaView';
import { slateWords, strikeAt } from './runSlate';

const TEXTURE = 'arena-run-slate';
const SLATE_INK = [35, 42, 48] as const;
const SLATE_FRAME = [106, 74, 40] as const;
const SLATE_FRAME_DARK = [60, 40, 20] as const;
const CHALK = '#e8e4d0';
const STRIKE_INK = 0xd83818;
const SLATE_HEIGHT = 15;
const SLATE_WIDTH = 42;

function paintSlate(): PaintedPicture {
  const data = new Uint8ClampedArray(SLATE_WIDTH * SLATE_HEIGHT * 4);
  for (let y = 0; y < SLATE_HEIGHT; y += 1) {
    for (let x = 0; x < SLATE_WIDTH; x += 1) {
      const fromEdge = Math.min(x, y, SLATE_WIDTH - 1 - x, SLATE_HEIGHT - 1 - y);
      const corner = (x === 0 || x === SLATE_WIDTH - 1) && (y === 0 || y === SLATE_HEIGHT - 1);
      if (corner) {
        continue;
      }
      const ink = fromEdge === 0 ? SLATE_FRAME_DARK : fromEdge === 1 ? SLATE_FRAME : SLATE_INK;
      data.set([ink[0], ink[1], ink[2], 255], (y * SLATE_WIDTH + x) * 4);
    }
  }
  return { width: SLATE_WIDTH, height: SLATE_HEIGHT, data };
}

/** The slate itself, hung on the rail. Nothing stands on it and nobody can walk over it. */
export class RunSlate {
  private readonly board: Phaser.GameObjects.Image;
  private readonly words: Phaser.GameObjects.Text;
  private readonly strike: Phaser.GameObjects.Graphics;
  private strikingMs: number | null;
  private drawnShare = -1;

  public constructor(scene: Phaser.Scene, at: { readonly x: number; readonly y: number }, depth: number, run: number, struck: boolean) {
    ensureTexture(scene, TEXTURE, paintSlate);
    this.board = scene.add.image(at.x, at.y, TEXTURE).setOrigin(0, 0).setDepth(depth);
    this.words = scene.add
      .text(at.x + SLATE_WIDTH / 2, at.y + 1, slateWords(run), { fontFamily: GAME_FONT, fontSize: CHIP_FONT_SIZE, color: CHALK })
      .setOrigin(0.5, 0)
      .setDepth(depth + 0.001);
    this.words.setX(Math.round(this.words.x - this.words.width / 2) + this.words.width / 2);
    this.strike = scene.add.graphics().setPosition(at.x, at.y).setDepth(depth + 0.002);
    this.strikingMs = struck ? 0 : null;
  }

  public update(deltaMs: number): void {
    if (this.strikingMs === null) {
      return;
    }
    this.strikingMs += deltaMs;
    const share = strikeAt(this.strikingMs);
    if (share === null) {
      this.strikingMs = null;
      this.destroy();
      return;
    }
    if (share !== this.drawnShare) {
      this.drawnShare = share;
      this.strike.clear();
      const across = Math.round((SLATE_WIDTH - 6) * share);
      this.strike.fillStyle(STRIKE_INK, 1);
      for (let x = 0; x < across; x += 1) {
        // Corner to corner, two pixels thick, in whole pixels.
        const y = Math.round(((SLATE_HEIGHT - 6) * (SLATE_WIDTH - 6 - x)) / (SLATE_WIDTH - 6));
        this.strike.fillRect(3 + x, 2 + y, 1, 2);
      }
    }
  }

  public destroy(): void {
    this.board.destroy();
    this.words.destroy();
    this.strike.destroy();
  }
}
