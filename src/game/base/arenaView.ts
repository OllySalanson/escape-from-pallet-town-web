import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import type { GridPosition } from '../movement/gridMovement';
import { getWorldMap, worldMapName, type WorldMapId } from '../worldMap';
import type { RestoredGame } from '../save/SaveManager';
import { CANOPY_BAND, TERRAIN_DEPTH } from '../world/depths';
import { districtAt } from '../world/districts';
import { poisForMap } from '../world/pois';
import type { Minimap, PaintedPicture } from '../world/minimap';
import { GAME_FONT } from '../ui/gameFont';
import { CHIP_FONT_SIZE } from '../ui/screenType';
import { drawPixelWindow } from '../ui/pixelWindow';
import {
  ARENA_CENTRE,
  ARENA_TILE,
  ARENA_TORCHES,
  FLOOR_PARALLAX,
  MIST_PARALLAX,
  PIT_MAP_CENTRE,
  PIT_TIERS,
  PODIUM_PARALLAX,
  TIER_PARALLAX,
  WALL_FOOT,
  dithered,
  namePlatePlace,
  parallaxShift,
  pitFrameFor,
  pitLookPoint,
  pitPointOf,
  pitTileAt,
  podiumHole,
  type PitFrame,
} from './arenaHall';
import { windowLight, type WindowLight } from './homeClock';
import { TWINKLE_STEP_MS, isDimmed, townLights, type TownLight } from './pitClock';
import { FLARE_FRAMES, FLARE_HEIGHT, FLARE_WIDTH, RING_OF_FIRE_MS, flareAt } from './ringOfFire';
import { shareTheRim, showsThroughTheHole, type RimLanding, type RimShare } from './arenaRim';
import {
  PIT_FLOOR_SIZE,
  RING_ORIGIN,
  isGroundKnown,
  paintMist,
  paintPitFloor,
  paintPodium,
  paintTier,
} from './arenaPit';

import {
  CROWD_STIRRING,
  PERSON_WIDTH,
  STANDS_ORIGIN,
  nextStir,
  paintCrowdPerson,
  paintStands,
  type CrowdStir,
} from './arenaStands';
import {
  EYES_HEIGHT,
  EYES_MS,
  EYES_WIDTH,
  EYE_LOOKS,
  SHADOW_HEIGHT,
  SHADOW_PARALLAX,
  SHADOW_WIDTH,
  chooseEyeGate,
  eyesAt,
  facesTheViewer,
  gateEyes,
  nextEyesInMs,
  nextShadowInMs,
  paintEyes,
  paintWingShadow,
  shadowAt,
  shadowPassFor,
  type ShadowPass,
} from './pitLife';
import { wallMapPicture } from './wallMap';

/**
 * THE RAID ARENA's pit and its fires, as the scene draws them: everything in
 * the great hall that is not a tile.
 *
 * Under the hall's tile layers, which leave a hole for it, stand the floor (the
 * map a raid would go out to, painted fresh for this save on every visit), the
 * ways in on it, the mist over it, the wall and the steps; each is a picture of
 * its own so it can slide against the rest as the player walks, further the
 * further down it is, which is what makes a picture on a floor read as a long
 * way down. Over them stand the flames.
 */

/** Below the ground layer, deepest first. */
const FLOOR_DEPTH = TERRAIN_DEPTH - 0.9;
const LIFTING_DEPTH = TERRAIN_DEPTH - 0.89;
/** What crosses the floor goes under the marks on it: a way in is never hidden by it. */
const SHADOW_DEPTH = TERRAIN_DEPTH - 0.885;
const TOWN_LIGHT_DEPTH = TERRAIN_DEPTH - 0.884;
const LIGHT_DEPTH = TERRAIN_DEPTH - 0.88;
const LOOK_DEPTH = TERRAIN_DEPTH - 0.87;
const MIST_DEPTH = TERRAIN_DEPTH - 0.85;
const PODIUM_DEPTH = TERRAIN_DEPTH - 0.8;
const EYES_DEPTH = PODIUM_DEPTH + 0.01;
/** Outside the wall, under the hall's own layers wherever the two could meet. */
const STANDS_DEPTH = TERRAIN_DEPTH - 0.1;
const CROWD_DEPTH = TERRAIN_DEPTH - 0.09;
const tierDepth = (tier: number): number => TERRAIN_DEPTH - 0.7 + (PIT_TIERS - tier) * 0.05;
/** Over the steps and under the hall's own floor, so a name in the pit never lies across the platform. */
const NAME_DEPTH = TERRAIN_DEPTH - 0.3;
/**
 * A flame, its halo and the pool of light it throws burn over everything but the
 * screen's own words. A pool has to be over the pillars' upper tiles too, or it
 * lights a pillar's foot and stops in a straight line at the tile above - and it
 * lights whoever walks through it, which a pool of light should.
 */
const POOL_DEPTH = CANOPY_BAND + 0.03;
const HALO_DEPTH = CANOPY_BAND + 0.04;
const FLAME_DEPTH = CANOPY_BAND + 0.05;

