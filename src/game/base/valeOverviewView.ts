import type Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import type { GridPosition } from '../movement/gridMovement';
import { CANOPY_BAND } from '../world/depths';
import { GAME_FONT } from '../ui/gameFont';
import { keyHint, TELESCOPE_KEY_LETTERS } from '../input/keyBindings';
import { CHIP_FONT_SIZE } from '../ui/screenType';
import { drawPixelWindow } from '../ui/pixelWindow';
import type { PaintedPicture } from '../world/minimap';
import type { RaidMark } from '../world/raidMemory';
import type { RimLanding } from './arenaRim';
import { podiumHole } from './arenaHall';
import { calmedFloor, condensedFloor, steppedCloud, type Rgb } from './arenaPit';
import { nextShadowInMs, SHADOW_WIDTH, shadowAt, shadowPassFor, type ShadowPass } from './pitLife';
import type { WindowLight } from './homeClock';
import type { TownLight } from './pitClock';
import {
  IRIS_MS,
  NAME_PLATE_HEIGHT,
  OVERVIEW_BAR_HEIGHT,
  OVERVIEW_BAR_WORDS_Y,
  WALKED,
  cardHeight,
  OverviewView,
  cardPlace,
  irisOpen,
  irisReach,
  mapPointOfTile,
  nextWayIn,
  overviewArea,
  wholePicture,
  type OverviewPoint,
  type OverviewRect,
  type OverviewScreen,
} from './valeOverview';

/**
 * The view through THE RAID ARENA's telescope, as the scene draws it. It is FireRed's
 * Town Map, of a place you are about to jump into: the map at the bottom of the pit
 * as big as the screen takes it, its cloud and what it remembers, a light at every way
 * in, and a cursor that says something about what it is on and nothing about anything
 * else. Beside the map a compass, and along the foot the keys.
 *
 * It stands over the whole hall on the screen's own coordinates, so a scene's camera
 * has nothing to do with it and every number is a whole game pixel at rest. The rules
 * are `valeOverview.ts`. What it is drawn from is the pit's own
 * (`ArenaView.overviewSource`), so the two can never disagree.
 */

/** What a look through the glass is of. */
export interface OverviewSource {
  readonly floorTexture: string;
  /** The map's square on the floor's picture, in that picture's pixels. */
  readonly mapFloor: OverviewRect;
  /** Pixels of the floor to a tile of the map. */
  readonly scale: number;
  readonly mapName: string;
  readonly walkedPercent: number;
  readonly landings: readonly RimLanding[];
  /** The towns on ground this save has walked (`townsOf`). */
  readonly towns: readonly GridPosition[];
  readonly townLights: readonly TownLight[];
  readonly marks: readonly (RaidMark & { readonly age: number })[];
  readonly trail: readonly GridPosition[];
  readonly drawMark: (on: Phaser.GameObjects.Graphics, mark: RaidMark & { readonly age: number }, x: number, y: number) => void;
  /** What a tile is called, if this save has walked it: never anything under the cloud. */
  readonly placeAt: (tile: GridPosition) => string | null;
  readonly isWalked: (tile: GridPosition) => boolean;
  /** What the cloud is calmed towards at this hour, so the ground is what reads (`calmedFloor`). */
  readonly cloudInk: Rgb;
  readonly light: WindowLight;
  readonly textures: {
    readonly light: string;
    readonly shadow: string;
  };
  readonly trailInk: number;
  readonly trailShade: number;
}

export type OverviewEnding = { readonly kind: 'back' } | { readonly kind: 'go'; readonly landing: RimLanding };

/** What the card beside a way in says: its name, then a line or two. */
export interface OverviewCard {
  readonly title: string;
  readonly lines: readonly string[];
}

/** What the keys are doing this frame. */
export interface OverviewKeys {
  readonly held: OverviewPoint;
  readonly stepBack: boolean;
  readonly go: boolean;
  readonly wayBack: boolean;
  readonly wayNext: boolean;
  readonly closer: boolean;
}

/** Over everything the hall draws: only the page's own FEEDBACK tab stands over this. */
const OVERVIEW_DEPTH = CANOPY_BAND + 5;
const SURROUND_INK = 0x0c0e18;
const BRASS = 0xf8c840;
const BRASS_DARK = 0x885820;
const CREAM = 0xf8f0d8;
const INK = 0x101018;
const PLATE_FILL = 0x0b1220;
const WHITE = 0xf8f8f8;
const CURSOR_RED = 0xe04038;
const TOWN_ROOF = 0xd84830;
const TOWN_WALL = 0xf8f0d8;
const DIM_WORDS = '#70788c';
const BRIGHT_WORDS = '#f8f7dd';

/** How wide the card about a way in is, and what stands inside its frame. */
const CARD_WIDTH = 150;
const CARD_PADDING = 4;
/** A drag starts once the pointer has moved this far, so a shaky click is still a click. */
const DRAG_FROM = 3;
/** How long the map's name stays up on opening, if nothing is done first. */
const NAME_UP_MS = 3000;
/** How long "no way in here" is said for. */
const REFUSED_MS = 1100;
/** How soon the wings first cross after the glass comes up, and the least before they next do. */
const FIRST_WINGS_MS = 12000;
const WINGS_AGAIN_LEAST_MS = 30000;
/** How a mark left by a raid is found with the cursor, in screen pixels. */
const MARK_REACH = 5;
/** How often the cursor and the light under it beat. */
const BEAT_MS = 420;
/** How far over its light the player's head floats, in pixels: clear of the light and of the cursor's corners. */
const YOU_ABOVE_LIGHT = 10;

