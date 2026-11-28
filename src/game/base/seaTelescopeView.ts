import Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import { keyHint, TELESCOPE_KEY_LETTERS } from '../input/keyBindings';
import { pokemonTextureKey } from '../pokemon/pokemonSprites';
import { CHIP_FONT_SIZE } from '../ui/screenType';
import { GAME_FONT } from '../ui/gameFont';
import { drawPixelWindow } from '../ui/pixelWindow';
import type { PaintedPicture } from '../world/minimap';
import { isFigureSpecies, POKEMON_ICON_FRAME_MS, POKEMON_ICON_TEXTURE, pokemonIconFrames } from '../world/pokemonFigures';
import type { WindowLight } from './homeClock';
import {
  BAND_SCALE,
  BEHIND_HOLD_MS,
  BEHIND_IN_MS,
  BEHIND_PUSH_MS,
  BEHIND_PUSH_ZOOM,
  HOLD_TO_SEE_MS,
  LENS_IRIS_MS,
  PANORAMA,
  SHOWN_TO_SEE,
  SIGHTS_SLACK,
  SWOOP_BACK_MS,
  SWOOP_MS,
  ZOOM_STEPS,
  closeEnoughAt,
  heldFor,
  nextZoom,
  poseAt,
  rollSea,
  showsAt,
  swoopAt,
  type SeaPose,
  type SeaSighting,
  type TelescopeZoom,
} from './seaTelescope';
import {
  RAIL_INKS,
  SEA_INKS,
  TELESCOPE_BACK,
  TELESCOPE_EYE,
  TELESCOPE_INKS,
  opaqueBox,
  paintGrid,
  paintSeaView,
  shrinkPicture,
  type BodyBox,
} from './seaTelescopeArt';
import { OVERVIEW_BAR_HEIGHT, OVERVIEW_BAR_WORDS_Y } from './valeOverview';

/**
 * THE POINT's coin telescope, as the harbour draws it (`seaTelescope.ts` is the
 * rules). The harbour's own camera comes down to the player and round behind
 * them; then a shot from behind their head, over their shoulder to the
 * telescope and the sea past the rail, pushes in to the eyepiece; and the round
 * of the glass opens on the open sea. ESC goes back the same way.
 *
 * Two cameras of its own once the shot is behind the player: one over the sea
 * (it pans and zooms, and only it draws the sea), and one for the glass (the
 * dark round the lens, its rim, the sights, the kinds spotted and the keys),
 * which never moves. The harbour's camera is switched off while either is up,
 * as the Raid Arena's telescope does (`valeOverviewView.ts`), and both are
 * taken away again before the harbour's comes back.
 */

export interface SeaTelescopeKeys {
  readonly held: { readonly x: number; readonly y: number };
  readonly back: boolean;
  readonly zoom: boolean;
}

export interface SeaTelescopeOptions {
  readonly light: WindowLight;
  /** How far round the harbour's camera turns to stand behind the player (`turnBehind`). */
  readonly turn: number;
  /** Reduced motion: the glass opens and shuts without the swoop. */
  readonly still: boolean;
  /** The player's figure, its frame from behind, and the row their head starts on. */
  readonly figure: { readonly texture: string; readonly frame: number; readonly headTop: number };
  /** Tells the Pokédex a kind has been seen; whether it was new to it. */
  readonly see: (dexId: number) => boolean;
  readonly rng?: () => number;
}

type Phase =
  | 'swoop-in'
  | 'behind-in'
  | 'behind-hold'
  | 'push'
  | 'lens-open'
  | 'open'
  | 'lens-close'
  | 'pull'
  | 'behind-out'
  | 'swoop-out'
  | 'done';

const INK = 0x080810;
const BRASS = 0xf8c840;
const BRASS_DARK = 0x885820;
const BRASS_DEEP = 0x483010;
const PLATE_FILL = 0x221d1e;
const BRIGHT_WORDS = '#f8f7dd';
/** How fast the glass pans, in screen pixels a second, whatever the zoom; and up to how many times that, held. */
const PAN_PX_PER_S = 110;
const PAN_SPEEDS_UP = 3;
/** How long an arrow is held before the pan is at its fastest. */
const PAN_SPEED_UP_MS = 1000;
/** How long the glass takes from one zoom to the next. */
const ZOOM_MS = 180;
/** How big the player and the telescope stand in the shot behind them. */
const BEHIND_SCALE = 4;
/** How many rows of the figure, from the top of the head, the shot behind them takes in. */
const FIGURE_ROWS = 22;
/** The hold's ring round the middle of the glass, and how many marks it fills in. */
const HOLD_RING_RADIUS = 9;
const HOLD_RING_MARKS = 16;
/** Kinds spotted on a look, down the side of the glass. */
const TRAY_PITCH = 28;
const TRAY_FLY_MS = 420;

const ease = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
};
const easeIn = (t: number): number => {
  const c = Math.max(0, Math.min(1, t));
  return c * c * c;
};

interface SightingShown {
  readonly sighting: SeaSighting;
  readonly image: Phaser.GameObjects.Image;
  pose: SeaPose;
  /** The drawn body's square in panorama pixels, or null while it is under. */
  body: { left: number; top: number; right: number; bottom: number } | null;
  heldMs: number;
  spotted: boolean;
}

interface Spotted {
  readonly speciesId: string;
  readonly fresh: boolean;
  readonly icon: Phaser.GameObjects.Image | null;
  readonly flash: Phaser.GameObjects.Graphics;
  flyMs: number;
  readonly from: { readonly x: number; readonly y: number };
}

