import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import type { GridPosition } from '../movement/gridMovement';
import type { RestoredGame } from '../save/SaveManager';
import { CANOPY_BAND, TERRAIN_DEPTH } from '../world/depths';
import { districtAt } from '../world/districts';
import type { Minimap, PaintedPicture } from '../world/minimap';
import {
  ARENA_TILE,
  ARENA_TORCHES,
  FLOOR_PARALLAX,
  MIST_PARALLAX,
  PIT_MAP_CENTRE,
  PIT_TIERS,
  PODIUM_PARALLAX,
  TIER_PARALLAX,
  parallaxShift,
  pitLookPoint,
  pitTileAt,
  podiumHole,
} from './arenaHall';
import {
  PIT_FLOOR_SIZE,
  RING_ORIGIN,
  isGroundKnown,
  paintMist,
  paintPitFloor,
  paintPodium,
  paintTier,
} from './arenaPit';
import { wallMapPicture } from './wallMap';

/**
 * THE RAID ARENA's pit and its fires, as the scene draws them: everything in
 * the great hall that is not a tile.
 *
 * Under the hall's tile layers, which leave a hole for it, stand the floor (the
 * vale, painted fresh for this save on every visit), the mist over it, the wall
 * and the steps; each is a picture of its own so it can slide against the rest
 * as the player walks, further the further down it is, which is what makes a
 * picture on a floor read as a long way down. Over them stand the flames.
 *
 * Which map is at the bottom is said once, here: the one place a raid is
 * going out to.
 */

const PIT_MAP = 'greystone-vale';

/** Below the ground layer, deepest first. */
const FLOOR_DEPTH = TERRAIN_DEPTH - 0.9;
const MIST_DEPTH = TERRAIN_DEPTH - 0.85;
const PODIUM_DEPTH = TERRAIN_DEPTH - 0.8;
const tierDepth = (tier: number): number => TERRAIN_DEPTH - 0.7 + (PIT_TIERS - tier) * 0.05;
const LOOK_DEPTH = TERRAIN_DEPTH - 0.4;
/**
 * A flame, its halo and the pool of light it throws burn over everything but the
 * screen's own words. A pool has to be over the pillars' upper tiles too, or it
 * lights a pillar's foot and stops in a straight line at the tile above - and it
 * lights whoever walks through it, which a pool of light should.
 */
const POOL_DEPTH = CANOPY_BAND + 0.03;
const HALO_DEPTH = CANOPY_BAND + 0.04;
const FLAME_DEPTH = CANOPY_BAND + 0.05;

const FLOOR_TEXTURE = 'arena-pit-floor';
const PODIUM_TEXTURE = 'arena-podium';
const MIST_TEXTURE = 'arena-mist';
const FLAME_TEXTURE = 'arena-flame';
const HALO_TEXTURE = 'arena-halo';
const POOL_TEXTURE = 'arena-pool';
const LOOK_TEXTURE = 'arena-look';
const tierTexture = (tier: number): string => `arena-tier-${tier}`;

const FLAME_WIDTH = 11;
const FLAME_HEIGHT = 15;
/**
 * A torch's flame, frame by frame, a character to the pixel: red at its edge,
 * then orange, yellow and a white heart. A flame leans and licks rather than
 * pulsing, so no two frames are the same shape.
 */
const FLAME_FRAMES: readonly (readonly string[])[] = [
  [
    '.....r.....',
    '.....ro....',
    '....roo....',
    '....rooo...',
    '...roooor..',
    '...rooyor..',
    '..rooyyoor.',
    '..rooyyyor.',
    '.rooyywyoor',
    '.rooywwyyor',
    '.rooywwwyor',
    '..roywwyor.',
    '..rooyyyor.',
    '...roooor..',
    '....rrrr...',
  ],
  [
    '...........',
    '....r......',
    '....or.....',
    '...roor....',
    '...roor..r.',
    '..roooor.r.',
    '..rooyoor..',
    '.rooyyoor..',
    '.rooyyyoor.',
    '.rooywyyor.',
    '.rooywwyor.',
    '.rooywwyor.',
    '..rooyyyor.',
    '...roooor..',
    '....rrrr...',
  ],
  [
    '......r....',
    '.....ror...',
    '.....oor...',
    '....rooor..',
    '.r..rooor..',
    '.r.roooor..',
    '..rooyyoor.',
    '..rooyyoor.',
    '.rooyyyyor.',
    '.rooywyyor.',
    '.rooywwyoor',
    '.rooywwyor.',
    '..rooyyyor.',
    '...roooor..',
    '....rrrr...',
  ],
  [
    '...........',
    '.....r.....',
    '....ror....',
    '....oor....',
    '...roor....',
    '...rooor...',
    '..roooyor..',
    '..rooyyor..',
    '..rooyyoor.',
    '.rooyywyor.',
    '.rooywwyor.',
    '.rooywwyor.',
    '..rooyyyor.',
    '...roooor..',
    '....rrrr...',
  ],
];