const COMPASS = { x: 2, y: 2, size: 46, arm: 16 } as const;
const LOCATOR = { size: 46, inset: 3 } as const;

type Phase = 'to-the-glass' | 'opening' | 'open' | 'closing' | 'back-in-the-hall' | 'done';

type ChipId = 'move' | 'closer' | 'ways' | 'go' | 'step-back';

interface Chip {
  readonly id: ChipId;
  readonly text: Phaser.GameObjects.Text;
  x: number;
  width: number;
}

/** The four ways, as the compass names them and the keys move. */
const WAYS = [
  { letter: 'N', dx: 0, dy: -1 },
  { letter: 'E', dx: 1, dy: 0 },
  { letter: 'S', dx: 0, dy: 1 },
  { letter: 'W', dx: -1, dy: 0 },
] as const;

export class ValeOverviewView {
  private readonly scene: Phaser.Scene;
  private readonly source: OverviewSource;
  private readonly still: boolean;
  private readonly cardFor: (landing: RimLanding) => OverviewCard;
  private readonly from: OverviewPoint;
  private readonly mapSize: OverviewScreen;
  private screen: OverviewScreen;
  private readonly view: OverviewView;
  private readonly root: Phaser.GameObjects.Container;
  private readonly iris: Phaser.GameObjects.Graphics;
  private readonly fitted: Phaser.GameObjects.Image;
  private readonly close: Phaser.GameObjects.Image;
  private readonly townLayer: Phaser.GameObjects.Graphics;
  private readonly memoryLayer: Phaser.GameObjects.Graphics;
  private readonly lights: { readonly landing: RimLanding; readonly image: Phaser.GameObjects.Image }[];
  private readonly floorTexture: string;
  private readonly painted: string[] = [];
  private readonly you: Phaser.GameObjects.Image | null;
  private readonly youOn: RimLanding | null;
  /** How far above a light the top of the player's figure stands, for its head to sit just over the light. */
  private readonly youRises: number;
  private readonly cursorMark: Phaser.GameObjects.Graphics;
  private readonly cardFrame: Phaser.GameObjects.Graphics;
  private readonly cardTitle: Phaser.GameObjects.Text;
  private readonly cardBody: Phaser.GameObjects.Text;
  private readonly titleFrame: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly compass: Phaser.GameObjects.Graphics;
  private readonly compassLetters: Phaser.GameObjects.Text[] = [];
  private readonly walkedFrame: Phaser.GameObjects.Graphics;
  private readonly walkedText: Phaser.GameObjects.Text;
  private readonly locator: Phaser.GameObjects.Image;
  private readonly locatorMark: Phaser.GameObjects.Graphics;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly chips: Chip[] = [];
  private phase: Phase;
  private phaseMs = 0;
  private openMs = 0;
  private cardKey = '';
  private cardSize: OverviewScreen = { width: CARD_WIDTH, height: NAME_PLATE_HEIGHT };
  private memoryKey = '';
  private compassKey = '';
  private cursorKey = '';
  private barKey = '';
  private locatorKey = '';
  private litChip: ChipId | null = null;
  private refusedMs = 0;
  private touched = false;
  private pointer: { startX: number; startY: number; lastX: number; lastY: number; dragging: boolean } | null = null;
  /** A compass arm held down with the mouse: which way it is pressing. */
  private armHeld: OverviewPoint | null = null;
  private heldNow: OverviewPoint = { x: 0, y: 0 };
  private ending: OverviewEnding | null = null;
  private wings: { readonly image: Phaser.GameObjects.Image; readonly pass: ShadowPass; elapsedMs: number } | null = null;
  private wingsInMs = FIRST_WINGS_MS;
  private glassCamera: Phaser.Cameras.Scene2D.Camera | null = null;
  private childrenIgnored = -1;