export class SeaTelescopeView {
  private readonly scene: Phaser.Scene;
  private readonly options: SeaTelescopeOptions;
  private readonly sightings: SightingShown[];
  private readonly seaLayer: Phaser.GameObjects.Container;
  private readonly glassLayer: Phaser.GameObjects.Container;
  /** The sea and sky, painted a pixel of the screen at a time for what the glass shows (`paintSeaView`). */
  private readonly seaPicture: Phaser.GameObjects.Image;
  private seaPictureKey = '';
  private seaPictureSize = '';
  private readonly water: Phaser.GameObjects.Graphics;
  private readonly foreground: Phaser.GameObjects.Container;
  private readonly iris: Phaser.GameObjects.Graphics;
  private readonly sights: Phaser.GameObjects.Graphics;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly chips: Phaser.GameObjects.Text[] = [];
  private readonly spotted: Spotted[] = [];
  private readonly painted: string[] = [];
  private readonly bodies = new Map<string, BodyBox>();
  private seaCamera: Phaser.Cameras.Scene2D.Camera | null = null;
  private glassCamera: Phaser.Cameras.Scene2D.Camera | null = null;
  private childrenIgnored = -1;
  private phase: Phase;
  private phaseMs = 0;
  private lookMs = 0;
  // The glass opens on the whole sea; Z goes in to make out what is on it.
  private zoom: TelescopeZoom = ZOOM_STEPS[0];
  private zoomShown: number = ZOOM_STEPS[0];
  private zoomFrom: number = ZOOM_STEPS[0];
  private zoomMs = ZOOM_MS;
  /** Where the glass is pointed, in panorama pixels: the middle of what it shows. */
  private aim = { x: PANORAMA.width / 2, y: PANORAMA.horizon + 34 };
  /** Where the shot behind the player looks, and the eyepiece it pushes in to. */
  private behindAim = { x: PANORAMA.width / 2, y: 0 };
  private eye = { x: 0, y: 0 };
  private ringMs = 0;
  private wavesOn: 0 | 1 = 0;
  private wavesMs = 0;
  private drag: { x: number; y: number } | null = null;
  /** How long the arrows have been held without a break: a long pan speeds up, a nudge stays fine. */
  private panHeldMs = 0;
  private readonly listeners: { readonly event: string; readonly fn: (...args: never[]) => void }[] = [];

  public constructor(scene: Phaser.Scene, options: SeaTelescopeOptions) {
    this.scene = scene;
    this.options = options;
    this.phase = options.still ? 'lens-open' : 'swoop-in';
    const add = scene.add;
    this.seaLayer = add.container(0, 0).setVisible(false);
    this.seaPicture = add.image(0, 0, '__DEFAULT').setOrigin(0, 0);
    this.water = add.graphics();
    this.sightings = rollSea(options.rng).map((sighting) => ({
      sighting,
      image: add.image(0, 0, pokemonTextureKey('front', sighting.dexId)).setOrigin(0.5, 0),
      pose: poseAt(sighting, 0),
      body: null,
      heldMs: 0,
      spotted: false,
    }));
    this.foreground = add.container(0, 0);
    this.seaLayer.add([this.seaPicture, ...this.sightings.map((shown) => shown.image), this.water, this.foreground]);

    this.glassLayer = add.container(0, 0);
    this.iris = add.graphics();
    this.sights = add.graphics();
    this.bar = add.graphics();
    this.glassLayer.add([this.iris, this.sights, this.bar]);
    for (const words of [keyHint('ARROWS', 'MOVE'), keyHint(TELESCOPE_KEY_LETTERS.closer, 'ZOOM'), keyHint('ESC', 'BACK')]) {
      const chip = add.text(0, 0, words, { fontFamily: GAME_FONT, fontSize: CHIP_FONT_SIZE, color: BRIGHT_WORDS });
      this.chips.push(chip);
      this.glassLayer.add(chip);
    }
    this.glassLayer.setVisible(false);
    this.scene.cameras.main.ignore([this.seaLayer, this.glassLayer]);
    this.layOutBehind();
    if (!options.still) this.padTheHarbour(true);
    if (options.still) {
      this.lookOutToSea();
    }
    this.listen();
  }

  /** Whether the eye has left the glass and the harbour is back as it was. */
  public get finished(): boolean {
    return this.phase === 'done';
  }

  /** Whether the glass is up and answering the keys, rather than on its way to the eye or back. */
  public get looking(): boolean {
    return this.phase === 'open';
  }

  /** What the touch pad offers while the glass is up: ZOOM. OK and BACK are the pad's own. */
  public padKeys(): string {
    return keyHint(TELESCOPE_KEY_LETTERS.closer, 'ZOOM');
  }

