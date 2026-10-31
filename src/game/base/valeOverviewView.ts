import type Phaser from 'phaser';
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
import { condensedFloor } from './arenaPit';
import { nextShadowInMs, SHADOW_WIDTH, shadowAt, shadowPassFor, type ShadowPass } from './pitLife';
import type { TownLight } from './pitClock';
import {
  IRIS_MS,
  OVERVIEW_BAR_HEIGHT,
  OverviewView,
  fittedPictureSize,
  irisOpen,
  irisReach,
  mapPointOfTile,
  nextWayIn,
  overviewArea,
  platePlace,
  wayInNear,
  type OverviewPoint,
  type OverviewScreen,
} from './valeOverview';

/**
 * The view through THE RAID ARENA's telescope, as the scene draws it: the map at
 * the bottom of the pit with its fog, marks, ways in and whatever crosses it, a
 * compass with the keys that pan it, and along the foot the keys that do the rest.
 * It stands over the whole hall on the screen's own coordinates, so a scene's
 * camera has nothing to do with it and every number is a whole game pixel at rest.
 *
 * The rules are `valeOverview.ts`. What it is drawn from is the pit's own
 * (`ArenaView.overviewSource`), so the two can never disagree.
 */

/** What a look through the glass is of. */
export interface OverviewSource {
  readonly floorTexture: string;
  /** The map's square on the floor's picture, in that picture's pixels. */
  readonly mapFloor: { readonly left: number; readonly top: number; readonly width: number; readonly height: number };
  /** Pixels of the floor to a tile of the map. */
  readonly scale: number;
  readonly mapName: string;
  readonly walkedPercent: number;
  readonly landings: readonly RimLanding[];
  readonly townLights: readonly TownLight[];
  readonly marks: readonly (RaidMark & { readonly age: number })[];
  readonly trail: readonly GridPosition[];
  readonly drawMark: (on: Phaser.GameObjects.Graphics, mark: RaidMark & { readonly age: number }, x: number, y: number) => void;
  readonly textures: {
    readonly light: string;
    readonly look: string;
    readonly mist: string;
    readonly shadow: string;
  };
  /** How thick the pit's two sheets of cloud are, and the colour of the air at this hour. */
  readonly mistAlphas: readonly number[];
  readonly mistTint: number;
  readonly cloudShadow: { readonly alpha: number; readonly tint: number } | null;
  readonly trailInk: number;
  readonly trailShade: number;
}

export type OverviewEnding = { readonly kind: 'back' } | { readonly kind: 'go'; readonly landing: RimLanding };

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
const BRASS_SHADE = 0x583818;
const CREAM = 0xf8f0d8;
const KEY_RESTING = 0xa8a090;
const INK = 0x101018;
const PLATE_FILL = 0x0b1220;
const NAME_PLATE_HEIGHT = 13;
const PIN_INK = 0xf0c454;
/** How much room a way in is brought into sight with, for its name. */
const REVEAL_MARGIN = 44;
/** A drag starts once the pointer has moved this far, so a shaky click is still a click. */
const DRAG_FROM = 3;
/** How long the map's name stays up on opening. */
const NAME_UP_MS = 3600;
/** How soon the wings first cross after the glass comes up, and the least and the most before they next do. */
const FIRST_WINGS_MS = 1600;
const WINGS_AGAIN_LEAST_MS = 9000;
/** How long a chip is lit to say that panning wants a closer look first. */
const TEACH_CLOSER_MS = 900;

const COMPASS = { x: 2, y: 2, width: 68, height: 68, dialRadius: 17, keyCap: 12 } as const;
/** The compass's own corner, which a name is kept clear of. */
const COMPASS_CLEAR = { right: COMPASS.x + COMPASS.width, bottom: COMPASS.y + COMPASS.height };

type Phase = 'to-the-glass' | 'opening' | 'open' | 'closing' | 'back-in-the-hall' | 'done';

