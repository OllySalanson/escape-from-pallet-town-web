import type Phaser from 'phaser';
import type { Direction } from '../movement/gridMovement';
import { getIdleFrame } from '../playerFrames';
import { GAME_FONT } from '../ui/gameFont';
import { CHIP_FONT_SIZE } from '../ui/screenType';
import { drawPixelWindow } from '../ui/pixelWindow';
import { condensedFloor } from './arenaPit';
import {
  AIM_HOP_MS,
  PORTAL_CLOSE_MS,
  PORTAL_DIM,
  PORTAL_OPEN_MS,
  aimHopAt,
  cutPortalFloor,
  paintPortalRing,
  portalDiveScales,
  portalFloorSquare,
  portalHopAt,
  portalOpenPose,
  portalPlace,
  portalPointOfFloor,
  portalShapeFor,
  portalStance,
  type PortalPoint,
  type PortalRegion,
  type PortalShape,
} from './arenaPortal';
import { partnerFrame } from './partner';

/**
 * THE RAID ARENA's portal on the screen (`arenaPortal.ts` is what it is). It stands
 * in the screen's own pixels over the hall, on the hall's camera with no scroll,
 * under the dialogue box so a question can be asked over it, and under the jump's
 * own camera (`arenaDiveView.ts`), so whoever falls is drawn over it.
 */

/** Over the hall and its hints, under the dialogue box (1000). */
const PORTAL_DEPTH = 900;
const DIM_DEPTH = PORTAL_DEPTH;
const RING_DEPTH = PORTAL_DEPTH + 2;
const FLOOR_DEPTH = PORTAL_DEPTH + 1;
const LIGHT_DEPTH = PORTAL_DEPTH + 3;
const FIGURE_DEPTH = PORTAL_DEPTH + 4;
const PLATE_DEPTH = PORTAL_DEPTH + 5;

/** The hall's darkest stone, which is what the hall goes down to round the portal. */
const DIM_INK = 0x0c0a10;
const PLATE_HEIGHT = 13;
const PLATE_GAP = 3;
/** How long ground glints as the cloud comes off it, how bright, and in what. */
const GLINT_MS = 700;
const GLINT_SHARE = 0.85;
const GLINT_INK = [255, 244, 176] as const;
/** How often the cloud in the portal steps along a pixel. */
const MIST_STEP_MS = 140;
/** How much of the mist's ink is laid over the floor, by hour. */
const MIST_SHARE = 0.38;
/** How long a light stays lit and dark, blinking on the way in chosen. */
const LIGHT_BEAT_MS = 360;
/** How near a click must be to a light to choose it, in screen pixels. */
const LIGHT_REACH = 10;

export interface PortalSource {
  /** The pit's floor picture, the map in the middle of it under its cloud. */
  readonly floorTexture: string;
  /** How many of the floor's pixels across the map is. */
  readonly mapSpan: number;
  /** The mist the pit drifts, and its ink at this hour. */
  readonly mistTexture: string;
  readonly mistInk: readonly [number, number, number];
  /** The ways in, each where it is on the floor's picture. */
  readonly landings: readonly { readonly id: string; readonly floorPixel: PortalPoint }[];
  /** The textures of the light on a way in and the mark round the chosen one. */
  readonly lightTexture: string;
  readonly lookTexture: string;
  /** The old cloud lifting off what a raid has just walked, laid over the floor while it lifts. */
  readonly lifting: () => { readonly pixels: ImageData; readonly left: number; readonly top: number } | null;
}

/** Over the portal, for a board put up while it is looked at. */
export const PORTAL_SIGN_DEPTH = 950;

export interface PortalOpening {
  /** Where the screen has room for it. */
  readonly region: PortalRegion;
  /** Where the pit's hole is on the screen now, and how wide, which is where the portal draws back from. */
  readonly pitOnScreen: { readonly x: number; readonly y: number; readonly rx: number };
  /** Where the player stands round the pit, and the pit's middle, in the hall's pixels. */
  readonly player: PortalPoint;
  readonly pitMiddle: PortalPoint;
  readonly facing: Direction;
  readonly playerTexture: string;
  readonly partnerTexture: string | null;
}