const FLAME_INKS: Readonly<Record<string, readonly [number, number, number]>> = {
  r: [216, 56, 24],
  o: [248, 136, 40],
  y: [248, 208, 72],
  w: [248, 248, 200],
};

const FLAME_STEP_MS = 95;

/** How often the nearest fire can be heard, and how near it has to be, in pixels. */
const CRACKLE_EVERY_MS = 2600;
const CRACKLE_SPREAD_MS = 4200;
const CRACKLE_REACH = 88;
/** And how often something a long way down in the pit can. */
const DEEP_SOUND_EVERY_MS = 38000;
const DEEP_SOUND_SPREAD_MS = 40000;

/** What the floor texture was last painted from. */
let floorShows = '';

/** A picture in a texture of its own, kept for the next visit: the steps never change. */
function ensureTexture(scene: Phaser.Scene, key: string, paint: () => PaintedPicture): void {
  if (scene.textures.exists(key)) {
    return;
  }
  const picture = paint();
  const texture = scene.textures.createCanvas(key, picture.width, picture.height);
  texture?.context.putImageData(new ImageData(picture.data, picture.width, picture.height), 0, 0);
  texture?.refresh();
}

/** A round glow of one colour, its strength stepped in dithered rings, for adding over stone. */
function paintGlow(radius: number, ink: readonly [number, number, number]): PaintedPicture {
  const size = radius * 2;
  const data = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const share = 1 - Math.hypot(x + 0.5 - radius, y + 0.5 - radius) / radius;
      if (share <= 0) {
        continue;
      }
      // Stepped to whole levels with a checker between, as the hall's stone is.
      const level = Math.min(3, Math.floor(share * 4 + ((x + y) % 2 === 0 ? 0.25 : 0)));
      if (level === 0) {
        continue;
      }
      const at = (y * size + x) * 4;
      data[at] = (ink[0] * level) / 3;
      data[at + 1] = (ink[1] * level) / 3;
      data[at + 2] = (ink[2] * level) / 3;
      data[at + 3] = 255;
    }
  }
  return { width: size, height: size, data };
}

function paintFlames(): PaintedPicture {
  const width = FLAME_WIDTH * FLAME_FRAMES.length;
  const height = FLAME_HEIGHT;
  const data = new Uint8ClampedArray(width * height * 4);
  FLAME_FRAMES.forEach((frame, index) =>
    frame.forEach((row, y) => {
      for (let x = 0; x < FLAME_WIDTH; x += 1) {
        const ink = FLAME_INKS[row[x]];
        if (!ink) {
          continue;
        }
        const at = (y * width + index * FLAME_WIDTH + x) * 4;
        data[at] = ink[0];
        data[at + 1] = ink[1];
        data[at + 2] = ink[2];
        data[at + 3] = 255;
      }
    }),
  );
  return { width, height, data };
}

function paintLookMark(): PaintedPicture {
  const size = 15;
  const data = new Uint8ClampedArray(size * size * 4);
  const put = (x: number, y: number, ink: readonly [number, number, number]): void => {
    const at = (y * size + x) * 4;
    data[at] = ink[0];
    data[at + 1] = ink[1];
    data[at + 2] = ink[2];
    data[at + 3] = 255;
  };
  const CREAM = [248, 240, 216] as const;
  const INK = [16, 16, 24] as const;
  // Four corners of a box, ringed in ink so it reads on sea, wood and cloud.
  for (const [cornerX, stepX] of [[1, 1], [size - 2, -1]] as const) {
    for (const [cornerY, stepY] of [[1, 1], [size - 2, -1]] as const) {
      for (let along = -1; along <= 4; along += 1) {
        for (const across of [-1, 1]) {
          put(cornerX + along * stepX, cornerY + across, INK);
          put(cornerX + across, cornerY + along * stepY, INK);
        }
        put(cornerX + along * stepX, cornerY - stepY * 0, INK);
        put(cornerX, cornerY + along * stepY, INK);
      }
    }
  }
  for (const [cornerX, stepX] of [[1, 1], [size - 2, -1]] as const) {
    for (const [cornerY, stepY] of [[1, 1], [size - 2, -1]] as const) {
      for (let along = 0; along <= 3; along += 1) {
        put(cornerX + along * stepX, cornerY, CREAM);
        put(cornerX, cornerY + along * stepY, CREAM);
      }
    }
  }
  return { width: size, height: size, data };
}

