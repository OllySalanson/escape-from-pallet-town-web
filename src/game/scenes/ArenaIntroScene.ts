import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { getBaseMap, type BaseMapDefinition } from '../base/baseMap';
import { BASE_TILESET } from '../base/baseTileset';
import { PARTNER_SPRITE_Y_OFFSET } from '../base/partnerFigure';
import { partnerFrame, partnerTextureKey, type PartnerSpeciesId } from '../base/partner';
import { loadPlayerName } from '../console/playerName';
import {
  ARENA_INTRO_ARMING_MS,
  arenaIntroCast,
  arenaIntroOffersSkip,
  arenaIntroViewing,
  arenaIntroWords,
  beatStart,
  type ArenaIntroCast,
  type ArenaIntroViewing,
} from '../cutscene/arenaIntro';
import {
  ARENA_INTRO_FOREST_HEIGHT,
  ARENA_INTRO_FOREST_SOURCES,
  ARENA_INTRO_FOREST_WIDTH,
  ESCAPE_ROUTE,
  EXIT_TILE,
  FIND_TILES,
  FIRE_WALL,
  HERO_LANDING,
  HUNTER_CHASE,
  HUNTER_DRIVEN_TO,
  HUNTER_ROUTE,
  PARTNER_STAND_TILE,
  RUSTLE_TILE,
  SNEAK_ROUTE,
  STAND_TILE,
  SWARM_FROM,
  SWARM_RING,
  arenaIntroForest,
  routeTiles,
} from '../cutscene/arenaIntroForest';
import type { Direction, GridPosition } from '../movement/gridMovement';
import { CHARACTER_FEET_PIXEL_Y, CHARACTER_SHEET_COLUMNS, getIdleFrame, getWalkAnimationKey } from '../playerFrames';
import { SaveManager, type RestoredGame } from '../save/SaveManager';
import { DIALOG_FONT_SIZE, CHIP_FONT_SIZE } from '../ui/screenType';
import { GAME_FONT } from '../ui/gameFont';
import { drawPixelWindow } from '../ui/pixelWindow';
import { flashScreen } from '../ui/screenFlash';
import { iconTextureKey, itemIconName, WORLD_ICONS } from '../ui/icons';
import { FIRE_LETTERING, stampedWord } from '../ui/stampedLettering';
import { readLook } from '../look/look';
import { bestPackIn } from '../items/packs';
import { lookTexture, lookWalkKey } from '../look/lookTexture';
import { SHARED_CHARACTER_TEXTURE } from '../world/characterPresentation';
import {
  CHARACTER_DESIGN_SHEET_COLUMNS,
  characterDesignTextureKey,
  getCharacterDesign,
  type CharacterDesignId,
} from '../world/characterDesigns';
import {
  POKEMON_ICON_FRAME_MS,
  POKEMON_ICON_TEXTURE,
  pokemonIconFrames,
  pokemonSoleDrop,
  type FigureSpeciesId,
} from '../world/pokemonFigures';
import type { MapLayers, TileLayer } from '../world/tiles';
import type { TileSource } from '../world/tileset/catalogue';
import type { BaseSceneData } from './BaseScene';

/**
 * THE RAID ARENA's trailer (`cutscene/arenaIntro.ts` is the script): a raid
 * in forty-odd seconds, played in the engine with the game's own art so it is
 * the player's own - their figure, their name, their partner in the fight and
 * the hunter who is after them next, with that hunter's own team - and then
 * the Arena's door and the great hall behind it.
 *
 * It is a film rather than a map, so it borrows the world's parts and none of
 * its rules: the forest and the harbour are laid by the same `buildMapLayers`
 * every map is, figures stand and walk on the same sheets, and nothing here
 * has collision, a clock or a hunter of its own. Two cameras: the world one
 * cuts between sets and pushes in at whole zooms only (a zoom in between
 * would draw some pixels wider than others), and one for everything laid over
 * the picture - the letterbox, the words, the comic panel.
 *
 * Any key or a click ends it at any moment and lands in the hall, which is
 * where the door goes; the key that walked the
 * player into the door is not counted (`ARENA_INTRO_ARMING_MS`).
 */
export interface ArenaIntroSceneData {
  readonly savedGame: RestoredGame;
  /** Where the Arena's door goes: into its great hall. */
  readonly hall: BaseSceneData;
}

const TILE = 16;
const LETTERBOX = 18;
const PERSON_Y = TILE - CHARACTER_FEET_PIXEL_Y;

/** Where each set stands in the world, far enough apart that one camera never sees two. */
const FOREST_ORIGIN = { x: 0, y: 0 };
const ARENA_ORIGIN = { x: 2048, y: 0 };
const BATTLE_ORIGIN = { x: 4096, y: 0 };

/** The arena shot: where the player, the partner and the host stand in the harbour. */
const ARENA_PLAYER: GridPosition = { x: 8, y: 14 };
const ARENA_PARTNER: GridPosition = { x: 9, y: 15 };
const ARENA_HOST: GridPosition = { x: 7, y: 14 };

const DEPTH = {
  ground: 0,
  overlay: 1,
  detail: 2,
  item: 3,
  figure: 10,
  canopy: 30,
  brim: 31,
  night: 40,
  light: 41,
  fx: 50,
  hero: 60,
  ui: 100,
} as const;

const NIGHT_WASH = 0x0a1236;
const ALERT_RED = 0xd03030;

/** The battle backdrop's art, without the border its crop left (as `BattleScene` reads it). */
const BACKDROP_ART = { x: 0, y: 1, width: 255, height: 143 } as const;

/** The stamped words' palettes: the title's gold, an alarm red, and an exit green. */
const GOLD = { fill: ['#fffbe6', '#ffe58a', '#ffd04a', '#f4a933'], rim: '#a84a10', depth: '#5a2008', edge: '#0a1428' };
const MINT = { fill: ['#e8fff4', '#9be8c8'], rim: '#2c5aa0', depth: '#1c3768', edge: '#0a1428' };
const FIRE = FIRE_LETTERING;
const GREEN = { fill: ['#f0fff0', '#a8f080', '#58c840', '#2c9028'], rim: '#185018', depth: '#0c2c0c', edge: '#0a1428' };

interface Walker {
  readonly sprite: Phaser.GameObjects.Sprite;
  readonly kind: 'person' | 'partner';
  /** The key of a person's walk cycle for a facing, or null where the design stands still. */
  readonly walk: ((facing: Direction) => string) | null;
  readonly columns: number;
  readonly species?: PartnerSpeciesId;
  readonly origin: { readonly x: number; readonly y: number };
  tile: GridPosition;
  facing: Direction;
}

const EASES = {
  Linear: (t: number) => t,
  'Quad.In': (t: number) => t * t,
  'Quad.Out': (t: number) => 1 - (1 - t) * (1 - t),
  'Cubic.Out': (t: number) => 1 - (1 - t) ** 3,
  'Sine.InOut': (t: number) => -(Math.cos(Math.PI * t) - 1) / 2,
  'Back.Out': (t: number) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2,
} as const;

interface MotionConfig {
  readonly targets: object;
  readonly duration: number;
  readonly ease?: keyof typeof EASES;
  readonly yoyo?: boolean;
  /** How many times more; -1 is for ever. */
  readonly repeat?: number;
  readonly delay?: number;
  readonly onComplete?: () => void;
  readonly [prop: string]: unknown;
}

interface Motion {
  readonly target: Record<string, number>;
  props: { readonly key: string; readonly from?: number; readonly to: number }[];
  readonly start: number;
  readonly duration: number;
  readonly ease: (t: number) => number;
  readonly yoyo: boolean;
  readonly repeat: number;
  readonly onComplete?: () => void;
  begun: boolean;
  done: boolean;
}

export class ArenaIntroScene extends Phaser.Scene {
  private hall!: BaseSceneData;
  private leaving = false;
  private startedAt = 0;
  private uiCamera!: Phaser.Cameras.Scene2D.Camera;
  private worldObjects: Phaser.GameObjects.GameObject[] = [];
  private uiObjects: Phaser.GameObjects.GameObject[] = [];
  private cast!: ArenaIntroCast;
  private words!: ReturnType<typeof arenaIntroWords>;
  private viewing: ArenaIntroViewing = 'first';
  private textBox: { readonly frame: Phaser.GameObjects.Graphics; readonly text: Phaser.GameObjects.Text } | null = null;
  private typing: Phaser.Time.TimerEvent | null = null;
  private fire!: Phaser.GameObjects.Particles.ParticleEmitter;
  private sparks!: Phaser.GameObjects.Particles.ParticleEmitter;
  private smoke!: Phaser.GameObjects.Particles.ParticleEmitter;

  public constructor() {
    super('arenaIntro');
  }

  public create(data: ArenaIntroSceneData): void {
    this.hall = data.hall;
    this.leaving = false;
    this.worldObjects = [];
    this.uiObjects = [];
    this.textBox = null;
    this.typing = null;
    this.motions = [];
    this.torch = null;
    this.flight = null;
    this.startedAt = this.time.now;

    // The save is told first, so a reload mid-way is not the first time again.
    const unseen = new SaveManager().watchArenaIntro();
    this.viewing = unseen ? arenaIntroViewing(data.savedGame.raidProgress) : 'again';
    this.cast = arenaIntroCast(data.savedGame, loadPlayerName());
    // The player in what they wear, as the harbour draws them (`look/`).
    // On their back, the pack the rack would open on: the reel is of them.
    this.playerTexture = lookTexture(
      this,
      readLook(data.savedGame.raidProgress.look),
      bestPackIn(data.savedGame.stash.listItems()),
    );
    this.words = arenaIntroWords(this.cast);
    void audioManager.loadCries([
      this.cast.partner.dexId,
      this.cast.wild.dexId,
      this.cast.hero.dexId,
      ...this.cast.swarm.map((member) => member.dexId),
    ]);

    this.makeTextures();
    const main = this.cameras.main;
    main.setBackgroundColor('#000000');
    main.setRoundPixels(true);
    this.uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height).setRoundPixels(true);
    this.uiCamera.transparent = true;