  public update(deltaMs: number, keys: SeaTelescopeKeys): void {
    this.phaseMs += deltaMs;
    const main = this.scene.cameras.main;
    switch (this.phase) {
      case 'swoop-in': {
        const at = swoopAt(this.phaseMs / SWOOP_MS, this.options.turn);
        main.setZoom(at.zoom).setRotation(at.rotation);
        if (this.phaseMs >= SWOOP_MS) this.next('behind-in', () => this.standBehind());
        break;
      }
      case 'behind-in':
        this.seaLayer.setAlpha(ease(this.phaseMs / BEHIND_IN_MS));
        if (this.phaseMs >= BEHIND_IN_MS) {
          this.next('behind-hold');
          main.setVisible(false);
        }
        break;
      case 'behind-hold':
        if (this.phaseMs >= BEHIND_HOLD_MS) this.next('push');
        break;
      case 'push': {
        this.pushIn(this.phaseMs / BEHIND_PUSH_MS);
        if (this.phaseMs >= BEHIND_PUSH_MS) this.next('lens-open', () => this.lookOutToSea());
        break;
      }
      case 'lens-open':
        this.drawGlass(ease(this.phaseMs / LENS_IRIS_MS));
        if (this.phaseMs >= LENS_IRIS_MS) this.next('open');
        break;
      case 'open':
        this.lookAbout(deltaMs, keys);
        this.drawGlass(1);
        break;
      case 'lens-close':
        this.drawGlass(1 - ease(this.phaseMs / LENS_IRIS_MS));
        if (this.phaseMs >= LENS_IRIS_MS) {
          if (this.options.still) {
            this.next('done', () => this.backInTheHarbour());
          } else {
            this.next('pull', () => this.standBehind());
          }
        }
        break;
      case 'pull':
        this.pushIn(1 - this.phaseMs / BEHIND_PUSH_MS);
        if (this.phaseMs >= BEHIND_PUSH_MS) {
          this.next('behind-out');
          main.setVisible(true);
        }
        break;
      case 'behind-out':
        this.seaLayer.setAlpha(1 - ease(this.phaseMs / BEHIND_IN_MS));
        if (this.phaseMs >= BEHIND_IN_MS) this.next('swoop-out', () => this.backInTheHarbour());
        break;
      case 'swoop-out': {
        const at = swoopAt(1 - this.phaseMs / SWOOP_BACK_MS, this.options.turn);
        main.setZoom(at.zoom).setRotation(at.rotation);
        if (this.phaseMs >= SWOOP_BACK_MS) {
          main.setZoom(1).setRotation(0);
          this.padTheHarbour(false);
          this.next('done');
        }
        break;
      }
      default:
        break;
    }
    if (this.seaLayer.visible) {
      this.ignoreTheHarbour();
      this.drawSea(deltaMs);
    }
  }

  private next(phase: Phase, then?: () => void): void {
    this.phase = phase;
    this.phaseMs = 0;
    then?.();
  }

  // --- the shot behind the player ----------------------------------------------

  /** Where the shot behind the player stands, and the figures in front of the sea. */
  private layOutBehind(): void {
    const { width, height } = this.scene.scale;
    const middleY = Math.max(height / 2, Math.min(PANORAMA.height - height / 2, PANORAMA.horizon + 0.12 * height));
    this.behindAim = { x: PANORAMA.width / 2, y: Math.round(middleY) };
    const left = this.behindAim.x - width / 2;
    const top = this.behindAim.y - height / 2;
    this.foreground.removeAll(true);
    const add = this.scene.add;
    // The lookout's rail, between the telescope and the sea.
    const railY = Math.round(top + height * 0.7);
    const rail = add.graphics();
    const ink = (rgb: readonly [number, number, number]): number => (rgb[0] << 16) | (rgb[1] << 8) | rgb[2];
    rail.fillStyle(ink(RAIL_INKS.shade), 1).fillRect(left, railY + 3, width, 1);
    rail.fillStyle(ink(RAIL_INKS.rail), 1).fillRect(left, railY, width, 3);
    rail.fillStyle(ink(RAIL_INKS.lit), 1).fillRect(left, railY, width, 1);
    for (let x = left + 10; x < left + width; x += 36) {
      rail.fillStyle(ink(RAIL_INKS.rail), 1).fillRect(x, railY + 3, 3, top + height - railY);
      rail.fillStyle(ink(RAIL_INKS.lit), 1).fillRect(x, railY + 3, 1, top + height - railY);
    }
    const telescopeKey = this.paint('sea-telescope-back', () => paintGrid(TELESCOPE_BACK, TELESCOPE_INKS));
    const telescopeTop = Math.round(top + height - 22 * BEHIND_SCALE);
    const telescope = add.image(this.behindAim.x, telescopeTop, telescopeKey).setOrigin(0.5, 0).setScale(BEHIND_SCALE);
    const artLeft = this.behindAim.x - (TELESCOPE_BACK[0].length * BEHIND_SCALE) / 2;
    this.eye = { x: artLeft + (TELESCOPE_EYE.x + 0.5) * BEHIND_SCALE, y: telescopeTop + (TELESCOPE_EYE.y + 0.5) * BEHIND_SCALE };
    // The player, from behind, over their shoulder: nearer than the telescope, at its left.
    const { figure } = this.options;
    const you = add
      .image(Math.round(this.behindAim.x - 18 * BEHIND_SCALE), Math.round(top + height - 17 * BEHIND_SCALE), figure.texture, figure.frame)
      .setOrigin(0.5, 0)
      .setScale(BEHIND_SCALE)
      .setCrop(0, figure.headTop, 16, FIGURE_ROWS);
    // The crop keeps the frame's place, so the head is lifted to where it shows.
    you.y -= figure.headTop * BEHIND_SCALE;
    this.foreground.add([rail, telescope, you]);
  }

  /** The two cameras of the glass, and the shot behind the player in the sea's. */
  private standBehind(): void {
    const { width, height } = this.scene.scale;
    this.seaLayer.setVisible(true).setAlpha(this.phase === 'behind-in' ? 0 : 1);
    this.glassLayer.setVisible(true);
    this.foreground.setVisible(true);
    this.addCameras();
    this.seaCamera?.setViewport(0, 0, width, height).removeBounds().setZoom(1).centerOn(this.behindAim.x, this.behindAim.y);
    this.chips.forEach((chip) => chip.setVisible(false));
    this.bar.clear();
    this.sights.clear();
    this.iris.clear();
    this.trayVisible(false);
  }