const topLeft = (image: Phaser.GameObjects.Image | null): PortalPoint =>
  image ? { x: Math.round(image.x - image.displayWidth / 2), y: Math.round(image.y - image.displayHeight) } : { x: 0, y: 0 };

type Phase = 'opening' | 'open' | 'closing' | 'diving' | 'shut';

export class ArenaPortalView {
  private readonly scene: Phaser.Scene;
  private readonly still: boolean;
  private readonly dim: Phaser.GameObjects.Rectangle;
  private ring: Phaser.GameObjects.Image | null = null;
  private floor: Phaser.GameObjects.Image | null = null;
  private floorCanvas: Phaser.Textures.CanvasTexture | null = null;
  private floorBase: ImageData | null = null;
  private mistPixels: ImageData | null = null;
  private mistMs = 0;
  private mistStep = 0;
  /** Pixels of the floor where cloud has just lifted, and how much longer each glints. */
  private readonly glints = new Map<number, number>();
  private lights: { readonly id: string; readonly at: PortalPoint; readonly image: Phaser.GameObjects.Image }[] = [];
  private look: Phaser.GameObjects.Image | null = null;
  private readonly plate: Phaser.GameObjects.Graphics;
  private readonly plateText: Phaser.GameObjects.Text;
  private plateName = '';
  private player: Phaser.GameObjects.Image | null = null;
  private partner: Phaser.GameObjects.Image | null = null;
  private shape: PortalShape | null = null;
  private source: PortalSource | null = null;
  private square: PortalRegion | null = null;
  private place: PortalPoint = { x: 0, y: 0 };
  private placeGoal: PortalPoint = { x: 0, y: 0 };
  private shownAt: PortalPoint = { x: 0, y: 0 };
  private opening: PortalOpening | null = null;
  private stance: PortalPoint = { x: 0, y: 0 };
  private phase: Phase = 'shut';
  private phaseMs = 0;
  private lightMs = 0;
  private aimedId: string | null = null;
  private aimFrom: PortalPoint | null = null;
  private aimMs = AIM_HOP_MS;
  private sizeKey = '';
  /** The jump: how far over the edge, and how far down. */
  private hop = 0;
  private partnerHop = 0;
  private going = false;
  private dive = { zoom: 1, swing: 0 };

  public constructor(scene: Phaser.Scene, still: boolean) {
    this.scene = scene;
    this.still = still;
    const { width, height } = scene.scale;
    this.dim = scene.add.rectangle(0, 0, width, height, DIM_INK, 1).setOrigin(0, 0).setScrollFactor(0).setDepth(DIM_DEPTH).setAlpha(0).setVisible(false);
    this.plate = scene.add.graphics().setScrollFactor(0).setDepth(PLATE_DEPTH).setVisible(false);
    this.plateText = scene.add
      .text(0, 0, '', { fontFamily: GAME_FONT, fontSize: CHIP_FONT_SIZE, color: '#f8f7dd' })
      .setScrollFactor(0)
      .setDepth(PLATE_DEPTH + 0.001)
      .setVisible(false);
  }

  /** Whether any of it is on the screen. */
  public get showing(): boolean {
    return this.phase !== 'shut';
  }

  /** Whether it stands over the rail, with the player and their partner drawn on its edge rather than in the hall. */
  public get covers(): boolean {
    return this.phase === 'open' || this.phase === 'diving' || (this.phase === 'opening' && this.phaseMs >= PORTAL_OPEN_MS * 0.6);
  }

  /** Whether it is up, or coming up: what a press or a click is asking of while it is. */
  public get open(): boolean {
    return this.phase === 'opening' || this.phase === 'open' || this.phase === 'diving';
  }

  /** Draws back from the rail to the whole portal, from wherever it stands now. */
  public show(source: PortalSource, opening: PortalOpening): boolean {
    const shape = portalShapeFor(opening.region);
    if (!shape) {
      return false;
    }
    const reopening = this.phase === 'closing';
    this.opening = opening;
    this.paint(source, shape);
    this.placeGoal = portalPlace(shape, opening.region);
    this.place = this.placeGoal;
    this.shownAt = this.place;
    this.stance = portalStance(shape, opening.pitMiddle, opening.player);
    this.standFigures(opening);
    this.phase = this.still ? 'open' : 'opening';
    // Shutting and opened again at once, it comes back from as far as it had gone.
    this.phaseMs = reopening ? PORTAL_OPEN_MS * (1 - Math.min(1, this.phaseMs / PORTAL_CLOSE_MS)) : 0;
    this.hop = 0;
    this.partnerHop = 0;
    this.going = false;
    this.dive = { zoom: 1, swing: 0 };
    this.dim.setVisible(true);
    this.frame();
    return true;
  }

