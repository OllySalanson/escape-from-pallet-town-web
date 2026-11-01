import type Phaser from 'phaser';
import { ARENA_MAT, ARENA_TILE } from './arenaHall';
import type { PaintedPicture } from '../world/minimap';
import { FLOOR_FURNITURE_DEPTH } from '../world/depths';

/**
 * The one thing a new save is shown to do next, with no words: a gold chevron over
 * the Raid Arena's door, or at the edge of the screen on the way to it, and chevrons
 * running up the hall's runner to the rail. It is there until the first raid has
 * begun and never again (`hub/firstRaid.ts`). Where each goes is a pure function of
 * the time and the view, so it is held by a test rather than by eye.
 */

const CHEVRON: readonly string[] = [
  '.....D.....',
  '....DGD....',
  '...DGGGD...',
  '..DGGDGGD..',
  '.DGGD.DGGD.',
  'DGGD...DGGD',
  'DGD.....DGD',
  '.D.......D.',
];

const GOLD: Readonly<Record<string, readonly [number, number, number]>> = {
  G: [248, 208, 88],
  D: [96, 56, 16],
};

const TEXTURE = 'way-mark-chevron';

/** The chevron's picture, once a game. Canvas, so no art file stands behind so small a thing. */
function ensureChevron(scene: Phaser.Scene): void {
  if (scene.textures.exists(TEXTURE)) {
    return;
  }
  const picture = paintChevron();
  const texture = scene.textures.createCanvas(TEXTURE, picture.width, picture.height);
  texture?.context.putImageData(new ImageData(picture.data, picture.width, picture.height), 0, 0);
  texture?.refresh();
}

function paintChevron(): PaintedPicture {
  const width = CHEVRON[0].length;
  const height = CHEVRON.length;
  const data = new Uint8ClampedArray(width * height * 4);
  CHEVRON.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      const ink = GOLD[cell];
      if (ink) {
        data.set([...ink, 255], (y * width + x) * 4);
      }
    }),
  );
  return { width, height, data };
}

export interface ScreenRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** How far inside the screen's edge the chevron stands when what it points at is off it, and how far it bobs. */
const EDGE_CLEAR = 22;
const BOB_PX = 2;
const BOB_MS = 170;
/** The chevron over a door stands clear of the door's top. */
const OVER_THE_DOOR = 14;

/**
 * Where the chevron stands on the screen for a target in the world, and which way
 * it points: over the target while that is on the screen, else at the screen's edge
 * pointing at it. Whole pixels, because anything else is a blurred one.
 */
export function chevronTowards(
  target: { readonly x: number; readonly y: number },
  view: ScreenRect,
  player: { readonly x: number; readonly y: number },
  elapsedMs: number,
): { readonly x: number; readonly y: number; readonly angle: number } {
  const bob = Math.round(Math.sin(elapsedMs / BOB_MS) * BOB_PX);
  const onScreen =
    target.x >= view.left && target.x < view.left + view.width && target.y - OVER_THE_DOOR >= view.top && target.y < view.top + view.height;
  if (onScreen) {
    return { x: Math.round(target.x - view.left), y: Math.round(target.y - view.top - OVER_THE_DOOR + bob), angle: 180 };
  }
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const across = Math.abs(dx) / Math.max(1, view.width) >= Math.abs(dy) / Math.max(1, view.height);
  if (across) {
    return {
      x: dx < 0 ? EDGE_CLEAR + bob : view.width - EDGE_CLEAR - bob,
      y: Math.round(Math.max(EDGE_CLEAR, Math.min(view.height - EDGE_CLEAR, player.y - view.top))),
      angle: dx < 0 ? 270 : 90,
    };
  }
  return {
    x: Math.round(Math.max(EDGE_CLEAR, Math.min(view.width - EDGE_CLEAR, player.x - view.left))),
    y: dy < 0 ? EDGE_CLEAR + bob : view.height - EDGE_CLEAR - bob,
    angle: dy < 0 ? 0 : 180,
  };
}

/** How many run up the runner at once, how far apart in pixels, and how fast. */
const RUNNER_CHEVRONS = 4;
const RUNNER_SPACING = 40;
const RUNNER_SPEED_PX_PER_MS = 0.075;

/**
 * Where the chevrons on the runner are, from just ahead of the player to the rail:
 * rows of the hall in pixels, all of them moving north, so the floor itself says
 * which way to go. With nothing to run (reduced motion) they stand still.
 */
export function runnerChevrons(elapsedMs: number, playerY: number, railY: number, still = false): readonly number[] {
  const offset = still ? 0 : (elapsedMs * RUNNER_SPEED_PX_PER_MS) % RUNNER_SPACING;
  const rows: number[] = [];
  for (let index = 0; index < RUNNER_CHEVRONS * 3; index += 1) {
    const y = Math.round(playerY - ARENA_TILE - (index * RUNNER_SPACING + offset));
    if (y >= railY) {
      rows.push(y);
    }
  }
  return rows;
}

/** The chevron in the yard: over the Arena's door, or at the screen's edge on the way there. */
export class YardWayMark {
  private readonly scene: Phaser.Scene;
  private readonly target: { readonly x: number; readonly y: number };
  private readonly still: boolean;
  private readonly image: Phaser.GameObjects.Image;

  public constructor(scene: Phaser.Scene, target: { readonly x: number; readonly y: number }, still: boolean) {
    this.scene = scene;
    this.target = target;
    this.still = still;
    ensureChevron(scene);
    // Over the map and under anything that is being read.
    this.image = scene.add.image(0, 0, TEXTURE).setScrollFactor(0).setScale(2).setDepth(FLOOR_FURNITURE_DEPTH + 3);
  }

  public frame(elapsedMs: number, player: { readonly x: number; readonly y: number }, hidden: boolean): void {
    const view = this.scene.cameras.main.worldView;
    const at = chevronTowards(this.target, { left: view.left, top: view.top, width: view.width, height: view.height }, player, this.still ? 0 : elapsedMs);
    this.image.setVisible(!hidden).setPosition(at.x, at.y).setAngle(at.angle);
  }

  public destroy(): void {
    this.image.destroy();
  }
}

/** The chevrons in the hall, running up the runner to the rail. */
export class RunnerWayMarks {
  private readonly scene: Phaser.Scene;
  private readonly railY: number;
  private readonly still: boolean;
  private readonly images: Phaser.GameObjects.Image[] = [];

  public constructor(scene: Phaser.Scene, railY: number, still: boolean) {
    this.scene = scene;
    this.railY = railY;
    this.still = still;
    ensureChevron(scene);
  }

  public frame(elapsedMs: number, playerY: number, hidden: boolean): void {
    const rows = hidden ? [] : runnerChevrons(elapsedMs, playerY, this.railY, this.still);
    while (this.images.length < rows.length) {
      this.images.push(
        this.scene.add
          .image(ARENA_MAT.x * ARENA_TILE + ARENA_TILE / 2, 0, TEXTURE)
          .setDepth(FLOOR_FURNITURE_DEPTH + 0.02)
          .setAlpha(0.85),
      );
    }
    this.images.forEach((image, index) => {
      const y = rows[index];
      image.setVisible(y !== undefined);
      if (y !== undefined) {
        image.setY(y);
      }
    });
  }

  public destroy(): void {
    this.images.forEach((image) => image.destroy());
    this.images.length = 0;
  }
}