const floorTexture = (mapId: string): string => `arena-pit-floor-${mapId}`;
const LIGHT_TEXTURE = 'arena-landing-light';
const LIFTING_TEXTURE = 'arena-lifting-cloud';
const PODIUM_TEXTURE = 'arena-podium';
const MIST_TEXTURE = 'arena-mist';
const FLAME_TEXTURE = 'arena-flame';
const HALO_TEXTURE = 'arena-halo';
const POOL_TEXTURE = 'arena-pool';
const FLARE_TEXTURE = 'arena-flare';
const BLAZE_TEXTURE = 'arena-blaze';
const LOOK_TEXTURE = 'arena-look';
const STANDS_TEXTURE = 'arena-stands';
const CROWD_TEXTURE = 'arena-crowd-person';
const SHADOW_TEXTURE = 'arena-pit-shadow';
const EYES_TEXTURE = 'arena-pit-eyes';
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
/** How much more than its everyday glow a torch throws at each step of a flare. */
const BLAZE_ALPHA = [0, 0.4, 0.7, 1] as const;

/** How often the nearest fire can be heard, and how near it has to be, in pixels. */
const CRACKLE_EVERY_MS = 2600;
const CRACKLE_SPREAD_MS = 4200;
const CRACKLE_REACH = 88;
/** And how often something a long way down in the pit can. */
const DEEP_SOUND_EVERY_MS = 38000;
const DEEP_SOUND_SPREAD_MS = 40000;
/** How soon eyes that could not be seen try again. */
const EYES_NOT_SEEN_RETRY_MS = 4000;

/** What each map's floor texture was last painted from. */
const floorShows = new Map<string, string>();

const NAME_PLATE_HEIGHT = 13;

/** The mist's two sheets: how thick each, and at each hour the colour of the air they catch the light of. */
const MIST_ALPHAS = [0.2, 0.13] as const;
const MIST_TINTS: Readonly<Record<WindowLight, number>> = { day: 0xffffff, dusk: 0xf0c8a0, night: 0x7888b8 };
/** By day the same sheet again, dark, a long way down, as the shadows of cloud on the ground. */
const CLOUD_SHADOW_ALPHA = 0.14;
const CLOUD_SHADOW_TINT = 0x182838;

const TOWN_LIGHT_WARM = 0xf8d070;
const TOWN_LIGHT_PALE = 0xf8e8b8;
const TOWN_LIGHT_GLOW = 0x806030;

/** How a landing's light beats, and how far a light is from the mark round the one being looked at. */
const LIGHT_BEAT_MS = 520;
/**
 * The map as it stood when this page last jumped, which is what a raid's fresh
 * ground is shown lifting out of when the player comes home. Kept for the page
 * and nowhere else: a game reloaded in between simply shows the ground as it is.
 */
let lastSeenBelow: { readonly mapId: string; readonly picture: Minimap } | null = null;

