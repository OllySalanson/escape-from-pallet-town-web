import type Phaser from 'phaser';
import { audioManager } from '../audio/AudioManager';
import type { GridPosition } from '../movement/gridMovement';
import { formatRaidClock } from '../run/raidClock';
import {
  CHART_CELLS,
  CHART_PAN_TILES,
  CLOSE_TILE_GAME_PIXELS,
  chartLight,
  fogChart,
  foggedChart,
  paintChart,
  placeChart,
  tileCells,
  type ChartPicture,
  type ChartRect,
  type ChartZoom,
} from '../world/chart';
import { getWorldMap, worldMapName, type WorldMapId } from '../worldMap';
import type { MapLayers } from '../world/tiles';
import type { TileSource } from '../world/tileset/catalogue';
import { chartSheetsFor } from './chartSheets';
import { REVEAL_TOTAL_MS, revealFrame } from '../world/chartReveal';
import { iconUrl } from './icons';
import { MenuOverlay } from './MenuOverlay';
import { isOverlayDismissKey } from './overlayKeyboard';
import { CHART_ZOOM_KEY, RAID_KEY_LETTERS, keyHint } from '../input/keyBindings';

/**
 * THE MAP, on M, anywhere: the whole of the place a raid goes to, drawn from
 * its own tiles, in colour wherever the player has stood and fog everywhere
 * else (`world/chart.ts` is the picture, `world/trodden.ts` the steps). The
 * captain's pick of 25 Nov 2026, in place of a map on THE RAID ARENA's wall.
 *
 * It fills the game's screen. In a raid the world goes on under it - the raid
 * clock runs, as the captain asked, and the hunter keeps walking - so the clock
 * is drawn on it, ticking, and anything the world raises closes it
 * (`WorldScene.updateRaid`). At home nothing is running, and the harbour waits.
 */
export interface MapScreenView {
  /** What the map is of: a raid's map, or THE HARBOUR (`chartOfMap`, `BaseScene.openMap`). */
  readonly subject: ChartSubject;
  /** Whether a tile of the map is known: stood on, in any raid. */
  readonly isKnown: (tile: GridPosition) => boolean;
  /** Where the player is on the chart, when they are on this map at all. */
  readonly standing: GridPosition | null;
  /** The raid clock, in a raid. */
  readonly clockMs?: number;
  /**
   * A place coming up out of the fog (`world/chartReveal.ts`): the map opens on
   * the whole place as it was without it, the square flashes and fills in, its
   * name goes up with a jingle, and the map goes away by itself.
   */
  readonly reveal?: {
    readonly name: string;
    readonly rect: ChartRect;
    /** What was known before the place was filled in. */
    readonly wasKnown: (tile: GridPosition) => boolean;
  };
}

/** A map's picture in colour and the same under fog, painted once a page: a map does not change while a page is open. */
interface PaintedChart {
  readonly colour: ChartPicture;
  readonly fogged: ChartPicture;
}

/**
 * What THE MAP is of: a place's tile layers, the sheets they are drawn from, the
 * part of it shown, and its name. Where the player is decides it - a raid's map
 * in a raid, THE HARBOUR at home (firstmate for the captain, 26 Nov 2026: "M
 * shows the map of where you are").
 */
export interface ChartSubject {
  /** What its picture is kept under while the page is open: a place drawn differently is a different key. */
  readonly key: string;
  readonly name: string;
  readonly layers: MapLayers;
  readonly sources: readonly TileSource[];
  readonly rect: ChartRect;
}

/** A raid's map as THE MAP shows it: the outdoors of a map of several places, else all of it. */
export function chartOfMap(mapId: WorldMapId): ChartSubject {
  const map = getWorldMap(mapId);
  return {
    key: `map:${mapId}`,
    name: worldMapName(mapId),
    layers: map.layers,
    sources: map.tileset.sources,
    rect: map.areas?.[0]?.rect ?? { x: 0, y: 0, width: map.width, height: map.height },
  };
}

const painted = new Map<string, Promise<PaintedChart>>();

function paintedChart(subject: ChartSubject): Promise<PaintedChart> {
  const held = painted.get(subject.key);
  if (held) {
    return held;
  }
  const painting = chartSheetsFor(subject.sources).then((sheets) => {
    const colour = paintChart(subject, subject.rect, tileCells(sheets));
    return { colour, fogged: foggedChart(colour, subject.rect) };
  });
  painting.catch(() => painted.delete(subject.key));
  painted.set(subject.key, painting);
  return painting;
}