  /** The push in to the eyepiece, `share` of the way, the glass's dark closing round it at the end. */
  private pushIn(share: number): void {
    const t = Math.max(0, Math.min(1, share));
    const zoomed = 1 + (BEHIND_PUSH_ZOOM - 1) * easeIn(t);
    const along = ease(t);
    this.seaCamera
      ?.setZoom(zoomed)
      .centerOn(this.behindAim.x + (this.eye.x - this.behindAim.x) * along, this.behindAim.y + (this.eye.y - this.behindAim.y) * along);
    const { width, height } = this.scene.scale;
    const closing = Math.max(0, (t - 0.55) / 0.45);
    if (closing <= 0) {
      this.iris.clear();
      return;
    }
    const reach = Math.ceil(Math.hypot(width / 2, height / 2));
    this.drawIris({ x: width / 2, y: height / 2 }, reach * (1 - ease(closing)), false);
  }

  // --- the glass ----------------------------------------------------------------

  /** Through the eyepiece: the sea at the glass's own zoom, the keys along the foot. */
  private lookOutToSea(): void {
    const { width, height } = this.scene.scale;
    this.seaLayer.setVisible(true).setAlpha(1);
    this.glassLayer.setVisible(true);
    this.foreground.setVisible(false);
    this.addCameras();
    this.scene.cameras.main.setVisible(false);
    this.seaCamera
      ?.setViewport(0, 0, width, height - OVERVIEW_BAR_HEIGHT)
      .removeBounds()
      .setZoom(this.zoomShown)
      .centerOn(this.aim.x, this.aim.y);
    this.chips.forEach((chip) => chip.setVisible(true));
    this.drawBar();
    this.trayVisible(true);
  }

  private addCameras(): void {
    const { width, height } = this.scene.scale;
    if (!this.seaCamera) {
      this.seaCamera = this.scene.cameras.add(0, 0, width, height).setRoundPixels(true);
    }
    if (!this.glassCamera) {
      this.glassCamera = this.scene.cameras.add(0, 0, width, height).setRoundPixels(true);
    }
    this.childrenIgnored = -1;
    this.ignoreTheHarbour();
  }

  /** Each of the glass's cameras draws only its own layer: the harbour's things are added to as it lives. */
  private ignoreTheHarbour(): void {
    const { list } = this.scene.children;
    if (list.length === this.childrenIgnored) return;
    this.childrenIgnored = list.length;
    this.seaCamera?.ignore(list.filter((child) => child !== this.seaLayer));
    this.glassCamera?.ignore(list.filter((child) => child !== this.glassLayer));
  }

  private removeCameras(): void {
    for (const camera of [this.seaCamera, this.glassCamera]) {
      if (camera) this.scene.cameras.remove(camera);
    }
    this.seaCamera = null;
    this.glassCamera = null;
    this.childrenIgnored = -1;
  }

  private backInTheHarbour(): void {
    this.removeCameras();
    this.seaLayer.setVisible(false);
    this.glassLayer.setVisible(false);
    const main = this.scene.cameras.main.setVisible(true);
    if (this.options.still) main.setZoom(1).setRotation(0);
  }

  /** Where the round of the glass stands, above the keys. */
  private lens(): { readonly x: number; readonly y: number; readonly radius: number } {
    const { width, height } = this.scene.scale;
    const room = height - OVERVIEW_BAR_HEIGHT;
    return { x: Math.round(width / 2), y: Math.round(room / 2), radius: Math.floor(Math.min(width, room) / 2) - 4 };
  }

  /** The dark round the glass, `share` open, and its rim and sights once it is. */
  private drawGlass(share: number): void {
    const lens = this.lens();
    this.drawIris(lens, lens.radius * share, share >= 1);
    this.drawSights(share >= 1 && this.phase === 'open');
  }

  /** Dark outside a round, in whole pixels two rows at a time, its edge stepped; with the brass rim when `rim`. */
  private drawIris(middle: { readonly x: number; readonly y: number }, radius: number, rim: boolean): void {
    const { width, height } = this.scene.scale;
    const on = this.iris.clear();
    const room = rim ? height - OVERVIEW_BAR_HEIGHT : height;
    const STEP = 2;
    const across = (r: number, dy: number): number => (r > Math.abs(dy) ? Math.floor(Math.sqrt(r * r - dy * dy)) : -1);
    for (let y = 0; y < room; y += STEP) {
      const dy = y + STEP / 2 - middle.y;
      const half = across(radius, dy);
      on.fillStyle(INK, 1);
      if (half < 0) {
        on.fillRect(0, y, width, STEP);
        continue;
      }
      on.fillRect(0, y, Math.max(0, middle.x - half), STEP);
      on.fillRect(middle.x + half, y, Math.max(0, width - middle.x - half), STEP);
      if (!rim) continue;
      // The brass rim, darker round its foot, and a checker of shade just inside it: a lens.
      const lit = dy < -radius * 0.3;
      on.fillStyle(lit ? BRASS : BRASS_DARK, 1);
      on.fillRect(middle.x - half, y, 2, STEP).fillRect(middle.x + half - 2, y, 2, STEP);
      const inner = across(radius - 2, dy);
      if (inner >= 0) {
        on.fillStyle(BRASS_DEEP, 1);
        for (let x = middle.x - half + 2; x < middle.x - inner + 2; x += 1) on.fillRect(x, y, 1, STEP);
        for (let x = middle.x + inner - 2; x < middle.x + half - 2; x += 1) on.fillRect(x, y, 1, STEP);
        const shade = across(radius - 6, dy);
        on.fillStyle(INK, 0.5);
        if (shade >= 0) {
          for (let x = middle.x - inner + 2; x < middle.x - shade; x += 1) if ((x + y / STEP) % 2 === 0) on.fillRect(x, y, 1, STEP);
          for (let x = middle.x + shade; x < middle.x + inner - 2; x += 1) if ((x + y / STEP) % 2 === 0) on.fillRect(x, y, 1, STEP);
        }
      } else {
        on.fillStyle(BRASS_DARK, 1).fillRect(middle.x - half, y, half * 2, STEP);
      }
    }
  }

