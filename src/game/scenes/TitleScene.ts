import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { SaveManager, type SaveSummary } from '../save/SaveManager';
import { getStarterSpecies } from '../stash';
import { GAME_FONT } from '../ui/gameFont';
import { drawMenuCursor, drawPixelWindow, WINDOW_BORDER, WINDOW_CREAM, WINDOW_INK } from '../ui/pixelWindow';
import {
  eraseMenu,
  layoutTitleMenu,
  moveTitleChoice,
  moveTitleChoiceAcross,
  needsEraseConfirmation,
  playtestMenu,
  titleHint,
  titleMenu,
  type TitleChoiceId,
  type TitleMenu,
  type TitleRow,
} from '../ui/titleMenu';
import {
  chaseAt,
  CHASE_LANE,
  cursorNudge,
  duskBands,
  hash01,
  logoGlint,
  shineColumn,
  shineStrength,
  sparkleAt,
  sparklePixels,
  TITLE_TOWN,
  townDrift,
  vignetteBands,
} from '../ui/titleScenery';
import { setActiveSaveSlot } from '../dev/playtestMode';
import { isReviewReturn } from '../maker/review';
import { createPlaytestGame, withEverythingCurrent } from '../dev/playtestSave';
import { CHIP_FONT_SIZE, DIALOG_FONT_SIZE } from '../ui/screenType';
import { TILE_SIZE, WORLD_MAPS, type WorldMapDefinition } from '../worldMap';
import { characterDesignTextureKey } from '../world/characterDesigns';
import { getWalkAnimationKey } from '../playerFrames';
import { isPartnerSpecies, partnerFrame, partnerTextureKey, PARTNER_FEET_PIXEL_Y, type PartnerSpeciesId } from '../base/partner';

/**
 * The first screen anyone sees, and the living version of the front page's
 * banner (`docs/readme/hero.svg`): Viridian City drifting by at dusk under a
 * sky's worth of sparkles, the name lit gold with a shine crossing it, a
 * trainer legging it along the foot of the screen with their partner at their
 * heel and Blue right behind - and the menu, on the game's own windows.
 *
 * Nothing here is new art. The town is the real map drawn through the same
 * layers the raid uses; the figures are the overworld's own FireRed sheets and
 * the partner the harbour's HeartGold follower; every letter is Orange Kid cut
 * by `pixelText.ts`, and the name's outline, depth and shine are that same
 * lettering stamped again in other colours. What moves, and when, is
 * `ui/titleScenery.ts`, which is pure and tested; this only draws it.
 */

const DUSK = 0x0a1428;
const MINT = 0x8ed4c2;
const RAID_RED = 0xb0201c;

const TITLE_MAIN = '#f8f5d7';
const TAGLINE = '#cfdce6';
/** A choice that would do nothing: dimmer than the cream window, and its words with it. */
const DISABLED_FILL = 0xc3c29d;
const DISABLED_INK = '#75745f';
/** What a window casts on the town under it. */
const SHADOW_ALPHA = 0.55;

/** The name, set at four times Orange Kid's own grid so every stem is a whole four pixels. */
const NAME_SIZE = '50px';
/** "ESCAPE FROM", at twice the grid. */
const OVERLINE_SIZE = '25px';
/** The lettering's colours, top row to bottom: a gold that reads against dusk. */
const NAME_FILL = ['#fffbe6', '#ffe58a', '#ffd04a', '#f4a933'] as const;
const NAME_RIM = '#2c5aa0';
const NAME_DEPTH = '#1c3768';
const NAME_EDGE = '#0a1428';
const SHINE = { r: 255, g: 255, b: 255 };
const OVERLINE_FILL = '#8ed4c2';
/** How far the name stands up off the town: the depth drawn under the letters. */
const NAME_DEPTH_PX = 3;

const SPARKLE_COUNT = 12;
const SPARKLE_INK = 0xfff6c8;
const PARTNER_STARTERS: readonly PartnerSpeciesId[] = ['bulbasaur', 'charmander', 'squirtle'];

/** The tagline, as the front page says it. */
const TAGLINE_TEXT = 'GRAB THE LOOT. BEAT THE CLOCK. LEG IT.';

/** One canvas the logo is stamped into, and the pixels the shine may light. */
interface Logo {
  readonly key: string;
  readonly canvas: HTMLCanvasElement;
  readonly base: ImageData;
  /** Indexes of the pixels that are the name's own fill, which is all a shine lights. */
  readonly fill: Uint8Array;
  /** Where the name's fill sits inside the canvas, for the shine's slant. */
  readonly name: { readonly x: number; readonly y: number; readonly width: number; readonly height: number };
}