  /** Where the pit under the rail is on the screen now, which a closing portal goes back to. */
  public trackPit(pitOnScreen: PortalOpening['pitOnScreen']): void {
    if (this.opening) {
      this.opening = { ...this.opening, pitOnScreen };
    }
  }

  /** A jump is under way: the way in's name goes, so what is at stake can be read over it. */
  public goingOver(): void {
    this.going = true;
  }

  /** Back to the rail. */
  public hide(): void {
    if (this.phase === 'shut' || this.phase === 'closing') {
      return;
    }
    if (this.still) {
      this.shut();
      return;
    }
    // Part of the way open, it goes back from where it got to.
    this.phaseMs = this.phase === 'opening' ? PORTAL_CLOSE_MS * (1 - Math.min(1, this.phaseMs / PORTAL_OPEN_MS)) : 0;
    this.phase = 'closing';
  }

  /**
   * Room for it has changed: the card has been measured, say, or has gone. It
   * stands in the middle of what there is, drawn again at the size that fits when
   * `refit` (never mid-jump, when it is going down into what is already drawn).
   */
  public moveTo(region: PortalRegion, refit = false): void {
    if (!this.shape || !this.source || !this.opening) {
      return;
    }
    if (refit) {
      const shape = portalShapeFor(region);
      if (shape && (shape.width !== this.shape.width || shape.height !== this.shape.height)) {
        const stance = this.opening;
        this.opening = { ...stance, region };
        this.paint(this.source, shape);
        this.stance = portalStance(shape, stance.pitMiddle, stance.player);
        this.place = portalPlace(shape, region);
        this.shownAt = this.place;
      }
    }
    this.opening = { ...this.opening, region };
    this.placeGoal = portalPlace(this.shape, region);
  }

  /** The way in chosen, and its name. */
  public aim(id: string | null, name: string): void {
    if (id !== this.aimedId) {
      const was = this.lights.find((light) => light.id === this.aimedId);
      this.aimFrom = was && this.phase === 'open' && !this.still ? this.lookAt() : null;
      this.aimMs = this.aimFrom ? 0 : AIM_HOP_MS;
      this.aimedId = id;
    }
    if (name !== this.plateName) {
      this.plateName = name;
      this.plateText.setText(name);
      const width = Math.ceil(this.plateText.width) + 8;
      this.plate.clear();
      drawPixelWindow(this.plate, { x: 0, y: 0, width, height: PLATE_HEIGHT }, { fill: 0x221d1e, border: 0xf0c454 });
      this.plate.setData('width', width);
    }
  }

  /** Where each way in's light is on the screen, while the portal is up and still: what a click is matched against. */
  public lightsOnScreen(): readonly { readonly id: string; readonly x: number; readonly y: number }[] {
    return this.phase === 'open' ? this.lights.map((light) => ({ id: light.id, x: this.place.x + light.at.x, y: this.place.y + light.at.y })) : [];
  }

  /** The way in a click on the screen is on, if it is on one. */
  public lightAt(x: number, y: number): string | null {
    if (this.phase !== 'open') {
      return null;
    }
    const near = this.lights
      .map((light) => ({ id: light.id, away: Math.hypot(this.place.x + light.at.x - x, this.place.y + light.at.y - y) }))
      .sort((a, b) => a.away - b.away)[0];
    return near && near.away <= LIGHT_REACH ? near.id : null;
  }

  /** Over the edge: how far through the hop the player is, and their partner a beat behind, each 0 to 1. */
  public hopOver(hop: number, partnerHop: number): void {
    this.phase = 'diving';
    this.hop = hop;
    this.partnerHop = partnerHop;
    this.frame();
  }

  /** How far it has moved since it came up: a jump moves it to the middle, and the hall goes with it. */
  public get movedBy(): PortalPoint {
    return { x: this.place.x - this.shownAt.x, y: this.place.y - this.shownAt.y };
  }

