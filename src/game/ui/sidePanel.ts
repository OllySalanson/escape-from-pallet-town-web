import type Phaser from 'phaser';
import type { MenuOverlay } from './MenuOverlay';
import { prefersReducedMotion } from './reducedMotion';

/**
 * A screen that stands down the right of the window, with the game still there
 * beside it (the captain, 30 Oct: a full screen over a raid "felt disengaging").
 *
 * The FEEDBACK panel is what it is copied from, and the raid's pack, party and
 * disc-reading and the harbour's favours open this way. Two halves. The panel
 * itself is a `MenuOverlay` wearing `side-panel`, which `fitSidePanel` fits to
 * the window: a column where there is room beside it, the whole screen where
 * there is not. And `PanelLean` is what the game does about it: the camera
 * moves over so whoever is walking stands in the middle of what is left, which
 * is what keeps them on screen at the map's east edge and in a small window.
 *
 * What the panel changes about the *raid* is nothing. It opens over a paused
 * world, as these screens always have (the clock only runs in
 * `WorldScene.update`), so the clock and the hunter stand where they stood.
 * Being able to see them do it is the point, so the HUD moves over too.
 */

/** Below this many game pixels across, the panel is the whole screen rather than a column. */
export const SIDE_PANEL_MIN_LAYER_WIDTH = 440;

/** How fast the view moves over for a panel, in game pixels a millisecond. */
const LEAN_PER_MS = 0.7;

export type SidePanelLayout = 'side' | 'sheet';

/** What a scene is told about the panel in front of it. */
export interface SidePanelView {
  /** How many game pixels of the canvas the panel now covers, from the right. Zero once it is gone. */
  covers(gamePixels: number): void;
  /** A frame of the panel's scene: the only clock a paused world has left. */
  frame(deltaMs: number): void;
}

/**
 * A column where there is room beside it, the whole screen where there is not -
 * and never wider than the window. On a phone the menu layer is wider than the
 * screen (it is never narrower than 320 game pixels at 2x), and a panel laid out
 * against the layer put SEND off the edge.
 */
export function fitSidePanel(root: HTMLElement): SidePanelLayout {
  const layer = root.parentElement;
  const unit = Number.parseFloat(layer?.style.getPropertyValue('--px') ?? '') || 2;
  const box = layer?.getBoundingClientRect();
  const across = (box?.width ?? 0) / unit;
  const visible = Math.floor((window.innerWidth - (box?.left ?? 0)) / unit);
  if (box && visible < across) {
    root.dataset.layout = 'sheet';
    root.style.width = `${visible * unit}px`;
    return 'sheet';
  }
  const layout = across >= SIDE_PANEL_MIN_LAYER_WIDTH ? 'side' : 'sheet';
  root.dataset.layout = layout;
  root.style.width = '';
  return layout;
}

/**
 * How many game pixels of the canvas a panel covers, measured from the right.
 * A sheet covers nothing worth moving over for: there is nothing left to see.
 */
export function sidePanelCover(
  panelLeft: number,
  canvas: { readonly left: number; readonly right: number },
  stageWidth: number,
): number {
  const across = canvas.right - canvas.left;
  if (across <= 0 || stageWidth <= 0 || panelLeft <= canvas.left) {
    return 0;
  }
  return Math.max(0, Math.ceil((canvas.right - panelLeft) * (stageWidth / across)));
}

/**
 * Makes a screen a side panel: fitted in the overlay's measured pass, so a
 * resized window fits it again before its columns are counted, with the scene
 * under it told what it covers. Telling it the panel has gone is the caller's.
 */
export function dockSidePanel(scene: Phaser.Scene, overlay: MenuOverlay, view: SidePanelView | undefined): void {
  let told = -1;
  overlay.onMeasure = () => {
    const layout = fitSidePanel(overlay.root);
    const canvas = scene.game.canvas.getBoundingClientRect();
    const cover =
      layout === 'side'
        ? sidePanelCover(overlay.root.getBoundingClientRect().left, canvas, scene.scale.width)
        : 0;
    if (cover !== told) {
      told = cover;
      view?.covers(cover);
    }
  };
}

/** The parts of a camera the lean moves. */
export interface LeaningCamera {
  getBounds(): { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
  setBounds(x: number, y: number, width: number, height: number): unknown;
  setFollowOffset(x: number, y: number): unknown;
}

/**
 * The camera moving over for a panel, and back when it goes.
 *
 * It looks half the panel's width further east, so the player stands in the
 * middle of what is left, and its bounds grow by that lean twice over: at the
 * map's east edge what comes into view past the map is under the panel, where
 * nobody can see it, and the player is not. Eased, because a cut of a third of
 * the screen loses the figure the player was looking at, unless the browser has
 * been asked for less motion.
 */
export class PanelLean {
  private cover = 0;
  private lean = 0;
  private widened = 0;
  private readonly camera: () => LeaningCamera;

  public constructor(camera: () => LeaningCamera) {
    this.camera = camera;
  }

  /** How much of the canvas is covered right now, in game pixels. */
  public get covering(): number {
    return this.cover;
  }

  public setCover(gamePixels: number): void {
    this.cover = gamePixels;
  }

  /** The camera's bounds were set afresh (a door, a rebuilt world), and hold no widening of ours. */
  public boundsWereSet(): void {
    this.widened = 0;
  }

  /** A frame. Answers true on the one where the view has come to rest. */
  public settle(deltaMs: number, still?: boolean): boolean {
    const target = Math.floor(this.cover / 2);
    if (this.lean === target && this.widened === target * 2) {
      return false;
    }
    const reach = (still ?? prefersReducedMotion()) ? Number.POSITIVE_INFINITY : LEAN_PER_MS * Math.max(deltaMs, 0);
    this.lean = target > this.lean ? Math.min(target, this.lean + reach) : Math.max(target, this.lean - reach);
    const camera = this.camera();
    const whole = Math.round(this.lean);
    const bounds = camera.getBounds();
    camera.setBounds(bounds.x, bounds.y, bounds.width - this.widened + whole * 2, bounds.height);
    this.widened = whole * 2;
    camera.setFollowOffset(-whole, 0);
    return this.lean === target;
  }
}