  /** The ticks round the middle of the glass, the ring a hold fills, and how close the glass is. */
  private drawSights(open: boolean): void {
    const on = this.sights.clear();
    if (!open) return;
    const lens = this.lens();
    const held = this.sightings.filter((shown) => shown.heldMs > 0 && !shown.spotted).reduce((most, shown) => Math.max(most, shown.heldMs), 0);
    on.fillStyle(BRASS_DARK, 1);
    const gap = 5;
    const tick = 4;
    on.fillRect(lens.x - gap - tick, lens.y, tick, 1).fillRect(lens.x + gap + 1, lens.y, tick, 1);
    on.fillRect(lens.x, lens.y - gap - tick, 1, tick).fillRect(lens.x, lens.y + gap + 1, 1, tick);
    if (held > 0) {
      const marks = Math.min(HOLD_RING_MARKS, Math.floor((held / HOLD_TO_SEE_MS) * HOLD_RING_MARKS));
      for (let mark = 0; mark < HOLD_RING_MARKS; mark += 1) {
        const angle = -Math.PI / 2 + (mark / HOLD_RING_MARKS) * Math.PI * 2;
        const x = Math.round(lens.x + Math.cos(angle) * HOLD_RING_RADIUS);
        const y = Math.round(lens.y + Math.sin(angle) * HOLD_RING_RADIUS);
        on.fillStyle(mark < marks ? BRASS : BRASS_DEEP, 1).fillRect(x - 1, y - 1, 2, 2);
      }
    }
    // How close the glass is: a brass pip a step of zoom, lit up to this one, beside the rim.
    const pipsX = lens.x + lens.radius + 8;
    ZOOM_STEPS.forEach((step, index) => {
      const y = lens.y + 10 - index * 10;
      on.fillStyle(step <= this.zoom ? BRASS : BRASS_DEEP, 1).fillRect(pipsX, y, 4 + index * 2, 4 + index * 2);
    });
    // A ring flashes gold where a kind was just spotted.
    if (this.ringMs > 0) {
      const t = 1 - this.ringMs / 360;
      const r = HOLD_RING_RADIUS + Math.round(t * 10);
      on.lineStyle(1, BRASS, 1 - t).strokeCircle(lens.x, lens.y, r);
    }
  }

  private drawBar(): void {
    const { width, height } = this.scene.scale;
    const top = height - OVERVIEW_BAR_HEIGHT;
    drawPixelWindow(this.bar.clear(), { x: 0, y: top, width, height: OVERVIEW_BAR_HEIGHT }, { fill: PLATE_FILL, border: BRASS_DARK });
    let x = 6;
    for (const chip of this.chips) {
      chip.setPosition(x, top + OVERVIEW_BAR_WORDS_Y);
      x += Math.ceil(chip.width) + 10;
    }
  }

  // --- looking about -------------------------------------------------------------

  private lookAbout(deltaMs: number, keys: SeaTelescopeKeys): void {
    if (keys.back) {
      audioManager.play('menuClose');
      this.next('lens-close');
      return;
    }
    if (keys.zoom) {
      this.zoomTo(nextZoom(this.zoom, 1, true));
    }
    if (keys.held.x !== 0 || keys.held.y !== 0) {
      this.panHeldMs += deltaMs;
      const faster = 1 + (PAN_SPEEDS_UP - 1) * Math.min(1, this.panHeldMs / PAN_SPEED_UP_MS);
      const by = (PAN_PX_PER_S * faster * deltaMs) / 1000 / this.zoomShown;
      this.aimBy(keys.held.x * by, keys.held.y * by);
    } else {
      this.panHeldMs = 0;
    }
    if (this.zoomMs < ZOOM_MS) {
      this.zoomMs = Math.min(ZOOM_MS, this.zoomMs + deltaMs);
      const t = ease(this.zoomMs / ZOOM_MS);
      this.zoomShown = this.zoomMs >= ZOOM_MS ? this.zoom : this.zoomFrom + (this.zoom - this.zoomFrom) * t;
    }
    this.seaCamera?.setZoom(this.zoomShown);
    this.aimBy(0, 0);
    this.watchTheMiddle(deltaMs);
    this.ringMs = Math.max(0, this.ringMs - deltaMs);
  }

  private zoomTo(zoom: TelescopeZoom): void {
    if (zoom === this.zoom) return;
    audioManager.play('select');
    this.zoomFrom = this.zoomShown;
    this.zoom = zoom;
    this.zoomMs = 0;
  }

  /** Points the glass on by so much, kept inside the picture at the zoom it is at. */
  private aimBy(dx: number, dy: number): void {
    const camera = this.seaCamera;
    if (!camera) return;
    const halfHeight = camera.height / 2 / this.zoomShown;
    const clamp = (value: number, low: number, high: number): number => (low > high ? (low + high) / 2 : Math.max(low, Math.min(high, value)));
    // Across, as far as the middle of the glass reaches either end of the sea, so
    // nothing out there is ever at a place the glass cannot be held on; the sea is
    // painted wherever it looks (`paintSeaView`). Up and down, the sky and the sea.
    this.aim = {
      x: clamp(this.aim.x + dx, 0, PANORAMA.width),
      y: clamp(this.aim.y + dy, halfHeight, PANORAMA.height - halfHeight),
    };
    camera.centerOn(this.aim.x, this.aim.y);
  }