export class MapScreen {
  private readonly overlay: MenuOverlay;
  private readonly rect: ChartRect;
  private readonly canvas: HTMLCanvasElement;
  private readonly frame: HTMLElement;
  private readonly here: HTMLElement | null;
  private readonly zoomTag: HTMLElement;
  private readonly clock: HTMLElement | null;
  private readonly resize: ResizeObserver | null;
  private readonly standing: GridPosition | null;
  /** The picture as seen this opening, colour and fog together, ready to draw from. */
  private source: HTMLCanvasElement | null = null;
  /** For a place coming up: the map as it was, and when the moment began. */
  private before: HTMLCanvasElement | null = null;
  private readonly reveal: MapScreenView['reveal'];
  private revealStart: number | null = null;
  private revealFrameId: number | undefined;
  private cheered = false;
  private readonly edge: HTMLElement | null;
  private readonly cheer: HTMLElement | null;
  private zoom: ChartZoom;
  /** The tile the close view is centred on, moved by the arrows. */
  private centre: GridPosition;
  private closed = false;
  /** How many tiles of the map are in colour, once it is drawn: for a playtest to read. */
  public knownTiles: number | null = null;

  private readonly onClose: () => void;

  public constructor(scene: Phaser.Scene, view: MapScreenView, onClose: () => void) {
    this.onClose = onClose;
    this.rect = view.subject.rect;
    this.standing = view.standing;
    this.reveal = view.reveal;
    // Somewhere on the map, it opens close round where they stand: a walk is a
    // road at that size, and a hair's width with the whole vale on screen. A
    // place coming up is seen whole, with the vale round it.
    this.zoom = view.standing && !view.reveal ? 'close' : 'whole';
    this.centre = view.standing ?? { x: this.rect.x + Math.floor(this.rect.width / 2), y: this.rect.y + Math.floor(this.rect.height / 2) };
    this.overlay = new MenuOverlay(scene, 'chart-screen', (event) => this.onKey(event));
    this.overlay.root.setAttribute('aria-label', `Map of ${view.subject.name}`);
    this.overlay.root.innerHTML = `
      <div class="chart-bar">
        <h2 class="chart-name">${view.subject.name.toUpperCase()}</h2>
        <button type="button" class="chart-zoom" data-chart-zoom${view.reveal ? ' hidden' : ''}></button>
        ${view.clockMs === undefined ? '' : `<p class="chart-clock"><img src="${iconUrl('raid-clock')}" alt=""><span data-chart-clock>${formatRaidClock(view.clockMs)}</span></p>`}
        <button type="button" class="chart-close" data-chart-close aria-label="Close the map"></button>
      </div>
      <div class="chart-frame" data-chart-frame>
        <canvas class="chart-canvas" data-chart-canvas></canvas>
        ${view.standing ? '<span class="chart-here" data-chart-here hidden></span>' : ''}
        ${
          view.reveal
            ? `<span class="chart-reveal-edge" data-chart-edge hidden></span><span class="chart-reveal-cheer" data-chart-cheer hidden><span class="chart-reveal-name">${view.reveal.name}</span>${'<i></i>'.repeat(8)}</span>`
            : ''
        }
      </div>`;
    this.canvas = this.overlay.root.querySelector<HTMLCanvasElement>('[data-chart-canvas]')!;
    this.frame = this.overlay.root.querySelector<HTMLElement>('[data-chart-frame]')!;
    this.here = this.overlay.root.querySelector<HTMLElement>('[data-chart-here]');
    this.zoomTag = this.overlay.root.querySelector<HTMLElement>('[data-chart-zoom]')!;
    this.zoomTag.onclick = () => this.toggleZoom();
    this.clock = this.overlay.root.querySelector<HTMLElement>('[data-chart-clock]');
    this.edge = this.overlay.root.querySelector<HTMLElement>('[data-chart-edge]');
    this.cheer = this.overlay.root.querySelector<HTMLElement>('[data-chart-cheer]');
    this.overlay.root.querySelector<HTMLButtonElement>('[data-chart-close]')!.onclick = () => this.close();
    this.nameZoom();
    this.resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => this.draw());
    this.resize?.observe(this.frame);
    audioManager.play('menuOpen');
    paintedChart(view.subject).then(
      ({ colour, fogged }) => {
        if (this.closed) {
          return;
        }
        const light = chartLight(this.rect, view.isKnown);
        this.knownTiles = light.filter((each) => each === 'known').length;
        this.source = toCanvas(fogChart(colour, fogged, this.rect, light));
        if (view.reveal) {
          this.before = toCanvas(fogChart(colour, fogged, this.rect, chartLight(this.rect, view.reveal.wasKnown)));
          this.revealStart = performance.now();
          this.playReveal();
          return;
        }
        this.draw();
      },
      () => {
        // A sheet that would not load leaves the frame dark rather than the game stuck behind it.
        this.knownTiles = 0;
      },
    );
  }

  public get isOpen(): boolean {
    return !this.closed;
  }

  /** Which view is up: for a playtest to read. */
  public get zoomed(): ChartZoom {
    return this.zoom;
  }

  /** The clock, as the raid has it this frame. */
  public setClock(remainingMs: number): void {
    if (this.clock) {
      const text = formatRaidClock(remainingMs);
      if (this.clock.textContent !== text) {
        this.clock.textContent = text;
      }
    }
  }

  /** Whether a place is still coming up: for a playtest to read. */
  public get revealing(): boolean {
    return this.reveal !== undefined && !this.closed && (this.revealStart === null || performance.now() - this.revealStart < REVEAL_TOTAL_MS);
  }

  public close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    if (this.revealFrameId !== undefined) {
      cancelAnimationFrame(this.revealFrameId);
    }
    this.resize?.disconnect();
    this.overlay.destroy();
    this.source = null;
    audioManager.play('menuClose');
    this.onClose();
  }

  private onKey(event: KeyboardEvent): void {
    if (this.reveal) {
      // A place coming up is watched, not driven: a key once the name is up
      // goes on, and ESC goes on at any moment, the place already filled in.
      if (event.key === 'Escape' || (this.cheered && (event.key === ' ' || event.key === 'Enter' || event.key.toLowerCase() === RAID_KEY_LETTERS.map.toLowerCase()))) {
        event.preventDefault();
        this.close();
      }
      return;
    }
    if (isOverlayDismissKey(event, RAID_KEY_LETTERS.map)) {
      event.preventDefault();
      this.close();
      return;
    }
    const key = event.key.toLowerCase();
    if (key === CHART_ZOOM_KEY.toLowerCase()) {
      event.preventDefault();
      // Nothing to change on a place that is only ever seen whole.
      if (!this.zoomTag.hidden) {
        this.toggleZoom();
      }
      return;
    }
    const step = PAN_KEYS[key];
    if (step && this.zoom === 'close' && !this.zoomTag.hidden) {
      event.preventDefault();
      this.centre = {
        x: Math.min(this.rect.x + this.rect.width - 1, Math.max(this.rect.x, this.centre.x + step[0] * CHART_PAN_TILES)),
        y: Math.min(this.rect.y + this.rect.height - 1, Math.max(this.rect.y, this.centre.y + step[1] * CHART_PAN_TILES)),
      };
      this.draw();
    }
  }

  private toggleZoom(): void {
    this.zoom = this.zoom === 'close' ? 'whole' : 'close';
    if (this.zoom === 'close' && this.standing) {
      this.centre = this.standing;
    }
    audioManager.play('select');
    this.nameZoom();
    this.draw();
  }

  /** The zoom key, named by what it will show next, as every key the game names is. */
  private nameZoom(): void {
    this.zoomTag.textContent = keyHint(CHART_ZOOM_KEY, this.zoom === 'close' ? 'WHOLE' : 'CLOSER');
  }

  /** Where a rectangle of the map is in the frame, in device pixels. */
  private squareOnScreen(rect: ChartRect, place: { readonly tilePixels: number; readonly left: number; readonly top: number }): { x: number; y: number; width: number; height: number } {
    return {
      x: place.left + (rect.x - this.rect.x) * place.tilePixels,
      y: place.top + (rect.y - this.rect.y) * place.tilePixels,
      width: rect.width * place.tilePixels,
      height: rect.height * place.tilePixels,
    };
  }

  /** One frame of a place coming up, and the next asked for until it is over. */
  private playReveal(): void {
    if (this.closed || this.revealStart === null) {
      return;
    }
    const frame = revealFrame(performance.now() - this.revealStart);
    this.draw(frame.risen);
    if (this.edge) {
      this.edge.hidden = !frame.edge || frame.cheer;
    }
    if (frame.cheer && !this.cheered) {
      this.cheered = true;
      if (this.cheer) {
        this.cheer.hidden = false;
      }
      audioManager.play('placeFilledIn');
    }
    if (frame.done) {
      this.close();
      return;
    }
    this.revealFrameId = requestAnimationFrame(() => this.playReveal());
  }

  /** The picture at the size the frame is now, in the screen's own pixels: for a place coming up, `risen` of it come up. */
  private draw(risen = 1): void {
    const source = this.source;
    if (!source || this.closed) {
      return;
    }
    if (this.reveal && this.revealStart !== null && risen === 1 && !this.cheered) {
      // A resize mid-moment redraws the frame the moment is on.
      risen = revealFrame(performance.now() - this.revealStart).risen;
    }
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(this.frame.clientWidth * ratio));
    const height = Math.max(1, Math.round(this.frame.clientHeight * ratio));
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
    }
    const context = this.canvas.getContext('2d');
    if (!context) {
      return;
    }
    // A game pixel in device pixels: close up, a tile is four of them, whole.
    const unit = Number.parseFloat(getComputedStyle(this.overlay.root).getPropertyValue('--u')) || 2;
    const cellPixels = Math.max(1, Math.round((unit * ratio * CLOSE_TILE_GAME_PIXELS) / CHART_CELLS));
    // A place small enough to fit whole at least as big as close up - THE
    // HARBOUR - is only ever shown whole, and Z has nothing to change.
    const whole = placeChart(this.rect, { width, height }, 'whole', this.centre, cellPixels);
    const fitsWhole = whole.tilePixels >= cellPixels * CHART_CELLS;
    this.zoomTag.hidden = Boolean(this.reveal) || fitsWhole;
    const place = this.reveal
      ? placeChart(this.rect, { width, height }, 'close', revealCentre(this.reveal.rect), revealCellPixels(this.reveal.rect, height))
      : fitsWhole
        ? placeChart(
            this.rect,
            { width, height },
            'close',
            { x: this.rect.x + Math.floor(this.rect.width / 2), y: this.rect.y + Math.floor(this.rect.height / 2) },
            Math.floor(whole.tilePixels / CHART_CELLS),
          )
        : placeChart(this.rect, { width, height }, this.zoom, this.centre, cellPixels);
    // Close up the cells are drawn whole and sharp; the whole place is shrunk
    // smoothly, because a quarter-tile is finer than the screen has pixels for
    // and a nearest pick would drop one-tile lanes.
    // Only the whole of a place too big for the frame is shrunk, smoothly; every
    // other view is a whole number of device pixels a cell, and drawn sharp.
    context.imageSmoothingEnabled = !this.reveal && !fitsWhole && this.zoom === 'whole';
    context.imageSmoothingQuality = 'high';
    context.clearRect(0, 0, width, height);
    const drawn = { width: this.rect.width * place.tilePixels, height: this.rect.height * place.tilePixels };
    const reveal = this.reveal;
    if (reveal && this.before && risen < 1) {
      context.drawImage(this.before, place.left, place.top, drawn.width, drawn.height);
      // The colour comes up from the middle of the square to its corners.
      const square = this.squareOnScreen(reveal.rect, place);
      if (risen > 0) {
        context.save();
        context.beginPath();
        context.arc(square.x + square.width / 2, square.y + square.height / 2, (Math.hypot(square.width, square.height) / 2) * risen, 0, Math.PI * 2);
        context.clip();
        context.drawImage(source, place.left, place.top, drawn.width, drawn.height);
        context.restore();
      }
    } else {
      context.drawImage(source, place.left, place.top, drawn.width, drawn.height);
    }
    if (reveal) {
      const square = this.squareOnScreen(reveal.rect, place);
      for (const element of [this.edge, this.cheer]) {
        if (element) {
          element.style.left = `${square.x / ratio}px`;
          element.style.top = `${square.y / ratio}px`;
          element.style.width = `${square.width / ratio}px`;
          element.style.height = `${square.height / ratio}px`;
        }
      }
    }
    if (this.here && this.standing) {
      this.here.hidden = false;
      this.here.style.left = `${(place.left + (this.standing.x - this.rect.x + 0.5) * place.tilePixels) / ratio}px`;
      this.here.style.top = `${(place.top + (this.standing.y - this.rect.y + 0.5) * place.tilePixels) / ratio}px`;
    }
  }
}