    // Three kinds of particle, each a few whole pixels of one colour: fire,
    // the sparks off a hit, and the smoke a fire leaves.
    this.fire = this.world(
      this.add.particles(0, 0, 'arena-intro-fx', {
        frame: ['blaze', 'blaze', 'ember', 'ember', 'flame', 'core'],
        lifespan: { min: 280, max: 640 },
        speed: { min: 20, max: 110 },
        alpha: { start: 1, end: 0 },
        gravityY: -60,
        emitting: false,
      }),
    ).setDepth(DEPTH.fx);
    this.sparks = this.world(
      this.add.particles(0, 0, 'arena-intro-fx', {
        frame: ['spark', 'core', 'flame'],
        lifespan: { min: 160, max: 360 },
        speed: { min: 60, max: 160 },
        alpha: { start: 1, end: 0 },
        emitting: false,
      }),
    ).setDepth(DEPTH.fx);
    this.smoke = this.world(
      this.add.particles(0, 0, 'arena-intro-fx', {
        frame: ['smoke'],
        lifespan: { min: 700, max: 1300 },
        speed: { min: 6, max: 24 },
        alpha: { start: 0.8, end: 0 },
        gravityY: -24,
        emitting: false,
      }),
    ).setDepth(DEPTH.fx - 1);

    this.playScript(data.savedGame);
    this.drawLetterbox();