  /** Whatever is in the middle of the glass, close enough and out of the water, is being held; long enough, and it is seen. */
  private watchTheMiddle(deltaMs: number): void {
    const resting = this.zoomMs >= ZOOM_MS;
    const slack = SIGHTS_SLACK / this.zoomShown;
    for (const shown of this.sightings) {
      const { body, sighting } = shown;
      const inSights =
        resting &&
        !shown.spotted &&
        body !== null &&
        shown.pose.shown >= SHOWN_TO_SEE &&
        closeEnoughAt(sighting.band, this.zoom) &&
        this.aim.x >= body.left - slack &&
        this.aim.x <= body.right + slack &&
        this.aim.y >= body.top - slack &&
        this.aim.y <= body.bottom + slack;
      shown.heldMs = shown.spotted ? 0 : heldFor(shown.heldMs, inSights, deltaMs);
      if (shown.heldMs >= HOLD_TO_SEE_MS) {
        this.spot(shown);
      }
    }
  }

  private spot(shown: SightingShown): void {
    shown.spotted = true;
    shown.heldMs = 0;
    this.ringMs = 360;
    // Every sighting of a kind already in the tray is that kind again: it is spotted, and nothing more is said.
    for (const other of this.sightings) {
      if (other.sighting.speciesId === shown.sighting.speciesId) other.spotted = true;
    }
    if (this.spotted.some((each) => each.speciesId === shown.sighting.speciesId)) return;
    const fresh = this.options.see(shown.sighting.dexId);
    audioManager.play(fresh ? 'prizeSighted' : 'select');
    const add = this.scene.add;
    const species = shown.sighting.speciesId;
    const icon = isFigureSpecies(species) ? add.image(0, 0, POKEMON_ICON_TEXTURE, pokemonIconFrames(species)[0]) : null;
    const flash = add.graphics();
    this.glassLayer.add([flash, ...(icon ? [icon] : [])]);
    const lens = this.lens();
    this.spotted.push({ speciesId: species, fresh, icon, flash, flyMs: 0, from: { x: lens.x, y: lens.y } });
    this.childrenIgnored = -1;
  }

  /** Where the `index`th kind spotted rests, down the glass's left. */
  private traySlot(index: number): { readonly x: number; readonly y: number } {
    const lens = this.lens();
    const strip = lens.x - lens.radius;
    return { x: Math.round(strip / 2), y: 18 + index * TRAY_PITCH };
  }

  private trayVisible(visible: boolean): void {
    for (const each of this.spotted) {
      each.icon?.setVisible(visible);
      each.flash.setVisible(visible);
    }
  }

  private drawTray(deltaMs: number): void {
    const frame = Math.floor(this.lookMs / POKEMON_ICON_FRAME_MS) % 2;
    this.spotted.forEach((each, index) => {
      each.flyMs = Math.min(TRAY_FLY_MS, each.flyMs + deltaMs);
      const t = ease(each.flyMs / TRAY_FLY_MS);
      const slot = this.traySlot(index);
      const x = Math.round(each.from.x + (slot.x - each.from.x) * t);
      const y = Math.round(each.from.y + (slot.y - each.from.y) * t - Math.sin(Math.PI * t) * 24);
      if (each.icon && isFigureSpecies(each.speciesId)) {
        each.icon.setPosition(x, y).setFrame(pokemonIconFrames(each.speciesId)[frame]);
      }
      // A kind new to the Pokédex keeps a gold frame in the tray.
      const on = each.flash.clear();
      if (each.fresh && t >= 1) {
        on.lineStyle(1, BRASS, 1).strokeRect(slot.x - 13, slot.y - 12, 26, 24);
        on.fillStyle(BRASS, 1).fillRect(slot.x + 10, slot.y - 14, 3, 3);
      }
    });
  }

  // --- the sea ---------------------------------------------------------------------