interface Fire {
  readonly flame: Phaser.GameObjects.Image;
  readonly halo: Phaser.GameObjects.Image;
  readonly pool: Phaser.GameObjects.Image;
  /** Each fire has its own time, or the hall flickers as one. */
  clock: number;
  every: number;
  frame: number;
}

export class ArenaView {
  private readonly floor: Phaser.GameObjects.Image;
  private readonly podium: Phaser.GameObjects.Image;
  private readonly tiers: Phaser.GameObjects.Image[] = [];
  private readonly mists: Phaser.GameObjects.TileSprite[] = [];
  private readonly look: Phaser.GameObjects.Image;
  private readonly fires: Fire[] = [];
  private readonly picture: Minimap;
  private readonly walkedShare: number;
  private drift = 0;
  private crackleInMs = CRACKLE_EVERY_MS;
  private deepSoundInMs = DEEP_SOUND_EVERY_MS / 2;

  private readonly still: boolean;

  public constructor(scene: Phaser.Scene, game: RestoredGame, still: boolean) {
    this.still = still;
    this.picture = wallMapPicture(game, PIT_MAP);
    const { knownWalkable, walkable } = this.picture;
    this.walkedShare = walkable === 0 ? 0 : knownWalkable / walkable;

    // The floor is this save's, so it is painted again whenever what it shows
    // has changed - which a trip to the loadout and back has not.
    const shows = this.picture.rows.join('');
    if (shows !== floorShows && scene.textures.exists(FLOOR_TEXTURE)) {
      scene.textures.remove(FLOOR_TEXTURE);
    }
    floorShows = shows;
    ensureTexture(scene, FLOOR_TEXTURE, () => paintPitFloor(this.picture));
    this.floor = (scene.add.image(0, 0, FLOOR_TEXTURE).setOrigin(0, 0).setDepth(FLOOR_DEPTH));

    ensureTexture(scene, MIST_TEXTURE, () => paintMist());
    const hole = podiumHole();
    const mistWidth = Math.ceil(hole.rx * 2) + 96;
    const mistHeight = Math.ceil(hole.ry * 2) + 96;
    for (const [alpha, flipped] of [[0.2, false], [0.13, true]] as const) {
      const mist = scene.add
        .tileSprite(0, 0, mistWidth, mistHeight, MIST_TEXTURE)
        .setOrigin(0.5, 0.5)
        .setDepth(MIST_DEPTH)
        .setAlpha(alpha)
        .setFlipX(flipped);
      this.mists.push((mist));
    }

    ensureTexture(scene, PODIUM_TEXTURE, paintPodium);
    this.podium = (scene.add.image(0, 0, PODIUM_TEXTURE).setOrigin(0, 0).setDepth(PODIUM_DEPTH));
    for (let tier = 0; tier < PIT_TIERS; tier += 1) {
      ensureTexture(scene, tierTexture(tier), () => paintTier(tier));
      this.tiers.push(
        (scene.add.image(0, 0, tierTexture(tier)).setOrigin(0, 0).setDepth(tierDepth(tier))),
      );
    }

    ensureTexture(scene, LOOK_TEXTURE, paintLookMark);
    this.look = (scene.add.image(0, 0, LOOK_TEXTURE).setDepth(LOOK_DEPTH).setVisible(false));

    ensureTexture(scene, FLAME_TEXTURE, paintFlames);
    ensureTexture(scene, HALO_TEXTURE, () => paintGlow(24, [96, 56, 16]));
    ensureTexture(scene, POOL_TEXTURE, () => paintGlow(52, [40, 24, 8]));
    const flames = scene.textures.get(FLAME_TEXTURE);
    if (!flames.has('0')) {
      FLAME_FRAMES.forEach((_frame, index) => flames.add(String(index), 0, index * FLAME_WIDTH, 0, FLAME_WIDTH, FLAME_HEIGHT));
    }
    ARENA_TORCHES.forEach((torch, index) => {
      const pool = scene.add
        .image(torch.x, torch.y + 34, POOL_TEXTURE)
        .setDepth(POOL_DEPTH)
        .setBlendMode(Phaser.BlendModes.ADD);
      const halo = scene.add
        .image(torch.x, torch.y - 4, HALO_TEXTURE)
        .setDepth(HALO_DEPTH)
        .setBlendMode(Phaser.BlendModes.ADD);
      const flame = scene.add
        .image(torch.x, torch.y + 2, FLAME_TEXTURE, String(index % FLAME_FRAMES.length))
        .setOrigin(0.5, 1)
        .setDepth(FLAME_DEPTH);
      this.fires.push({
        flame,
        halo,
        pool,
        clock: (index * 37) % FLAME_STEP_MS,
        every: FLAME_STEP_MS + (index * 13) % 40,
        frame: index % FLAME_FRAMES.length,
      });
    });
  }