    const onKey = (event: KeyboardEvent) => this.onKey(event);
    const onPointer = () => this.tryLeave();
    this.input.keyboard?.on('keydown', onKey);
    this.input.on('pointerdown', onPointer);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', onKey);
      this.input.off('pointerdown', onPointer);
    });
  }

  // -- input -----------------------------------------------------------------

  private onKey(event: KeyboardEvent): void {
    // F is the FEEDBACK key on every screen, and a held key is the one that
    // walked the player in.
    if (event.repeat || event.key === 'f' || event.key === 'F') {
      return;
    }
    this.tryLeave();
  }

  private tryLeave(): void {
    if (this.time.now - this.startedAt < ARENA_INTRO_ARMING_MS) {
      return;
    }
    this.leave();
  }

  /** Into the hall, whether the trailer ended or was skipped. */
  public leave(): void {
    if (this.leaving) {
      return;
    }
    this.leaving = true;
    this.time.removeAllEvents();
    audioManager.play('menuOpen');
    const camera = this.cameras.main;
    this.uiCamera.fadeOut(160, 0, 0, 0);
    camera.fadeOut(160, 0, 0, 0);
    camera.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.motions = [];
      this.scene.start('base', this.hall);
    });
  }

  // -- motion --------------------------------------------------------------

  /**
   * Everything that moves, moved on the scene's own clock. Phaser's tweens
   * keep the wall clock, so on a slow frame - or a driver stepping the loop -
   * they drift away from the cues on `this.time`, and a Rattata was still
   * sliding in a second after its line was read. Driven from `this.time.now`,
   * as the world's own cutscenes are, every motion lands on its cue.
   */
  private motions: Motion[] = [];

  /** A tween's config, and the same shape: `{ targets, x: to, alpha: { from, to }, duration, ... }`. */
  private move(config: MotionConfig): void {
    const { targets, duration, ease = 'Linear', yoyo = false, repeat = 0, delay = 0, onComplete, ...props } = config;
    this.motions.push({
      target: targets as unknown as Record<string, number>,
      props: Object.entries(props).map(([key, value]) =>
        typeof value === 'number'
          ? { key, to: value }
          : { key, from: (value as { from: number; to: number }).from, to: (value as { from: number; to: number }).to },
      ),
      start: this.time.now + delay,
      duration: Math.max(1, duration),
      ease: EASES[ease],
      yoyo,
      repeat,
      onComplete,
      begun: false,
      done: false,
    });
  }

  public update(): void {
    const now = this.time.now;
    // The torch is carried: it stands where the player's feet are, every frame.
    if (this.torch && this.hero) {
      this.torch.setPosition(Math.round(this.hero.sprite.x + 8), Math.round(this.hero.sprite.y + 20));
    }
    for (const motion of this.motions) {
      this.advance(motion, now);
    }
    this.motions = this.motions.filter((motion) => !motion.done);
    // In the air, the hero is its place on the ground lifted by its height,
    // and its shadow stays on the ground: the gap between them is what reads as flying.
    if (this.flight && this.heroSprite && this.heroShadow) {
      const { x, y, altitude } = this.flight;
      this.heroSprite.setPosition(Math.round(x), Math.round(y - altitude));
      this.heroShadow.setPosition(Math.round(x), Math.round(y - 2));
    }
  }

  private advance(motion: Motion, now: number): void {
    const elapsed = now - motion.start;
    if (elapsed < 0 || motion.done) {
      return;
    }
    const target = motion.target as unknown as { scene?: unknown } & Record<string, number>;
    if (target.scene === undefined && 'scene' in target) {
      // Destroyed under the motion: nothing left to move.
      motion.done = true;
      return;
    }
    if (!motion.begun) {
      motion.begun = true;
      motion.props = motion.props.map((prop) => ({ ...prop, from: prop.from ?? target[prop.key] }));
    }
    const cycle = motion.yoyo ? motion.duration * 2 : motion.duration;
    const cycles = Math.floor(elapsed / cycle);
    const finished = motion.repeat >= 0 && cycles > motion.repeat;
    let share: number;
    if (finished) {
      share = motion.yoyo ? 0 : 1;
    } else {
      const into = (elapsed - cycles * cycle) / motion.duration;
      share = motion.ease(into > 1 ? 2 - into : into);
    }
    for (const prop of motion.props) {
      const from = prop.from ?? 0;
      const value = from + (prop.to - from) * share;
      target[prop.key] = prop.key === 'x' || prop.key === 'y' ? Math.round(value) : value;
    }
    if (finished) {
      motion.done = true;
      motion.onComplete?.();
    }
  }

  // -- the two cameras -------------------------------------------------------

  /** Something in the picture: the UI camera never draws it. */
  private world<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.worldObjects.push(object);
    this.uiCamera?.ignore(object);
    return object;
  }

  /** Something laid over the picture: the world camera never draws it, and it never zooms. */
  private ui<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.uiObjects.push(object);
    this.cameras.main.ignore(object);
    return object;
  }

  // -- the script ------------------------------------------------------------

  private at(ms: number, cue: () => void): void {
    this.time.delayedCall(ms, () => {
      if (!this.leaving) {
        cue();
      }
    });
  }

  private playScript(savedGame: RestoredGame): void {
    this.layTiles(arenaIntroForest().layers, ARENA_INTRO_FOREST_SOURCES, FOREST_ORIGIN, 'forest');
    const night = this.world(
      this.add
        .rectangle(0, 0, ARENA_INTRO_FOREST_WIDTH * TILE, ARENA_INTRO_FOREST_HEIGHT * TILE, NIGHT_WASH, 0.42)
        .setOrigin(0, 0)
        .setDepth(DEPTH.night),
    );
    this.arenaMap = getBaseMap(savedGame.raidProgress.workshopUpgrades);
    this.layTiles(this.arenaMap.layers, BASE_TILESET.sources, ARENA_ORIGIN, 'arena');

    this.sneak();
    this.rustle();
    this.battle();
    this.swarm(night);
    this.heroPanel();
    this.rescue();
    this.escape();
    this.extracted();
    this.arena();
    this.loadoutCard();

    if (arenaIntroOffersSkip(this.viewing)) {
      this.drawSkipChip();
    }
  }

  // -- sets ------------------------------------------------------------------

  private layTiles(layers: MapLayers, sources: readonly TileSource[], origin: { x: number; y: number }, name: string): void {
    const height = layers.ground.tiles.length;
    const width = layers.ground.tiles[0]?.length ?? 0;
    const map = this.make.tilemap({ width, height, tileWidth: TILE, tileHeight: TILE });
    const sheets = sources.map((source) => {
      const sheet = map.addTilesetImage(source.textureKey, source.textureKey, TILE, TILE, 0, 0, source.firstIndex);
      if (!sheet) {
        throw new Error(`Tileset '${source.textureKey}' failed to load.`);
      }
      return sheet;
    });
    const lay = (layer: TileLayer, suffix: string, depth: number) => {
      const created = map.createBlankLayer(`${name}-${suffix}`, sheets, origin.x, origin.y);
      if (!created) {
        throw new Error(`Tilemap layer '${name}-${suffix}' failed to initialize.`);
      }
      created.putTilesAt(layer.tiles.map((row) => [...row]), 0, 0);
      created.setDepth(depth);
      created.forEachTile((tile) => {
        const tint = layer.tints[tile.y]?.[tile.x] ?? -1;
        if (tint >= 0) tile.tint = tint;
        if (layer.flips[tile.y]?.[tile.x]) tile.flipX = true;
      });
      this.world(created);
    };
    lay(layers.ground, 'ground', DEPTH.ground);
    lay(layers.overlay, 'overlay', DEPTH.overlay);
    lay(layers.detail, 'detail', DEPTH.detail);
    lay(layers.canopy, 'canopy', DEPTH.canopy);
    lay(layers.brim, 'brim', DEPTH.brim);
  }

  // -- figures ---------------------------------------------------------------

  private person(texture: string, design: CharacterDesignId | null, origin: { x: number; y: number }, tile: GridPosition, facing: Direction): Walker {
    const columns = design ? CHARACTER_DESIGN_SHEET_COLUMNS : CHARACTER_SHEET_COLUMNS;
    const sprite = this.world(this.add.sprite(0, 0, texture, getIdleFrame(facing, columns)).setOrigin(0, 0));
    // The player walks in whatever they wear (`look/lookTexture.ts`, whose
    // sheets are laid out as `character.png` is); a design that stands still
    // in FireRed has no cycle, and slides a step instead.
    const walk = design
      ? getCharacterDesign(design).walks
        ? (way: Direction) => getWalkAnimationKey(way, texture)
        : null
      : (way: Direction) => lookWalkKey(texture, way);
    const walker: Walker = { sprite, kind: 'person', walk, columns, origin, tile, facing };
    this.stand(walker, tile, facing);
    return walker;
  }

  private partner(species: PartnerSpeciesId, origin: { x: number; y: number }, tile: GridPosition, facing: Direction): Walker {
    const sprite = this.world(this.add.sprite(0, 0, partnerTextureKey(species), partnerFrame(facing, 0)).setOrigin(0, 0));
    const walker: Walker = { sprite, kind: 'partner', walk: null, columns: 2, species, origin, tile, facing };
    this.stand(walker, tile, facing);
    return walker;
  }

  private spot(walker: Walker, tile: GridPosition): { x: number; y: number } {
    return walker.kind === 'person'
      ? { x: walker.origin.x + tile.x * TILE, y: walker.origin.y + tile.y * TILE + PERSON_Y }
      : { x: walker.origin.x + tile.x * TILE - 8, y: walker.origin.y + tile.y * TILE + PARTNER_SPRITE_Y_OFFSET };
  }

  private stand(walker: Walker, tile: GridPosition, facing: Direction): void {
    walker.tile = tile;
    walker.facing = facing;
    const { x, y } = this.spot(walker, tile);
    walker.sprite.setPosition(x, y).setDepth(DEPTH.figure + tile.y / 100);
    this.face(walker, facing);
  }

  private face(walker: Walker, facing: Direction): void {
    walker.facing = facing;
    walker.sprite.anims.stop();
    walker.sprite.setFrame(
      walker.kind === 'person' ? getIdleFrame(facing, walker.columns) : partnerFrame(facing, 0),
    );
  }

  /** One step onto a neighbouring tile, drawn over `ms`. */
  private step(walker: Walker, to: GridPosition, ms: number): void {
    const facing: Direction =
      to.x > walker.tile.x ? 'right' : to.x < walker.tile.x ? 'left' : to.y > walker.tile.y ? 'down' : 'up';
    walker.facing = facing;
    walker.tile = to;
    const { x, y } = this.spot(walker, to);
    if (walker.kind === 'person') {
      if (walker.walk) {
        walker.sprite.anims.play(walker.walk(facing), true);
      } else {
        walker.sprite.setFrame(getIdleFrame(facing, walker.columns));
      }
    } else {
      walker.sprite.setFrame(partnerFrame(facing, 1));
      this.time.delayedCall(ms / 2, () => walker.sprite.setFrame(partnerFrame(facing, 0)));
    }
    walker.sprite.setDepth(DEPTH.figure + Math.max(to.y, walker.tile.y) / 100);
    this.move({ targets: walker.sprite, x, y, duration: ms });
  }

  /**
   * Walks `lead` along `tiles` from `startMs`, a step every `stepMs`, with
   * `follower` stepping onto each tile the lead leaves. Returns when it ends.
   */
  private walk(lead: Walker, tiles: readonly GridPosition[], startMs: number, stepMs: number, follower?: Walker): number {
    for (let index = 1; index < tiles.length; index += 1) {
      const from = tiles[index - 1];
      const to = tiles[index];
      this.at(startMs + (index - 1) * stepMs, () => {
        this.step(lead, to, stepMs);
        if (follower) this.step(follower, from, stepMs);
      });
    }
    const end = startMs + (tiles.length - 1) * stepMs;
    this.at(end, () => {
      this.face(lead, lead.facing);
      if (follower) this.face(follower, follower.facing);
    });
    return end;
  }

  /** A Pokemon of the hunter's team, as FireRed's party menu draws it, bobbing. */
  private icon(species: string, tile: GridPosition): Phaser.GameObjects.Sprite {
    const id = species as FigureSpeciesId;
    const [first, second] = pokemonIconFrames(id);
    const sprite = this.world(
      this.add
        .sprite(0, 0, POKEMON_ICON_TEXTURE, first)
        .setOrigin(0.5, 1)
        .setPosition(tile.x * TILE + 8, tile.y * TILE + TILE + pokemonSoleDrop(id))
        .setDepth(DEPTH.figure + tile.y / 100),
    );
    let on = false;
    this.time.addEvent({
      delay: POKEMON_ICON_FRAME_MS,
      loop: true,
      callback: () => {
        on = !on;
        sprite.setFrame(on ? second : first);
      },
    });
    return sprite;
  }

  /** FireRed's "!" over a figure, hopping once. */
  private alert(sprite: Phaser.GameObjects.Sprite, holdMs = 900): void {
    const mark = this.world(
      this.add
        .image(Math.round(sprite.x + sprite.displayWidth / 2) - 5, Math.round(sprite.y) - 8, 'arena-intro-alert')
        .setOrigin(0, 0)
        .setDepth(DEPTH.fx),
    );
    this.move({ targets: mark, y: mark.y - 3, duration: 90, yoyo: true });
    this.time.delayedCall(holdMs, () => mark.destroy());
  }

  // -- the words -------------------------------------------------------------

  /**
   * Holds the world camera to a set, with the letterbox's depth to spare at
   * top and bottom: clamped to the map itself, its top and bottom rows were
   * drawn under the bars.
   */
  private frameSet(origin: { x: number; y: number }, width: number, height: number): void {
    this.cameras.main.setBounds(origin.x, origin.y - LETTERBOX, width * TILE, height * TILE + LETTERBOX * 2);
  }

  /** The cinematic area between the letterbox bars. */
  private area(): { x: number; y: number; width: number; height: number } {
    return { x: 0, y: LETTERBOX, width: this.scale.width, height: this.scale.height - LETTERBOX * 2 };
  }

  /** A line in the game's own text box at the foot of the picture, typed out. */
  private say(line: string, width = Math.min(304, this.scale.width - 16)): void {
    this.closeBox();
    const area = this.area();
    const height = 40;
    const x = Math.floor((this.scale.width - width) / 2);
    const y = area.y + area.height - height - 4;
    const frame = this.ui(this.add.graphics().setDepth(DEPTH.ui + 5));
    drawPixelWindow(frame, { x, y, width, height }, { fill: 0xf8f8f0 });
    const text = this.ui(
      this.add
        .text(x + 8, y + 5, '', {
          fontFamily: GAME_FONT,
          fontSize: DIALOG_FONT_SIZE,
          color: '#383838',
          wordWrap: { width: width - 16 },
          lineSpacing: 1,
        })
        .setDepth(DEPTH.ui + 6),
    );
    this.textBox = { frame, text };
    let shown = 0;
    this.typing = this.time.addEvent({
      delay: 22,
      repeat: line.length - 1,
      callback: () => {
        shown += 1;
        text.setText(line.slice(0, shown));
      },
    });
  }

  private closeBox(): void {
    this.typing?.remove();
    this.typing = null;
    this.textBox?.frame.destroy();
    this.textBox?.text.destroy();
    this.textBox = null;
  }

  /** A big stamped word over the middle of the picture, popped in a whole step at a time. */
  private bigWord(
    key: string,
    text: string,
    palette: typeof GOLD,
    fontSize: string,
    y: number,
    holdMs: number,
    depth: number = DEPTH.ui + 10,
  ): Phaser.GameObjects.Image {
    const size = stampedWord(this, key, text, { fontSize, depthPx: 3, ...palette });
    const image = this.ui(
      this.add
        .image(Math.floor((this.scale.width - size.width) / 2), y, key)
        .setOrigin(0, 0)
        .setDepth(depth),
    );
    // Two whole steps of scale down to its own size, so no frame of it is drawn
    // at a scale between.
    image.setScale(2).setPosition(Math.floor((this.scale.width - size.width * 2) / 2), y - Math.floor(size.height / 2));
    this.time.delayedCall(70, () => image.setScale(1).setPosition(Math.floor((this.scale.width - size.width) / 2), y));
    if (holdMs > 0) {
      this.time.delayedCall(holdMs, () => image.destroy());
    }
    return image;
  }

  /** A small chip under the top bar, or over the bottom one: an icon and a line. */
  private chip(line: string, iconKey: string | null, holdMs: number, where: 'top' | 'bottom' = 'top'): void {
    const text = this.ui(
      this.add
        .text(0, 0, line, { fontFamily: GAME_FONT, fontSize: CHIP_FONT_SIZE, color: '#f8f8f0' })
        .setDepth(DEPTH.ui + 8),
    );
    const iconWidth = iconKey ? 18 : 0;
    const width = Math.ceil(text.width) + iconWidth + 12;
    const x = 8;
    const y = where === 'top' ? LETTERBOX + 6 : this.scale.height - LETTERBOX - 6 - 22;
    const frame = this.ui(this.add.graphics().setDepth(DEPTH.ui + 7));
    drawPixelWindow(frame, { x, y, width, height: 22 }, { fill: 0x18203a, border: 0xf8f8f0 });
    text.setPosition(x + 6 + iconWidth, y + 4);
    const parts: Phaser.GameObjects.GameObject[] = [frame, text];
    if (iconKey) {
      parts.push(this.ui(this.add.image(x + 4, y + 3, iconKey).setOrigin(0, 0).setDepth(DEPTH.ui + 8)));
    }
    this.time.delayedCall(holdMs, () => parts.forEach((part) => part.destroy()));
  }

  private drawLetterbox(): void {
    const bars = this.ui(this.add.graphics().setDepth(DEPTH.ui + 50));
    bars.fillStyle(0x000000, 1);
    bars.fillRect(0, 0, this.scale.width, LETTERBOX);
    bars.fillRect(0, this.scale.height - LETTERBOX, this.scale.width, LETTERBOX);
  }

  /** SKIP, on every viewing after the first: any key does it, and the chip says so. */
  private drawSkipChip(): void {
    const text = this.ui(
      this.add
        .text(0, 0, `${this.words.skip}  ANY KEY`, { fontFamily: GAME_FONT, fontSize: CHIP_FONT_SIZE, color: '#f8f8f0' })
        .setDepth(DEPTH.ui + 52),
    );
    const x = this.scale.width - Math.ceil(text.width) - 14;
    const y = this.scale.height - LETTERBOX + 2;
    text.setPosition(x, y);
    const arrow = this.ui(this.add.graphics().setDepth(DEPTH.ui + 52));
    arrow.fillStyle(0xf8f8f0, 1);
    for (let row = 0; row < 7; row += 1) {
      const reach = row < 4 ? row : 6 - row;
      arrow.fillRect(this.scale.width - 10, y + 3 + row, reach + 1, 1);
    }
  }

  // -- beats -----------------------------------------------------------------

  private playerTexture: string = SHARED_CHARACTER_TEXTURE;
  private hero!: Walker;
  private buddy!: Walker;
  private rival!: Walker;
  private torch: Phaser.GameObjects.Image | null = null;
  private arenaMap!: BaseMapDefinition;

  /** Night in the vale: up the path, three finds, into the clearing. */
  private sneak(): void {
    const main = this.cameras.main;
    const start = beatStart('sneak');
    this.frameSet(FOREST_ORIGIN, ARENA_INTRO_FOREST_WIDTH, ARENA_INTRO_FOREST_HEIGHT);
    main.setZoom(1);
    this.hero = this.person(this.playerTexture, null, FOREST_ORIGIN, SNEAK_ROUTE[0], 'up');
    this.buddy = this.partner(this.cast.partner.id as PartnerSpeciesId, FOREST_ORIGIN, { x: SNEAK_ROUTE[0].x, y: SNEAK_ROUTE[0].y + 1 }, 'up');
    main.startFollow(this.hero.sprite, true, 0.15, 0.15, -8, -16);
    main.fadeIn(600, 0, 0, 0);
    this.uiCamera.fadeIn(600, 0, 0, 0);

    // The torch the player carries, and the fireflies in the clearing.
    this.torch = this.world(
      this.add.image(0, 0, 'arena-intro-light').setDepth(DEPTH.light).setAlpha(0.22).setBlendMode(Phaser.BlendModes.ADD),
    );
    this.fireflies();

    // The finds, lying in the path: an item's own icon, glinting.
    const finds = FIND_TILES.map((tile, index) => {
      const icon = this.world(
        this.add
          .image(tile.x * TILE, tile.y * TILE, iconTextureKey(itemIconName(this.cast.finds[index].id)))
          .setOrigin(0, 0)
          .setDepth(DEPTH.item),
      );
      const glint = this.world(this.add.image(tile.x * TILE + 12, tile.y * TILE + 1, 'arena-intro-star').setDepth(DEPTH.fx));
      this.move({ targets: glint, alpha: { from: 1, to: 0.1 }, duration: 380, yoyo: true, repeat: -1, delay: index * 160 });
      if (index === FIND_PRIZE) {
        icon.preFX?.addGlow(0xffc040, 2, 0, false, 0.1, 8);
      }
      return { icon, glint };
    });
    const pick = (index: number, sound: 'lootPickup' | 'itemObtained') => {
      const { icon, glint } = finds[index];
      glint.destroy();
      audioManager.play(sound);
      this.move({ targets: icon, y: icon.y - 14, alpha: 0, duration: 520, onComplete: () => icon.destroy() });
      this.chip(`+ ${this.cast.finds[index].name}`, iconTextureKey(itemIconName(this.cast.finds[index].id)), 1300, 'bottom');
    };

    // The place, as a title card over the opening shot, and the hour beside it.
    this.at(start + 500, () => {
      this.bigWord('arena-intro-place', this.words.place, MINT, '30px', LETTERBOX + 22, 2300);
      this.chip(this.words.hour, null, 2300);
    });
    const step = 220;
    const route = routeTiles(SNEAK_ROUTE);
    const findAt = FIND_TILES.map((tile) => route.findIndex((place) => place.x === tile.x && place.y === tile.y));
    // Up to the first find, pick it up; on to the second, look about; on to
    // the third - a prize, which gleams - and on to where the grass moves.
    let t = start + 600;
    t = this.walk(this.hero, route.slice(0, findAt[0] + 1), t, step, this.buddy);
    this.at(t, () => pick(0, 'lootPickup'));
    t += 440;
    t = this.walk(this.hero, route.slice(findAt[0], findAt[1] + 1), t, step, this.buddy);
    this.at(t, () => pick(1, 'lootPickup'));
    this.at(t + 240, () => this.face(this.hero, 'up'));
    this.at(t + 520, () => this.face(this.hero, 'down'));
    this.at(t + 800, () => this.face(this.hero, 'right'));
    t += 820;
    this.at(t + 600, () => audioManager.play('prizeSighted'));
    t = this.walk(this.hero, route.slice(findAt[1], findAt[2] + 1), t, step, this.buddy);
    this.at(t, () => pick(2, 'itemObtained'));
    t += 440;
    t = this.walk(this.hero, route.slice(findAt[2]), t, step, this.buddy);
    this.at(t + 120, () => this.face(this.hero, 'right'));
  }

  private fireflies(): void {
    let seed = 7;
    const random = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let index = 0; index < 18; index += 1) {
      const x = Math.round((10 + random() * 24) * TILE);
      const y = Math.round((10 + random() * 12) * TILE);
      const fly = this.world(this.add.image(x, y, 'arena-intro-fx', 'firefly').setDepth(DEPTH.light + 1).setAlpha(0));
      this.move({
        targets: fly,
        alpha: { from: 0, to: 1 },
        x: x + Math.round((random() - 0.5) * 24),
        y: y - Math.round(random() * 12),
        duration: 900 + random() * 900,
        yoyo: true,
        repeat: -1,
        delay: random() * 1500,
      });
    }
  }

  /** The grass moves, and the player has seen it. */
  private rustle(): void {
    const start = beatStart('rustle');
    this.at(start, () => {
      audioManager.play('grassRustle');
      const blades = this.world(this.add.graphics().setDepth(DEPTH.figure + 1));
      blades.fillStyle(0x184820, 1);
      for (const [dx, dy] of [[3, 6], [7, 3], [11, 7], [5, 10], [12, 11]] as const) {
        blades.fillRect(RUSTLE_TILE.x * TILE + dx, RUSTLE_TILE.y * TILE + dy, 1, 4);
      }
      this.move({ targets: blades, x: 2, duration: 60, yoyo: true, repeat: 7 });
      this.time.delayedCall(1000, () => blades.destroy());
    });
    this.at(start + 420, () => {
      // A cut in, at twice the size: the player has seen it.
      const main = this.cameras.main;
      main.stopFollow();
      main.setZoom(2);
      main.centerOn(this.hero.sprite.x + 16, this.hero.sprite.y + 16);
      this.alert(this.hero.sprite);
      audioManager.play('encounter');
    });
    // FireRed's way into a fight: the screen flashes, twice, and closes.
    this.at(start + 760, () => flashScreen(this.cameras.main, 110, [255, 255, 255]));
    this.at(start + 920, () => flashScreen(this.cameras.main, 110, [255, 255, 255]));
    this.at(start + 1000, () => this.wipe(220));
  }

  /** Black bands closing across the picture from either side, then opening on the next cut. */
  private wipe(ms: number): void {
    const bands = 8;
    const height = Math.ceil(this.scale.height / bands);
    for (let band = 0; band < bands; band += 1) {
      const fromLeft = band % 2 === 0;
      const rect = this.ui(
        this.add
          .rectangle(fromLeft ? -this.scale.width : this.scale.width, band * height, this.scale.width, height, 0x000000)
          .setOrigin(0, 0)
          .setDepth(DEPTH.ui + 40),
      );
      this.move({ targets: rect, x: 0, duration: ms });
      this.time.delayedCall(ms + 120, () =>
        this.move({ targets: rect, x: fromLeft ? this.scale.width : -this.scale.width, duration: ms, onComplete: () => rect.destroy() }),
      );
    }
  }

  /** A wild fight the partner is winning. */
  private battle(): void {
    const start = beatStart('battle');
    const area = this.area();
    const top = area.y + Math.max(4, Math.floor((area.height - BACKDROP_ART.height - 44) / 2));
    const left = Math.floor((this.scale.width - BACKDROP_ART.width) / 2);
    const texture = this.textures.get('battle-background-grass');
    if (!texture.has('art')) {
      texture.add('art', 0, BACKDROP_ART.x, BACKDROP_ART.y, BACKDROP_ART.width, BACKDROP_ART.height);
    }
    this.world(this.add.image(BATTLE_ORIGIN.x, BATTLE_ORIGIN.y, 'battle-background-grass', 'art').setOrigin(0, 0));
    const foeSpot = { x: BATTLE_ORIGIN.x + 190, y: BATTLE_ORIGIN.y + 94 };
    const mineSpot = { x: BATTLE_ORIGIN.x + 66, y: BATTLE_ORIGIN.y + BACKDROP_ART.height + 4 };
    const foe = this.world(
      this.add.image(BATTLE_ORIGIN.x - 80, foeSpot.y, `pokemon-front-${this.cast.wild.dexId}`).setOrigin(0.5, 1).setDepth(5),
    );
    const mine = this.world(
      this.add
        .image(mineSpot.x, mineSpot.y + 90, `pokemon-back-${this.cast.partner.dexId}`)
        .setOrigin(0.5, 1)
        .setDepth(6),
    );
    let foeHp: Phaser.GameObjects.Graphics | null = null;
    const drawFoeHp = (share: number) => {
      foeHp?.clear();
      if (!foeHp) return;
      const plate = { x: left + 10, y: top + 10, width: 100, height: 26 };
      drawPixelWindow(foeHp, plate, { fill: 0xf8f8e0 });
      foeHp.fillStyle(0x404040, 1);
      foeHp.fillRect(plate.x + 30, plate.y + 17, 64, 4);
      foeHp.fillStyle(share > 0.5 ? 0x40c860 : share > 0.2 ? 0xf8c030 : 0xe04030, 1);
      foeHp.fillRect(plate.x + 31, plate.y + 18, Math.max(1, Math.round(62 * share)), 2);
    };

    this.at(start, () => {
      this.cameras.main.stopFollow();
      this.cameras.main.removeBounds();
      this.cameras.main.setZoom(1);
      this.cameras.main.setScroll(BATTLE_ORIGIN.x - left, BATTLE_ORIGIN.y - top);
      audioManager.play('battleStart');
      this.move({ targets: foe, x: foeSpot.x, duration: 520 });
    });
    this.at(start + 560, () => {
      audioManager.play('cry', { species: this.cast.wild.dexId });
      this.say(this.words.battle[0], BACKDROP_ART.width);
      foeHp = this.ui(this.add.graphics().setDepth(DEPTH.ui + 4));
      const name = this.ui(
        this.add
          .text(left + 16, top + 13, this.cast.wild.name, { fontFamily: GAME_FONT, fontSize: CHIP_FONT_SIZE, color: '#383838' })
          .setDepth(DEPTH.ui + 5),
      );
      this.time.delayedCall(beatStart('swarm') - start - 560, () => {
        name.destroy();
        foeHp?.destroy();
        foeHp = null;
      });
      drawFoeHp(1);
    });
    this.at(start + 1800, () => {
      this.say(this.words.battle[1], BACKDROP_ART.width);
      audioManager.play('sendOut');
      this.move({ targets: mine, y: mineSpot.y, duration: 300, ease: 'Back.Out' });
    });
    this.at(start + 2150, () => audioManager.play('cry', { species: this.cast.partner.dexId }));
    this.at(start + 3200, () => this.say(this.words.battle[2], BACKDROP_ART.width));
    this.at(start + 3600, () => {
      this.move({ targets: mine, x: mine.x + 10, y: mine.y - 4, duration: 90, yoyo: true });
    });
    this.at(start + 3780, () => {
      audioManager.play('hitSpecial');
      this.sparks.explode(18, foe.x, foe.y - 28);
      this.move({ targets: foe, alpha: { from: 1, to: 0 }, duration: 70, yoyo: true, repeat: 3 });
      this.cameras.main.shake(140, 0.006);
      let share = 1;
      this.time.addEvent({
        delay: 30,
        repeat: 25,
        callback: () => {
          share = Math.max(0.18, share - 0.032);
          drawFoeHp(share);
        },
      });
    });
    this.at(start + 4700, () => this.say(this.words.battle[3], BACKDROP_ART.width));
    this.at(start + 5500, () => this.say(`${this.cast.playerName}: ${this.words.cocky}`, BACKDROP_ART.width));
    // And then it is not easy at all.
    this.at(start + 6200, () => {
      this.closeBox();
      flashScreen(this.cameras.main, 180, [208, 48, 48]);
      this.cameras.main.shake(320, 0.012);
      audioManager.play('hunterNear');
      this.say(this.words.warning, BACKDROP_ART.width);
    });
  }

  /** Out of the trees: the hunter, and the hunter's whole team. */
  private swarm(night: Phaser.GameObjects.Rectangle): void {
    const start = beatStart('swarm');
    const main = this.cameras.main;
    const rival = this.cast.rival;
    const hunter = this.person(characterDesignTextureKey(rival.design), rival.design, FOREST_ORIGIN, HUNTER_ROUTE[0], 'left');
    hunter.sprite.setVisible(false);
    this.rival = hunter;
    const red = this.ui(this.add.image(0, 0, 'arena-intro-vignette-red').setOrigin(0, 0).setDepth(DEPTH.ui + 1).setAlpha(0));
    const dark = this.ui(this.add.image(0, 0, 'arena-intro-vignette').setOrigin(0, 0).setDepth(DEPTH.ui));
    this.time.delayedCall(beatStart('arena'), () => dark.destroy());

    this.at(start, () => {
      this.closeBox();
      night.setAlpha(0.32);
      main.setZoom(1);
      this.frameSet(FOREST_ORIGIN, ARENA_INTRO_FOREST_WIDTH, ARENA_INTRO_FOREST_HEIGHT);
      main.centerOn(22 * TILE, 15 * TILE + 8);
      this.stand(this.hero, STAND_TILE, 'right');
      this.stand(this.buddy, PARTNER_STAND_TILE, 'right');
      hunter.sprite.setVisible(true);
      this.alert(hunter.sprite, 1200);
      audioManager.play('trainerSpotted');
    });
    this.walk(hunter, routeTiles(HUNTER_ROUTE), start + 400, 200);
    this.at(start + 1900, () => {
      audioManager.play('hunterArrival');
      this.say(this.words.shout);
    });
    const icons = this.cast.swarm.map((species, index) => {
      const sprite = this.icon(species.id, SWARM_FROM[index]);
      sprite.setVisible(false);
      return sprite;
    });
    icons.forEach((sprite, index) => {
      const to = SWARM_RING[index];
      this.at(start + 2600 + index * 150, () => {
        sprite.setVisible(true);
        this.move({
          targets: sprite,
          x: to.x * TILE + 8,
          y: to.y * TILE + TILE + pokemonSoleDrop(this.cast.swarm[index].id as FigureSpeciesId),
          duration: 820,
          onComplete: () => sprite.setDepth(DEPTH.figure + to.y / 100),
        });
      });
    });
    this.at(start + 2700, () => audioManager.play('cry', { species: this.cast.swarm[0].dexId }));
    this.at(start + 3700, () => {
      main.shake(260, 0.01);
      this.move({ targets: red, alpha: { from: 0, to: 0.85 }, duration: 380, yoyo: true, repeat: 3 });
    });
    // The team goes in, one after another; the partner takes every hit.
    [0, 1, 3].forEach((member, turn) => {
      this.at(start + 4300 + turn * 420, () => {
        const sprite = icons[member];
        const toward = this.buddy.sprite;
        const dx = Math.sign(toward.x + 16 - sprite.x) * 8;
        const dy = Math.sign(toward.y + 24 - sprite.y) * 4;
        this.move({ targets: sprite, x: sprite.x + dx, y: sprite.y + dy, duration: 80, yoyo: true });
        audioManager.play('hitPhysical');
        this.sparks.explode(10, toward.x + 16, toward.y + 18);
        this.move({ targets: toward, alpha: { from: 1, to: 0.15 }, duration: 60, yoyo: true, repeat: 2 });
        main.shake(110, 0.006);
      });
    });
    this.at(start + 5400, () => {
      audioManager.play('lowHp');
      this.say(this.words.trapped);
    });
    this.at(start + 6100, () => this.face(this.hero, 'up'));
  }

  /** A roar, and the one comic panel: the player looking up, and what is coming. */
  private heroPanel(): void {
    const start = beatStart('hero');
    this.at(start, () => {
      this.closeBox();
      audioManager.play('cry', { species: this.cast.hero.dexId });
      flashScreen(this.cameras.main, 220, [255, 255, 255]);
      this.cameras.main.shake(400, 0.016);
    });
    this.at(start + 260, () => {
      const area = this.area();
      const width = this.scale.width;
      const parts: Phaser.GameObjects.GameObject[] = [];
      const keep = <T extends Phaser.GameObjects.GameObject>(object: T): T => {
        parts.push(this.ui(object));
        return object;
      };
      keep(this.add.rectangle(0, area.y, width, area.height, 0x000000).setOrigin(0, 0).setDepth(DEPTH.ui + 20));
      // The big panel: a burst of fire-coloured rays behind the hero, on a slant.
      const split = Math.round(width * 0.34);
      const burst = keep(this.add.graphics().setDepth(DEPTH.ui + 21));
      const cx = split + Math.round((width - split) / 2);
      const cy = area.y + Math.round(area.height * 0.46);
      const rays = 18;
      const reach = Math.max(width, area.height) * 1.2;
      burst.fillStyle(0xf8a020, 1);
      burst.fillRect(split - 10, area.y + 4, width - split + 6, area.height - 8);
      burst.fillStyle(0xf8d048, 1);
      for (let ray = 0; ray < rays; ray += 2) {
        const a0 = (ray / rays) * Math.PI * 2;
        const a1 = ((ray + 1) / rays) * Math.PI * 2;
        burst.fillTriangle(cx, cy, cx + Math.cos(a0) * reach, cy + Math.sin(a0) * reach, cx + Math.cos(a1) * reach, cy + Math.sin(a1) * reach);
      }
      const panelMask = this.make.graphics({}, false);
      panelMask.fillStyle(0xffffff, 1);
      panelMask.fillPoints(
        [
          new Phaser.Math.Vector2(split + 14, area.y + 4),
          new Phaser.Math.Vector2(width - 4, area.y + 4),
          new Phaser.Math.Vector2(width - 4, area.y + area.height - 4),
          new Phaser.Math.Vector2(split - 14, area.y + area.height - 4),
        ],
        true,
      );
      burst.setMask(panelMask.createGeometryMask());
      // Speed lines across the burst, redrawn as it holds.
      const lines = keep(this.add.graphics().setDepth(DEPTH.ui + 22));
      lines.setMask(panelMask.createGeometryMask());
      let frame = 0;
      const drawLines = () => {
        lines.clear();
        lines.fillStyle(0xfff8e0, 1);
        for (let line = 0; line < 9; line += 1) {
          const y = area.y + 10 + ((line * 23 + frame * 7) % (area.height - 20));
          const length = 30 + ((line * 37) % 50);
          const x = width - ((frame * 29 + line * 53) % (width - split + 60));
          lines.fillRect(x, y, length, 1);
        }
        frame += 1;
      };
      drawLines();
      this.time.addEvent({ delay: 60, repeat: 30, callback: drawLines });
      // The hero itself, twice its size: a whole step, so every pixel is two.
      const heroArt = keep(
        this.add
          .image(cx, cy + 6, `pokemon-front-${this.cast.hero.dexId}`)
          .setScale(2)
          .setDepth(DEPTH.ui + 23),
      );
      heroArt.preFX?.addGlow(0xfff0a0, 3, 0, false, 0.1, 10);
      heroArt.setX(width + 80);
      this.move({ targets: heroArt, x: cx, duration: 260, ease: 'Cubic.Out' });
      // The small panel: the player, three times their size, looking up.
      const left = keep(this.add.graphics().setDepth(DEPTH.ui + 24));
      left.fillStyle(0x203060, 1);
      left.fillPoints(
        [
          new Phaser.Math.Vector2(4, area.y + 4),
          new Phaser.Math.Vector2(split + 6, area.y + 4),
          new Phaser.Math.Vector2(split - 22, area.y + area.height - 4),
          new Phaser.Math.Vector2(4, area.y + area.height - 4),
        ],
        true,
      );
      left.lineStyle(2, 0xf8f8f8, 1);
      left.strokePoints(
        [
          new Phaser.Math.Vector2(4, area.y + 4),
          new Phaser.Math.Vector2(split + 6, area.y + 4),
          new Phaser.Math.Vector2(split - 22, area.y + area.height - 4),
          new Phaser.Math.Vector2(4, area.y + area.height - 4),
        ],
        true,
      );
      const face = keep(
        this.add
          .sprite(Math.round(split / 2) - 22, area.y + Math.round(area.height / 2) - 52, this.playerTexture, getIdleFrame('down'))
          .setOrigin(0, 0)
          .setScale(3)
          .setDepth(DEPTH.ui + 25),
      );
      face.setX(-80);
      this.move({ targets: face, x: Math.round(split / 2) - 26, duration: 220, ease: 'Cubic.Out' });
      const bang = keep(this.add.image(Math.round(split / 2) + 18, area.y + 20, 'arena-intro-alert').setOrigin(0, 0).setScale(2).setDepth(DEPTH.ui + 26));
      this.move({ targets: bang, y: bang.y - 4, duration: 120, yoyo: true, repeat: 3 });
      this.time.delayedCall(420, () => {
        audioManager.play('criticalHit');
        parts.push(this.bigWord('arena-intro-roar', this.words.roar, FIRE, '40px', area.y + area.height - 54, 0, DEPTH.ui + 30));
      });
      this.time.delayedCall(beatStart('rescue') - start - 260, () => {
        parts.forEach((part) => part.destroy());
        panelMask.destroy();
      });
    });
  }

  /** Fire across the clearing, and the swarm scatters. */
  private rescue(): void {
    const start = beatStart('rescue');
    const main = this.cameras.main;
    const hero = this.world(
      this.add
        .sprite(0, 0, partnerTextureKey('charizard'), partnerFrame('left', 0))
        .setOrigin(0.5, 1)
        .setScale(2)
        .setDepth(DEPTH.hero)
        .setVisible(false),
    );
    hero.preFX?.addGlow(0xffa040, 2, 0, false, 0.1, 6);
    const shadow = this.world(this.add.ellipse(0, 0, 28, 8, 0x000000, 0.35).setDepth(DEPTH.figure - 0.5).setVisible(false));
    const landing = heroGround();
    let flap = 0;
    this.time.addEvent({
      delay: 140,
      loop: true,
      callback: () => {
        flap = 1 - flap;
        // Drawn facing left and mirrored to face right, so a turn is a flip and nothing else.
        hero.setFrame(partnerFrame('left', flap as 0 | 1));
      },
    });
    this.heroSprite = hero;
    this.heroShadow = shadow;

    this.at(start, () => {
      const view = main.worldView;
      hero.setVisible(true).setPosition(view.right + 40, view.top - 10);
      shadow.setVisible(true).setPosition(view.right + 40, landing.y - 2);
      audioManager.play('cry', { species: this.cast.hero.dexId });
      this.move({ targets: hero, x: landing.x, duration: 900, ease: 'Sine.InOut' });
      this.move({ targets: hero, y: landing.y, duration: 900, ease: 'Quad.In' });
      this.move({ targets: shadow, x: landing.x, duration: 900, ease: 'Sine.InOut' });
    });
    this.at(start + 920, () => {
      main.shake(260, 0.014);
      this.shockwave(landing.x, landing.y - 2);
      audioManager.play('hitSpecial');
      this.sparks.explode(24, landing.x, landing.y - 4);
      this.smoke.explode(10, landing.x, landing.y - 2);
    });
    // Fire at each of the team in turn, and each one flies.
    this.cast.swarm.forEach((_species, index) => {
      this.at(start + 1200 + index * 260, () => {
        const target = this.swarmIcon(index);
        if (!target) return;
        this.flame(this.turnToBreathe(hero, target.x), { x: target.x, y: target.y - 10 });
        this.time.delayedCall(160, () => {
          audioManager.play('hitSpecial');
          this.fire.explode(34, target.x, target.y - 10);
          this.sparks.explode(12, target.x, target.y - 10);
          this.smoke.explode(6, target.x, target.y - 6);
          main.shake(90, 0.008);
          const awayX = Math.sign(target.x - landing.x) || 1;
          const awayY = Math.sign(target.y - landing.y) || -1;
          this.move({
            targets: target,
            x: target.x + awayX * 220,
            y: target.y + awayY * 120,
            alpha: 0,
            duration: 700,
            ease: 'Quad.In',
          });
        });
      });
    });
    this.at(start + 3000, () => {
      const hunter = this.rival.sprite;
      this.flame(this.turnToBreathe(hero, hunter.x + 8), { x: hunter.x + 8, y: hunter.y + 16 });
      this.time.delayedCall(160, () => {
        this.fire.explode(30, hunter.x + 8, hunter.y + 22);
        this.smoke.explode(8, hunter.x + 8, hunter.y + 24);
        this.alert(hunter, 600);
        this.move({ targets: hunter, x: hunter.x + 40, duration: 500, ease: 'Quad.Out' });
      });
    });
    this.at(start + 3700, () => {
      audioManager.play('trainerSpotted');
      this.bigWord('arena-intro-run', this.words.run, GOLD, '40px', LETTERBOX + 12, 900);
    });
  }

  /** Turns the hero to face `x`, and says where its mouth is now. */
  private turnToBreathe(hero: Phaser.GameObjects.Sprite, x: number): { x: number; y: number } {
    hero.setFlipX(x > hero.x);
    return { x: hero.x + (hero.flipX ? 22 : -22), y: hero.y - 40 };
  }

  private heroSprite: Phaser.GameObjects.Sprite | null = null;
  private heroShadow: Phaser.GameObjects.Ellipse | null = null;
  /** Where the hero is over the ground and how high, while it is in the air (`update`). */
  private flight: { x: number; y: number; altitude: number } | null = null;

  private swarmIcon(index: number): Phaser.GameObjects.Sprite | undefined {
    const icons = this.worldObjects.filter(
      (object): object is Phaser.GameObjects.Sprite =>
        object instanceof Phaser.GameObjects.Sprite && object.texture.key === POKEMON_ICON_TEXTURE,
    );
    return icons[index];
  }

  /** A ring of dust thrown out along the ground where something heavy lands. */
  private shockwave(x: number, y: number): void {
    const ring = this.world(this.add.graphics().setDepth(DEPTH.figure - 0.4));
    const state = { radius: 4, alpha: 1 };
    const draw = () => {
      ring.clear();
      ring.lineStyle(2, 0xf8f0d0, state.alpha);
      // Twice as wide as it is deep: a ring lying on the ground, seen from above and in front.
      ring.strokeEllipse(x, y, Math.round(state.radius * 2), Math.round(state.radius));
    };
    draw();
    this.move({
      targets: state,
      radius: 40,
      alpha: 0,
      duration: 420,
      ease: 'Quad.Out',
      onComplete: () => ring.destroy(),
    });
    this.time.addEvent({ delay: 16, repeat: 26, callback: draw });
  }

  /** Flamethrower: a stream of fire from one point to another, thickening as it goes. */
  private flame(from: { x: number; y: number }, to: { x: number; y: number }): void {
    const steps = 14;
    audioManager.play('statusDamage');
    for (let index = 0; index <= steps; index += 1) {
      this.time.delayedCall(index * 11, () => {
        const x = Math.round(from.x + ((to.x - from.x) * index) / steps);
        const y = Math.round(from.y + ((to.y - from.y) * index) / steps);
        this.fire.explode(4 + Math.round((index / steps) * 6), x, y);
      });
    }
  }

  /**
   * The run for the way out, and what the hero is there to do about it: it
   * stays behind and pins the hunter off the road while the two of them run
   * past, and when the hunter breaks out and comes up the road behind them it
   * takes off, shuts the road with fire at their heels and goes over their
   * heads into the night. Nobody is carried out: they get to the exit on their
   * own feet, and look back at the hunter on the wrong side of the fire.
   */
  private escape(): void {
    const start = beatStart('escape');
    const main = this.cameras.main;
    // Behind the figures: drawn over them, it hid the player for the last of the run.
    const exit = this.world(this.add.graphics().setDepth(DEPTH.figure - 1).setVisible(false));
    const exitIcon = this.world(
      this.add.image(EXIT_TILE.x * TILE, EXIT_TILE.y * TILE, iconTextureKey(WORLD_ICONS.extractionOpen)).setOrigin(0, 0).setDepth(DEPTH.item).setVisible(false),
    );
    const drawExit = (pulse: number) => {
      exit.clear();
      const x = EXIT_TILE.x * TILE;
      const y = EXIT_TILE.y * TILE;
      for (let band = 0; band < 4; band += 1) {
        exit.fillStyle(0x80f8a0, (0.12 + 0.06 * pulse) * (4 - band));
        exit.fillRect(x + band * 2, y - 48 + band * 4, TILE - band * 4, 48 + TILE - band * 4);
      }
    };
    let pulse = 0;
    this.at(start, () => {
      this.closeBox();
      exit.setVisible(true);
      exitIcon.setVisible(true);
      drawExit(0);
      this.time.addEvent({ delay: 120, loop: true, callback: () => drawExit((pulse = (pulse + 1) % 4)) });
      main.setZoom(1);
      main.startFollow(this.hero.sprite, true, 0.2, 0.2, -8, -16);
    });
    // The clock, in the raid's own red.
    let seconds = 9;
    const clock = this.ui(
      this.add
        .text(this.scale.width - 8, LETTERBOX + 6, '', { fontFamily: GAME_FONT, fontSize: DIALOG_FONT_SIZE, color: '#f85050' })
        .setOrigin(1, 0)
        .setDepth(DEPTH.ui + 8)
        .setVisible(false),
    );
    this.at(start, () => {
      clock.setVisible(true).setText(`0:0${seconds}`);
      audioManager.play('clockUrgent');
    });
    for (let tick = 1; tick <= 5; tick += 1) {
      this.at(start + tick * 1000, () => {
        seconds -= 1;
        clock.setText(`0:0${seconds}`);
        audioManager.play('clockUrgent');
      });
    }
    this.at(beatStart('extracted'), () => clock.destroy());

    const route = routeTiles(ESCAPE_ROUTE);
    const end = this.walk(this.hero, route, start + 200, RUN_STEP_MS, this.buddy);
    this.holdTheHunter(start);
    this.hunterBreaksOut(start + BREAK_OUT_MS);
    this.heroTakesOff(start + BREAK_OUT_MS - 40);

    // At the way out, they look back: the fire, and who is behind it.
    this.at(end + 150, () => {
      this.face(this.hero, 'left');
      this.face(this.buddy, 'left');
    });
    this.at(end + 1250, () => {
      this.closeBox();
      audioManager.play('extract');
      flashScreen(main, 400, [255, 255, 255]);
    });
  }

  /** The hunter goes for the road; the hero, still on the ground, drives them off it and keeps them off. */
  private holdTheHunter(start: number): void {
    const hero = this.heroSprite!;
    this.at(start, () => {
      const sprite = this.rival.sprite;
      this.rival.tile = { x: sprite.x / TILE, y: Math.round((sprite.y - PERSON_Y) / TILE) };
    });
    this.at(start + 350, () => {
      this.step(this.rival, { x: this.rival.tile.x, y: this.rival.tile.y - 1 }, 180);
      hero.setFlipX(true);
    });
    this.at(start + 530, () => this.face(this.rival, 'left'));
    // Flamethrower, breath after breath, for as long as the two of them are passing.
    for (let breath = 0; breath < 5; breath += 1) {
      this.at(start + 700 + breath * 200, () => {
        const sprite = this.rival.sprite;
        const target = { x: sprite.x + 8, y: sprite.y + 16 };
        this.flame(this.turnToBreathe(hero, target.x), target);
        this.time.delayedCall(160, () => {
          this.fire.explode(14, target.x, target.y);
          this.smoke.explode(3, target.x, target.y + 4);
        });
      });
    }
    this.at(start + 860, () => {
      audioManager.play('hitSpecial');
      this.cameras.main.shake(140, 0.008);
      this.rival.tile = HUNTER_DRIVEN_TO;
      const { x, y } = this.spot(this.rival, HUNTER_DRIVEN_TO);
      this.move({ targets: this.rival.sprite, x, y, duration: 260, ease: 'Quad.Out' });
    });
    this.at(start + 1120, () => this.alert(this.rival.sprite, 600));
  }

  /** The fire stops, and the hunter is on the road behind them, and gaining; the hero's fire stops them dead. */
  private hunterBreaksOut(at: number): void {
    const chase = routeTiles(HUNTER_CHASE);
    // The mark first, and only then the run: a figure runs out from under its mark.
    this.at(at - 300, () => {
      this.alert(this.rival.sprite, 300);
      audioManager.play('hunterNear');
    });
    const reached = this.walk(this.rival, chase, at, HUNTER_STEP_MS);
    this.at(reached + 60, () => this.step(this.rival, { x: chase.at(-1)!.x - 1, y: chase.at(-1)!.y }, 200));
    this.at(reached + 260, () => {
      this.face(this.rival, 'right');
      this.alert(this.rival.sprite, 800);
    });
    this.at(reached + 500, () => this.say(this.words.getaway));
  }

  /**
   * Off the ground, across the clearing and up the road after the hunter, with
   * the fire laid at the runners' heels on the way past; then over their heads
   * and out of the picture, its job done.
   */
  private heroTakesOff(at: number): void {
    const hero = this.heroSprite!;
    const shadow = this.heroShadow!;
    const landing = heroGround();
    // Just short of the fire, so the breath from its mouth lands on the tiles.
    const overFire = { x: (FIRE_WALL[0].x - 1.5) * TILE, y: (FIRE_WALL.at(-1)!.y + 1) * TILE };
    // Along the road, so its shadow runs down the road and it is seen to pass over them.
    const away = { x: (ARENA_INTRO_FOREST_WIDTH + 4) * TILE, y: overFire.y - TILE };
    const pass = HUNTER_FIRE_MS;
    this.at(at, () => {
      hero.setFlipX(true);
      audioManager.play('cry', { species: this.cast.hero.dexId });
      this.smoke.explode(10, landing.x, landing.y - 2);
      this.shockwave(landing.x, landing.y - 2);
      const flight = { x: landing.x, y: landing.y, altitude: 0 };
      this.flight = flight;
      this.move({ targets: flight, x: overFire.x, y: overFire.y, duration: pass, ease: 'Sine.InOut' });
      this.move({ targets: flight, altitude: 44, duration: pass, ease: 'Quad.Out' });
    });
    this.at(at + pass - 200, () => {
      const middle = FIRE_WALL[Math.floor(FIRE_WALL.length / 2)];
      this.flame({ x: hero.x + 22, y: hero.y - 40 }, { x: middle.x * TILE + 8, y: middle.y * TILE + 8 });
    });
    this.at(at + pass - 40, () => this.lightFireWall());
    this.at(at + pass, () => {
      const flight = this.flight!;
      audioManager.play('cry', { species: this.cast.hero.dexId });
      this.move({ targets: flight, x: away.x, y: away.y, duration: 900, ease: 'Quad.In' });
      this.move({
        targets: flight,
        altitude: 72,
        duration: 900,
        ease: 'Quad.Out',
        onComplete: () => {
          this.flight = null;
          hero.setVisible(false);
          shadow.setVisible(false);
        },
      });
    });
  }

  /** The road shut, hedge to hedge, and burning until the picture cuts away. */
  private lightFireWall(): void {
    this.cameras.main.shake(300, 0.014);
    audioManager.play('hitSpecial');
    audioManager.play('criticalHit');
    const spots = FIRE_WALL.map((tile) => ({ x: tile.x * TILE + 8, y: tile.y * TILE + 12 }));
    for (const spot of spots) {
      this.fire.explode(30, spot.x, spot.y);
      this.smoke.explode(4, spot.x, spot.y);
    }
    const middle = spots[Math.floor(spots.length / 2)];
    const glow = this.world(this.add.image(middle.x, middle.y, 'arena-intro-light').setDepth(DEPTH.light).setBlendMode(Phaser.BlendModes.ADD));
    this.move({ targets: glow, alpha: { from: 0.4, to: 0.22 }, duration: 180, yoyo: true, repeat: -1 });
    let turn = 0;
    const burning = this.time.addEvent({
      delay: 50,
      loop: true,
      callback: () => {
        turn += 1;
        for (const spot of spots) {
          this.fire.explode(3, spot.x, spot.y);
        }
        if (turn % 6 === 0) {
          this.smoke.explode(2, spots[turn % spots.length].x, spots[turn % spots.length].y - 6);
        }
      },
    });
    this.at(beatStart('arena'), () => {
      burning.remove();
      glow.destroy();
    });
  }

  /** EXTRACTED, and what came home. */
  private extracted(): void {
    const start = beatStart('extracted');
    this.at(start, () => {
      const area = this.area();
      const dim = this.ui(this.add.rectangle(0, area.y, this.scale.width, area.height, 0x000000, 0.6).setOrigin(0, 0).setDepth(DEPTH.ui + 2));
      this.time.delayedCall(beatStart('arena') - start, () => dim.destroy());
      const word = this.bigWord('arena-intro-extracted', this.words.extracted, GREEN, '40px', area.y + 22, 0);
      this.time.delayedCall(beatStart('arena') - start, () => word.destroy());
      audioManager.play('victory');
      const found = this.cast.finds;
      const spacing = 96;
      const left = Math.round(this.scale.width / 2 - (spacing * (found.length - 1)) / 2);
      found.forEach((find, index) => {
        this.time.delayedCall(700 + index * 360, () => {
          if (this.leaving) return;
          audioManager.play('itemObtained');
          const x = left + index * spacing;
          const y = area.y + Math.round(area.height * 0.55);
          const icon = this.ui(this.add.image(x, y, iconTextureKey(itemIconName(find.id))).setScale(2).setDepth(DEPTH.ui + 11));
          const name = this.ui(
            this.add
              .text(x, y + 20, find.name, { fontFamily: GAME_FONT, fontSize: CHIP_FONT_SIZE, color: '#f8f8f0' })
              .setOrigin(0.5, 0)
              .setDepth(DEPTH.ui + 11),
          );
          this.time.delayedCall(beatStart('arena') - start - 700 - index * 360, () => {
            icon.destroy();
            name.destroy();
          });
        });
      });
    });
    this.at(beatStart('arena') - 400, () => {
      this.cameras.main.fadeOut(380, 0, 0, 0);
    });
  }

  /** Back at the Arena's door, where the host asks. */
  private arena(): void {
    const start = beatStart('arena');
    const arenaSize = { width: this.arenaMap.width, height: this.arenaMap.height };
    const main = this.cameras.main;
    const player = this.person(this.playerTexture, null, ARENA_ORIGIN, ARENA_PLAYER, 'up');
    this.partner(this.cast.partner.id as PartnerSpeciesId, ARENA_ORIGIN, ARENA_PARTNER, 'left');
    const host = this.person(characterDesignTextureKey('gym-guide'), 'gym-guide', ARENA_ORIGIN, ARENA_HOST, 'right');
    this.at(start, () => {
      main.stopFollow();
      main.setZoom(1);
      this.frameSet(ARENA_ORIGIN, arenaSize.width, arenaSize.height);
      main.centerOn(ARENA_ORIGIN.x + 8 * TILE + 8, ARENA_ORIGIN.y + 12 * TILE + 8);
      main.fadeIn(420, 0, 0, 0);
    });
    this.at(start + 600, () => {
      this.face(player, 'left');
      this.face(host, 'right');
      this.say(this.words.host[0]);
    });
    this.at(start + 4400, () => this.say(this.words.host[1]));
  }

  /** PACK YOUR LOADOUT, held until a key is pressed. */
  private loadoutCard(): void {
    const start = beatStart('loadout');
    this.at(start, () => {
      this.closeBox();
      const area = this.area();
      this.ui(this.add.rectangle(0, area.y, this.scale.width, area.height, 0x000000, 0.62).setOrigin(0, 0).setDepth(DEPTH.ui + 2));
      audioManager.play('prizeSighted');
      const [first, second] = splitCard(this.words.loadout);
      const top = area.y + Math.round(area.height * 0.22);
      const line1 = this.bigWord('arena-intro-book', first, GOLD, '30px', top, 0);
      this.bigWord('arena-intro-start', second, MINT, '20px', top + Math.round(line1.height) + 8, 0);
      const press = this.ui(
        this.add
          .text(Math.round(this.scale.width / 2), area.y + area.height - 30, this.words.press, {
            fontFamily: GAME_FONT,
            fontSize: DIALOG_FONT_SIZE,
            color: '#f8f8f0',
          })
          .setOrigin(0.5, 0)
          .setDepth(DEPTH.ui + 12),
      );
      this.move({ targets: press, alpha: { from: 1, to: 0.2 }, duration: 520, yoyo: true, repeat: -1 });
    });
  }

  // -- textures --------------------------------------------------------------

  private makeTextures(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    if (!this.textures.exists('arena-intro-fx')) {
      const canvas = this.textures.createCanvas('arena-intro-fx', 32, 6)!;
      const context = canvas.getContext();
      const paint = (x: number, y: number, w: number, h: number, colour: string) => {
        context.fillStyle = colour;
        context.fillRect(x, y, w, h);
      };
      // A frame each, a column apart, so no frame takes a neighbour's edge.
      paint(0, 0, 3, 3, '#f8a030');
      paint(1, 1, 1, 1, '#fff8c0');
      paint(4, 0, 2, 2, '#f8d040');
      paint(7, 0, 2, 2, '#ffffff');
      paint(10, 0, 4, 4, '#787888');
      paint(11, 1, 2, 2, '#9898a8');
      paint(15, 0, 1, 1, '#d8f878');
      paint(17, 0, 5, 5, '#e85020');
      paint(18, 1, 3, 3, '#f8a030');
      paint(19, 2, 1, 1, '#fff8c0');
      paint(23, 0, 3, 3, '#fff8c0');
      paint(24, 1, 1, 1, '#ffffff');
      canvas.add('ember', 0, 0, 0, 3, 3);
      canvas.add('flame', 0, 4, 0, 2, 2);
      canvas.add('spark', 0, 7, 0, 2, 2);
      canvas.add('smoke', 0, 10, 0, 4, 4);
      canvas.add('firefly', 0, 15, 0, 1, 1);
      canvas.add('blaze', 0, 17, 0, 5, 5);
      canvas.add('core', 0, 23, 0, 3, 3);
      canvas.refresh();
    }
    if (!this.textures.exists('arena-intro-light')) {
      const radius = 40;
      const canvas = this.textures.createCanvas('arena-intro-light', radius * 2, radius * 2)!;
      const context = canvas.getContext();
      for (const [r, alpha] of [[40, 0.35], [30, 0.6], [20, 1]] as const) {
        context.fillStyle = `rgba(255, 236, 180, ${alpha})`;
        context.beginPath();
        context.arc(radius, radius, r, 0, Math.PI * 2);
        context.fill();
      }
      canvas.refresh();
    }
    if (!this.textures.exists('arena-intro-star')) {
      const canvas = this.textures.createCanvas('arena-intro-star', 5, 5)!;
      const context = canvas.getContext();
      context.fillStyle = '#ffffff';
      context.fillRect(2, 0, 1, 5);
      context.fillRect(0, 2, 5, 1);
      canvas.refresh();
    }
    if (!this.textures.exists('arena-intro-alert')) {
      // FireRed's surprise balloon: a white bubble round a black "!".
      const rows = ['.oooooooo.', 'oWWWWWWWWo', 'oWWWkkWWWo', 'oWWWkkWWWo', 'oWWWkkWWWo', 'oWWWkkWWWo', 'oWWWWWWWWo', 'oWWWkkWWWo', 'oWWWWWWWWo', '.ooooWooo.', '....oo....'];
      const canvas = this.textures.createCanvas('arena-intro-alert', 10, rows.length)!;
      const context = canvas.getContext();
      rows.forEach((row, y) =>
        [...row].forEach((pixel, x) => {
          if (pixel === '.') return;
          context.fillStyle = pixel === 'o' || pixel === 'k' ? '#181818' : '#f8f8f8';
          context.fillRect(x, y, 1, 1);
        }),
      );
      canvas.refresh();
    }
    for (const [key, colour] of [['arena-intro-vignette', '8, 10, 30'], ['arena-intro-vignette-red', String(hexRgb(ALERT_RED))]] as const) {
      if (this.textures.exists(key)) {
        this.textures.remove(key);
      }
      const canvas = this.textures.createCanvas(key, width, height)!;
      const context = canvas.getContext();
      // Stepped rather than smooth, so the dark comes in a band at a time, as
      // FireRed's own fades do.
      const steps = 6;
      for (let step = 0; step < steps; step += 1) {
        const inset = Math.round((step / steps) * Math.min(width, height) * 0.24);
        context.fillStyle = `rgba(${colour}, ${0.11})`;
        context.fillRect(0, 0, width, inset);
        context.fillRect(0, height - inset, width, inset);
        context.fillRect(0, inset, inset, height - inset * 2);
        context.fillRect(width - inset, inset, inset, height - inset * 2);
      }
      canvas.refresh();
    }
  }
}

/** The run: a step's time, a shade slower than the hunter's once the hunter is on the road. */
const RUN_STEP_MS = 150;
const HUNTER_STEP_MS = 140;
/** When, into the escape, the hunter breaks out; and how long the hero then takes to reach the fire. */
const BREAK_OUT_MS = 2240;
const HUNTER_FIRE_MS = 1480;

/** The hero's place on the ground where it lands. */
function heroGround(): { x: number; y: number } {
  return { x: HERO_LANDING.x * TILE + 8, y: HERO_LANDING.y * TILE + TILE + 2 };
}

/** Which find is the prize, and gleams. */
const FIND_PRIZE = 2;

function hexRgb(colour: number): string {
  return `${(colour >> 16) & 0xff}, ${(colour >> 8) & 0xff}, ${colour & 0xff}`;
}

/** PACK YOUR LOADOUT / TO START THE RAID: the card's two lines. */
function splitCard(line: string): [string, string] {
  const at = line.indexOf(' TO ');
  return at < 0 ? [line, ''] : [line.slice(0, at), line.slice(at + 1)];
}
