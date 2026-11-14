import type Phaser from 'phaser';
import { CANOPY_BAND, CAPTION_BAND } from '../world/depths';
import type { BaseProp } from './fixtures';
import type { FloatingBoats } from './floatingBoats';
import { BASE_TILESET } from './baseTileset';
import { beamAngle, harbourWash, lightsAreOn, type HarbourWash } from './harbourLight';
import { findPortholes, findWindows, isPane, type PixelBox } from './litWindows';

/**
 * THE HARBOUR after dark, by the player's own clock (`harbourLight.ts`).
 *
 * The rule the owner set for it is that names and figures stay clear at
 * night, so the wash is laid *under* the captions and the figures and over
 * everything else: the ground, the buildings, the boats. The tree crowns
 * above the figures are tinted to match rather than washed. Over the wash,
 * when the lights are on: every window FireRed drew in glass glows
 * (`litWindows.ts`), the ships' portholes are lit and ride the swell with
 * them, and - once Brock has built the beacon - the harbour light sweeps the
 * bay.
 */

/** Under the captions, over the map art. */
export const WASH_DEPTH = CAPTION_BAND - 0.05;
const LIGHTS_DEPTH = WASH_DEPTH + 0.01;
const LAMP = 0xf8d870;
const LAMP_GLOW = 0xffc860;
/** How far the beacon's beam reaches, in pixels. */
const BEAM_REACH = 230;
/** Half the beam's width, in radians. */
const BEAM_HALF_WIDTH = 0.11;

/** One 16x16 tile's art: where it is on its sheet and where it goes. */
interface Piece {
  readonly source: CanvasImageSource;
  readonly sx: number;
  readonly sy: number;
  readonly dx: number;
  readonly dy: number;
  readonly flipX: boolean;
}

/** Draws pieces of art onto a canvas the size given, and reads its pixels back. */
function pixelsOf(pieces: readonly Piece[], width: number, height: number): Uint8ClampedArray {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return new Uint8ClampedArray(width * height * 4);
  context.imageSmoothingEnabled = false;
  for (const piece of pieces) {
    context.save();
    if (piece.flipX) {
      context.translate(piece.dx + 16, piece.dy);
      context.scale(-1, 1);
      context.drawImage(piece.source, piece.sx, piece.sy, 16, 16, 0, 0, 16, 16);
    } else {
      context.drawImage(piece.source, piece.sx, piece.sy, 16, 16, piece.dx, piece.dy, 16, 16);
    }
    context.restore();
  }
  return context.getImageData(0, 0, width, height).data;
}

/** Paints a lit window - its panes, and a soft glow round it - onto `graphics`, offset by `ox, oy`. */
function paintWindow(
  graphics: Phaser.GameObjects.Graphics,
  pixels: Uint8ClampedArray,
  width: number,
  box: PixelBox,
  ox: number,
  oy: number,
  panesOnly: boolean,
): void {
  graphics.fillStyle(LAMP_GLOW, 0.16);
  graphics.fillRect(ox + box.x - 2, oy + box.y - 2, box.width + 4, box.height + 4);
  graphics.fillStyle(LAMP, 1);
  for (let y = box.y; y < box.y + box.height; y += 1) {
    for (let x = box.x; x < box.x + box.width; x += 1) {
      const i = (y * width + x) * 4;
      if (pixels[i + 3] === 0) continue;
      if (panesOnly && !isPane(pixels[i], pixels[i + 1], pixels[i + 2])) continue;
      graphics.fillRect(ox + x, oy + y, 1, 1);
    }
  }
}

export interface HarbourNightOptions {
  readonly now: Date;
  readonly map: Phaser.Tilemaps.Tilemap;
  /** The buildings whose windows light, by what is planted. */
  readonly buildings: readonly (readonly BaseProp[])[];
  readonly boats: FloatingBoats | null;
  /** Where the tree crowns are drawn over the figures, in pixels: whole tiles of leaves. */
  readonly crowns: readonly PixelBox[];
  /**
   * The brim tiles that are a lamp's lantern (`promenadePost`): once the
   * lights are on they are left out of the wash and given a glow, because a
   * lamp that goes dark at dusk is the one thing on a quay that should not.
   */
  readonly lanterns: ReadonlySet<number>;
  /** Where the harbour light's lamp is, in pixels, when the beacon is built. */
  readonly beacon: { readonly x: number; readonly y: number } | null;
}