  public constructor(
    scene: Phaser.Scene,
    source: OverviewSource,
    options: {
      /** The way in the player is stood over, where their own head goes and the cursor starts. */
      readonly chosenId: string | null;
      readonly cardFor: (landing: RimLanding) => OverviewCard;
      readonly still: boolean;
      /** Where on the screen the eye goes to the glass. */
      readonly from: OverviewPoint;
      /** The player's own figure, a frame of it, and the rows of it that are their head. */
      readonly figure: { readonly texture: string; readonly frame: number; readonly headTop: number; readonly headRows: number };
    },
  ) {
    this.scene = scene;
    this.source = source;
    this.still = options.still;
    this.cardFor = options.cardFor;
    this.from = options.from;
    this.mapSize = { width: source.mapFloor.width, height: source.mapFloor.height };
    this.screen = { width: scene.scale.width, height: scene.scale.height };
    this.view = new OverviewView(
      this.mapSize,
      this.screen,
      source.landings.map((landing) => ({ id: landing.id, at: this.pointOfLanding(landing) })),
      (source.landings.find((landing) => landing.id === options.chosenId) ?? source.landings[0])?.id ?? null,
    );
    this.youOn = source.landings.find((landing) => landing.id === options.chosenId) ?? null;
    this.phase = this.still ? 'open' : 'to-the-glass';

    const add = scene.add;
    this.root = add.container(0, 0).setScrollFactor(0).setDepth(OVERVIEW_DEPTH);
    this.iris = add.graphics().setScrollFactor(0).setDepth(OVERVIEW_DEPTH + 1);

    const backdrop = add.rectangle(0, 0, 4096, 4096, SURROUND_INK).setOrigin(0, 0);
    this.floorTexture = this.paintTexture(`${source.floorTexture}-glass`, () => {
      const canvas = scene.textures.get(source.floorTexture).getSourceImage() as HTMLCanvasElement;
      const { data, width, height } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
      return calmedFloor({ data, width, height }, source.mapFloor, source.scale, source.isWalked, source.cloudInk, source.light);
    });
    this.close = add.image(0, 0, this.floorTexture).setOrigin(0, 0).setVisible(false);
    this.fitted = add.image(0, 0, this.wholeTexture()).setOrigin(0, 0);
    this.townLayer = add.graphics();
    this.memoryLayer = add.graphics();
    this.lights = source.landings.map((landing) => ({ landing, image: add.image(0, 0, source.textures.light) }));
    const { figure } = options;
    this.you = this.youOn
      ? add.image(0, 0, figure.texture, figure.frame).setOrigin(0.5, 0).setCrop(0, figure.headTop, 16, figure.headRows)
      : null;
    this.youRises = figure.headTop + figure.headRows + YOU_ABOVE_LIGHT;
    this.cursorMark = add.graphics();
    const text = (color: string): Phaser.GameObjects.Text => add.text(0, 0, '', { fontFamily: GAME_FONT, fontSize: CHIP_FONT_SIZE, color });
    this.cardFrame = add.graphics();
    this.cardTitle = text('#101018');
    this.cardBody = text('#484860').setWordWrapWidth(CARD_WIDTH - CARD_PADDING * 2 - 1);
    this.titleFrame = add.graphics();
    this.titleText = text(BRIGHT_WORDS);
    this.compass = add.graphics();
    for (const way of WAYS) {
      this.compassLetters.push(text(BRIGHT_WORDS).setText(way.letter));
    }
    this.walkedFrame = add.graphics();
    this.walkedText = text(BRIGHT_WORDS).setAlign('center');
    this.locator = add.image(0, 0, this.locatorTexture()).setOrigin(0, 0).setVisible(false);
    this.locatorMark = add.graphics();
    this.bar = add.graphics();
    this.root.add([
      backdrop,
      this.close,
      this.fitted,
      this.townLayer,
      this.memoryLayer,
      ...this.lights.map(({ image }) => image),
      ...(this.you ? [this.you] : []),
      this.cursorMark,
      this.titleFrame,
      this.titleText,
      this.compass,
      ...this.compassLetters,
      this.walkedFrame,
      this.walkedText,
      this.locator,
      this.locatorMark,
      this.cardFrame,
      this.cardTitle,
      this.cardBody,
      this.bar,
    ]);
    for (const id of ['move', 'closer', 'ways', 'go', 'step-back'] as const) {
      const chip: Chip = { id, text: text(BRIGHT_WORDS), x: 0, width: 0 };
      this.chips.push(chip);
      this.root.add(chip.text);
    }
    this.nameTheMap();
    this.root.setVisible(false);
    if (this.still) {
      this.lookOverTheHall();
    }
    this.layOut();
  }

  private floorPixels(): ImageData {
    const canvas = this.scene.textures.get(this.floorTexture).getSourceImage() as HTMLCanvasElement;
    return canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
  }

  /** A picture for this one look, because the ground changes between looks: a raid walks more of it. `destroy` takes them all away. */
  private paintTexture(key: string, paint: () => PaintedPicture): string {
    const { textures } = this.scene;
    if (!textures.exists(key)) {
      const picture = paint();
      const texture = textures.createCanvas(key, picture.width, picture.height);
      texture?.context.putImageData(new ImageData(picture.data, picture.width, picture.height), 0, 0);
      texture?.refresh();
      this.painted.push(key);
    }
    return key;
  }

  /** The whole-map picture of this map, painted once for each size of window it is looked at through. */
  private wholeTexture(): string {
    const { square, size } = wholePicture(this.source.mapFloor, this.screen);
    const { mapFloor, scale } = this.source;
    const spanX = square.width / size.width;
    const spanY = square.height / size.height;
    return this.paintTexture(`${this.source.floorTexture}-whole-${size.width}x${size.height}`, () =>
      steppedCloud(
        condensedFloor(this.floorPixels(), square, size),
        (x, y) =>
          this.source.isWalked({
            x: Math.floor((square.left + (x + 0.5) * spanX - mapFloor.left) / scale),
            y: Math.floor((square.top + (y + 0.5) * spanY - mapFloor.top) / scale),
          }),
        this.source.cloudInk,
      ),
    );
  }

  /** The little whole map in the corner of a closer look. */
  private locatorTexture(): string {
    const size = { width: LOCATOR.size - 2, height: LOCATOR.size - 2 };
    return this.paintTexture(`${this.source.floorTexture}-locator`, () => condensedFloor(this.floorPixels(), this.source.mapFloor, size));
  }

  private nameTheMap(): void {
    this.titleText.setText(this.source.mapName.toUpperCase());
    const width = Math.ceil(this.titleText.width) + 8;
    this.titleFrame.clear();
    drawPixelWindow(this.titleFrame, { x: 0, y: 0, width, height: NAME_PLATE_HEIGHT }, { fill: PLATE_FILL, border: BRASS });
    this.titleFrame.setData('width', width);
    this.walkedText.setText(`${this.source.walkedPercent}%\nWALKED`);
    this.walkedFrame.clear();
    drawPixelWindow(this.walkedFrame, { x: 0, y: 0, width: WALKED.width, height: WALKED.height }, { fill: PLATE_FILL, border: BRASS_DARK });
    this.walkedFrame.setPosition(WALKED.x, WALKED.y);
    this.walkedText.setPosition(WALKED.x + Math.round((WALKED.width - this.walkedText.width) / 2), WALKED.y + WALKED.wordsY);
  }

  /** How it ended, once the hall is back on the screen. */
  public get finished(): OverviewEnding | null {
    return this.phase === 'done' ? this.ending : null;
  }