export class TitleScene extends Phaser.Scene {
  private hasStarted = false;
  /** The key hint under the menu; it pulses until something is chosen. */
  private prompt: Phaser.GameObjects.Text[] = [];
  private built: Phaser.GameObjects.GameObject[] = [];
  /** The menu's own objects, so moving the cursor redraws the menu and nothing under it. */
  private menuBuilt: Phaser.GameObjects.GameObject[] = [];
  private titleBottom = 0;
  private readonly saveManager = new SaveManager();
  private summary: SaveSummary = { kind: 'none' };
  /**
   * The explorer run's save, read through a manager pinned to that slot: the
   * title has to say whether there is one to carry on without switching the
   * game into it.
   */
  private readonly playtestSaveManager = new SaveManager(undefined, 'playtest');
  private playtestSummary: SaveSummary = { kind: 'none' };
  private menu: TitleMenu = titleMenu({ kind: 'none' });
  private choice: TitleChoiceId = 'new';
  private redrawPending = false;

  /** When this visit began: everything that moves is a function of the time since. */
  private bornAt = 0;
  /** People who asked their system for less motion get the picture, still. */
  private still = false;
  private townLayers: Phaser.Tilemaps.TilemapLayer[] = [];
  private townSpan = 0;
  private townStart = 0;
  private sky!: Phaser.GameObjects.Graphics;
  private glint!: Phaser.GameObjects.Graphics;
  private trainer!: Phaser.GameObjects.Sprite;
  private partner!: Phaser.GameObjects.Sprite;
  private rival!: Phaser.GameObjects.Sprite;
  private rivalMark!: Phaser.GameObjects.Graphics;
  private partnerSpecies: PartnerSpeciesId = 'charmander';
  private chaseHeading: 1 | -1 | 0 = 0;
  private logo: Logo | null = null;
  private shineAt: number | null = null;
  /** Where the logo was put on screen, for the glint the shine leaves on it. */
  private logoAt = { x: 0, y: 0 };
  private cursor: { graphics: Phaser.GameObjects.Graphics; x: number; y: number } | null = null;

  public constructor() {
    super('title');
  }