export class HarbourNight {
  private readonly wash: HarbourWash | null;
  private readonly beam: Phaser.GameObjects.Graphics | null = null;
  private readonly beacon: { readonly x: number; readonly y: number } | null;
  private ms = 0;

  public constructor(scene: Phaser.Scene, options: HarbourNightOptions) {
    this.wash = harbourWash(options.now);
    this.beacon = options.beacon;
    if (!this.wash) {
      return;
    }
    scene.add
      .rectangle(0, 0, scene.scale.width * 4, scene.scale.height * 4, this.wash.colour, this.wash.alpha)
      .setOrigin(0, 0)
      .setScrollFactor(0)
      .setDepth(WASH_DEPTH);
    // The crowns are drawn over the figures, so the wash under the captions
    // never reaches them: they get the same wash again, laid just over each
    // crown's own tile. Nobody can stand under a crown (`crowns.test.ts`), so
    // no figure is ever darkened by it.
    const crowns = scene.add.graphics().setDepth(CANOPY_BAND + 0.001);
    crowns.fillStyle(this.wash.colour, this.wash.alpha);
    for (const crown of options.crowns) {
      crowns.fillRect(crown.x, crown.y, crown.width, crown.height);
    }
    const lit = lightsAreOn(options.now);
    const lanterns = this.washBrims(scene, options, lit);
    if (!lit) {
      return;
    }
    const lights = scene.add.graphics().setDepth(LIGHTS_DEPTH);
    // A pool of lamplight on the ground under each lantern, and a halo round it.
    for (const lantern of lanterns) {
      lights.fillStyle(LAMP_GLOW, 0.1);
      lights.fillEllipse(lantern.x + 8, lantern.y + 30, 34, 18);
      lights.fillStyle(LAMP_GLOW, 0.16);
      lights.fillCircle(lantern.x + 8, lantern.y + 7, 9);
    }
    const detail = options.map.getLayer('base-detail')?.tilemapLayer;
    if (detail) {
      for (const props of options.buildings) {
        this.lightBuilding(detail, props, lights);
      }
    }
    options.boats?.pictures().forEach((picture, index) => {
      const rider = scene.add.container(picture.x, picture.y).setDepth(LIGHTS_DEPTH);
      const ship = scene.add.graphics();
      rider.add(ship);
      this.lightBoat(picture, ship);
      options.boats?.carry(index, rider);
    });
    if (this.beacon) {
      this.beam = scene.add.graphics().setDepth(LIGHTS_DEPTH + 0.001);
      this.drawBeam();
    }
  }

  public update(deltaMs: number): void {
    if (!this.beam) return;
    this.ms += deltaMs;
    this.drawBeam();
  }

  /**
   * The wash over everything drawn above the figures that is not a whole tile
   * of leaves: the top of a tree's crown, a lamp's head, a stall's awning, a
   * net on its rack (`PropDefinition.brim`). Each is washed through its own
   * art - a copy of the tile filled with the wash's colour - so only what is
   * drawn is darkened. Washed as a box, a lamp's head stood in a dark square
   * of the quay behind it, and anybody under it went dark with it. Returns
   * where the lanterns are, which are not washed once the lights are on.
   */
  private washBrims(scene: Phaser.Scene, options: HarbourNightOptions, lit: boolean): { x: number; y: number }[] {
    const wash = this.wash;
    const brim = options.map.getLayer('base-brim')?.tilemapLayer;
    const lanterns: { x: number; y: number }[] = [];
    if (!wash || !brim) return lanterns;
    const size = brim.tilemap.tileWidth;
    brim.forEachTile((tile) => {
      if (tile.index < 0 || !tile.tileset) return;
      if (options.lanterns.has(tile.index)) {
        lanterns.push({ x: tile.pixelX, y: tile.pixelY });
        if (lit) return;
      }
      const at = tile.tileset.getTileTextureCoordinates(tile.index) as { x: number; y: number } | null;
      const key = tile.tileset.image?.key;
      if (!at || !key) return;
      const frame = `tile-${tile.index}`;
      const texture = scene.textures.get(key);
      if (!texture.has(frame)) {
        texture.add(frame, 0, at.x, at.y, size, size);
      }
      scene.add
        .image(tile.pixelX, tile.pixelY, key, frame)
        .setOrigin(0, 0)
        .setFlipX(tile.flipX)
        .setTintFill(wash.colour)
        .setAlpha(wash.alpha)
        .setDepth(CANOPY_BAND + 0.001);
    });
    return lanterns;
  }

