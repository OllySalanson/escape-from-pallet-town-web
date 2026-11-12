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

const GREEN: Readonly<Record<string, readonly [number, number, number]>> = {
  G: [120, 232, 144],
  D: [16, 72, 40],
};

const TEXTURE = 'way-mark-chevron';
const GREEN_TEXTURE = 'way-mark-chevron-out';

/** The chevron's picture, once a game. Canvas, so no art file stands behind so small a thing. */
function ensureChevron(scene: Phaser.Scene, key = TEXTURE, inks = GOLD): void {
  if (scene.textures.exists(key)) {
    return;
  }
  const picture = paintChevron(inks);
  const texture = scene.textures.createCanvas(key, picture.width, picture.height);
  texture?.context.putImageData(new ImageData(picture.data, picture.width, picture.height), 0, 0);
  texture?.refresh();
}

function paintChevron(inks: Readonly<Record<string, readonly [number, number, number]>>): PaintedPicture {
  const width = CHEVRON[0].length;
  const height = CHEVRON.length;
  const data = new Uint8ClampedArray(width * height * 4);
  CHEVRON.forEach((row, y) =>
    [...row].forEach((cell, x) => {
      const ink = inks[cell];
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

const isOnScreen = (target: { readonly x: number; readonly y: number }, view: ScreenRect): boolean =>
  target.x >= view.left && target.x < view.left + view.width && target.y - OVER_THE_DOOR >= view.top && target.y < view.top + view.height;

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
  keepOff: readonly ScreenRect[] = [],
): { readonly x: number; readonly y: number; readonly angle: number } {
  const bob = Math.round(Math.sin(elapsedMs / BOB_MS) * BOB_PX);
  // What it must not stand over, on the screen: a sign it hid was a sign nobody read (playtest 51, finding 12).
  const signs = keepOff.map((rect) => ({ ...rect, left: rect.left - view.left, top: rect.top - view.top }));
  if (isOnScreen(target, view)) {
    const x = Math.round(target.x - view.left);
    const y = Math.round(target.y - view.top - OVER_THE_DOOR + bob);
    return { x, y: riseClear(x, y, signs), angle: 180 };
  }
  const dx = target.x - player.x;
  const dy = target.y - player.y;
  const across = Math.abs(dx) / Math.max(1, view.width) >= Math.abs(dy) / Math.max(1, view.height);
  // Whether it is clear is asked of the whole of its bob, from where it rests:
  // asked of where it is this frame, a caption two pixels off it was covered
  // on the way in and clear on the way out, and it hopped along the edge and
  // back with every bob.
  const reach = CHEVRON_HALF.short + BOB_PX;
  if (across) {
    const rest = dx < 0 ? EDGE_CLEAR : view.width - EDGE_CLEAR;
    const y = Math.round(Math.max(EDGE_CLEAR, Math.min(view.height - EDGE_CLEAR, player.y - view.top)));
    return {
      x: dx < 0 ? rest + bob : rest - bob,
      y: slideClear(y, rest, CHEVRON_HALF.long, reach, signs, 'top', view.height),
      angle: dx < 0 ? 270 : 90,
    };
  }
  const rest = dy < 0 ? EDGE_CLEAR : view.height - EDGE_CLEAR;
  const x = Math.round(Math.max(EDGE_CLEAR, Math.min(view.width - EDGE_CLEAR, player.x - view.left)));
  return {
    x: slideClear(x, rest, CHEVRON_HALF.long, reach, signs, 'left', view.width),
    y: dy < 0 ? rest + bob : rest - bob,
    angle: dy < 0 ? 0 : 180,
  };
}

/** Half the chevron's size as it stands, drawn at twice its pixels: along the edge it runs, and out from it. */
const CHEVRON_HALF = { long: CHEVRON[0].length, short: CHEVRON.length } as const;

/**
 * Where along the screen's edge the chevron stands clear of every sign: where
 * it would be, or slid along the edge to the nearer side of whatever it would
 * cover, as long as that is still on the screen. `along` is the coordinate it
 * slides on, `out` the other; `axis` says which of a rect's sides is `along`.
 */
function slideClear(
  along: number,
  out: number,
  halfAlong: number,
  halfOut: number,
  signs: readonly ScreenRect[],
  axis: 'top' | 'left',
  room: number,
): number {
  const span = (rect: ScreenRect) =>
    axis === 'top'
      ? { from: rect.top, to: rect.top + rect.height, outFrom: rect.left, outTo: rect.left + rect.width }
      : { from: rect.left, to: rect.left + rect.width, outFrom: rect.top, outTo: rect.top + rect.height };
  const covers = (at: number) =>
    signs.some((rect) => {
      const sign = span(rect);
      return at + halfAlong > sign.from && at - halfAlong < sign.to && out + halfOut > sign.outFrom && out - halfOut < sign.outTo;
    });
  if (!covers(along)) return along;
  const candidates = signs.flatMap((rect) => {
    const sign = span(rect);
    return [Math.floor(sign.from - halfAlong - 1), Math.ceil(sign.to + halfAlong + 1)];
  });
  const fits = candidates
    .filter((at) => at >= EDGE_CLEAR && at <= room - EDGE_CLEAR && !covers(at))
    .sort((a, b) => Math.abs(a - along) - Math.abs(b - along));
  return fits[0] ?? along;
}

/**
 * Where the chevron over a thing stands clear of every caption: where it would
 * be, or just above whatever it would cover - still over the thing and pointing
 * down at it, because rising never puts it below what it points at - as long
 * as that is still on the screen (the north bug hunt of 11 Nov 2026 saw it sat
 * on THE WEEPING PINE's caption, which is seated round the very thing it marks).
 */
function riseClear(x: number, y: number, captions: readonly ScreenRect[]): number {
  const { long: halfAcross, short: halfUp } = CHEVRON_HALF;
  let at = y;
  // Each caption risen over can put it on the one above, so rise until clear.
  for (let step = 0; step <= captions.length; step += 1) {
    const covered = captions.filter(
      (rect) => x + halfAcross > rect.left && x - halfAcross < rect.left + rect.width && at + halfUp > rect.top && at - halfUp < rect.top + rect.height,
    );
    if (covered.length === 0) {
      return at;
    }
    at = Math.floor(Math.min(...covered.map((rect) => rect.top)) - halfUp - 1);
    if (at - halfUp < 0) {
      return y;
    }
  }
  return y;
}

/** How far from the middle of the figure the raid's chevron stands: clear of its head mark and of every chip. */
const ROUND_THE_FIGURE = 30;

/**
 * Where the raid's chevron stands: over the thing once it is on the screen, and
 * until then just off the figure on the side the walk sets off, a quarter-turn at
 * a time, where the player is looking anyway and no chip stands.
 */
export function chevronRoundFigure(
  target: { readonly x: number; readonly y: number },
  aim: { readonly x: number; readonly y: number },
  view: ScreenRect,
  figure: { readonly x: number; readonly y: number },
  elapsedMs: number,
  /** The captions on show, in the world: it stands on none of them. */
  captions: readonly ScreenRect[] = [],
): { readonly x: number; readonly y: number; readonly angle: number } {
  if (isOnScreen(target, view)) {
    return chevronTowards(target, view, figure, elapsedMs, captions);
  }
  const bob = Math.round(Math.sin(elapsedMs / BOB_MS) * BOB_PX);
  const dx = aim.x - figure.x;
  const dy = aim.y - figure.y;
  const across = Math.abs(dx) >= Math.abs(dy);
  const reach = ROUND_THE_FIGURE + bob;
  return {
    x: Math.round(figure.x - view.left + (across ? Math.sign(dx) * reach : 0)),
    y: Math.round(figure.y - view.top + (across ? 0 : Math.sign(dy) * reach)),
    angle: across ? (dx < 0 ? 270 : 90) : dy < 0 ? 0 : 180,
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
  /** The signs it never stands over, in the world's pixels. */
  private readonly keepOff: readonly ScreenRect[];

  public constructor(scene: Phaser.Scene, target: { readonly x: number; readonly y: number }, still: boolean, keepOff: readonly ScreenRect[] = []) {
    this.scene = scene;
    this.target = target;
    this.still = still;
    this.keepOff = keepOff;
    ensureChevron(scene);
    // Over the map and under anything that is being read.
    this.image = scene.add.image(0, 0, TEXTURE).setScrollFactor(0).setScale(2).setDepth(FLOOR_FURNITURE_DEPTH + 3);
  }

  /**
   * `captions` are the ones on show, in the world's pixels: it stands on none
   * of them, as the raid's does not. At the screen's edge it stood on the
   * first letter of whichever place's caption was seated there, and THE
   * WAREHOUSES read HE WAREHOUSES.
   */
  public frame(
    elapsedMs: number,
    player: { readonly x: number; readonly y: number },
    hidden: boolean,
    captions: readonly ScreenRect[] = [],
  ): void {
    const view = this.scene.cameras.main.worldView;
    const at = chevronTowards(
      this.target,
      { left: view.left, top: view.top, width: view.width, height: view.height },
      player,
      this.still ? 0 : elapsedMs,
      captions.length > 0 ? [...this.keepOff, ...captions] : this.keepOff,
    );
    this.image.setVisible(!hidden).setPosition(at.x, at.y).setAngle(at.angle);
  }

  public destroy(): void {
    this.image.destroy();
  }
}

/**
 * What a raid shows the way to, with no words (`WorldScene.settleWayMark`): gold
 * to what the raid is for, green to the way out. Over the thing once it is on the
 * screen, and before that beside the figure, pointing where the walk goes.
 */
export class RaidWayMark {
  private readonly scene: Phaser.Scene;
  private readonly still: boolean;
  private readonly image: Phaser.GameObjects.Image;

  public constructor(scene: Phaser.Scene, depth: number, still: boolean) {
    this.scene = scene;
    this.still = still;
    ensureChevron(scene);
    ensureChevron(scene, GREEN_TEXTURE, GREEN);
    this.image = scene.add.image(0, 0, TEXTURE).setScrollFactor(0).setScale(2).setDepth(depth).setVisible(false);
  }

  public frame(
    way: { readonly target: { readonly x: number; readonly y: number }; readonly aim: { readonly x: number; readonly y: number }; readonly out: boolean } | null,
    player: { readonly x: number; readonly y: number },
    elapsedMs: number,
    captions: readonly ScreenRect[] = [],
  ): void {
    if (!way) {
      this.image.setVisible(false);
      return;
    }
    const view = this.scene.cameras.main.worldView;
    const at = chevronRoundFigure(
      way.target,
      way.aim,
      { left: view.left, top: view.top, width: view.width, height: view.height },
      player,
      this.still ? 0 : elapsedMs,
      captions,
    );
    this.image.setTexture(way.out ? GREEN_TEXTURE : TEXTURE).setVisible(true).setPosition(at.x, at.y).setAngle(at.angle);
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