  private drawSea(deltaMs: number): void {
    this.lookMs += deltaMs;
    this.wavesMs += deltaMs;
    if (this.wavesMs >= 520) {
      this.wavesMs = 0;
      this.wavesOn = this.wavesOn === 0 ? 1 : 0;
    }
    this.paintTheView();
    const looking = this.phase === 'open' || this.phase === 'lens-open' || this.phase === 'lens-close';
    // At rest every pixel of a Pokémon is a pixel of the screen: the sprite it is drawn from is
    // shrunk to the size it shows at, and never squeezed by the camera.
    const zoomAt = looking ? this.zoom : 1;
    const shownAt = looking ? this.zoomShown : 1;
    const water = this.water.clear();
    const inks = SEA_INKS[this.options.light];
    const cap = (inks.cap[0] << 16) | (inks.cap[1] << 8) | inks.cap[2];
    for (const shown of this.sightings) {
      const { sighting, image } = shown;
      const pose = poseAt(sighting, this.lookMs);
      shown.pose = pose;
      const visible = showsAt(sighting.band, zoomAt) && pose.shown > 0;
      const factor = Math.max(1, Math.round(1 / (BAND_SCALE[sighting.band] * zoomAt)));
      const key = this.shrunk(sighting.dexId, factor);
      const body = this.bodyOf(key);
      const scale = BAND_SCALE[sighting.band] * factor;
      const pixel = Math.max(BAND_SCALE[sighting.band], 1 / Math.max(1, zoomAt));
      if (pose.splash) this.drawSplash(water, pose, pixel, cap);
      if (pose.rock) this.drawRock(water, pose, body, scale, pixel, cap);
      if (!visible) {
        image.setVisible(false);
        shown.body = null;
        continue;
      }
      const rows = Math.max(1, Math.round(body.top + pose.shown * (body.bottom + 1 - body.top)));
      image.setTexture(key).setVisible(true).setFlipX(pose.flip).setScale(scale).setCrop(0, 0, image.frame.width, rows);
      image.setPosition(pose.x, pose.waterline - pose.lift - rows * scale);
      image.setAlpha(sighting.band === 'far' ? Math.max(0, Math.min(1, shownAt - 1)) : 1);
      const half = image.frame.width / 2;
      const flipped = (x: number): number => (pose.flip ? image.frame.width - 1 - x : x);
      const lefts = [flipped(body.left), flipped(body.right)];
      shown.body = {
        left: pose.x + (Math.min(...lefts) - half) * scale,
        right: pose.x + (Math.max(...lefts) + 1 - half) * scale,
        top: pose.waterline - pose.lift - (rows - body.top) * scale,
        bottom: pose.waterline - pose.lift,
      };
      // The water laps across a body standing in it, and a swimmer leaves a wake.
      if (pose.shown < 1 && pose.lift === 0) {
        water.fillStyle(cap, 1).fillRect(shown.body.left - pixel, pose.waterline - pixel, shown.body.right - shown.body.left + pixel * 2, pixel);
      }
      if (pose.wake) {
        const behind = pose.flip ? shown.body.left : shown.body.right;
        const away = pose.flip ? -1 : 1;
        for (let dash = 0; dash < 3; dash += 1) {
          const wobble = Math.floor((this.lookMs / 300 + dash) % 2);
          water.fillStyle(cap, 1).fillRect(behind + away * (2 + dash * 4) * pixel * 2, pose.waterline + (dash % 2) * pixel + wobble * pixel, 3 * pixel, pixel);
        }
      }
    }
    this.drawTray(deltaMs);
  }

  private drawSplash(on: Phaser.GameObjects.Graphics, pose: SeaPose, pixel: number, cap: number): void {
    const splash = pose.splash;
    if (!splash) return;
    const { t, size } = splash;
    if (splash.kind === 'ring') {
      const across = size * (0.3 + t * 0.7);
      const deep = Math.max(pixel, across / 5);
      on.fillStyle(cap, 1 - t * 0.6);
      on.fillRect(pose.x - across / 2, pose.waterline - deep / 2, across * 0.3, pixel);
      on.fillRect(pose.x + across * 0.2, pose.waterline - deep / 2, across * 0.3, pixel);
      on.fillRect(pose.x - across * 0.35, pose.waterline + deep / 2, across * 0.7, pixel);
      return;
    }
    // Drops thrown up and out, falling back.
    on.fillStyle(cap, 1);
    for (let drop = -2; drop <= 2; drop += 1) {
      const out = drop * (size / 5) * (0.4 + t);
      const up = Math.sin(Math.PI * t) * size * (0.5 - Math.abs(drop) * 0.12);
      on.fillRect(pose.x + out - pixel, pose.waterline - up - pixel, pixel * 2, pixel * 2);
    }
    on.fillRect(pose.x - size / 2, pose.waterline, size, pixel);
  }

  /**
   * A rock out in the water under a kind that sits on one: a dome a pixel of the
   * screen at a time, lit on top and dark at its foot, outlined, with the sea
   * breaking white round its foot.
   */
  private drawRock(on: Phaser.GameObjects.Graphics, pose: SeaPose, body: BodyBox, scale: number, pixel: number, cap: number): void {
    const wide = Math.max(6 * pixel, (body.right - body.left + 1) * scale * 1.15);
    const tall = Math.max(3 * pixel, pose.lift);
    const rows = Math.max(3, Math.round(tall / pixel));
    const top = pose.waterline - tall;
    for (let row = 0; row < rows; row += 1) {
      const down = (row + 0.5) / rows;
      const half = (wide / 2) * Math.sqrt(1 - (1 - down) ** 2 * 0.85);
      const y = top + row * pixel;
      const shade = row === 0 ? 0x9898a8 : down < 0.45 ? 0x787888 : down < 0.8 ? 0x585868 : 0x404050;
      on.fillStyle(0x283040, 1).fillRect(pose.x - half - pixel, y, half * 2 + pixel * 2, pixel);
      on.fillStyle(shade, 1).fillRect(pose.x - half, y, half * 2, pixel);
    }
    on.fillStyle(cap, 1).fillRect(pose.x - wide / 2 - pixel * 2, pose.waterline - pixel, wide + pixel * 4, pixel);
  }

  // --- pictures ----------------------------------------------------------------------