  /** A frame of the hall, for somebody standing at `player` (their figure's middle, in hall pixels). */
  public update(deltaMs: number, player: { readonly x: number; readonly y: number }): void {
    this.slide(player);
    if (this.still) {
      return;
    }
    this.drift += deltaMs;
    const [slow, fast] = this.mists;
    slow.setTilePosition(Math.round(this.drift / 170), Math.round(this.drift / 420));
    fast.setTilePosition(-Math.round(this.drift / 95), Math.round(this.drift / 300));
    for (const fire of this.fires) {
      fire.clock += deltaMs;
      if (fire.clock < fire.every) {
        continue;
      }
      fire.clock -= fire.every;
      // Never the same frame twice in a row, and never in order: a flame licks.
      const next = (fire.frame + 1 + Math.floor(Math.random() * (FLAME_FRAMES.length - 1))) % FLAME_FRAMES.length;
      fire.frame = next;
      fire.flame.setFrame(String(next));
      const strength = 0.7 + Math.random() * 0.3;
      fire.halo.setAlpha(strength);
      fire.pool.setAlpha(strength);
    }
    this.listen(deltaMs, player);
  }

  /** The torch nearest the player crackles now and then, and something stirs a long way down. */
  private listen(deltaMs: number, player: { readonly x: number; readonly y: number }): void {
    this.crackleInMs -= deltaMs;
    if (this.crackleInMs <= 0) {
      this.crackleInMs = CRACKLE_EVERY_MS + Math.random() * CRACKLE_SPREAD_MS;
      if (ARENA_TORCHES.some((torch) => Math.hypot(torch.x - player.x, torch.y - player.y) < CRACKLE_REACH)) {
        audioManager.play('grassRustle');
      }
    }
    this.deepSoundInMs -= deltaMs;
    if (this.deepSoundInMs <= 0) {
      this.deepSoundInMs = DEEP_SOUND_EVERY_MS + Math.random() * DEEP_SOUND_SPREAD_MS;
      audioManager.play('distantHorn');
    }
  }

  private slide(player: { readonly x: number; readonly y: number }): void {
    const floor = parallaxShift(FLOOR_PARALLAX, player);
    this.floor.setPosition(
      PIT_MAP_CENTRE.x - PIT_FLOOR_SIZE / 2 + floor.x,
      PIT_MAP_CENTRE.y - PIT_FLOOR_SIZE / 2 + floor.y,
    );
    const mist = parallaxShift(MIST_PARALLAX, player);
    for (const each of this.mists) {
      each.setPosition(PIT_MAP_CENTRE.x + mist.x, PIT_MAP_CENTRE.y + mist.y);
    }
    const podium = parallaxShift(PODIUM_PARALLAX, player);
    this.podium.setPosition(RING_ORIGIN.x + podium.x, RING_ORIGIN.y + podium.y);
    this.tiers.forEach((image, tier) => {
      const shift = parallaxShift(TIER_PARALLAX[tier], player);
      image.setPosition(RING_ORIGIN.x + shift.x, RING_ORIGIN.y + shift.y);
    });
  }

  /** Puts the mark on what somebody at the fence is looking at, or takes it away. */
  public lookFrom(tile: GridPosition | null): void {
    if (!tile) {
      this.look.setVisible(false);
      return;
    }
    const point = pitLookPoint(tile);
    this.look.setPosition(point.x, point.y).setVisible(true);
  }

  /** What somebody standing on `tile` and looking over the fence is told they can see. */
  public lookLines(tile: GridPosition): readonly string[] {
    const middle = { x: tile.x * ARENA_TILE + 8, y: tile.y * ARENA_TILE + 8 };
    const looked = pitTileAt(pitLookPoint(tile), middle);
    const known = looked !== null && isGroundKnown(this.picture.rows[looked.y]?.[looked.x]);
    const place = known && looked ? districtAt(PIT_MAP, looked)?.name : undefined;
    const percent = Math.round(this.walkedShare * 100);
    const walked =
      percent === 0
        ? 'GREYSTONE VALE lies under the cloud. You have walked none of it.'
        : `You have walked ${percent}% of GREYSTONE VALE. The cloud hides the rest.`;
    return [known ? `A long way down: ${place ?? 'open country'}.` : 'A long way down, only cloud.', walked];
  }
}