  /** Where the player figure is on the screen, its frame's top-left. */
  public playerOnScreen(): PortalPoint {
    return topLeft(this.player);
  }

  /** Where the partner is on the screen, its frame's top-left, if it came. */
  public partnerOnScreen(): PortalPoint | null {
    return this.partner ? topLeft(this.partner) : null;
  }

  /** The player has gone over: the fall draws them now. */
  public playerGone(): void {
    this.player?.setVisible(false);
  }

  /** And their partner. */
  public partnerGone(): void {
    this.partner?.setVisible(false);
  }

  /** Going down: the jump's own zoom (1 at the rail) and how far the view has gone over to the landing. */
  public diveTo(zoom: number, swing: number): void {
    this.phase = 'diving';
    this.dive = { zoom, swing };
  }

  public update(deltaMs: number): void {
    if (this.phase === 'shut') {
      return;
    }
    this.phaseMs += deltaMs;
    this.lightMs += deltaMs;
    this.aimMs += deltaMs;
    if (this.phase === 'opening' && this.phaseMs >= PORTAL_OPEN_MS) {
      this.phase = 'open';
    }
    if (this.phase === 'closing' && this.phaseMs >= PORTAL_CLOSE_MS) {
      this.shut();
      return;
    }
    // A card that comes or goes moves it, a pixel at a time and quickly.
    const toward = (from: number, to: number): number => (from === to ? to : from + Math.sign(to - from) * Math.max(1, Math.round(Math.abs(to - from) * Math.min(1, deltaMs / 160))));
    this.place = { x: toward(this.place.x, this.placeGoal.x), y: toward(this.place.y, this.placeGoal.y) };
    if (!this.still) {
      this.drift(deltaMs);
    }
    this.frame();
  }

  private shut(): void {
    this.phase = 'shut';
    this.dim.setVisible(false);
    this.ring?.setVisible(false);
    this.floor?.setVisible(false);
    this.look?.setVisible(false);
    this.lights.forEach((light) => light.image.setVisible(false));
    this.player?.setVisible(false);
    this.partner?.setVisible(false);
    this.plate.setVisible(false);
    this.plateText.setVisible(false);
  }

  public destroy(): void {
    this.dim.destroy();
    this.ring?.destroy();
    this.floor?.destroy();
    this.look?.destroy();
    this.lights.forEach((light) => light.image.destroy());
    this.player?.destroy();
    this.partner?.destroy();
    this.plate.destroy();
    this.plateText.destroy();
    if (this.floorCanvas) {
      this.scene.textures.remove(this.floorCanvas);
    }
  }

  // --- painting ---------------------------------------------------------------

  /** The ring and the floor for this size of portal and this floor: painted again only when either has changed. */
  private paint(source: PortalSource, shape: PortalShape): void {
    const key = `${source.floorTexture}:${shape.width}x${shape.height}:${source.landings.map((landing) => landing.id).join(',')}`;
    this.source = source;
    this.shape = shape;
    if (key === this.sizeKey && this.ring && this.floor) {
      return;
    }
    this.sizeKey = key;
    const { textures } = this.scene;
    const ringKey = `arena-portal-ring-${shape.width}x${shape.height}`;
    if (!textures.exists(ringKey)) {
      const ring = paintPortalRing(shape);
      const texture = textures.createCanvas(ringKey, ring.width, ring.height);
      texture?.context.putImageData(new ImageData(ring.data, ring.width, ring.height), 0, 0);
      texture?.refresh();
    }
    this.ring?.destroy();
    this.ring = this.scene.add.image(0, 0, ringKey).setOrigin(0, 0).setScrollFactor(0).setDepth(RING_DEPTH);

    this.floorBase = this.condensedFloor(source, shape);
    if (this.floorCanvas) {
      textures.remove(this.floorCanvas);
    }
    this.floorCanvas = textures.createCanvas(`arena-portal-floor-${shape.width}x${shape.height}`, shape.width, shape.height);
    const mist = this.scene.textures.get(source.mistTexture).getSourceImage() as HTMLCanvasElement;
    this.mistPixels = mist.getContext?.('2d')?.getImageData(0, 0, mist.width, mist.height) ?? null;
    this.drawFloor();
    this.floor?.destroy();
    this.floor = this.scene.add.image(0, 0, this.floorCanvas!.key).setOrigin(0, 0).setScrollFactor(0).setDepth(FLOOR_DEPTH);

    this.lights.forEach((light) => light.image.destroy());
    this.lights = source.landings.map((landing) => ({
      id: landing.id,
      at: portalPointOfFloor(landing.floorPixel, this.square!, shape),
      image: this.scene.add.image(0, 0, source.lightTexture).setScrollFactor(0).setDepth(LIGHT_DEPTH),
    }));
    this.look ??= this.scene.add.image(0, 0, source.lookTexture).setScrollFactor(0).setDepth(LIGHT_DEPTH + 0.001);
  }