/** A picture in a texture of its own, kept for the next visit: the steps never change. */
export function ensureTexture(scene: Phaser.Scene, key: string, paint: () => PaintedPicture): void {
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

function paintFlameFrames(frames: readonly (readonly string[])[], frameWidth: number, height: number): PaintedPicture {
  const width = frameWidth * frames.length;
  const data = new Uint8ClampedArray(width * height * 4);
  frames.forEach((frame, index) =>
    frame.forEach((row, y) => {
      for (let x = 0; x < frameWidth; x += 1) {
        const ink = FLAME_INKS[row[x]];
        if (!ink) {
          continue;
        }
        const at = (y * width + index * frameWidth + x) * 4;
        data[at] = ink[0];
        data[at + 1] = ink[1];
        data[at + 2] = ink[2];
        data[at + 3] = 255;
      }
    }),
  );
  return { width, height, data };
}

/** How far the floor comes up for how far the hall has gone past, and how far in the view is when the mist has gone. */
const DIVE_FLOOR_REACH = 0.2;
const DIVE_MIST_GONE = 6;

/** A way in, seen from high up: a small steady gold light with a dark ring round it, so it reads on sea, wood and cloud. */
function paintLandingLight(): PaintedPicture {
  const rows = [
    '..kkk..',
    '.kyyyk.',
    'kyywyyk',
    'kywwwyk',
    'kyywyyk',
    '.kyyyk.',
    '..kkk..',
  ];
  const inks: Readonly<Record<string, readonly [number, number, number]>> = {
    k: [16, 16, 24],
    y: [248, 200, 64],
    w: [248, 248, 200],
  };
  const size = rows.length;
  const data = new Uint8ClampedArray(size * size * 4);
  rows.forEach((row, y) => {
    for (let x = 0; x < size; x += 1) {
      const ink = inks[row[x]];
      if (ink) {
        const at = (y * size + x) * 4;
        data[at] = ink[0];
        data[at + 1] = ink[1];
        data[at + 2] = ink[2];
        data[at + 3] = 255;
      }
    }
  });
  return { width: size, height: size, data };
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

/** Where a point stands round the hall, as `ovalPoint` turns. */
const angleInHall = (point: { readonly x: number; readonly y: number }): number =>
  Math.atan2((point.y - ARENA_CENTRE.y) / WALL_FOOT.ry, (point.x - ARENA_CENTRE.x) / WALL_FOOT.rx);

interface Fire {
  readonly angle: number;
  /** What it burns as in a flare, made only for a jump. */
  flare: Phaser.GameObjects.Image | null;
  blaze: Phaser.GameObjects.Image | null;
  readonly flame: Phaser.GameObjects.Image;
  readonly halo: Phaser.GameObjects.Image;
  readonly pool: Phaser.GameObjects.Image;
  /** Each fire has its own time, or the hall flickers as one. */
  clock: number;
  every: number;
  frame: number;
}

export class ArenaView {
  private readonly scene: Phaser.Scene;
  private readonly game: RestoredGame;
  private floor: Phaser.GameObjects.Image;
  private readonly podium: Phaser.GameObjects.Image;
  private readonly tiers: Phaser.GameObjects.Image[] = [];
  private readonly mists: Phaser.GameObjects.TileSprite[] = [];
  private readonly look: Phaser.GameObjects.Image;
  private readonly fires: Fire[] = [];
  private readonly nameFrame: Phaser.GameObjects.Graphics;
  private readonly nameText: Phaser.GameObjects.Text;
  private nameShown = '';
  private lights: { readonly landing: RimLanding; readonly image: Phaser.GameObjects.Image }[] = [];
  private lightMs = 0;
  private picture: Minimap;
  private walkedShare: number;
  private mapIdValue: WorldMapId;
  private frameValue: PitFrame;
  private shareValue: RimShare;
  private aimedId: string | null = null;
  private lastPlayer = { x: 0, y: 0 };
  /** The fire running round the hall from a jump (`ringOfFire.ts`), while it is. */
  private ringOfFire: { elapsedMs: number; readonly from: number } | null = null;
  /** The hour this visit is at: the clock is read when the hall is walked into, as a room's is. */
  private readonly light: WindowLight = windowLight(new Date());
  private readonly townLightLayer: Phaser.GameObjects.Graphics;
  private townLightsHere: readonly TownLight[] = [];
  private twinkleMs = 0;
  private twinkleBeat = 0;
  private cloudShadow: Phaser.GameObjects.TileSprite | null = null;
  /** The few of the crowd who are shifting in their seats just now: dim, and barely at all. */
  private readonly stirring: { readonly image: Phaser.GameObjects.Image; stir: CrowdStir | null; leftMs: number }[] = [];
  /** What lives in the pit (`pitLife.ts`): when each next shows, and whatever is showing. */
  private shadowInMs = nextShadowInMs(Math.random(), true);
  private eyesInMs = nextEyesInMs(Math.random(), true);
  private shadow: { readonly image: Phaser.GameObjects.Image; readonly pass: ShadowPass; elapsedMs: number } | null = null;
  private eyes: { readonly image: Phaser.GameObjects.Image; readonly gate: number; elapsedMs: number } | null = null;
  private drift = 0;
  private crackleInMs = CRACKLE_EVERY_MS;
  private deepSoundInMs = DEEP_SOUND_EVERY_MS / 2;
  /** The old cloud over ground a raid has just walked, a little less of it each step (`liftFogFrom`). */
  private lifting: {
    readonly image: Phaser.GameObjects.Image;
    readonly texture: Phaser.Textures.CanvasTexture;
    readonly pixels: ImageData;
    readonly left: number;
    readonly top: number;
    step: number;
  } | null = null;

  private readonly still: boolean;

  public constructor(scene: Phaser.Scene, game: RestoredGame, still: boolean, mapId: WorldMapId, landings: readonly RimLanding[]) {
    this.scene = scene;
    this.game = game;
    this.still = still;
    this.mapIdValue = mapId;
    this.picture = wallMapPicture(game, mapId);
    this.frameValue = pitFrameFor(this.picture.width, this.picture.height);
    this.walkedShare = this.shareWalked();
    this.shareValue = shareTheRim(landings, this.frameValue);
    this.floor = scene.add.image(0, 0, this.paintFloorFor(mapId, this.picture)).setOrigin(0, 0).setDepth(FLOOR_DEPTH);

    ensureTexture(scene, MIST_TEXTURE, () => paintMist());
    const hole = podiumHole();
    const mistWidth = Math.ceil(hole.rx * 2) + 96;
    const mistHeight = Math.ceil(hole.ry * 2) + 96;
    for (const [index, flipped] of [false, true].entries()) {
      const mist = scene.add
        .tileSprite(0, 0, mistWidth, mistHeight, MIST_TEXTURE)
        .setOrigin(0.5, 0.5)
        .setDepth(MIST_DEPTH)
        .setAlpha(MIST_ALPHAS[index])
        .setTint(MIST_TINTS[this.light])
        .setFlipX(flipped);
      this.mists.push((mist));
    }
    if (this.light === 'day') {
      this.cloudShadow = scene.add
        .tileSprite(0, 0, mistWidth, mistHeight, MIST_TEXTURE)
        .setOrigin(0.5, 0.5)
        .setDepth(SHADOW_DEPTH - 0.001)
        .setAlpha(CLOUD_SHADOW_ALPHA)
        .setTint(CLOUD_SHADOW_TINT);
    }
    this.townLightLayer = scene.add.graphics().setDepth(TOWN_LIGHT_DEPTH);
    this.placeTownLights();

    ensureTexture(scene, PODIUM_TEXTURE, paintPodium);
    this.podium = (scene.add.image(0, 0, PODIUM_TEXTURE).setOrigin(0, 0).setDepth(PODIUM_DEPTH));
    for (let tier = 0; tier < PIT_TIERS; tier += 1) {
      ensureTexture(scene, tierTexture(tier), () => paintTier(tier));
      this.tiers.push(
        (scene.add.image(0, 0, tierTexture(tier)).setOrigin(0, 0).setDepth(tierDepth(tier))),
      );
    }

    ensureTexture(scene, STANDS_TEXTURE, paintStands);
    scene.add.image(STANDS_ORIGIN.x, STANDS_ORIGIN.y, STANDS_TEXTURE).setOrigin(0, 0).setDepth(STANDS_DEPTH);
    if (!still) {
      ensureTexture(scene, CROWD_TEXTURE, paintCrowdPerson);
      const people = scene.textures.get(CROWD_TEXTURE);
      if (!people.has('0')) {
        for (let ink = 0; ink * PERSON_WIDTH < people.source[0].width; ink += 1) {
          people.add(String(ink), 0, ink * PERSON_WIDTH, 0, PERSON_WIDTH, people.source[0].height);
        }
      }
      for (let index = 0; index < CROWD_STIRRING; index += 1) {
        this.stirring.push({
          image: scene.add.image(0, 0, CROWD_TEXTURE, '0').setOrigin(0, 0).setDepth(CROWD_DEPTH).setVisible(false),
          stir: null,
          leftMs: Math.random() * 3000,
        });
      }
    }

    ensureTexture(scene, LOOK_TEXTURE, paintLookMark);
    this.look = (scene.add.image(0, 0, LOOK_TEXTURE).setDepth(LOOK_DEPTH).setVisible(false));
    ensureTexture(scene, LIGHT_TEXTURE, paintLandingLight);
    this.placeLights(landings);
    this.nameFrame = scene.add.graphics().setDepth(NAME_DEPTH).setVisible(false);
    this.nameText = scene.add
      .text(0, 0, '', { fontFamily: GAME_FONT, fontSize: CHIP_FONT_SIZE, color: '#f8f7dd' })
      .setDepth(NAME_DEPTH + 0.001)
      .setVisible(false);

    ensureTexture(scene, FLAME_TEXTURE, () => paintFlameFrames(FLAME_FRAMES, FLAME_WIDTH, FLAME_HEIGHT));
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
        angle: angleInHall(torch),
        flare: null,
        blaze: null,
        flame,
        halo,
        pool,
        clock: (index * 37) % FLAME_STEP_MS,
        every: FLAME_STEP_MS + (index * 13) % 40,
        frame: index % FLAME_FRAMES.length,
      });
    });
  }

  /** The map at the bottom of the pit. */
  public get mapId(): WorldMapId {
    return this.mapIdValue;
  }

  public get frame(): PitFrame {
    return this.frameValue;
  }

  /** How the rim is shared out among the ways in on this map (`arenaRim.ts`). */
  public get share(): RimShare {
    return this.shareValue;
  }

  private shareWalked(): number {
    const { knownWalkable, walkable } = this.picture;
    return walkable === 0 ? 0 : knownWalkable / walkable;
  }

  /** The floor's texture for this map, painted again only if what it shows has changed. */
  private paintFloorFor(mapId: string, picture: Minimap): string {
    const key = floorTexture(mapId);
    // The floor is this save's, so it is painted again whenever what it shows
    // has changed - which a trip to the bench and back has not.
    const shows = this.light + picture.rows.join('');
    if (floorShows.get(mapId) !== shows && this.scene.textures.exists(key)) {
      this.scene.textures.remove(key);
    }
    floorShows.set(mapId, shows);
    ensureTexture(this.scene, key, () => paintPitFloor(picture, this.light));
    return key;
  }

  /**
   * Puts another map at the bottom of the pit: a way in on a player's map has
   * come under the cursor. The vale's floor is kept, so coming back to it is
   * immediate, and a map's own floor is painted only the first time it is asked.
   */
  public showMap(mapId: WorldMapId, landings: readonly RimLanding[]): void {
    if (mapId === this.mapIdValue) {
      return;
    }
    this.mapIdValue = mapId;
    this.picture = wallMapPicture(this.game, mapId);
    this.frameValue = pitFrameFor(this.picture.width, this.picture.height);
    this.walkedShare = this.shareWalked();
    this.shareValue = shareTheRim(landings, this.frameValue);
    this.floor.setTexture(this.paintFloorFor(mapId, this.picture));
    this.placeLights(landings);
    this.placeTownLights();
    this.aimedId = null;
  }

  /** The little lights at the doors of the towns, on ground this save has walked. */
  private placeTownLights(): void {
    const map = getWorldMap(this.mapIdValue);
    const doors = (map.warps ?? []).map((warp) => warp.source);
    const pois = poisForMap(this.mapIdValue).map((poi) => poi.position);
    this.townLightsHere = townLights(this.picture, [...doors, ...pois], isGroundKnown, PIT_FLOOR_SIZE, this.light);
    this.drawTownLights();
  }

  private drawTownLights(): void {
    const layer = this.townLightLayer;
    layer.clear();
    this.townLightsHere.forEach((light, index) => {
      if (isDimmed(index, this.twinkleBeat)) {
        layer.fillStyle(TOWN_LIGHT_GLOW, 1).fillRect(light.x, light.y, 1, 1);
        return;
      }
      layer.fillStyle(TOWN_LIGHT_GLOW, 1);
      layer.fillRect(light.x - 1, light.y, 3, 1);
      layer.fillRect(light.x, light.y - 1, 1, 3);
      layer.fillStyle(light.warm ? TOWN_LIGHT_WARM : TOWN_LIGHT_PALE, 1).fillRect(light.x, light.y, 1, 1);
    });
  }

  private twinkle(deltaMs: number): void {
    if (this.townLightsHere.length === 0) {
      return;
    }
    this.twinkleMs += deltaMs;
    if (this.twinkleMs >= TWINKLE_STEP_MS) {
      this.twinkleMs = 0;
      this.twinkleBeat += 1;
      this.drawTownLights();
    }
  }

  private placeLights(landings: readonly RimLanding[]): void {
    this.lights.forEach((light) => light.image.destroy());
    this.lights = landings.map((landing) => ({
      landing,
      image: this.scene.add.image(0, 0, LIGHT_TEXTURE).setDepth(LIGHT_DEPTH),
    }));
  }

  /** A frame of the hall, for somebody standing at `player` (their figure's middle, in hall pixels). */
  public update(deltaMs: number, player: { readonly x: number; readonly y: number }): void {
    this.lastPlayer = player;
    this.slide(player);
    this.placeTheLights(deltaMs, player);
    if (this.still) {
      return;
    }
    this.drift += deltaMs;
    const [slow, fast] = this.mists;
    slow.setTilePosition(Math.round(this.drift / 170), Math.round(this.drift / 420));
    fast.setTilePosition(-Math.round(this.drift / 95), Math.round(this.drift / 300));
    this.burn(deltaMs);
    this.listen(deltaMs, player);
    this.cloudShadow?.setTilePosition(Math.round(this.drift / 120), Math.round(this.drift / 260));
    this.twinkle(deltaMs);
    this.stir(deltaMs, player);
    this.shift(deltaMs);
  }

  /** One or two of the crowd lean over or sit up, and settle back. That is all they do. */
  private shift(deltaMs: number): void {
    const view = this.scene.cameras.main.worldView;
    for (const person of this.stirring) {
      person.leftMs -= deltaMs;
      if (person.leftMs > 0) {
        continue;
      }
      if (person.stir) {
        person.stir = null;
        person.image.setVisible(false);
        person.leftMs = 1500 + Math.random() * 6000;
        continue;
      }
      const stir = nextStir([Math.random(), Math.random(), Math.random()], (seat) => view.contains(seat.x, seat.y));
      if (!stir) {
        person.leftMs = 1000;
        continue;
      }
      person.stir = stir;
      person.leftMs = stir.forMs;
      person.image.setFrame(String(stir.seat.ink)).setPosition(stir.seat.x + stir.dx, stir.seat.y + stir.dy).setVisible(true);
    }
  }

  /** Now and then, something in the pit: nobody is told, and it never happens twice at once. */
  private stir(deltaMs: number, player: { readonly x: number; readonly y: number }): void {
    this.shadowInMs -= deltaMs;
    this.eyesInMs -= deltaMs;
    const view = this.scene.cameras.main.worldView;
    if (this.shadowInMs <= 0 && !this.shadow && !this.eyes) {
      this.startShadow(view);
    }
    if (this.eyesInMs <= 0 && !this.shadow && !this.eyes) {
      this.startEyes(view, player);
    }
    if (this.shadow) {
      this.shadow.elapsedMs += deltaMs;
      const at = shadowAt(this.shadow.pass, this.shadow.elapsedMs);
      if (at) {
        const shift = parallaxShift(SHADOW_PARALLAX, player);
        this.shadow.image.setPosition(at.x + shift.x, at.y + shift.y).setFrame(String(at.frame));
      } else {
        this.shadow.image.destroy();
        this.shadow = null;
      }
    }
    if (this.eyes) {
      this.eyes.elapsedMs += deltaMs;
      const at = eyesAt(this.eyes.elapsedMs);
      if (at) {
        const rest = gateEyes(this.eyes.gate);
        const shift = parallaxShift(PODIUM_PARALLAX, player);
        this.eyes.image
          .setPosition(rest.x + shift.x + at.shift, rest.y + shift.y)
          .setFrame(at.look);
      } else {
        this.eyes.image.destroy();
        this.eyes = null;
      }
    }
  }

  private startShadow(view: Phaser.Geom.Rectangle): void {
    ensureTexture(this.scene, SHADOW_TEXTURE, paintWingShadow);
    const sheet = this.scene.textures.get(SHADOW_TEXTURE);
    if (!sheet.has('0')) {
      [0, 1, 2].forEach((frame) => sheet.add(String(frame), 0, frame * SHADOW_WIDTH, 0, SHADOW_WIDTH, SHADOW_HEIGHT));
    }
    // Across the part of the hole on the screen, or a thing this rare is wasted.
    const hole = podiumHole();
    const seenTop = Math.max(view.top, hole.y - hole.ry);
    const seenBottom = Math.min(view.bottom, hole.y + hole.ry);
    const slid = parallaxShift(SHADOW_PARALLAX, this.lastPlayer);
    const pass = shadowPassFor((seenTop + seenBottom) / 2 - slid.y, Math.random() < 0.5);
    this.shadow = {
      image: this.scene.add.image(0, 0, SHADOW_TEXTURE, '0').setDepth(SHADOW_DEPTH).setFlipX(!pass.east),
      pass,
      elapsedMs: 0,
    };
    this.shadowInMs = nextShadowInMs(Math.random(), false);
  }

  private startEyes(view: Phaser.Geom.Rectangle, player: { readonly x: number; readonly y: number }): void {
    const shift = parallaxShift(PODIUM_PARALLAX, player);
    const gate = chooseEyeGate(
      Math.random(),
      (point) => facesTheViewer(point) && view.contains(point.x + shift.x, point.y + shift.y),
    );
    if (gate === null) {
      // Not from where they are standing: they might walk round in a moment.
      this.eyesInMs = EYES_NOT_SEEN_RETRY_MS;
      return;
    }
    ensureTexture(this.scene, EYES_TEXTURE, paintEyes);
    const sheet = this.scene.textures.get(EYES_TEXTURE);
    if (!sheet.has('open')) {
      EYE_LOOKS.forEach((look, frame) => sheet.add(look, 0, frame * EYES_WIDTH, 0, EYES_WIDTH, EYES_HEIGHT));
    }
    this.eyes = { image: this.scene.add.image(0, 0, EYES_TEXTURE, 'slit').setDepth(EYES_DEPTH), gate, elapsedMs: 0 };
    this.eyesInMs = EYES_MS + nextEyesInMs(Math.random(), false);
  }

  /** Whatever is in the pit is gone: the camera is about to go in, and it was never going to be seen up close. */
  private stillThePit(): void {
    this.shadow?.image.destroy();
    this.shadow = null;
    this.eyes?.image.destroy();
    this.eyes = null;
  }

  /** The hall's fires, which go on burning through everything, a jump included. */
  public burn(deltaMs: number): void {
    this.fires.forEach((fire, index) => {
      fire.clock += deltaMs;
      if (fire.clock < fire.every) {
        return;
      }
      fire.clock -= fire.every;
      // Never the same frame twice in a row, and never in order: a flame licks.
      const next = (fire.frame + 1 + Math.floor(Math.random() * (FLAME_FRAMES.length - 1))) % FLAME_FRAMES.length;
      fire.frame = next;
      fire.flame.setFrame(String(next));
      const strength = 0.7 + Math.random() * 0.3;
      fire.halo.setAlpha(strength);
      fire.pool.setAlpha(strength);
      fire.flare?.setFrame(String((next + index) % FLARE_FRAMES.length));
    });
    this.runTheRingOfFire(deltaMs);
  }

  /**
   * The hall answers a jump: from the place they went over, fire runs round both
   * ways and meets at the far side. Asked for with a jump and never on the way home.
   */
  public sendOff(from: { readonly x: number; readonly y: number }): void {
    ensureTexture(this.scene, FLARE_TEXTURE, () => paintFlameFrames(FLARE_FRAMES, FLARE_WIDTH, FLARE_HEIGHT));
    ensureTexture(this.scene, BLAZE_TEXTURE, () => paintGlow(38, [168, 96, 32]));
    const sheet = this.scene.textures.get(FLARE_TEXTURE);
    if (!sheet.has('0')) {
      FLARE_FRAMES.forEach((_frame, index) => sheet.add(String(index), 0, index * FLARE_WIDTH, 0, FLARE_WIDTH, FLARE_HEIGHT));
    }
    for (const fire of this.fires) {
      fire.flare = this.scene.add
        .image(fire.flame.x, fire.flame.y, FLARE_TEXTURE, '0')
        .setOrigin(0.5, 1)
        .setDepth(FLAME_DEPTH)
        .setVisible(false);
      fire.blaze = this.scene.add
        .image(fire.halo.x, fire.halo.y, BLAZE_TEXTURE)
        .setDepth(HALO_DEPTH)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setVisible(false);
    }
    this.ringOfFire = { elapsedMs: 0, from: angleInHall(from) };
  }

  private runTheRingOfFire(deltaMs: number): void {
    const ring = this.ringOfFire;
    if (!ring) {
      return;
    }
    ring.elapsedMs += deltaMs;
    const over = ring.elapsedMs >= RING_OF_FIRE_MS;
    for (const fire of this.fires) {
      const step = over ? 0 : flareAt(ring.elapsedMs, fire.angle, ring.from);
      fire.flame.setVisible(step < 2);
      fire.flare?.setVisible(step >= 2);
      fire.blaze?.setVisible(step > 0).setAlpha(BLAZE_ALPHA[step]);
    }
    if (over) {
      this.ringOfFire = null;
    }
  }

  /** The lights on the ways in, the mark round the one looked at, and its name on a plate over it. */
  private placeTheLights(deltaMs: number, player: { readonly x: number; readonly y: number }): void {
    this.lightMs += deltaMs;
    const beat = !this.still && Math.floor(this.lightMs / LIGHT_BEAT_MS) % 2 === 1;
    let aimed: { readonly x: number; readonly y: number } | null = null;
    for (const { landing, image } of this.lights) {
      const point = pitPointOf(landing.tile, player, this.frameValue);
      image.setPosition(Math.round(point.x), Math.round(point.y));
      if (landing.id === this.aimedId) {
        aimed = showsThroughTheHole(landing.tile, player, this.frameValue) ? point : null;
        image.setVisible(!beat);
      } else {
        image.setVisible(true);
      }
    }
    this.look.setVisible(aimed !== null);
    if (aimed) {
      this.look.setPosition(Math.round(aimed.x), Math.round(aimed.y));
    }
    const view = this.scene.cameras.main.worldView;
    const plate =
      aimed && this.nameShown !== '' && view.width > 0
        ? namePlatePlace(aimed, { width: this.nameFrame.getData('width') as number, height: NAME_PLATE_HEIGHT }, view)
        : null;
    this.nameFrame.setVisible(plate !== null);
    this.nameText.setVisible(plate !== null);
    if (plate) {
      this.nameFrame.setPosition(plate.x, plate.y);
      this.nameText.setPosition(plate.x + 4, plate.y + 1);
    }
  }

  /** Which way in the mark is on, and what it is called, or nothing. */
  public aimAt(landing: RimLanding | null, name: string): void {
    this.aimedId = landing?.id ?? null;
    if (name === this.nameShown) {
      return;
    }
    this.nameShown = name;
    this.nameText.setText(name);
    const width = Math.ceil(this.nameText.width) + 8;
    this.nameFrame.clear();
    drawPixelWindow(this.nameFrame, { x: 0, y: 0, width, height: NAME_PLATE_HEIGHT }, { fill: 0x0b1220, border: 0xf0c454 });
    this.nameFrame.setData('width', width);
  }

  /** Where a way in lies right now, in hall pixels, for the camera to look at. */
  public pointOfLanding(landing: RimLanding): { readonly x: number; readonly y: number } {
    return pitPointOf(landing.tile, this.lastPlayer, this.frameValue);
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
    // Only what can show through the hole, or the floor would stand out past the
    // hall's wall on whichever side the player has walked it towards.
    const podiumShift = parallaxShift(PODIUM_PARALLAX, player);
    const hole = podiumHole();
    this.floor.setCrop(
      Math.floor(hole.x + podiumShift.x - hole.rx - this.floor.x) - 2,
      Math.floor(hole.y + podiumShift.y - hole.ry - this.floor.y) - 2,
      Math.ceil(hole.rx * 2) + 4,
      Math.ceil(hole.ry * 2) + 4,
    );
    this.townLightLayer.setPosition(this.floor.x, this.floor.y);
    if (this.lifting) {
      this.lifting.image.setPosition(this.floor.x + this.lifting.left, this.floor.y + this.lifting.top);
    }
    const mist = parallaxShift(MIST_PARALLAX, player);
    for (const each of this.mists) {
      each.setPosition(PIT_MAP_CENTRE.x + mist.x, PIT_MAP_CENTRE.y + mist.y);
    }
    this.cloudShadow?.setPosition(this.floor.x + PIT_FLOOR_SIZE / 2, this.floor.y + PIT_FLOOR_SIZE / 2);
    const podium = parallaxShift(PODIUM_PARALLAX, player);
    this.podium.setPosition(RING_ORIGIN.x + podium.x, RING_ORIGIN.y + podium.y);
    this.tiers.forEach((image, tier) => {
      const shift = parallaxShift(TIER_PARALLAX[tier], player);
      image.setPosition(RING_ORIGIN.x + shift.x, RING_ORIGIN.y + shift.y);
    });
  }

  /** What somebody standing on `tile` at the fence is told is under them. */
  public lookLines(tile: GridPosition): readonly string[] {
    const middle = { x: tile.x * ARENA_TILE + 8, y: tile.y * ARENA_TILE + 8 };
    const looked = pitTileAt(pitLookPoint(tile), middle, this.frameValue);
    const known = looked !== null && isGroundKnown(this.picture.rows[looked.y]?.[looked.x]);
    const place = known && looked ? districtAt(this.mapIdValue, looked)?.name : undefined;
    const percent = Math.round(this.walkedShare * 100);
    const name = worldMapName(this.mapIdValue);
    const walked =
      percent === 0
        ? `${name} lies under the cloud. You have walked none of it.`
        : `You have walked ${percent}% of ${name}. The cloud hides the rest.`;
    return [known ? `A long way down: ${place ?? 'open country'}.` : 'A long way down, only cloud.', walked];
  }

  // --- a jump ------------------------------------------------------------------

  /** Writes down what the pit shows now, for the fog a raid lifts to lift out of. */
  public rememberBelow(): void {
    lastSeenBelow = { mapId: this.mapIdValue, picture: this.picture };
    this.stillThePit();
  }

  /**
   * One frame of going down: the camera has gone in by `zoom` on `focus`, and the
   * floor and the mist go in far less than the hall around them, because they are
   * so much further away. What falls and what goes past is `arenaDiveView.ts`.
   */
  public diveFrame(zoom: number, focus: { readonly x: number; readonly y: number }): void {
    const layer = (image: { x: number; y: number; setScale(scale: number): unknown; setPosition(x: number, y: number): unknown }, reach: number, restX: number, restY: number): void => {
      const seen = (1 + (zoom - 1) * reach) / zoom;
      image.setScale(seen);
      image.setPosition(focus.x + (restX - focus.x) * seen, focus.y + (restY - focus.y) * seen);
    };
    const floorShift = parallaxShift(FLOOR_PARALLAX, this.lastPlayer);
    const floorX = PIT_MAP_CENTRE.x - PIT_FLOOR_SIZE / 2 + floorShift.x;
    const floorY = PIT_MAP_CENTRE.y - PIT_FLOOR_SIZE / 2 + floorShift.y;
    layer(this.floor, DIVE_FLOOR_REACH, floorX, floorY);
    layer(this.townLightLayer, DIVE_FLOOR_REACH, floorX, floorY);
    this.cloudShadow?.setVisible(false);
    const mistShift = parallaxShift(MIST_PARALLAX, this.lastPlayer);
    for (const mist of this.mists) {
      layer(mist, 0.75, PIT_MAP_CENTRE.x + mistShift.x, PIT_MAP_CENTRE.y + mistShift.y);
    }
    // The mist goes first: magnified, its dither is a board of squares.
    const thin = 1 - Math.min(1, (Math.log(zoom) / Math.log(DIVE_MIST_GONE)) * 4);
    this.mists.forEach((mist, index) => mist.setAlpha(MIST_ALPHAS[index] * (Math.ceil(thin * 4) / 4)));
    this.look.setVisible(false);
    this.nameFrame.setVisible(false);
    this.nameText.setVisible(false);
    for (const { image } of this.lights) {
      image.setVisible(false);
    }
  }

  // --- home again ----------------------------------------------------------------

  /**
   * Home from a raid: if it walked any ground that was under cloud when it left,
   * lays the old cloud back over that ground and starts taking it away. Hands
   * back the middle of what is lifting, as a tile of the map, or null when there
   * was nothing new - or nothing to compare with, after a reload.
   */
  public liftFogFromLastRaid(): { readonly tile: GridPosition; readonly gained: number } | null {
    const before = lastSeenBelow;
    lastSeenBelow = null;
    if (!before || before.mapId !== this.mapIdValue || this.still) {
      return null;
    }
    const size = PIT_FLOOR_SIZE;
    const { scale } = this.frameValue;
    const offsetX = (size - this.frameValue.width * scale) / 2;
    const offsetY = (size - this.frameValue.height * scale) / 2;
    let left = Infinity;
    let top = Infinity;
    let right = -1;
    let bottom = -1;
    this.picture.rows.forEach((row, y) => {
      const old = before.picture.rows[y] ?? '';
      for (let x = 0; x < row.length; x += 1) {
        if (isGroundKnown(row[x]) && !isGroundKnown(old[x])) {
          left = Math.min(left, x);
          top = Math.min(top, y);
          right = Math.max(right, x);
          bottom = Math.max(bottom, y);
        }
      }
    });
    if (right < 0) {
      return null;
    }
    // Round what changed, by the width of the dither the known ground's edge is
    // drawn with, so nothing at the edge of it pops.
    const margin = 6;
    const boxLeft = Math.max(0, Math.floor(offsetX + left * scale) - margin);
    const boxTop = Math.max(0, Math.floor(offsetY + top * scale) - margin);
    const boxRight = Math.min(size, Math.ceil(offsetX + (right + 1) * scale) + margin);
    const boxBottom = Math.min(size, Math.ceil(offsetY + (bottom + 1) * scale) + margin);
    const width = boxRight - boxLeft;
    const height = boxBottom - boxTop;
    const old = paintPitFloor(before.picture, this.light);
    const fresh = paintPitFloor(this.picture, this.light);
    const texture = this.scene.textures.createCanvas(LIFTING_TEXTURE, width, height);
    if (!texture) {
      return null;
    }
    const pixels = new ImageData(width, height);
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const from = ((y + boxTop) * size + x + boxLeft) * 4;
        // Only where the two pictures differ: the rest of the box is the floor already.
        if (
          old.data[from] !== fresh.data[from] ||
          old.data[from + 1] !== fresh.data[from + 1] ||
          old.data[from + 2] !== fresh.data[from + 2]
        ) {
          const to = (y * width + x) * 4;
          pixels.data[to] = old.data[from];
          pixels.data[to + 1] = old.data[from + 1];
          pixels.data[to + 2] = old.data[from + 2];
          pixels.data[to + 3] = 255;
        }
      }
    }
    texture.context.putImageData(pixels, 0, 0);
    texture.refresh();
    const image = this.scene.add.image(0, 0, LIFTING_TEXTURE).setOrigin(0, 0).setDepth(LIFTING_DEPTH);
    this.lifting = { image, texture, pixels, left: boxLeft, top: boxTop, step: 0 };
    return {
      tile: { x: Math.round((left + right) / 2), y: Math.round((top + bottom) / 2) },
      gained: Math.round(this.walkedShare * 100) - Math.round(oldShare(before.picture) * 100),
    };
  }

  /** Takes the next step of the old cloud away, on an ordered dither, as the hall's own stone is lit. */
  public thinTheFog(steps: number): void {
    const lifting = this.lifting;
    if (!lifting || lifting.step >= steps) {
      return;
    }
    lifting.step += 1;
    const { pixels } = lifting;
    const stays = 1 - lifting.step / steps;
    for (let y = 0; y < pixels.height; y += 1) {
      for (let x = 0; x < pixels.width; x += 1) {
        const at = (y * pixels.width + x) * 4 + 3;
        if (pixels.data[at] !== 0 && !dithered(stays, x, y)) {
          pixels.data[at] = 0;
        }
      }
    }
    lifting.texture.context.putImageData(pixels, 0, 0);
    lifting.texture.refresh();
    if (lifting.step >= steps) {
      this.endFog();
    }
  }

  /** Done with the old cloud: the floor is the floor. */
  public endFog(): void {
    if (!this.lifting) {
      return;
    }
    this.lifting.image.destroy();
    this.scene.textures.remove(LIFTING_TEXTURE);
    this.lifting = null;
  }

  public destroy(): void {
    this.endFog();
  }
}

/** How much of a map a picture of it says has been walked. */
function oldShare(picture: Minimap): number {
  return picture.walkable === 0 ? 0 : picture.knownWalkable / picture.walkable;
}