const fillDisc = (on: Phaser.GameObjects.Graphics, x: number, y: number, radius: number, ink: number): void => {
  on.fillStyle(ink, 1);
  for (let dy = -radius; dy < radius; dy += 1) {
    const half = Math.floor(Math.sqrt(radius * radius - (dy + 0.5) * (dy + 0.5)));
    on.fillRect(x - half, y + dy, half * 2, 1);
  }
};

interface Chip {
  readonly id: 'back-way' | 'next-way' | 'go' | 'closer' | 'step-back';
  readonly text: Phaser.GameObjects.Text;
  x: number;
  width: number;
}

export class ValeOverviewView {
  private readonly scene: Phaser.Scene;
  private readonly source: OverviewSource;
  private readonly still: boolean;
  private readonly nameOf: (landing: RimLanding) => string;
  private readonly from: OverviewPoint;
  private readonly mapSize: OverviewScreen;
  private screen: OverviewScreen;
  private readonly view: OverviewView;
  private readonly root: Phaser.GameObjects.Container;
  private readonly iris: Phaser.GameObjects.Graphics;
  private readonly fitted: Phaser.GameObjects.Image;
  private readonly close: Phaser.GameObjects.Image;
  private readonly mists: Phaser.GameObjects.TileSprite[] = [];
  private readonly cloudShadow: Phaser.GameObjects.TileSprite | null;
  private readonly townLayer: Phaser.GameObjects.Graphics;
  private readonly memoryLayer: Phaser.GameObjects.Graphics;
  private readonly lights: { readonly landing: RimLanding; readonly image: Phaser.GameObjects.Image }[];
  private readonly look: Phaser.GameObjects.Image;
  private readonly surround: Phaser.GameObjects.Graphics;
  private readonly plateFrame: Phaser.GameObjects.Graphics;
  private readonly plateText: Phaser.GameObjects.Text;
  private readonly hoverFrame: Phaser.GameObjects.Graphics;
  private readonly hoverText: Phaser.GameObjects.Text;
  private readonly titleFrame: Phaser.GameObjects.Graphics;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly compass: Phaser.GameObjects.Graphics;
  private readonly compassLetters: Phaser.GameObjects.Text[] = [];
  private readonly compassKeys: Phaser.GameObjects.Text[] = [];
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly chips: Chip[] = [];
  private phase: Phase;
  private phaseMs = 0;
  private openMs = 0;
  private chosen: RimLanding | null;
  private hovered: RimLanding | null = null;
  private plateNamed: string | null = null;
  private hoverNamed: string | null = null;
  private memoryKey = '';
  private surroundKey = '';
  private compassKey = '';
  private barKey = '';
  private litChip: Chip['id'] | null = null;
  private teachCloserMs = 0;
  private pointer: { startX: number; startY: number; lastX: number; lastY: number; dragging: boolean } | null = null;
  private ending: OverviewEnding | null = null;
  private wings: { readonly image: Phaser.GameObjects.Image; readonly pass: ShadowPass; elapsedMs: number } | null = null;
  private wingsInMs = FIRST_WINGS_MS;
  private lightMs = 0;
  private glassCamera: Phaser.Cameras.Scene2D.Camera | null = null;
  private childrenIgnored = -1;