  private lightBuilding(
    detail: Phaser.Tilemaps.TilemapLayer,
    props: readonly BaseProp[],
    lights: Phaser.GameObjects.Graphics,
  ): void {
    const left = Math.min(...props.map((prop) => prop.x));
    const top = Math.min(...props.map((prop) => prop.y));
    const right = Math.max(...props.map((prop) => prop.x + BASE_TILESET.props[prop.name].width));
    const bottom = Math.max(...props.map((prop) => prop.y + BASE_TILESET.props[prop.name].height));
    const pieces: Piece[] = [];
    for (let y = top; y < bottom; y += 1) {
      for (let x = left; x < right; x += 1) {
        const tile = detail.getTileAt(x, y);
        const at = tile?.tileset?.getTileTextureCoordinates(tile.index) as { x: number; y: number } | null | undefined;
        const source = tile?.tileset?.image?.getSourceImage() as CanvasImageSource | undefined;
        if (!tile || !at || !source) continue;
        pieces.push({ source, sx: at.x, sy: at.y, dx: (x - left) * 16, dy: (y - top) * 16, flipX: tile.flipX });
      }
    }
    const width = (right - left) * 16;
    const height = (bottom - top) * 16;
    const pixels = pixelsOf(pieces, width, height);
    for (const box of findWindows(pixels, width, height)) {
      paintWindow(lights, pixels, width, box, left * 16, top * 16, true);
    }
  }

  private lightBoat(picture: Phaser.GameObjects.Container, lights: Phaser.GameObjects.Graphics): void {
    const pieces: Piece[] = [];
    let width = 0;
    let height = 0;
    for (const child of picture.list) {
      const image = child as Phaser.GameObjects.Image;
      const frame = image.frame;
      pieces.push({
        source: frame.source.image as CanvasImageSource,
        sx: frame.cutX,
        sy: frame.cutY,
        dx: image.x,
        dy: image.y,
        flipX: image.flipX,
      });
      width = Math.max(width, image.x + 16);
      height = Math.max(height, image.y + 16);
    }
    const pixels = pixelsOf(pieces, width, height);
    for (const box of findWindows(pixels, width, height)) {
      paintWindow(lights, pixels, width, box, 0, 0, true);
    }
    for (const box of findPortholes(pixels, width, height)) {
      paintWindow(lights, pixels, width, box, 0, 0, false);
    }
  }

  /** The harbour light's lamp, and its beam swinging out over the bay. */
  private drawBeam(): void {
    const beam = this.beam;
    const lamp = this.beacon;
    if (!beam || !lamp) return;
    beam.clear();
    const angle = beamAngle(this.ms);
    beam.fillStyle(LAMP_GLOW, 0.18);
    beam.fillTriangle(
      lamp.x,
      lamp.y,
      lamp.x + Math.cos(angle - BEAM_HALF_WIDTH) * BEAM_REACH,
      lamp.y + Math.sin(angle - BEAM_HALF_WIDTH) * BEAM_REACH,
      lamp.x + Math.cos(angle + BEAM_HALF_WIDTH) * BEAM_REACH,
      lamp.y + Math.sin(angle + BEAM_HALF_WIDTH) * BEAM_REACH,
    );
    beam.fillStyle(LAMP_GLOW, 0.3);
    beam.fillCircle(lamp.x, lamp.y, 6);
    beam.fillStyle(LAMP, 1);
    beam.fillRect(Math.round(lamp.x) - 1, Math.round(lamp.y) - 1, 3, 3);
  }
}