  /** What a driver and a test read: the rules underneath. */
  public get rules(): OverviewView {
    return this.view;
  }

  /** The way in under the cursor, or null out over the country. */
  public get wayIn(): RimLanding | null {
    return this.source.landings.find((landing) => landing.id === this.view.wayIn) ?? null;
  }

  public get isOpen(): boolean {
    return this.phase === 'open';
  }

  public get wingsCrossing(): boolean {
    return this.wings !== null;
  }

  /** The words and box of what the cursor is saying now, for a driver checking it is whole and on the screen. */
  public get cardShown(): { readonly title: string; readonly body: string; readonly x: number; readonly y: number; readonly width: number; readonly height: number } | null {
    return this.cardFrame.visible
      ? { title: this.cardTitle.text, body: this.cardBody.text, x: this.cardFrame.x, y: this.cardFrame.y, ...this.cardSize }
      : null;
  }

  /** Where the last of the keys along the foot ends, for a driver checking none is cut off. */
  public get barEnds(): number {
    return Math.max(...this.chips.filter((chip) => chip.text.visible).map((chip) => chip.x + chip.width));
  }

  private pointOfLanding(landing: RimLanding): OverviewPoint {
    return mapPointOfTile(landing.tile, this.source.scale);
  }

  private leave(ending: OverviewEnding): void {
    this.ending = ending;
    this.phase = this.still ? 'done' : 'closing';
    this.phaseMs = 0;
  }

  private goOrRefuse(): void {
    const landing = this.wayIn;
    if (landing) {
      this.leave({ kind: 'go', landing });
    } else {
      this.refusedMs = REFUSED_MS;
      audioManager.play('bump');
    }
  }

  private hopWay(by: number): void {
    const next = nextWayIn(this.source.landings, this.view.wayIn, by);
    if (next) {
      this.view.hop(next.id);
      audioManager.play('select');
    }
  }

  public update(deltaMs: number, keys: OverviewKeys): void {
    this.screen = { width: this.scene.scale.width, height: this.scene.scale.height };
    this.phaseMs += deltaMs;
    switch (this.phase) {
      case 'to-the-glass':
        this.drawIris(this.from, 1 - this.phaseMs / IRIS_MS);
        if (this.phaseMs >= IRIS_MS) {
          this.phase = 'opening';
          this.phaseMs = 0;
          this.lookOverTheHall();
        }
        break;
      case 'opening':
        this.drawIris(this.lensMiddle(), this.phaseMs / IRIS_MS);
        if (this.phaseMs >= IRIS_MS) {
          this.phase = 'open';
          this.iris.clear();
        }
        break;
      case 'open':
        this.listen(keys);
        break;
      case 'closing':
        this.drawIris(this.lensMiddle(), 1 - this.phaseMs / IRIS_MS);
        if (this.phaseMs >= IRIS_MS) {
          this.phase = 'back-in-the-hall';
          this.phaseMs = 0;
          this.lookBackAtTheHall();
        }
        break;
      case 'back-in-the-hall':
        this.drawIris(this.from, this.phaseMs / IRIS_MS);
        if (this.phaseMs >= IRIS_MS) {
          this.phase = 'done';
          this.iris.clear();
        }
        break;
      default:
        break;
    }
    if (this.root.visible) {
      const held = this.phase === 'open' ? (this.armHeld ?? keys.held) : { x: 0, y: 0 };
      this.frame(deltaMs, held);
    }
  }

  /**
   * The glass is up, and nothing behind it needs drawing: the hall's camera is
   * switched off and this one draws only the glass. With the hall under it the
   * same picture ran at half the frame rate on a machine drawing without a
   * graphics card. A camera added to a scene outlives a restart, so it is always
   * taken away again (`lookBackAtTheHall`, `destroy`).
   */
  private lookOverTheHall(): void {
    this.root.setVisible(true);
    this.scene.cameras.main.setVisible(false);
    this.glassCamera = this.scene.cameras.add(0, 0, this.screen.width, this.screen.height).setRoundPixels(true);
    this.ignoreTheHall();
  }

  private ignoreTheHall(): void {
    const { list } = this.scene.children;
    if (list.length !== this.childrenIgnored) {
      this.childrenIgnored = list.length;
      this.glassCamera?.ignore(list.filter((child) => child !== this.root && child !== this.iris));
    }
  }

  private lookBackAtTheHall(): void {
    this.root.setVisible(false);
    this.scene.cameras.main.setVisible(true);
    if (this.glassCamera) {
      this.scene.cameras.remove(this.glassCamera);
      this.glassCamera = null;
    }
    this.childrenIgnored = -1;
  }

  private lensMiddle(): OverviewPoint {
    const area = overviewArea(this.screen);
    return { x: Math.round(area.width / 2), y: Math.round(area.height / 2) };
  }

  /** The round of the glass: dark outside it, in whole pixels, its edge stepped as anything round is here. */
  private drawIris(middle: OverviewPoint, share: number): void {
    const { width, height } = this.screen;
    const radius = irisOpen(share) * irisReach(this.screen, middle);
    const on = this.iris;
    on.clear();
    on.fillStyle(INK, 1);
    const STEP = 2;
    for (let y = 0; y < height; y += STEP) {
      const dy = y + STEP / 2 - middle.y;
      const half = radius > Math.abs(dy) ? Math.floor(Math.sqrt(radius * radius - dy * dy)) : -1;
      if (half < 0) {
        on.fillRect(0, y, width, STEP);
      } else {
        on.fillRect(0, y, Math.max(0, middle.x - half), STEP);
        on.fillRect(middle.x + half, y, Math.max(0, width - middle.x - half), STEP);
      }
    }
  }