/** The middle of a place coming up: the moment is framed on it. */
function revealCentre(rect: ChartRect): GridPosition {
  return { x: rect.x + Math.floor(rect.width / 2), y: rect.y + Math.floor(rect.height / 2) };
}

/**
 * How close a place coming up is drawn: as many whole device pixels a cell as
 * leave it about half the frame high, so it is the thing on screen and the fog
 * all round it says where in the vale it is.
 */
function revealCellPixels(rect: ChartRect, frameHeight: number): number {
  return Math.max(1, Math.floor((frameHeight * 0.55) / (rect.height * CHART_CELLS)));
}

/** A picture as a canvas to draw from. */
function toCanvas(picture: ChartPicture): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = picture.width;
  canvas.height = picture.height;
  canvas.getContext('2d')?.putImageData(new ImageData(picture.data, picture.width, picture.height), 0, 0);
  return canvas;
}

/** The arrows and W, A, S and D pan the close view, as they walk everywhere else. */
const PAN_KEYS: Readonly<Record<string, readonly [number, number]>> = {
  arrowup: [0, -1],
  arrowdown: [0, 1],
  arrowleft: [-1, 0],
  arrowright: [1, 0],
  w: [0, -1],
  s: [0, 1],
  a: [-1, 0],
  d: [1, 0],
};