  /**
   * Paints the sea and sky for exactly what the sea's camera shows, a pixel of
   * the screen a pixel, and lays the picture over that view: only when the view
   * or the swell has moved on, so a still glass paints nothing.
   */
  private paintTheView(): void {
    const camera = this.seaCamera;
    if (!camera) return;
    const zoom = camera.zoom;
    // Where the camera's view starts, as it will be drawn this frame (`worldView` is only worked out as it draws).
    const viewLeft = camera.scrollX + camera.width / 2 - camera.width / (2 * zoom);
    const viewTop = camera.scrollY + camera.height / 2 - camera.height / (2 * zoom);
    const left = Math.round(viewLeft * zoom - 1) / zoom;
    const top = Math.round(viewTop * zoom - 1) / zoom;
    const width = camera.width + 3;
    const height = camera.height + 3;
    const key = `${Math.round(left * zoom)},${Math.round(top * zoom)},${zoom.toFixed(4)},${this.wavesOn}`;
    const size = `${width}x${height}`;
    const textureKey = 'sea-telescope-view';
    const { textures } = this.scene;
    if (size !== this.seaPictureSize || !textures.exists(textureKey)) {
      if (textures.exists(textureKey)) textures.remove(textureKey);
      textures.createCanvas(textureKey, width, height);
      if (!this.painted.includes(textureKey)) this.painted.push(textureKey);
      this.seaPictureSize = size;
      this.seaPictureKey = '';
      this.seaPicture.setTexture(textureKey);
    }
    this.seaPicture.setPosition(left, top).setScale(1 / zoom);
    if (key === this.seaPictureKey) return;
    this.seaPictureKey = key;
    const picture = paintSeaView(this.options.light, this.wavesOn, { left, top, zoom, width, height });
    const texture = textures.get(textureKey) as Phaser.Textures.CanvasTexture;
    texture.context.putImageData(new ImageData(picture.data, picture.width, picture.height), 0, 0);
    texture.refresh();
  }

  /**
   * The harbour's tile layers draw only the tiles in the camera's square, which a
   * turned camera's corners lie outside: while it turns they draw a ring more,
   * enough for any turn at any zoom of the swoop, and their own again after.
   */
  private padTheHarbour(padded: boolean): void {
    for (const child of this.scene.children.list) {
      if (child instanceof Phaser.Tilemaps.TilemapLayer) {
        child.setCullPadding(padded ? 12 : 1, padded ? 12 : 1);
      }
    }
  }

  /**
   * A front sprite shrunk by `factor` (1, 2 or 4), each pixel the average of the
   * pixels it covers and either there or not, so a Pokémon far off is still
   * drawn a pixel of the screen a pixel at rest.
   */
  private shrunk(dexId: number, factor: number): string {
    const source = pokemonTextureKey('front', dexId);
    if (factor <= 1) return source;
    return this.paint(`${source}-shrunk-${factor}`, () => shrinkPicture(this.pixelsOf(source), factor));
  }

  private bodyOf(key: string): BodyBox {
    const known = this.bodies.get(key);
    if (known) return known;
    const box = opaqueBox(this.pixelsOf(key));
    this.bodies.set(key, box);
    return box;
  }

  /** A texture's pixels, read once through a canvas of its own size. */
  private pixelsOf(key: string): PaintedPicture {
    const image = this.scene.textures.get(key).getSourceImage() as HTMLImageElement | HTMLCanvasElement;
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const context = canvas.getContext('2d')!;
    context.drawImage(image, 0, 0);
    const { data, width, height } = context.getImageData(0, 0, image.width, image.height);
    return { width, height, data };
  }

  private paint(key: string, paint: () => PaintedPicture): string {
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

  // --- the pointer ---------------------------------------------------------------------

  private listen(): void {
    const on = <T extends (...args: never[]) => void>(event: string, fn: T): void => {
      this.scene.input.on(event, fn);
      this.listeners.push({ event, fn });
    };
    on(Phaser.Input.Events.POINTER_WHEEL, (_pointer: Phaser.Input.Pointer, _over: unknown, _dx: number, dy: number) => {
      if (this.phase === 'open' && dy !== 0) this.zoomTo(nextZoom(this.zoom, dy < 0 ? 1 : -1, false));
    });
    on(Phaser.Input.Events.POINTER_DOWN, (pointer: Phaser.Input.Pointer) => {
      this.drag = this.phase === 'open' ? { x: pointer.x, y: pointer.y } : null;
    });
    on(Phaser.Input.Events.POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (!this.drag || !pointer.isDown || this.phase !== 'open') return;
      this.aimBy((this.drag.x - pointer.x) / this.zoomShown, (this.drag.y - pointer.y) / this.zoomShown);
      this.drag = { x: pointer.x, y: pointer.y };
    });
    on(Phaser.Input.Events.POINTER_UP, () => {
      this.drag = null;
    });
  }

  // --- for a driver --------------------------------------------------------------------

  /** For a playtest driver: the Pokédex number of a sighting. */
  public dexIdOf(id: number): number | undefined {
    return this.sightings.find((each) => each.sighting.id === id)?.sighting.dexId;
  }

  public describeForTest(): Record<string, unknown> {
    return {
      phase: this.phase,
      zoom: this.zoom,
      aim: { x: Math.round(this.aim.x), y: Math.round(this.aim.y) },
      sightings: this.sightings.map((shown) => ({
        id: shown.sighting.id,
        species: shown.sighting.speciesId,
        band: shown.sighting.band,
        motion: shown.sighting.motion,
        x: Math.round(shown.pose.x),
        waterline: shown.pose.waterline,
        shown: Math.round(shown.pose.shown * 100) / 100,
        heldMs: Math.round(shown.heldMs),
        // The middle of what shows of it, while any of it does: where to point the glass.
        body: shown.body ? { x: Math.round((shown.body.left + shown.body.right) / 2), y: Math.round((shown.body.top + shown.body.bottom) / 2) } : null,
        spotted: shown.spotted,
      })),
      spotted: this.spotted.map((each) => ({ species: each.speciesId, fresh: each.fresh })),
    };
  }

  public destroy(): void {
    for (const { event, fn } of this.listeners) this.scene.input.off(event, fn);
    this.removeCameras();
    this.scene.cameras.main.setVisible(true).setZoom(1).setRotation(0);
    this.padTheHarbour(false);
    this.seaLayer.destroy(true);
    this.glassLayer.destroy(true);
    for (const key of this.painted) {
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key);
    }
  }
}