  /** The pit's floor, with any cloud still lifting off it, drawn down into the hole. */
  private condensedFloor(source: PortalSource, shape: PortalShape): ImageData {
    const floorPicture = this.scene.textures.get(source.floorTexture).getSourceImage() as HTMLCanvasElement;
    const floorPixels = floorPicture.getContext('2d')!.getImageData(0, 0, floorPicture.width, floorPicture.height);
    const patch = source.lifting();
    if (patch) {
      const { pixels, left, top } = patch;
      for (let y = 0; y < pixels.height; y += 1) {
        for (let x = 0; x < pixels.width; x += 1) {
          const from = (y * pixels.width + x) * 4;
          if (pixels.data[from + 3] === 0) {
            continue;
          }
          const to = ((y + top) * floorPixels.width + x + left) * 4;
          floorPixels.data[to] = pixels.data[from];
          floorPixels.data[to + 1] = pixels.data[from + 1];
          floorPixels.data[to + 2] = pixels.data[from + 2];
        }
      }
    }
    this.square = portalFloorSquare(floorPicture.width, source.mapSpan);
    const holeSize = { width: Math.round(shape.hole.rx * 2), height: Math.round(shape.hole.ry * 2) };
    const cut = cutPortalFloor(condensedFloor(floorPixels, this.square, holeSize), shape);
    return new ImageData(cut.data, cut.width, cut.height);
  }

  /**
   * The floor has changed under it: a step of cloud has lifted. Wherever it has
   * lifted glints for a moment, so new ground is seen coming out from under the
   * cloud even where it is only a few pixels of the portal.
   */
  public refreshFloor(): void {
    if (!this.source || !this.shape || !this.floorCanvas) {
      return;
    }
    const was = this.floorBase;
    const now = this.condensedFloor(this.source, this.shape);
    if (was && was.data.length === now.data.length) {
      for (let at = 0; at < now.data.length; at += 4) {
        if (now.data[at + 3] !== 0 && (now.data[at] !== was.data[at] || now.data[at + 1] !== was.data[at + 1] || now.data[at + 2] !== was.data[at + 2])) {
          this.glints.set(at, GLINT_MS);
        }
      }
    }
    this.floorBase = now;
    this.drawFloor();
  }

  /** The floor with the mist laid over it where it has drifted to. */
  private drawFloor(): void {
    const base = this.floorBase;
    const canvas = this.floorCanvas;
    if (!base || !canvas) {
      return;
    }
    const mist = this.mistPixels;
    const out = new ImageData(new Uint8ClampedArray(base.data), base.width, base.height);
    if (mist && this.source) {
      const [r, g, b] = this.source.mistInk;
      const shiftX = this.mistStep;
      const shiftY = Math.floor(this.mistStep / 3);
      for (let y = 0; y < base.height; y += 1) {
        const mistY = (((y + shiftY) % mist.height) + mist.height) % mist.height;
        for (let x = 0; x < base.width; x += 1) {
          const at = (y * base.width + x) * 4;
          if (out.data[at + 3] === 0) {
            continue;
          }
          const mistAt = (mistY * mist.width + ((((x + shiftX) % mist.width) + mist.width) % mist.width)) * 4;
          if (mist.data[mistAt + 3] === 0) {
            continue;
          }
          out.data[at] += (r - out.data[at]) * MIST_SHARE;
          out.data[at + 1] += (g - out.data[at + 1]) * MIST_SHARE;
          out.data[at + 2] += (b - out.data[at + 2]) * MIST_SHARE;
        }
      }
    }
    for (const [at, leftMs] of this.glints) {
      const share = (leftMs / GLINT_MS) * GLINT_SHARE;
      out.data[at] += (GLINT_INK[0] - out.data[at]) * share;
      out.data[at + 1] += (GLINT_INK[1] - out.data[at + 1]) * share;
      out.data[at + 2] += (GLINT_INK[2] - out.data[at + 2]) * share;
    }
    canvas.context.putImageData(out, 0, 0);
    canvas.refresh();
  }