  private listen(keys: OverviewKeys): void {
    if (keys.stepBack) {
      this.leave({ kind: 'back' });
      return;
    }
    if (keys.go) {
      this.goOrRefuse();
      if (this.ending) {
        return;
      }
    }
    if (keys.wayBack || keys.wayNext) {
      this.hopWay(keys.wayBack ? -1 : 1);
      this.touched = true;
    }
    if (keys.closer) {
      this.view.cycleLevel();
      this.touched = true;
    }
    if (keys.held.x !== 0 || keys.held.y !== 0) {
      this.touched = true;
    }
  }

  // --- the pointer -------------------------------------------------------------

  private chipAt(x: number, y: number): Chip | undefined {
    if (y < this.screen.height - OVERVIEW_BAR_HEIGHT) {
      return undefined;
    }
    return this.chips.find((chip) => chip.text.visible && chip.id !== 'move' && x >= chip.x - 2 && x < chip.x + chip.width + 2);
  }

  /** Which arm of the compass a point is on, if the compass is up. */
  private armAt(x: number, y: number): OverviewPoint | null {
    if (!this.compass.visible || x < COMPASS.x || y < COMPASS.y || x >= COMPASS.x + COMPASS.size || y >= COMPASS.y + COMPASS.size) {
      return null;
    }
    const dx = x - (COMPASS.x + COMPASS.size / 2);
    const dy = y - (COMPASS.y + COMPASS.size / 2);
    return Math.abs(dx) > Math.abs(dy) ? { x: Math.sign(dx), y: 0 } : { x: 0, y: Math.sign(dy) };
  }

  /** Whether a point is over the map rather than over something standing on it. */
  private overMap(x: number, y: number): boolean {
    if (y >= overviewArea(this.screen).height) {
      return false;
    }
    const inRect = (rect: OverviewRect): boolean => x >= rect.left && x < rect.left + rect.width && y >= rect.top && y < rect.top + rect.height;
    return !this.furniture().some(inRect);
  }

  public pointerDown(x: number, y: number): void {
    if (this.phase !== 'open') {
      return;
    }
    this.touched = true;
    this.armHeld = this.armAt(x, y);
    if (!this.armHeld) {
      this.pointer = { startX: x, startY: y, lastX: x, lastY: y, dragging: false };
    }
  }

  public pointerMove(x: number, y: number, down: boolean): void {
    if (this.phase !== 'open') {
      return;
    }
    const held = this.pointer;
    if (held && down) {
      if (!held.dragging && Math.hypot(x - held.startX, y - held.startY) >= DRAG_FROM && !this.chipAt(held.startX, held.startY) && this.view.canPan) {
        held.dragging = true;
      }
      if (held.dragging) {
        this.view.dragBy(x - held.lastX, y - held.lastY);
      }
      held.lastX = x;
      held.lastY = y;
    } else if (this.overMap(x, y) && !this.armHeld) {
      if (this.view.pointTo({ x, y })) {
        audioManager.play('select');
      }
      this.touched = true;
    }
    const chip = this.chipAt(x, y);
    this.litChip = chip?.id ?? null;
    const onLight = this.view.wayIn !== null && this.overMap(x, y);
    this.scene.game.canvas.style.cursor = held?.dragging ? 'grabbing' : chip || onLight || this.armAt(x, y) ? 'pointer' : this.view.canPan ? 'grab' : '';
  }

  public pointerUp(x: number, y: number): void {
    const held = this.pointer;
    this.pointer = null;
    this.armHeld = null;
    if (!held || held.dragging || this.phase !== 'open') {
      return;
    }
    const chip = this.chipAt(x, y);
    if (chip) {
      if (chip.id === 'closer') {
        this.view.cycleLevel();
      } else if (chip.id === 'ways') {
        this.hopWay(x < chip.x + chip.width / 3 ? -1 : 1);
      } else if (chip.id === 'go') {
        this.goOrRefuse();
      } else {
        this.leave({ kind: 'back' });
      }
      return;
    }
    // The cursor has been on it since the pointer got here, saying what it is.
    if (this.overMap(x, y) && this.wayIn) {
      this.goOrRefuse();
    }
  }

  public wheel(x: number, y: number, by: number): void {
    if (this.phase === 'open' && by !== 0) {
      this.touched = true;
      this.view.changeLevel(by < 0 ? 1 : -1, { x, y: Math.min(y, overviewArea(this.screen).height) });
    }
  }

  // --- a frame ---------------------------------------------------------------

  private frame(deltaMs: number, held: OverviewPoint): void {
    this.ignoreTheHall();
    this.glassCamera?.setSize(this.screen.width, this.screen.height);
    this.view.resize(this.screen);
    if (this.view.advance(deltaMs, held, this.still)) {
      audioManager.play('select');
    }
    this.heldNow = held;
    this.openMs += deltaMs;
    this.refusedMs = Math.max(0, this.refusedMs - deltaMs);
    this.layOut();
    if (!this.still) {
      this.flyTheWings(deltaMs);
    }
  }

