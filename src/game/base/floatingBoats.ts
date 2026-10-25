import type Phaser from 'phaser';
import type { BaseProp } from './fixtures';
import { BASE_TILESET } from './baseTileset';

/**
 * The harbour's boats ride the water rather than sit on it.
 *
 * A moored boat is drawn by the map like any landmark (`landmarks.ts`), which
 * is what the collision, the captions and every picture of the map are built
 * from. Once the harbour is on screen its tiles are lifted off the map and
 * drawn again as one picture that bobs a pixel on the swell, each boat on a
 * swell of its own (`bobOffset`) - and the Seagallop, when a raid comes home,
 * glides in to its berth (`arrivalOffset`). Nothing about where anybody may
 * walk moves: the hull's tiles stay solid where the map put them.
 *
 * The timing is pure and tested; the class only draws what it says.
 */

/** How long the Seagallop takes to come in to the jetty, home from a raid. */
export const ARRIVAL_MS = 1_400;
/** Where she comes in from: out in the bay, south-west of her berth, in pixels. */
const ARRIVAL_FROM = { x: -72, y: 40 } as const;

/** How far a boat rides up or down on the swell, in whole pixels, at `ms`. */
export function bobOffset(ms: number, periodMs: number): number {
  // `|| 0`: a rounded -0.3 is -0, and a pixel offset has no sign at rest.
  return Math.round(Math.sin((ms / periodMs) * Math.PI * 2)) || 0;
}

/**
 * How far from her berth the Seagallop still is, `ms` into coming home: all
 * the way out at 0, easing in, and moored from `ARRIVAL_MS` on.
 */
export function arrivalOffset(ms: number): { readonly x: number; readonly y: number } {
  const t = Math.min(1, Math.max(0, ms / ARRIVAL_MS));
  const left = (1 - t) ** 3;
  return { x: Math.round(ARRIVAL_FROM.x * left) || 0, y: Math.round(ARRIVAL_FROM.y * left) || 0 };
}

export interface FloatingBoat {
  readonly props: readonly BaseProp[];
  /** How long one rise and fall of the swell takes under it. */
  readonly swellMs: number;
  /** Whether it is the boat a raid comes home on. */
  readonly bringsRaidsHome?: true;
}

interface Afloat {
  readonly boat: FloatingBoat;
  readonly picture: Phaser.GameObjects.Container;
  /** Anything else that rides with it - its lights at night (`harbourNight.ts`). */
  readonly riders: Phaser.GameObjects.Container[];
  readonly x: number;
  readonly y: number;
}

export class FloatingBoats {
  private readonly afloat: Afloat[] = [];
  private ms = 0;
  private arrivingMs: number | null;

  /**
   * Lifts each boat's tiles off `layer` into a picture at `depth`. `arriving`
   * starts the Seagallop out in the bay.
   */
  public constructor(
    scene: Phaser.Scene,
    layer: Phaser.Tilemaps.TilemapLayer,
    boats: readonly FloatingBoat[],
    depth: number,
    arriving: boolean,
  ) {
    this.arrivingMs = arriving ? 0 : null;
    const tileSize = layer.tilemap.tileWidth;
    for (const boat of boats) {
      const left = Math.min(...boat.props.map((prop) => prop.x));
      const top = Math.min(...boat.props.map((prop) => prop.y));
      const picture = scene.add.container(left * tileSize, top * tileSize).setDepth(depth);
      for (const prop of boat.props) {
        const art = BASE_TILESET.props[prop.name];
        for (let row = 0; row < art.height; row += 1) {
          for (let column = 0; column < art.width; column += 1) {
            const tile = layer.getTileAt(prop.x + column, prop.y + row);
            if (!tile || tile.index < 0 || !tile.tileset) continue;
            const sheet = tile.tileset;
            const at = sheet.getTileTextureCoordinates(tile.index) as { x: number; y: number } | null;
            const key = sheet.image?.key;
            if (!at || !key) continue;
            const frame = `tile-${tile.index}`;
            const texture = scene.textures.get(key);
            if (!texture.has(frame)) {
              texture.add(frame, 0, at.x, at.y, tileSize, tileSize);
            }
            picture.add(
              scene.add
                .image((prop.x - left + column) * tileSize, (prop.y - top + row) * tileSize, key, frame)
                .setOrigin(0, 0)
                .setFlipX(tile.flipX),
            );
            layer.removeTileAt(prop.x + column, prop.y + row);
          }
        }
      }
      this.afloat.push({ boat, picture, riders: [], x: picture.x, y: picture.y });
    }
    this.draw();
  }

  /** Each boat's picture, in the order the boats were given. */
  public pictures(): readonly Phaser.GameObjects.Container[] {
    return this.afloat.map((each) => each.picture);
  }

  /** Makes `rider` move with the `index`th boat, wherever the swell takes it. */
  public carry(index: number, rider: Phaser.GameObjects.Container): void {
    this.afloat[index]?.riders.push(rider);
    this.draw();
  }

  public update(deltaMs: number): void {
    this.ms += deltaMs;
    if (this.arrivingMs !== null) {
      this.arrivingMs += deltaMs;
      if (this.arrivingMs >= ARRIVAL_MS) this.arrivingMs = null;
    }
    this.draw();
  }

  private draw(): void {
    for (const { boat, picture, riders, x, y } of this.afloat) {
      const coming = boat.bringsRaidsHome && this.arrivingMs !== null ? arrivalOffset(this.arrivingMs) : { x: 0, y: 0 };
      picture.setPosition(x + coming.x, y + coming.y + bobOffset(this.ms, boat.swellMs));
      riders.forEach((rider) => rider.setPosition(picture.x, picture.y));
    }
  }
}