  /** The glints fade, a step at a time with the mist. */
  private fadeGlints(stepMs: number): void {
    for (const [at, leftMs] of this.glints) {
      if (leftMs <= stepMs) {
        this.glints.delete(at);
      } else {
        this.glints.set(at, leftMs - stepMs);
      }
    }
  }

  /** The cloud in the portal drifts, a pixel a step, as the pit's does. */
  private drift(deltaMs: number): void {
    this.mistMs += deltaMs;
    if (this.mistMs < MIST_STEP_MS) {
      return;
    }
    this.mistMs %= MIST_STEP_MS;
    this.mistStep += 1;
    this.fadeGlints(MIST_STEP_MS);
    this.drawFloor();
  }

  private standFigures(opening: PortalOpening): void {
    this.player?.destroy();
    this.partner?.destroy();
    this.player = this.scene.add
      .image(0, 0, opening.playerTexture, getIdleFrame(opening.facing))
      .setOrigin(0.5, 1)
      .setScrollFactor(0)
      .setDepth(FIGURE_DEPTH);
    this.partner = opening.partnerTexture
      ? this.scene.add.image(0, 0, opening.partnerTexture, partnerFrame(opening.facing, 0)).setOrigin(0.5, 1).setScrollFactor(0).setDepth(FIGURE_DEPTH - 0.001)
      : null;
  }

  // --- each frame ---------------------------------------------------------------

  /** Where the look mark is on the portal's picture: on the way in chosen, or on its way there. */
  private lookAt(): PortalPoint | null {
    const aimed = this.lights.find((light) => light.id === this.aimedId);
    if (!aimed) {
      return null;
    }
    return this.aimFrom && this.aimMs < AIM_HOP_MS ? aimHopAt(this.aimMs, this.aimFrom, aimed.at) : aimed.at;
  }