  /** Now and then something very big crosses the country, and it is no less big for being seen from further off. */
  private flyTheWings(deltaMs: number): void {
    this.wingsInMs -= deltaMs;
    const area = overviewArea(this.screen);
    if (!this.wings && this.wingsInMs <= 0) {
      const hole = podiumHole();
      const line = (Math.random() - 0.5) * Math.max(0, area.height - 80);
      const pass = shadowPassFor(hole.y + line, Math.random() < 0.5);
      const image = this.scene.add.image(0, 0, this.source.textures.shadow, '0').setFlipX(!pass.east);
      // Under the marks and the lights, as it is in the pit.
      this.root.addAt(image, this.root.getIndex(this.townLayer));
      this.wings = { image, pass, elapsedMs: 0 };
    }
    const wings = this.wings;
    if (!wings) {
      return;
    }
    wings.elapsedMs += deltaMs;
    const at = shadowAt(wings.pass, wings.elapsedMs);
    if (!at) {
      wings.image.destroy();
      this.wings = null;
      this.wingsInMs = Math.max(WINGS_AGAIN_LEAST_MS, nextShadowInMs(Math.random(), false) / 3);
      return;
    }
    const hole = podiumHole();
    const across = (at.x - hole.x) / (hole.rx + SHADOW_WIDTH);
    wings.image.setPosition(Math.round(area.width / 2 + across * (area.width / 2 + SHADOW_WIDTH)), Math.round(area.height / 2 + at.y - hole.y)).setFrame(String(at.frame));
  }

  /** Whether it is close enough that there is a whole map's worth of screen to lose. */
  private get isCloser(): boolean {
    return !this.view.isWhole;
  }

  /** What stands on the screen over the map: a name is kept off it, and the mouse is not over the map there. */
  private furniture(): readonly OverviewRect[] {
    const near = this.isCloser;
    const area = overviewArea(this.screen);
    return [
      ...(this.compass.visible ? [{ left: COMPASS.x, top: COMPASS.y, width: COMPASS.size, height: COMPASS.size }] : []),
      ...(this.walkedFrame.visible ? [{ left: WALKED.x, top: WALKED.y, width: WALKED.width, height: WALKED.height }] : []),
      ...(near ? [{ left: area.width - LOCATOR.size - LOCATOR.inset, top: LOCATOR.inset, width: LOCATOR.size, height: LOCATOR.size }] : []),
    ];
  }

  private layOut(): void {
    const rect = this.view.mapRect();
    if (this.view.isWhole) {
      const area = overviewArea(this.screen);
      if (this.fitted.width !== area.width || this.fitted.height !== area.height) {
        this.fitted.setTexture(this.wholeTexture());
      }
      this.fitted.setPosition(0, 0).setVisible(true);
      this.close.setVisible(false);
    } else {
      this.fitted.setVisible(false);
      const { zoom } = this.view;
      const { left, top } = this.source.mapFloor;
      this.close.setScale(zoom).setPosition(Math.round(rect.left - left * zoom), Math.round(rect.top - top * zoom)).setVisible(true);
    }
    this.drawMemory(rect);
    this.placeLights();
    this.drawCursor();
    this.drawCompass();
    this.drawLocator();
    this.placeCard();
    this.placeTitle();
    this.drawBar();
  }

  /** Towns, their lights, and what the pit remembers, at the size marks are drawn whatever the level. */
  private drawMemory(rect: { readonly left: number; readonly top: number }): void {
    const zoom = this.view.zoom;
    const key = `${rect.left},${rect.top},${zoom}`;
    if (key === this.memoryKey) {
      return;
    }
    this.memoryKey = key;
    const { mapFloor, scale, trail, marks, towns, townLights, trailInk, trailShade } = this.source;
    const town = this.townLayer.clear();
    for (const light of townLights) {
      const at = this.view.screenOf({ x: light.x - mapFloor.left, y: light.y - mapFloor.top });
      town.fillStyle(light.warm ? 0xf8d070 : 0xf8e8b8, 1).fillRect(at.x, at.y, 1, 1);
    }
    // A town is the little house FireRed's Town Map would give it.
    for (const tile of towns) {
      const at = this.view.screenOf(mapPointOfTile(tile, scale));
      // Its outline, then a roof coming to a point over two rows of wall and a door.
      town.fillStyle(INK, 1).fillRect(at.x - 2, at.y - 4, 5, 1).fillRect(at.x - 3, at.y - 3, 7, 1).fillRect(at.x - 4, at.y - 2, 9, 3).fillRect(at.x - 3, at.y + 1, 7, 3);
      town.fillStyle(TOWN_ROOF, 1).fillRect(at.x - 1, at.y - 3, 3, 1).fillRect(at.x - 2, at.y - 2, 5, 1).fillRect(at.x - 3, at.y - 1, 7, 1);
      town.fillStyle(TOWN_WALL, 1).fillRect(at.x - 2, at.y, 5, 3);
      town.fillStyle(INK, 1).fillRect(at.x, at.y + 1, 1, 2);
    }
    const layer = this.memoryLayer.clear();
    trail.forEach((tile, index) => {
      const at = this.view.screenOf(mapPointOfTile(tile, scale));
      layer.fillStyle(trailShade, 1).fillRect(at.x, at.y + 1, 1, 1);
      if (index % 2 === 0) {
        layer.fillStyle(trailInk, 1).fillRect(at.x, at.y, 1, 1);
      }
    });
    for (const mark of marks) {
      const at = this.view.screenOf(mapPointOfTile(mark, scale));
      this.source.drawMark(layer, mark, at.x, at.y);
    }
  }

  private get beat(): boolean {
    return !this.still && Math.floor(this.openMs / BEAT_MS) % 2 === 1;
  }

  private placeLights(): void {
    for (const { landing, image } of this.lights) {
      const at = this.view.screenOf(this.pointOfLanding(landing));
      image.setPosition(at.x, at.y);
    }
    if (this.you && this.youOn) {
      const at = this.view.screenOf(this.pointOfLanding(this.youOn));
      // Stood on its light, as the player's head stands on FireRed's Town Map.
      this.you.setPosition(at.x, at.y - this.youRises);
    }
  }