  public constructor(
    scene: Phaser.Scene,
    source: OverviewSource,
    options: {
      readonly chosenId: string | null;
      readonly nameOf: (landing: RimLanding) => string;
      readonly still: boolean;
      /** Where on the screen the eye goes to the glass. */
      readonly from: OverviewPoint;
    },
  ) {
    this.scene = scene;
    this.source = source;
    this.still = options.still;
    this.nameOf = options.nameOf;
    this.from = options.from;
    this.mapSize = { width: source.mapFloor.width, height: source.mapFloor.height };
    this.screen = { width: scene.scale.width, height: scene.scale.height };
    this.view = new OverviewView(this.mapSize, this.screen);
    this.chosen = source.landings.find((landing) => landing.id === options.chosenId) ?? source.landings[0] ?? null;
    this.phase = this.still ? 'open' : 'to-the-glass';

    const add = scene.add;
    this.root = add.container(0, 0).setScrollFactor(0).setDepth(OVERVIEW_DEPTH);
    this.iris = add.graphics().setScrollFactor(0).setDepth(OVERVIEW_DEPTH + 1);

    const backdrop = add.rectangle(0, 0, 4096, 4096, SURROUND_INK).setOrigin(0, 0);
    this.close = add.image(0, 0, source.floorTexture).setOrigin(0, 0).setVisible(false);
    this.close.setCrop(source.mapFloor.left, source.mapFloor.top, source.mapFloor.width, source.mapFloor.height);
    this.fitted = add.image(0, 0, this.fittedTexture()).setOrigin(0, 0);
    const big = { width: Math.max(this.screen.width, 400) + 64, height: Math.max(this.screen.height, 256) + 64 };
    this.cloudShadow = source.cloudShadow
      ? add
          .tileSprite(0, 0, big.width, big.height, source.textures.mist)
          .setOrigin(0, 0)
          .setAlpha(source.cloudShadow.alpha)
          .setTint(source.cloudShadow.tint)
      : null;
    this.townLayer = add.graphics();
    this.memoryLayer = add.graphics();
    this.lights = source.landings.map((landing) => ({ landing, image: add.image(0, 0, source.textures.light) }));
    this.look = add.image(0, 0, source.textures.look);
    for (const [index, alpha] of source.mistAlphas.entries()) {
      this.mists.push(
        add
          .tileSprite(0, 0, big.width, big.height, source.textures.mist)
          .setOrigin(0, 0)
          .setAlpha(alpha)
          .setTint(source.mistTint)
          .setFlipX(index === 1),
      );
    }
    this.surround = add.graphics();
    const text = (color: string): Phaser.GameObjects.Text => add.text(0, 0, '', { fontFamily: GAME_FONT, fontSize: CHIP_FONT_SIZE, color });
    this.plateFrame = add.graphics();
    this.plateText = text('#f8f7dd');
    this.hoverFrame = add.graphics().setVisible(false);
    this.hoverText = text('#f8f7dd').setVisible(false);
    this.titleFrame = add.graphics();
    this.titleText = text('#f8f7dd');
    this.compass = add.graphics();
    for (const letter of ['N', 'E', 'S', 'W']) {
      this.compassLetters.push(text('#f8f0d8').setText(letter));
    }
    for (const letter of ['W', 'A', 'S', 'D']) {
      this.compassKeys.push(text('#101018').setText(letter));
    }
    this.bar = add.graphics();
    this.root.add([
      backdrop,
      this.close,
      this.fitted,
      ...(this.cloudShadow ? [this.cloudShadow] : []),
      this.townLayer,
      this.memoryLayer,
      ...this.lights.map(({ image }) => image),
      this.look,
      ...this.mists,
      this.surround,
      this.plateFrame,
      this.plateText,
      this.hoverFrame,
      this.hoverText,
      this.titleFrame,
      this.titleText,
      this.compass,
      ...this.compassLetters,
      ...this.compassKeys,
      this.bar,
    ]);
    for (const [id, words] of [
      ['back-way', keyHint(TELESCOPE_KEY_LETTERS.wayBack, '')],
      ['next-way', keyHint(TELESCOPE_KEY_LETTERS.wayNext, 'WAY IN')],
      ['go', keyHint('ENTER', 'GO THERE')],
      ['closer', keyHint(TELESCOPE_KEY_LETTERS.closer, 'CLOSER')],
      ['step-back', keyHint('SPACE', 'STEP BACK')],
    ] as const) {
      const chip: Chip = { id, text: text('#f8f7dd').setText(words.trim()), x: 0, width: 0 };
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

  /** The fitted picture of this map, painted once for each size of window it is looked at through. */
  private fittedTexture(): string {
    const size = fittedPictureSize(this.mapSize, this.screen);
    const key = `${this.source.floorTexture}-whole-${size.width}x${size.height}`;
    const { textures } = this.scene;
    if (!textures.exists(key)) {
      const canvas = textures.get(this.source.floorTexture).getSourceImage() as HTMLCanvasElement;
      const floor = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height);
      const picture: PaintedPicture = condensedFloor(floor, this.source.mapFloor, size);
      const texture = textures.createCanvas(key, size.width, size.height);
      texture?.context.putImageData(new ImageData(picture.data, picture.width, picture.height), 0, 0);
      texture?.refresh();
    }
    return key;
  }

  private nameTheMap(): void {
    const { mapName, walkedPercent } = this.source;
    this.titleText.setText(`${mapName.toUpperCase()}: ${walkedPercent}% WALKED`);
    const width = Math.ceil(this.titleText.width) + 8;
    this.titleFrame.clear();
    drawPixelWindow(this.titleFrame, { x: 0, y: 0, width, height: NAME_PLATE_HEIGHT }, { fill: PLATE_FILL, border: BRASS });
    this.titleFrame.setData('width', width);
  }

  /** How it ended, once the hall is back on the screen. */
  public get finished(): OverviewEnding | null {
    return this.phase === 'done' ? this.ending : null;
  }

  /** What a driver and a test read: the rules underneath, and who is chosen. */
  public get rules(): OverviewView {
    return this.view;
  }

  public get wayIn(): RimLanding | null {
    return this.chosen;
  }

  public get isOpen(): boolean {
    return this.phase === 'open';
  }

  public get wingsCrossing(): boolean {
    return this.wings !== null;
  }

  private choose(landing: RimLanding | null): void {
    if (!landing || landing.id === this.chosen?.id) {
      return;
    }
    this.chosen = landing;
    this.view.reveal(this.pointOfLanding(landing), REVEAL_MARGIN);
    this.lightMs = 0;
  }

  private pointOfLanding(landing: RimLanding): OverviewPoint {
    return mapPointOfTile(landing.tile, this.source.scale);
  }

  private leave(ending: OverviewEnding): void {
    this.ending = ending;
    this.phase = this.still ? 'done' : 'closing';
    this.phaseMs = 0;
  }

  private act(id: Chip['id']): void {
    if (id === 'back-way' || id === 'next-way') {
      this.choose(nextWayIn(this.source.landings, this.chosen?.id ?? null, id === 'back-way' ? -1 : 1));
    } else if (id === 'closer') {
      this.view.cycleLevel(null);
      // Out of the whole map, the closer look is at the way in that has been chosen.
      if (this.chosen && this.view.level === 1) {
        this.view.lookAt(this.pointOfLanding(this.chosen));
      }
    } else if (id === 'go') {
      if (this.chosen) {
        this.leave({ kind: 'go', landing: this.chosen });
      }
    } else {
      this.leave({ kind: 'back' });
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
      this.frame(deltaMs, this.phase === 'open' ? keys.held : { x: 0, y: 0 });
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
    if (keys.go && this.chosen) {
      this.leave({ kind: 'go', landing: this.chosen });
      return;
    }
    if (keys.wayBack || keys.wayNext) {
      this.act(keys.wayBack ? 'back-way' : 'next-way');
    }
    if (keys.closer) {
      this.act('closer');
    }
    if ((keys.held.x !== 0 || keys.held.y !== 0) && !this.view.canPan) {
      // There is nothing to pan to with the whole map on the screen: this is what there is to do first.
      this.teachCloserMs = TEACH_CLOSER_MS;
    }
  }

  // --- the pointer -------------------------------------------------------------

  private chipAt(x: number, y: number): Chip | undefined {
    if (y < this.screen.height - OVERVIEW_BAR_HEIGHT) {
      return undefined;
    }
    return this.chips.find((chip) => chip.text.visible && x >= chip.x - 2 && x < chip.x + chip.width + 2);
  }

  private lightAt(x: number, y: number): RimLanding | null {
    return wayInNear(
      this.lights.map(({ landing }) => ({ landing, at: this.view.screenOf(this.pointOfLanding(landing)) })),
      { x, y },
    );
  }

  public pointerDown(x: number, y: number): void {
    if (this.phase === 'open') {
      this.pointer = { startX: x, startY: y, lastX: x, lastY: y, dragging: false };
    }
  }

  public pointerMove(x: number, y: number, down: boolean): void {
    if (this.phase !== 'open') {
      return;
    }
    const held = this.pointer;
    if (held && down) {
      if (!held.dragging && Math.hypot(x - held.startX, y - held.startY) >= DRAG_FROM && !this.chipAt(held.startX, held.startY)) {
        held.dragging = true;
      }
      if (held.dragging) {
        this.view.dragBy(x - held.lastX, y - held.lastY);
      }
      held.lastX = x;
      held.lastY = y;
    }
    const chip = this.chipAt(x, y);
    const light = chip ? null : this.lightAt(x, y);
    this.litChip = chip?.id ?? null;
    this.hovered = light;
    this.scene.game.canvas.style.cursor = held?.dragging ? 'grabbing' : chip || light ? 'pointer' : this.view.canPan ? 'grab' : '';
  }

  public pointerUp(x: number, y: number): void {
    const held = this.pointer;
    this.pointer = null;
    if (!held || held.dragging || this.phase !== 'open') {
      return;
    }
    const chip = this.chipAt(x, y);
    if (chip) {
      this.act(chip.id);
      return;
    }
    const light = this.lightAt(x, y);
    if (!light) {
      return;
    }
    // The first click on a light chooses it, and a click on the chosen one goes there.
    if (light.id === this.chosen?.id) {
      this.leave({ kind: 'go', landing: light });
    } else {
      this.choose(light);
    }
  }

  public wheel(x: number, y: number, by: number): void {
    if (this.phase === 'open' && by !== 0) {
      this.view.changeLevel(by < 0 ? 1 : -1, { x, y: Math.min(y, overviewArea(this.screen).height) });
    }
  }

  // --- a frame ---------------------------------------------------------------

  private frame(deltaMs: number, held: OverviewPoint): void {
    this.ignoreTheHall();
    this.glassCamera?.setSize(this.screen.width, this.screen.height);
    this.view.resize(this.screen);
    this.view.advance(deltaMs, held, this.still);
    this.openMs += deltaMs;
    this.lightMs += deltaMs;
    this.teachCloserMs = Math.max(0, this.teachCloserMs - deltaMs);
    this.layOut();
    if (!this.still) {
      this.driftTheCloud();
      this.flyTheWings(deltaMs);
    }
  }

  private driftTheCloud(): void {
    const [slow, fast] = this.mists;
    const rect = this.view.mapRect();
    const scaled = (value: number, by: number): number => Math.round(value / by);
    slow?.setTilePosition(scaled(this.openMs, 170) - rect.left, scaled(this.openMs, 420) - rect.top);
    fast?.setTilePosition(-scaled(this.openMs, 95) - rect.left, scaled(this.openMs, 300) - rect.top);
    this.cloudShadow?.setTilePosition(scaled(this.openMs, 120) - rect.left, scaled(this.openMs, 260) - rect.top);
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
      // Under the marks and the cloud, as it is in the pit.
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

  private layOut(): void {
    const whole = this.view.isWhole;
    const rect = this.view.mapRect();
    if (whole) {
      this.fitted.setPosition(rect.left, rect.top).setVisible(true);
      this.close.setVisible(false);
    } else {
      this.fitted.setVisible(false);
      const { zoom } = this.view;
      const { left, top } = this.source.mapFloor;
      this.close.setScale(zoom).setPosition(Math.round(rect.left - left * zoom), Math.round(rect.top - top * zoom)).setVisible(true);
    }
    this.drawMemory(rect);
    this.placeLights();
    this.drawSurround(rect);
    this.placeNames();
    this.drawCompass();
    this.drawBar();
  }

  /** Town lights and what the pit remembers, at the size marks are drawn whatever the level. */
  private drawMemory(rect: { readonly left: number; readonly top: number }): void {
    const zoom = this.view.zoom;
    const key = `${rect.left},${rect.top},${zoom}`;
    if (key === this.memoryKey) {
      return;
    }
    this.memoryKey = key;
    const { mapFloor, scale, trail, marks, townLights, trailInk, trailShade } = this.source;
    const towns = this.townLayer.clear();
    for (const light of townLights) {
      const at = this.view.screenOf({ x: light.x - mapFloor.left, y: light.y - mapFloor.top });
      towns.fillStyle(light.warm ? 0xf8d070 : 0xf8e8b8, 1).fillRect(at.x, at.y, 1, 1);
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

  private placeLights(): void {
    const beat = !this.still && Math.floor(this.lightMs / 520) % 2 === 1;
    for (const { landing, image } of this.lights) {
      const at = this.view.screenOf(this.pointOfLanding(landing));
      const isChosen = landing.id === this.chosen?.id;
      image.setPosition(at.x, at.y).setVisible(!isChosen || !beat);
      if (isChosen) {
        this.look.setPosition(at.x, at.y);
      }
    }
    this.look.setVisible(this.chosen !== null);
  }

  /** The dark round the map where the screen is wider than it, and a brass edge to the map itself. */
  private drawSurround(rect: { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number }): void {
    const { width, height } = this.screen;
    const key = `${rect.left},${rect.top},${rect.right},${rect.bottom},${width},${height}`;
    if (key === this.surroundKey) {
      return;
    }
    this.surroundKey = key;
    const on = this.surround.clear();
    on.fillStyle(SURROUND_INK, 1);
    if (rect.top > 0) on.fillRect(0, 0, width, rect.top);
    if (rect.bottom < height) on.fillRect(0, rect.bottom, width, height - rect.bottom);
    if (rect.left > 0) on.fillRect(0, 0, rect.left, height);
    if (rect.right < width) on.fillRect(rect.right, 0, width - rect.right, height);
    // Only the edges of the map that are on the screen are drawn.
    const edge = (x: number, y: number, w: number, h: number): void => {
      on.fillStyle(BRASS_SHADE, 1).fillRect(x - 1, y - 1, w + 2, h + 2);
      on.fillStyle(BRASS_DARK, 1).fillRect(x, y, w, h);
    };
    if (rect.left > 0) edge(rect.left - 1, rect.top, 1, rect.bottom - rect.top);
    if (rect.right < width) edge(rect.right, rect.top, 1, rect.bottom - rect.top);
    if (rect.top > 0) edge(rect.left, rect.top - 1, rect.right - rect.left, 1);
    if (rect.bottom < height - OVERVIEW_BAR_HEIGHT) edge(rect.left, rect.bottom, rect.right - rect.left, 1);
  }

  private placeNames(): void {
    const chosen = this.chosen;
    const named = chosen ? this.nameOf(chosen) : null;
    if (named !== this.plateNamed) {
      this.plateNamed = named;
      this.plateText.setText(named ?? '');
      const width = Math.ceil(this.plateText.width) + 8;
      this.plateFrame.clear();
      drawPixelWindow(this.plateFrame, { x: 0, y: 0, width, height: NAME_PLATE_HEIGHT }, { fill: PLATE_FILL, border: PIN_INK });
      this.plateFrame.setData('width', width);
    }
    this.plateFrame.setVisible(chosen !== null);
    this.plateText.setVisible(chosen !== null);
    if (chosen) {
      const width = this.plateFrame.getData('width') as number;
      const place = platePlace(this.view.screenOf(this.pointOfLanding(chosen)), { width, height: NAME_PLATE_HEIGHT }, this.screen, COMPASS_CLEAR);
      this.plateFrame.setPosition(place.x, place.y);
      this.plateText.setPosition(place.x + 4, place.y + 1);
      this.drawPointer(place, width);
    }
    const hovered = this.hovered && this.hovered.id !== chosen?.id ? this.hovered : null;
    const hoverName = hovered ? this.nameOf(hovered) : null;
    if (hoverName !== this.hoverNamed) {
      this.hoverNamed = hoverName;
      this.hoverText.setText(hoverName ?? '');
      const width = Math.ceil(this.hoverText.width) + 8;
      this.hoverFrame.clear();
      drawPixelWindow(this.hoverFrame, { x: 0, y: 0, width, height: NAME_PLATE_HEIGHT }, { fill: PLATE_FILL, border: BRASS_DARK });
      this.hoverFrame.setData('width', width);
    }
    this.hoverFrame.setVisible(hovered !== null);
    this.hoverText.setVisible(hovered !== null);
    if (hovered) {
      const width = this.hoverFrame.getData('width') as number;
      const place = platePlace(this.view.screenOf(this.pointOfLanding(hovered)), { width, height: NAME_PLATE_HEIGHT }, this.screen, COMPASS_CLEAR);
      this.hoverFrame.setPosition(place.x, place.y);
      this.hoverText.setPosition(place.x + 4, place.y + 1);
    }
    const titled = this.openMs < NAME_UP_MS;
    this.titleFrame.setVisible(titled);
    this.titleText.setVisible(titled);
    if (titled) {
      const width = this.titleFrame.getData('width') as number;
      const x = Math.max(COMPASS_CLEAR.right + 2, Math.round((this.screen.width - width) / 2));
      this.titleFrame.setPosition(x, 2);
      this.titleText.setPosition(x + 4, 3);
    }
  }

  /** A way in panned out of sight is pointed at from its name. */
  private drawPointer(place: ReturnType<typeof platePlace>, width: number): void {
    const key = 'pointer';
    let pin = this.plateFrame.getData(key) as Phaser.GameObjects.Graphics | undefined;
    if (!pin) {
      pin = this.scene.add.graphics();
      this.plateFrame.setData(key, pin);
      this.root.addAt(pin, this.root.getIndex(this.plateFrame));
    }
    pin.clear();
    if (!place.points) {
      return;
    }
    const x = place.points.x > 0 ? place.x + width + 2 : place.points.x < 0 ? place.x - 3 : place.x + Math.round(width / 2);
    const y = place.points.y > 0 ? place.y + NAME_PLATE_HEIGHT + 2 : place.points.y < 0 ? place.y - 3 : place.y + 6;
    pin.fillStyle(PIN_INK, 1).fillRect(x, y, 2, 2);
    pin.fillRect(x + place.points.x * 2, y + place.points.y * 2, 2, 2);
  }

  /** N, E, S and W on a brass dial, and round it the keys that move the view that way. */
  private drawCompass(): void {
    const canPan = this.view.canPan;
    const key = `${canPan}`;
    if (key === this.compassKey) {
      return;
    }
    this.compassKey = key;
    const on = this.compass.clear();
    const { x, y, width, height, dialRadius, keyCap } = COMPASS;
    drawPixelWindow(on, { x, y, width, height }, { fill: PLATE_FILL, border: BRASS_DARK });
    const cx = x + Math.floor(width / 2);
    const cy = y + Math.floor(height / 2);
    fillDisc(on, cx, cy, dialRadius, BRASS_DARK);
    fillDisc(on, cx, cy, dialRadius - 1, BRASS);
    fillDisc(on, cx, cy, dialRadius - 2, 0x182038);
    // The needle: north red, south cream.
    on.fillStyle(0xd83818, 1).fillRect(cx - 1, cy - 4, 2, 4);
    on.fillStyle(CREAM, 1).fillRect(cx - 1, cy, 2, 4);
    const letters = [
      { dx: 0, dy: -11 },
      { dx: 11, dy: 0 },
      { dx: 0, dy: 11 },
      { dx: -11, dy: 0 },
    ];
    this.compassLetters.forEach((letter, index) => {
      letter.setPosition(Math.round(cx + letters[index].dx - letter.width / 2), Math.round(cy + letters[index].dy - letter.height / 2));
    });
    // W above, A to the left, S below and D to the right.
    const off = dialRadius + 1 + Math.ceil(keyCap / 2);
    const caps = [
      { dx: 0, dy: -off },
      { dx: -off, dy: 0 },
      { dx: 0, dy: off },
      { dx: off, dy: 0 },
    ];
    this.compassKeys.forEach((cap, index) => {
      const capX = cx + caps[index].dx - keyCap / 2;
      const capY = cy + caps[index].dy - keyCap / 2;
      // A key with nothing to do just now is greyed, and says so without going out.
      on.fillStyle(BRASS_DARK, 1).fillRect(capX, capY, keyCap, keyCap);
      on.fillStyle(canPan ? CREAM : KEY_RESTING, 1).fillRect(capX + 1, capY + 1, keyCap - 2, keyCap - 2);
      cap.setPosition(Math.round(capX + keyCap / 2 - cap.width / 2), Math.round(capY + keyCap / 2 - cap.height / 2));
    });
  }

  private drawBar(): void {
    const { width, height } = this.screen;
    const closerWords = this.view.isClosest ? 'WHOLE MAP' : 'CLOSER';
    const lit = this.teachCloserMs > 0 ? 'closer' : this.litChip;
    const key = `${width},${height},${closerWords},${lit},${this.source.landings.length}`;
    if (key === this.barKey) {
      return;
    }
    this.barKey = key;
    const on = this.bar.clear();
    const top = height - OVERVIEW_BAR_HEIGHT;
    drawPixelWindow(on, { x: 0, y: top, width, height: OVERVIEW_BAR_HEIGHT }, { fill: PLATE_FILL, border: BRASS_DARK });
    const chipOf = (id: Chip['id']): Chip => this.chips.find((chip) => chip.id === id)!;
    chipOf('closer').text.setText(keyHint(TELESCOPE_KEY_LETTERS.closer, closerWords));
    const oneWayIn = this.source.landings.length < 2;
    chipOf('back-way').text.setVisible(!oneWayIn);
    chipOf('next-way').text.setVisible(!oneWayIn);
    // The whole row in the room there is, in the shorter words if it comes to it.
    const words = (long: boolean): void => {
      chipOf('go').text.setText(keyHint('ENTER', long ? 'GO THERE' : 'GO'));
      chipOf('step-back').text.setText(keyHint('SPACE', long ? 'STEP BACK' : 'BACK'));
    };
    const measured = (): number => this.chips.filter((chip) => chip.text.visible).reduce((sum, chip) => sum + Math.ceil(chip.text.width) + 8, 0);
    words(true);
    if (measured() > width - 8) {
      words(false);
    }
    let x = 6;
    for (const chip of this.chips.filter((each) => each.text.visible)) {
      chip.x = x;
      chip.width = Math.ceil(chip.text.width);
      chip.text.setPosition(x, top + 3);
      if (chip.id === lit) {
        on.fillStyle(BRASS_DARK, 1).fillRect(x - 2, top + 2, chip.width + 4, OVERVIEW_BAR_HEIGHT - 4);
      }
      x += chip.width + (chip.id === 'back-way' ? 4 : 10);
    }
  }

  public destroy(): void {
    this.lookBackAtTheHall();
    this.wings?.image.destroy();
    this.root.destroy(true);
    this.iris.destroy();
    this.scene.game.canvas.style.cursor = '';
  }
}