  private frame(): void {
    const shape = this.shape;
    const opening = this.opening;
    if (!shape || !opening || !this.ring || !this.floor) {
      return;
    }
    const pose = this.phase === 'closing' ? portalOpenPose(this.phaseMs, true) : this.phase === 'opening' ? portalOpenPose(this.phaseMs) : { drawn: 1, shown: 1, dim: PORTAL_DIM };
    const diving = this.phase === 'diving';
    const scales = diving ? portalDiveScales(this.dive.zoom) : { ring: 1, floor: 1 };
    // What the view is centred on, on the portal's picture, and where on the screen that stands.
    const aimed = this.lights.find((light) => light.id === this.aimedId)?.at ?? { x: shape.hole.x, y: shape.hole.y };
    const focus = diving
      ? { x: shape.hole.x + (aimed.x - shape.hole.x) * this.dive.swing, y: shape.hole.y + (aimed.y - shape.hole.y) * this.dive.swing }
      : { x: shape.hole.x, y: shape.hole.y };
    const { width, height } = this.scene.scale;
    const settled = { x: this.place.x + focus.x, y: this.place.y + focus.y };
    const onScreen = diving
      ? { x: settled.x + (width / 2 - settled.x) * this.dive.swing, y: settled.y + (height / 2 - settled.y) * this.dive.swing }
      : settled;
    // Drawing back: from the pit as the rail sees it to the portal's own size and place.
    const from = opening.pitOnScreen;
    const grown = from.rx / shape.hole.rx;
    const scale = 1 + (grown - 1) * (1 - pose.drawn);
    const centre = { x: from.x + (onScreen.x - from.x) * pose.drawn, y: from.y + (onScreen.y - from.y) * pose.drawn };
    const put = (image: Phaser.GameObjects.Image, zoom: number): void => {
      image
        .setScale(zoom)
        .setPosition(Math.round(centre.x - focus.x * zoom), Math.round(centre.y - focus.y * zoom))
        .setAlpha(pose.shown)
        .setVisible(true);
    };
    put(this.ring, scale * scales.ring);
    put(this.floor, scale * scales.floor);
    // Going down, the hall goes the rest of the way dark as the steps rush past.
    this.dim.setAlpha(diving ? PORTAL_DIM + (1 - PORTAL_DIM) * Math.min(1, (this.dive.zoom - 1) * 2) : pose.dim);
    const settledNow = pose.drawn >= 1 && this.phase !== 'closing';
    // The lights, and the mark on the one chosen, ride on the floor.
    const floorPoint = (at: PortalPoint): PortalPoint => ({
      x: Math.round(centre.x + (at.x - focus.x) * scale * scales.floor),
      y: Math.round(centre.y + (at.y - focus.y) * scale * scales.floor),
    });
    // The way in chosen keeps its light, and the mark round it breathes in and out a pixel.
    const beat = !this.still && Math.floor(this.lightMs / LIGHT_BEAT_MS) % 2 === 1;
    for (const light of this.lights) {
      const at = floorPoint(light.at);
      light.image.setPosition(at.x, at.y).setAlpha(pose.shown).setVisible(!diving);
    }
    const look = this.lookAt();
    const lookOn = look && !diving && this.look;
    if (this.look) {
      this.look.setVisible(Boolean(lookOn)).setAlpha(pose.shown);
      if (look) {
        const at = floorPoint(look);
        this.look.setPosition(at.x, at.y).setScale(beat && settledNow ? 17 / 15 : 1);
      }
    }
    // Its name over it, once it has come to rest there.
    const plateWidth = (this.plate.getData('width') as number | undefined) ?? 0;
    const plateShown = Boolean(lookOn) && settledNow && !this.going && this.aimMs >= AIM_HOP_MS && this.plateName !== '';
    this.plate.setVisible(plateShown);
    this.plateText.setVisible(plateShown);
    if (plateShown && look) {
      const at = floorPoint(look);
      const region = opening.region;
      const clampX = (left: number): number => Math.max(region.left + 1, Math.min(region.left + region.width - plateWidth - 1, Math.round(left)));
      const above = at.y - 8 - PLATE_GAP - PLATE_HEIGHT;
      const below = at.y + 8 + PLATE_GAP;
      const covers = (left: number, top: number): boolean =>
        this.lights.some((light) => {
          if (light.id === this.aimedId) return false;
          const other = floorPoint(light.at);
          return other.x + 3 >= left && other.x - 3 <= left + plateWidth && other.y + 3 >= top && other.y - 3 <= top + PLATE_HEIGHT;
        });
      // Over its light, centred, unless that is off the top or over another way
      // in's light: then under it, then slid to one side, above and then below.
      const tops = above >= region.top + 1 ? [above, below] : [below];
      const lefts = [at.x - plateWidth / 2, at.x - 6, at.x - plateWidth + 6];
      const places = lefts.flatMap((left) => tops.map((top) => ({ x: clampX(left), y: top })));
      const { x, y } = places.find((place) => !covers(place.x, place.y)) ?? places[0];
      this.plate.setPosition(x, y);
      this.plateText.setPosition(x + 4, y + 1);
    }
    // The player stood on the edge, and their partner beside them; over the edge on a jump.
    const figuresShown = this.phase === 'closing' ? 0 : pose.drawn >= 0.7 ? pose.shown * Math.min(1, (pose.drawn - 0.7) / 0.3) : 0;
    const stance = { x: Math.round(centre.x + (this.stance.x - focus.x) * scale), y: Math.round(centre.y + (this.stance.y - focus.y) * scale) };
    const hop = portalHopAt(this.hop, this.stance, { x: shape.hole.x, y: shape.hole.y });
    this.player?.setPosition(stance.x + hop.x, stance.y + 4 + hop.y).setAlpha(diving ? 1 : figuresShown);
    const side = this.stance.x <= shape.rim.x ? 1 : -1;
    const partnerHop = portalHopAt(this.partnerHop, this.stance, { x: shape.hole.x, y: shape.hole.y });
    this.partner?.setPosition(stance.x + side * 14 + partnerHop.x, stance.y + 6 + partnerHop.y).setAlpha(diving ? 1 : figuresShown);
  }
}