  public create(): void {
    this.hasStarted = false;
    this.redrawPending = false;
    this.built = [];
    this.menuBuilt = [];
    this.prompt = [];
    // The title is the one screen both games are reached from, so it is where
    // the slot is set - every ordinary path leaves it on the ordinary save, and
    // only the playtest row moves it. That is what makes an explorer run
    // unreachable by accident rather than merely unlikely.
    setActiveSaveSlot('normal');
    // GitHub sends the map reviewer back to the game's own address; the
    // review list is where they were going, so they go straight there.
    if (isReviewReturn()) {
      this.hasStarted = true;
      this.scene.start('mapmaker', { review: true });
      return;
    }
    // Asked once per visit, not per frame: the summary reads the whole save.
    this.summary = this.saveManager.describe();
    this.playtestSummary = this.playtestSaveManager.describe();
    this.menu = titleMenu(this.summary);
    this.choice = this.menu.initial;
    this.bornAt = this.time.now;
    this.still = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
    // Your own partner runs at your heel; a new player sees one of the three
    // they are about to choose between.
    const saved = this.summary.kind === 'game' ? this.summary.partner : undefined;
    this.partnerSpecies = saved && isPartnerSpecies(saved)
      ? saved
      : PARTNER_STARTERS[Math.floor(Math.random() * PARTNER_STARTERS.length)];
    this.logo = this.makeLogo();
    this.build();
    this.cameras.main.fadeIn(420, 10, 20, 40);

    const relayout = () => this.rebuild();
    this.scale.on?.(Phaser.Scale.Events.RESIZE, relayout);
    const keyboard = this.input.keyboard;
    keyboard?.on('keydown-ENTER', () => this.chooseSelected());
    keyboard?.on('keydown-SPACE', () => this.chooseSelected());
    keyboard?.on('keydown-UP', () => this.moveCursor(-1));
    keyboard?.on('keydown-DOWN', () => this.moveCursor(1));
    keyboard?.on('keydown-W', () => this.moveCursor(-1));
    keyboard?.on('keydown-S', () => this.moveCursor(1));
    keyboard?.on('keydown-LEFT', () => this.moveAcross(-1));
    keyboard?.on('keydown-RIGHT', () => this.moveAcross(1));
    keyboard?.on('keydown-A', () => this.moveAcross(-1));
    keyboard?.on('keydown-D', () => this.moveAcross(1));
    keyboard?.on('keydown-ESC', () => this.backOut());
    keyboard?.on('keydown-M', () => audioManager.toggleMute());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off?.(Phaser.Scale.Events.RESIZE, relayout);
      keyboard?.removeAllListeners();
      audioManager.stopTheme();
      if (this.logo && this.textures.exists(this.logo.key)) {
        this.textures.remove(this.logo.key);
      }
      this.logo = null;
    });
  }

  public update(time: number): void {
    if (this.prompt.length === 0) {
      return;
    }
    const since = time - this.bornAt;
    this.animate(this.still ? 0 : since);
    if (this.hasStarted) {
      return;
    }
    const pulse = (Math.sin(time / 260) + 1) / 2;
    for (const words of this.prompt) {
      words.setAlpha(0.7 + pulse * 0.3);
    }
  }

  private setPrompt(text: string): void {
    for (const words of this.prompt) {
      words.setText(text);
    }
  }

  private rebuild(): void {
    const label = this.hasStarted ? this.prompt[0]?.text : null;
    for (const object of [...this.built, ...this.menuBuilt]) {
      object.destroy();
    }
    this.built = [];
    this.menuBuilt = [];
    this.build();
    if (label) {
      this.setPrompt(label);
    }
  }

  private rebuildMenu(): void {
    for (const object of this.menuBuilt) {
      object.destroy();
    }
    this.menuBuilt = [];
    this.createMenu(this.scale.width, this.scale.height, this.titleBottom);
    this.animate(this.still ? 0 : this.time.now - this.bornAt);
  }

  /** Drawn to the live screen size, on whole pixels. */
  private build(): void {
    const width = this.scale.width;
    const height = this.scale.height;
    this.drawTown(width, height);
    this.drawDusk(width, height);
    this.sky = this.track(this.add.graphics().setDepth(6));
    this.glint = this.track(this.add.graphics().setDepth(12));
    this.createChase(height);
    this.titleBottom = this.createTitle(width, height);
    this.createMenu(width, height, this.titleBottom);
    this.animate(this.still ? 0 : this.time.now - this.bornAt);
  }

  private track<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.built.push(object);
    return object;
  }

  private trackMenu<T extends Phaser.GameObjects.GameObject>(object: T): T {
    this.menuBuilt.push(object);
    return object;
  }

  // -- the town --------------------------------------------------------------

  /**
   * A band of the real map, the whole width of the town, laid once and slid
   * under the screen a pixel at a time. The tiles are never scaled, so they
   * stay whole on any stage.
   */
  private drawTown(width: number, height: number): void {
    const map: WorldMapDefinition = WORLD_MAPS[TITLE_TOWN.map];
    const columns = map.width;
    const rows = TITLE_TOWN.rows;
    const tilemap = this.make.tilemap({ width: columns, height: rows, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const sheets = map.tileset.sources.map((source) => {
      const sheet = tilemap.addTilesetImage(source.textureKey, source.textureKey, TILE_SIZE, TILE_SIZE, 0, 0, source.firstIndex);
      if (!sheet) {
        throw new Error(`Tileset '${source.textureKey}' failed to load.`);
      }
      return sheet;
    });

    const backing = this.add.graphics().setDepth(-1);
    backing.fillStyle(DUSK, 1);
    backing.fillRect(0, 0, width, height);
    this.track(backing);

    const originY = Math.floor((height - rows * TILE_SIZE) / 2);
    const { ground, overlay, detail, canopy, brim } = map.layers;
    const layers = { ground, overlay, detail, canopy, brim };
    this.townLayers = [];
    let depth = 0;
    for (const [name, layer] of Object.entries(layers)) {
      const created = tilemap.createBlankLayer(name, sheets, 0, originY);
      if (!created) {
        throw new Error(`Tilemap layer '${name}' failed to initialize.`);
      }
      created.putTilesAt(layer.tiles.slice(TITLE_TOWN.top, TITLE_TOWN.top + rows), 0, 0);
      created.forEachTile((tile) => {
        const tint = layer.tints[TITLE_TOWN.top + tile.y]?.[tile.x] ?? -1;
        if (tint >= 0) {
          tile.tint = tint;
        }
      });
      created.setDepth(depth);
      depth += 1;
      this.townLayers.push(this.track(created));
    }
    this.track(tilemap as unknown as Phaser.GameObjects.GameObject);
    this.townSpan = Math.max(0, columns * TILE_SIZE - width);
    // The first thing seen is the gym and the main street, not the wood at the town's edge.
    this.townStart = Math.min(this.townSpan, Math.max(0, Math.round(columns * TILE_SIZE * 0.42 - width / 2)));
  }

  /** Dusk, in stepped bands: heavy over the sky-end of the screen, lightest just under the middle. */
  private drawDusk(width: number, height: number): void {
    const dusk = this.add.graphics().setDepth(5);
    for (const band of duskBands(height)) {
      dusk.fillStyle(DUSK, band.alpha);
      dusk.fillRect(0, band.y, width, band.height);
    }
    for (const band of vignetteBands()) {
      dusk.fillStyle(DUSK, band.alpha);
      dusk.fillRect(band.inset, 0, band.width, height);
      dusk.fillRect(width - band.inset - band.width, 0, band.width, height);
    }
    this.track(dusk);
  }

  // -- the chase ---------------------------------------------------------------

  private createChase(height: number): void {
    const feet = height - 3;
    const trainerKey = characterDesignTextureKey('protagonist-red');
    const rivalKey = characterDesignTextureKey('blue');
    // A figure's frame is 16x32 with its soles on the bottom row.
    this.trainer = this.track(this.add.sprite(-100, feet, trainerKey).setOrigin(0.5, 1).setDepth(7));
    this.rival = this.track(this.add.sprite(-100, feet, rivalKey).setOrigin(0.5, 1).setDepth(7));
    this.partner = this.track(
      this.add
        .sprite(-100, feet + (32 - 1 - PARTNER_FEET_PIXEL_Y), partnerTextureKey(this.partnerSpecies))
        .setOrigin(0.5, 1)
        .setDepth(7),
    );
    // Blue's "!": the mark a trainer shows when they have seen you.
    this.rivalMark = this.track(this.add.graphics().setDepth(7));
    this.rivalMark.fillStyle(WINDOW_BORDER, 1);
    this.rivalMark.fillRect(1, 0, 9, 1);
    this.rivalMark.fillRect(1, 10, 9, 1);
    this.rivalMark.fillRect(0, 1, 1, 9);
    this.rivalMark.fillRect(10, 1, 1, 9);
    this.rivalMark.fillRect(4, 11, 3, 1);
    this.rivalMark.fillRect(5, 12, 1, 1);
    this.rivalMark.fillStyle(0xffffff, 1);
    this.rivalMark.fillRect(1, 1, 9, 9);
    this.rivalMark.fillStyle(RAID_RED, 1);
    this.rivalMark.fillRect(5, 2, 1, 5);
    this.rivalMark.fillRect(5, 8, 1, 1);
    this.chaseHeading = 0;
    for (const figure of [this.trainer, this.rival, this.partner, this.rivalMark]) {
      figure.setVisible(false);
    }
  }

  private placeChase(since: number): void {
    const width = this.scale.width;
    const chase = this.still || this.hasStarted ? null : chaseAt(since, width);
    const running = chase?.running === true;
    for (const figure of [this.trainer, this.rival, this.partner, this.rivalMark]) {
      figure.setVisible(running);
    }
    if (!chase || !running) {
      this.chaseHeading = 0;
      return;
    }
    if (chase.heading !== this.chaseHeading) {
      this.chaseHeading = chase.heading;
      const direction = chase.heading === 1 ? 'right' : 'left';
      for (const figure of [this.trainer, this.rival]) {
        const key = getWalkAnimationKey(direction, figure.texture.key);
        figure.play({ key, frameRate: 14, repeat: -1 });
      }
    }
    this.trainer.setX(chase.trainerX);
    this.rival.setX(chase.rivalX);
    this.partner.setX(chase.partnerX);
    this.partner.setFrame(partnerFrame(chase.heading === 1 ? 'right' : 'left', (Math.floor(since / 130) % 2) as 0 | 1));
    // Over Blue's head, a pixel's hop now and then, as a seen-you mark does.
    const hop = Math.floor(since / 250) % 2;
    this.rivalMark.setPosition(chase.rivalX - 5, this.rival.y - 34 - hop);
  }

  // -- the name ------------------------------------------------------------------

  /**
   * One word set by the game itself, as a mask: Orange Kid cut to whole pixels
   * by `pixelText.ts`, every inked pixel opaque and every other clear, cropped
   * to its ink.
   */
  private lettering(text: string, fontSize: string): HTMLCanvasElement {
    const words = this.make.text({ x: 0, y: 0, text, style: { fontFamily: GAME_FONT, fontSize, color: '#ffffff' } }, false);
    words.updateText();
    const source = words.canvas;
    const context = source.getContext('2d', { willReadFrequently: true })!;
    const data = context.getImageData(0, 0, source.width, source.height);
    let top = source.height;
    let bottom = -1;
    let left = source.width;
    let right = -1;
    for (let y = 0; y < source.height; y += 1) {
      for (let x = 0; x < source.width; x += 1) {
        const at = (y * source.width + x) * 4 + 3;
        const on = data.data[at] >= 128;
        data.data[at] = on ? 255 : 0;
        if (on) {
          top = Math.min(top, y);
          bottom = Math.max(bottom, y);
          left = Math.min(left, x);
          right = Math.max(right, x);
        }
      }
    }
    const mask = document.createElement('canvas');
    mask.width = Math.max(1, right - left + 1);
    mask.height = Math.max(1, bottom - top + 1);
    mask.getContext('2d')!.putImageData(data, -left, -top);
    words.destroy();
    return mask;
  }

  /** The mask in one colour. */
  private static tinted(mask: HTMLCanvasElement, color: string): HTMLCanvasElement {
    const tinted = document.createElement('canvas');
    tinted.width = mask.width;
    tinted.height = mask.height;
    const context = tinted.getContext('2d')!;
    context.drawImage(mask, 0, 0);
    context.globalCompositeOperation = 'source-in';
    context.fillStyle = color;
    context.fillRect(0, 0, mask.width, mask.height);
    return tinted;
  }

  /**
   * Stamps `mask` at every offset within `reach` (a rounded square, its
   * corners left off) and `drop` further down - which is how a one-colour
   * outline and the depth under it are drawn out of the letters themselves.
   */
  private static stamp(
    context: CanvasRenderingContext2D,
    mask: HTMLCanvasElement,
    color: string,
    x: number,
    y: number,
    reach: number,
    drop: number,
  ): void {
    const ink = TitleScene.tinted(mask, color);
    for (let dy = -reach; dy <= reach + drop; dy += 1) {
      for (let dx = -reach; dx <= reach; dx += 1) {
        const cornerY = dy < -reach + 1 ? -reach : dy > reach + drop - 1 ? reach : 0;
        if (reach > 0 && Math.abs(dx) === reach && Math.abs(cornerY) === reach) {
          continue;
        }
        context.drawImage(ink, x + dx, y + dy);
      }
    }
  }

  /**
   * The logo: ESCAPE FROM in mint over PALLET TOWN in banded gold, each rimmed,
   * edged and stood up off the town by the depth under it. Built once a visit
   * into a canvas the shine can re-light without redrawing anything else.
   */
  private makeLogo(): Logo {
    const name = this.lettering('PALLET TOWN', NAME_SIZE);
    const overline = this.lettering('ESCAPE FROM', OVERLINE_SIZE);
    const pad = 3;
    const width = Math.max(name.width, overline.width) + pad * 2;
    const overlineY = pad;
    const nameX = Math.round((width - name.width) / 2);
    const nameY = overlineY + overline.height + 6;
    const height = nameY + name.height + NAME_DEPTH_PX + pad;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true })!;

    // The name: an edge round everything, the rim inside it, the depth below.
    TitleScene.stamp(context, name, NAME_EDGE, nameX, nameY, 2, NAME_DEPTH_PX);
    TitleScene.stamp(context, name, NAME_DEPTH, nameX, nameY, 1, NAME_DEPTH_PX - 1);
    TitleScene.stamp(context, name, NAME_RIM, nameX, nameY, 1, 0);
    // The fill, banded top to bottom.
    const fill = document.createElement('canvas');
    fill.width = name.width;
    fill.height = name.height;
    const fillContext = fill.getContext('2d')!;
    const bands = [0, 0.22, 0.5, 0.78, 1];
    NAME_FILL.forEach((color, index) => {
      const from = Math.round(name.height * bands[index]);
      const to = Math.round(name.height * bands[index + 1]);
      fillContext.fillStyle = color;
      fillContext.fillRect(0, from, name.width, to - from);
    });
    fillContext.globalCompositeOperation = 'destination-in';
    fillContext.drawImage(name, 0, 0);
    context.drawImage(fill, nameX, nameY);

    // ESCAPE FROM: mint, edged, and a pixel of depth.
    const overlineX = Math.round((width - overline.width) / 2);
    TitleScene.stamp(context, overline, NAME_EDGE, overlineX, overlineY, 1, 1);
    context.drawImage(TitleScene.tinted(overline, OVERLINE_FILL), overlineX, overlineY);

    const base = context.getImageData(0, 0, width, height);
    const nameMask = name.getContext('2d')!.getImageData(0, 0, name.width, name.height).data;
    const fillPixels = new Uint8Array(width * height);
    for (let y = 0; y < name.height; y += 1) {
      for (let x = 0; x < name.width; x += 1) {
        if (nameMask[(y * name.width + x) * 4 + 3] === 255) {
          fillPixels[(nameY + y) * width + nameX + x] = 1;
        }
      }
    }
    const key = 'title-logo';
    if (this.textures.exists(key)) {
      this.textures.remove(key);
    }
    this.textures.addCanvas(key, canvas);
    this.shineAt = null;
    return { key, canvas, base, fill: fillPixels, name: { x: nameX, y: nameY, width: name.width, height: name.height } };
  }

  /** Re-lights the name for a shine whose foot is on `column`, or puts it back. */
  private shine(column: number | null): void {
    const logo = this.logo;
    if (!logo || column === this.shineAt) {
      return;
    }
    this.shineAt = column;
    const context = logo.canvas.getContext('2d')!;
    if (column === null) {
      context.putImageData(logo.base, 0, 0);
    } else {
      const lit = new ImageData(new Uint8ClampedArray(logo.base.data), logo.base.width, logo.base.height);
      const { x: nameX, y: nameY, height } = logo.name;
      for (let index = 0; index < logo.fill.length; index += 1) {
        if (!logo.fill[index]) {
          continue;
        }
        const x = (index % logo.base.width) - nameX;
        const y = Math.floor(index / logo.base.width) - nameY;
        const strength = shineStrength(column, x, y, height);
        if (strength > 0) {
          const at = index * 4;
          lit.data[at] += Math.round((SHINE.r - lit.data[at]) * strength);
          lit.data[at + 1] += Math.round((SHINE.g - lit.data[at + 1]) * strength);
          lit.data[at + 2] += Math.round((SHINE.b - lit.data[at + 2]) * strength);
        }
      }
      context.putImageData(lit, 0, 0);
    }
    (this.textures.get(logo.key) as Phaser.Textures.CanvasTexture).refresh();
  }

  /** The words the canvas text draws, edged a pixel all round so they read over the town. */
  private edgedWords(
    x: number,
    y: number,
    text: string,
    color: string,
    fontSize: string,
    depth: number,
    keep: <T extends Phaser.GameObjects.GameObject>(object: T) => T,
  ): Phaser.GameObjects.Text[] {
    const style = { fontFamily: GAME_FONT, fontSize, color: '#0a1428' };
    const words: Phaser.GameObjects.Text[] = [];
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [1, 1]] as const) {
      words.push(keep(this.add.text(x + dx, y + dy, text, style).setOrigin(0.5, 0).setDepth(depth)));
    }
    words.push(keep(this.add.text(x, y, text, { ...style, color }).setOrigin(0.5, 0).setDepth(depth)));
    return words;
  }

  /** The logo and the tagline under it. Returns the bottom of both. */
  private createTitle(width: number, height: number): number {
    const logo = this.logo!;
    const top = Math.max(6, Math.round(height * 0.035));
    const left = Math.floor((width - logo.canvas.width) / 2);
    this.track(this.add.image(left, top, logo.key).setOrigin(0, 0).setDepth(10));
    this.logoAt = { x: left, y: top };
    const logoBottom = top + logo.canvas.height;

    const centre = Math.floor(width / 2);
    const taglineY = logoBottom + 2;
    this.edgedWords(centre, taglineY, TAGLINE_TEXT, TAGLINE, CHIP_FONT_SIZE, 10, (object) => this.track(object));

    return taglineY + 10;
  }

  // -- every frame -------------------------------------------------------------

  private animate(since: number): void {
    const drift = townDrift(since, this.townSpan, this.townStart);
    for (const layer of this.townLayers) {
      layer.setX(-drift);
    }
    this.drawSky(since);
    this.placeChase(since);
    if (this.logo) {
      const { name } = this.logo;
      this.shine(this.still ? null : shineColumn(since, name.width, name.height));
      // The glint sits on the last letter's top-right shoulder.
      this.glint.clear();
      const size = this.still ? 0 : logoGlint(since, name.width, name.height);
      const glintX = this.logoAt.x + name.x + name.width - 2;
      const glintY = this.logoAt.y + name.y + 1;
      for (const [dx, dy] of sparklePixels(size)) {
        this.glint.fillStyle(dx === 0 && dy === 0 ? 0xffffff : SPARKLE_INK, 1);
        this.glint.fillRect(glintX + dx, glintY + dy, 1, 1);
      }
    }
    if (this.cursor) {
      this.cursor.graphics.setPosition(this.still ? 0 : cursorNudge(since), 0);
    }
  }

  /** Sparkles, each one somewhere new every time it comes back. */
  private drawSky(since: number): void {
    const sky = this.sky;
    sky.clear();
    if (this.still) {
      return;
    }
    const width = this.scale.width;
    const height = this.scale.height;
    for (let index = 0; index < SPARKLE_COUNT; index += 1) {
      const period = 2_600 + Math.floor(hash01(index, 7) * 2_400);
      const phase = Math.floor(hash01(index, 11) * period);
      const sparkle = sparkleAt(since, period, phase);
      if (sparkle.size === 0) {
        continue;
      }
      // Anywhere but the very edges; the windows are drawn over them anyway.
      const x = 6 + Math.floor(hash01(index, sparkle.cycle, 1) * (width - 12));
      const y = 6 + Math.floor(hash01(index, sparkle.cycle, 2) * (height - 12));
      for (const [dx, dy] of sparklePixels(sparkle.size)) {
        // White at the heart, warm towards the tips.
        sky.fillStyle(dx === 0 && dy === 0 ? 0xffffff : SPARKLE_INK, 1);
        sky.fillRect(x + dx, y + dy, 1, 1);
      }
    }
  }

  // -- the menu ------------------------------------------------------------------

  /**
   * The choices, on the game's cream window, with the drawn menu cursor beside
   * the one the keys are on. What each says and where it sits is
   * `ui/titleMenu.ts`; this only paints it. A choice that would do nothing is
   * drawn dim and gives the cursor nothing to land on, so a first-time player
   * sees CONTINUE is not there rather than being offered it. Every window
   * casts a shadow on the town under it, and the chosen one stands a pixel
   * proud of it.
   */
  private createMenu(width: number, height: number, titleBottom: number): void {
    // The chase has the foot of the screen; the menu stands clear of it.
    const layout = layoutTitleMenu(this.menu, width, height - CHASE_LANE, titleBottom);
    const keep = <T extends Phaser.GameObjects.GameObject>(object: T): T => this.trackMenu(object);
    this.cursor = null;
    if (this.menu.question && layout.question) {
      this.edgedWords(layout.question.x, layout.question.y - 7, this.menu.question, TITLE_MAIN, DIALOG_FONT_SIZE, 11, keep);
    }
    for (const row of layout.rows) {
      const choice = this.menu.choices.find((candidate) => candidate.id === row.id)!;
      const selected = row.id === this.choice && choice.enabled;
      const lift = selected ? 1 : 0;
      const shadow = this.add.graphics().setDepth(9);
      shadow.fillStyle(DUSK, SHADOW_ALPHA);
      shadow.fillRect(row.x + 1, row.y + 2, row.width, row.height);
      this.trackMenu(shadow);
      const bar = this.add.graphics().setDepth(10);
      const raised: TitleRow = { ...row, y: row.y - lift };
      drawPixelWindow(bar, raised, { fill: !choice.enabled ? DISABLED_FILL : selected ? MINT : WINDOW_CREAM });
      this.trackMenu(bar);
      if (selected) {
        const cursor = this.add.graphics().setDepth(11);
        const cursorY = raised.y + (choice.detail ? 9 : Math.round(raised.height / 2)) - 2;
        drawMenuCursor(cursor, raised.x + 6, cursorY, 0x202020);
        this.cursor = { graphics: this.trackMenu(cursor), x: raised.x + 6, y: cursorY };
      }
      const ink = choice.enabled ? WINDOW_INK : DISABLED_INK;
      const labelY = choice.detail ? raised.y + 11 : raised.y + Math.round(raised.height / 2);
      this.trackMenu(
        this.add
          .text(raised.x + Math.round(raised.width / 2), labelY, choice.label, {
            align: 'center',
            color: ink,
            fontFamily: GAME_FONT,
            fontSize: DIALOG_FONT_SIZE,
          })
          .setOrigin(0.5)
          .setDepth(11),
      );
      if (choice.detail) {
        this.trackMenu(
          this.add
            .text(raised.x + Math.round(raised.width / 2), raised.y + 24, choice.detail, {
              align: 'center',
              color: ink,
              fontFamily: GAME_FONT,
              fontSize: CHIP_FONT_SIZE,
            })
            .setOrigin(0.5)
            .setDepth(11),
        );
      }
      if (choice.enabled) {
        const hit = this.add
          .zone(row.x, row.y - 1, row.width, row.height + 1)
          .setOrigin(0, 0)
          .setDepth(12)
          .setInteractive({ useHandCursor: true });
        hit.on(Phaser.Input.Events.POINTER_OVER, () => this.pointTo(row.id));
        hit.on(Phaser.Input.Events.POINTER_DOWN, () => {
          this.choice = row.id;
          this.chooseSelected();
        });
        this.trackMenu(hit);
      }
    }
    this.prompt = this.edgedWords(layout.hint.x, layout.hint.y - 6, titleHint(this.menu, this.choice), TAGLINE, CHIP_FONT_SIZE, 11, keep);
  }

  private pointTo(choice: TitleChoiceId): void {
    if (this.hasStarted || this.choice === choice) {
      return;
    }
    this.choice = choice;
    this.redraw();
  }

  /**
   * Draws the menu again on the next tick. It is asked for from a pointer
   * handler, and a redraw destroys the very zone that raised the event - so it
   * waits for the handler to finish rather than pulling the object out from
   * under it.
   */
  private redraw(): void {
    if (this.redrawPending) {
      return;
    }
    this.redrawPending = true;
    this.time.delayedCall(0, () => {
      this.redrawPending = false;
      this.rebuildMenu();
    });
  }

  private moveCursor(step: -1 | 1): void {
    if (this.hasStarted) {
      return;
    }
    const next = moveTitleChoice(this.menu, this.choice, step);
    if (next !== this.choice) {
      this.choice = next;
      audioManager.play('select');
      this.redraw();
    }
  }

  /** Left and Right: only ever to the choice beside this one. */
  private moveAcross(step: -1 | 1): void {
    if (this.hasStarted) {
      return;
    }
    const next = moveTitleChoiceAcross(this.menu, this.choice, step);
    if (next !== this.choice) {
      this.choice = next;
      audioManager.play('select');
      this.redraw();
    }
  }

  /** Escape on either second question is the answer that changes nothing. */
  private backOut(): void {
    if (this.hasStarted || !this.menu.question) {
      return;
    }
    const asking = this.menu.choices[0]?.id;
    // Each question backs out to the row that asked it.
    this.showMenu(titleMenu(this.summary), asking === 'keep' ? 'new' : 'playtest');
  }

  private showMenu(menu: TitleMenu, choice: TitleChoiceId): void {
    this.menu = menu;
    this.choice = choice;
    this.redraw();
  }

  private chooseSelected(): void {
    if (this.hasStarted) {
      return;
    }
    if (this.choice === 'continue') {
      this.startGame('continue');
    } else if (this.choice === 'new') {
      if (needsEraseConfirmation(this.summary)) {
        // The key that opened the game is still held down, so the question
        // starts on the answer that changes nothing.
        audioManager.play('confirm');
        const menu = eraseMenu();
        this.showMenu(menu, menu.initial);
      } else {
        this.startGame('new');
      }
    } else if (this.choice === 'maker') {
      this.startMapMaker();
    } else if (this.choice === 'playtest') {
      if (this.playtestSummary.kind === 'game') {
        audioManager.play('confirm');
        const menu = playtestMenu();
        this.showMenu(menu, menu.initial);
      } else {
        this.startGame('fresh-playtest');
      }
    } else if (this.choice === 'keep') {
      this.backOut();
    } else if (this.choice === 'resume-playtest' || this.choice === 'fresh-playtest') {
      this.startGame(this.choice);
    } else {
      this.startGame('new');
    }
  }

  /**
   * Into the map maker. It touches neither save - drafts are kept under a key
   * of their own (`maker/drafts.ts`) - so the slot is set back to the ordinary
   * game, as every way out of the title that is not the explorer run does.
   */
  private startMapMaker(): void {
    if (this.hasStarted) {
      return;
    }
    this.hasStarted = true;
    setActiveSaveSlot('normal');
    void this.playStartAudio();
    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.start('mapmaker');
    });
  }

  private startGame(mode: 'continue' | 'new' | 'resume-playtest' | 'fresh-playtest'): void {
    if (this.hasStarted) {
      return;
    }

    this.hasStarted = true;
    void this.playStartAudio();
    this.setPrompt('READY!');
    this.time.delayedCall(180, () => {
      if (mode === 'resume-playtest' || mode === 'fresh-playtest') {
        this.startPlaytestRun(mode === 'fresh-playtest');
        return;
      }
      if (mode === 'new') {
        // Only reached once the erase question has been answered, or when there
        // was nothing to erase.
        this.saveManager.clear();
        this.scene.start('starter');
        return;
      }
      const savedGame = this.loadOrCreateGame();
      this.scene.start(savedGame ? 'base' : 'starter', savedGame ? { savedGame } : undefined);
    });
  }

  /**
   * Into the explorer run. Everything after this reads and writes the playtest
   * slot, because `SaveManager` resolves its key through the active slot - and
   * the ordinary save is never opened on this path, so nothing about it can be
   * changed by anything the player does in here.
   */
  private startPlaytestRun(fresh: boolean): void {
    setActiveSaveSlot('playtest');
    if (fresh) {
      this.playtestSaveManager.clear();
    }
    let savedGame = this.playtestSaveManager.load();
    if (savedGame) {
      const current = withEverythingCurrent(savedGame.raidProgress);
      if (current !== savedGame.raidProgress) {
        savedGame = { ...savedGame, raidProgress: current };
        this.playtestSaveManager.save(savedGame);
      }
    }
    if (!savedGame) {
      this.playtestSaveManager.save(createPlaytestGame());
      savedGame = this.playtestSaveManager.load();
    }
    if (!savedGame) {
      // Storage is unavailable or full. The run is still playable; it simply
      // will not be there next time, which is better than refusing to start.
      this.scene.start('base', { savedGame: createPlaytestGame() });
      return;
    }
    this.scene.start('base', { savedGame });
  }

  private loadOrCreateGame() {
    const savedGame = this.saveManager.load();
    if (savedGame) {
      if (savedGame.stash.ensurePlayable(
        savedGame.starterSpeciesId ? getStarterSpecies(savedGame.starterSpeciesId) : undefined,
      )) {
        this.saveManager.save(savedGame);
      }
      return savedGame;
    }
    return null;
  }

  private async playStartAudio(): Promise<void> {
    await audioManager.activate();
    void audioManager.startTheme('title');
    audioManager.play('confirm');
  }
}