  /** The cursor: FireRed's red corners, drawn wider on a way in, beating slowly either way. */
  private drawCursor(): void {
    const at = this.view.screenOf(this.view.cursor);
    const onWayIn = this.view.wayIn !== null;
    const reach = (onWayIn ? 7 : 5) + (this.beat ? 1 : 0);
    const key = `${at.x},${at.y},${reach},${onWayIn}`;
    if (key === this.cursorKey) {
      return;
    }
    this.cursorKey = key;
    const on = this.cursorMark.clear();
    const corner = (x: number, y: number, dx: number, dy: number, ink: number, grow: number): void => {
      on.fillStyle(ink, 1);
      on.fillRect(dx > 0 ? x - grow : x - 3 - grow, y - grow, 4 + grow * 2, 1 + grow * 2);
      on.fillRect(x - grow, dy > 0 ? y - grow : y - 3 - grow, 1 + grow * 2, 4 + grow * 2);
    };
    for (const [ink, grow] of [[INK, 1], [onWayIn ? BRASS : WHITE, 0]] as const) {
      for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
        corner(at.x - dx * reach, at.y - dy * reach, dx, dy, ink, grow);
      }
    }
    // A dot in the middle where there is no light to be the middle of it.
    if (!onWayIn) {
      on.fillStyle(INK, 1).fillRect(at.x - 1, at.y - 1, 3, 3);
      on.fillStyle(CURSOR_RED, 1).fillRect(at.x, at.y, 1, 1);
    }
  }

  /** What is said about what the cursor is on: the only words on the map. */
  private placeCard(): void {
    const said = this.cardNow();
    this.cardFrame.setVisible(said !== null);
    this.cardTitle.setVisible(said !== null);
    this.cardBody.setVisible(said !== null && said.lines.length > 0);
    if (!said) {
      return;
    }
    const key = `${said.title}|${said.lines.join('|')}`;
    if (key !== this.cardKey) {
      this.cardKey = key;
      this.cardTitle.setText(said.title);
      this.cardBody.setText(said.lines.join('\n'));
      const titled = Math.ceil(this.cardTitle.width) + CARD_PADDING * 2;
      const width = said.lines.length === 0 ? Math.max(titled, 16) : Math.max(CARD_WIDTH, titled);
      const height = said.lines.length === 0 ? NAME_PLATE_HEIGHT : cardHeight(Math.ceil(this.cardBody.height));
      this.cardSize = { width, height };
      const on = this.cardFrame.clear();
      drawPixelWindow(on, { x: 0, y: 0, width, height }, { fill: CREAM, border: INK });
      if (said.lines.length > 0) {
        on.fillStyle(BRASS_DARK, 1).fillRect(1, NAME_PLATE_HEIGHT - 1, width - 2, 1);
      }
    }
    const landingAt = this.view.screenOf(this.view.cursor);
    const others = this.lights.filter(({ landing }) => landing.id !== this.view.wayIn).map(({ image }) => ({ x: image.x, y: image.y }));
    const place = cardPlace(landingAt, this.cardSize, this.screen, this.furniture(), others);
    this.cardFrame.setPosition(place.x, place.y);
    this.cardTitle.setPosition(place.x + CARD_PADDING, place.y);
    this.cardBody.setPosition(place.x + CARD_PADDING, place.y + NAME_PLATE_HEIGHT);
  }

  private cardNow(): OverviewCard | null {
    const landing = this.wayIn;
    if (landing) {
      return this.cardFor(landing);
    }
    if (this.refusedMs > 0) {
      return { title: 'NO WAY IN HERE', lines: [] };
    }
    const { cursor, zoom } = this.view;
    const { scale, marks } = this.source;
    const mark = marks.find((each) => Math.hypot((each.x + 0.5) * scale - cursor.x, (each.y + 0.5) * scale - cursor.y) * zoom <= MARK_REACH);
    if (mark) {
      return { title: mark.line.toUpperCase(), lines: [] };
    }
    const place = this.source.placeAt({ x: Math.floor(cursor.x / scale), y: Math.floor(cursor.y / scale) });
    return place ? { title: place.toUpperCase(), lines: [] } : null;
  }

  /** The map's name, for a moment on opening: the top of it is cloud, and it goes as soon as anything is done. */
  private placeTitle(): void {
    const up = !this.touched && this.openMs < NAME_UP_MS;
    this.titleFrame.setVisible(up);
    this.titleText.setVisible(up);
    if (up) {
      const width = this.titleFrame.getData('width') as number;
      const x = Math.round((this.screen.width - width) / 2);
      this.titleFrame.setPosition(x, 3);
      this.titleText.setPosition(x + 4, 3);
    }
  }

  /**
   * N, E, S and W round a brass dial, each with an arm that lights as the view goes
   * that way, and how much has been walked under it while there is room beside the map.
   */
  private drawCompass(): void {
    const whole = this.view.isWhole;
    const at = this.view.screenOf(this.view.cursor);
    // On a closer look the map runs under it, and it gets out of the way of the cursor.
    const inTheWay = !whole && at.x < COMPASS.x + COMPASS.size + 8 && at.y < COMPASS.y + COMPASS.size + 8;
    this.compass.setVisible(!inTheWay);
    this.compassLetters.forEach((letter) => letter.setVisible(!inTheWay));
    this.walkedFrame.setVisible(whole);
    this.walkedText.setVisible(whole);
    const lit = `${Math.sign(this.heldNow.x)},${Math.sign(this.heldNow.y)}`;
    if (lit === this.compassKey) {
      return;
    }
    this.compassKey = lit;
    const on = this.compass.clear();
    const { x, y, size, arm } = COMPASS;
    drawPixelWindow(on, { x, y, width: size, height: size }, { fill: PLATE_FILL, border: BRASS_DARK });
    const cx = x + size / 2;
    const cy = y + size / 2;
    WAYS.forEach((way, index) => {
      const going = Math.sign(this.heldNow.x) === way.dx && way.dx !== 0 || Math.sign(this.heldNow.y) === way.dy && way.dy !== 0;
      // A little arrow from the middle out towards the letter.
      for (let step = 0; step < 4; step += 1) {
        const half = 3 - step;
        const along = 3 + step;
        on.fillStyle(going ? BRASS : BRASS_DARK, 1);
        if (way.dx !== 0) {
          on.fillRect(way.dx > 0 ? cx + along - 1 : cx - along, cy - half, 1, half * 2);
        } else {
          on.fillRect(cx - half, way.dy > 0 ? cy + along - 1 : cy - along, half * 2, 1);
        }
      }
      const letter = this.compassLetters[index];
      letter.setPosition(Math.round(cx + way.dx * arm - letter.width / 2), Math.round(cy + way.dy * arm - letter.height / 2));
    });
  }

  /** On a closer look, the whole map small in a corner with what is in sight outlined. */
  private drawLocator(): void {
    const near = this.isCloser;
    const area = overviewArea(this.screen);
    const left = area.width - LOCATOR.size - LOCATOR.inset;
    const top = LOCATOR.inset;
    this.locator.setVisible(near).setPosition(left + 1, top + 1);
    this.locatorMark.setVisible(near);
    if (!near) {
      return;
    }
    const sight = this.view.inSight();
    const inner = LOCATOR.size - 2;
    const across = inner / this.mapSize.width;
    const down = inner / this.mapSize.height;
    const box = {
      x: left + 1 + Math.round(sight.left * across),
      y: top + 1 + Math.round(sight.top * down),
      width: Math.max(3, Math.round(sight.width * across)),
      height: Math.max(3, Math.round(sight.height * down)),
    };
    const key = `${box.x},${box.y},${box.width},${box.height},${left}`;
    if (key === this.locatorKey) {
      return;
    }
    this.locatorKey = key;
    const on = this.locatorMark.clear();
    on.fillStyle(BRASS_DARK, 1);
    on.fillRect(left, top, LOCATOR.size, 1).fillRect(left, top + LOCATOR.size - 1, LOCATOR.size, 1);
    on.fillRect(left, top, 1, LOCATOR.size).fillRect(left + LOCATOR.size - 1, top, 1, LOCATOR.size);
    on.fillStyle(WHITE, 1);
    on.fillRect(box.x, box.y, box.width, 1).fillRect(box.x, box.y + box.height - 1, box.width, 1);
    on.fillRect(box.x, box.y, 1, box.height).fillRect(box.x + box.width - 1, box.y, 1, box.height);
  }

  private drawBar(): void {
    const { width, height } = this.screen;
    const onWayIn = this.view.wayIn !== null;
    const manyWays = this.source.landings.length > 1;
    const key = `${width},${height},${this.litChip},${onWayIn},${manyWays},${this.view.level}`;
    if (key === this.barKey) {
      return;
    }
    this.barKey = key;
    const on = this.bar.clear();
    const top = height - OVERVIEW_BAR_HEIGHT;
    drawPixelWindow(on, { x: 0, y: top, width, height: OVERVIEW_BAR_HEIGHT }, { fill: PLATE_FILL, border: BRASS_DARK });
    const chipOf = (id: ChipId): Chip => this.chips.find((chip) => chip.id === id)!;
    chipOf('closer').text.setText(keyHint(TELESCOPE_KEY_LETTERS.closer, 'ZOOM'));
    chipOf('step-back').text.setText(keyHint('SPACE', 'BACK'));
    const ways = chipOf('ways').text;
    ways.setText(`${keyHint(TELESCOPE_KEY_LETTERS.wayBack, '').trim()} ${keyHint(TELESCOPE_KEY_LETTERS.wayNext, 'NEXT')}`).setVisible(manyWays);
    chipOf('go').text.setColor(onWayIn ? BRIGHT_WORDS : DIM_WORDS);
    // The whole row in the room there is, in the shorter words if it comes to it.
    const words = (move: string, go: string): void => {
      chipOf('move').text.setText(keyHint(move, 'MOVE'));
      chipOf('go').text.setText(keyHint('ENTER', go));
    };
    const measured = (): number => this.chips.filter((chip) => chip.text.visible).reduce((sum, chip) => sum + Math.ceil(chip.text.width) + 10, 0);
    words('ARROWS/WASD', 'DROP HERE');
    if (measured() > width - 18) {
      words('ARROWS', 'DROP HERE');
    }
    if (measured() > width - 18) {
      words('ARROWS', 'DROP');
    }
    // The keys still work: the cursor gets to every way in without them.
    if (measured() > width - 18) {
      ways.setVisible(false);
    }
    let x = 6;
    for (const chip of this.chips.filter((each) => each.text.visible)) {
      chip.x = x;
      chip.width = Math.ceil(chip.text.width);
      chip.text.setPosition(x, top + OVERVIEW_BAR_WORDS_Y);
      if (chip.id === this.litChip) {
        on.fillStyle(BRASS_DARK, 1).fillRect(x - 2, top + 1, chip.width + 4, OVERVIEW_BAR_HEIGHT - 2);
      }
      x += chip.width + 10;
    }
  }

  public destroy(): void {
    this.lookBackAtTheHall();
    this.wings?.image.destroy();
    this.root.destroy(true);
    this.iris.destroy();
    for (const key of this.painted) {
      this.scene.textures.remove(key);
    }
    this.scene.game.canvas.style.cursor = '';
  }
}
