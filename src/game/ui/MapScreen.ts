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
import { chartSheetsFor } from './chartSheets';
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
  readonly mapId: WorldMapId;
  /** Whether a tile of the map is known: stood on, in any raid. */
  readonly isKnown: (tile: GridPosition) => boolean;
  /** Where the player is on the chart, when they are on this map at all. */
  readonly standing: GridPosition | null;
  /** The raid clock, in a raid. */
  readonly clockMs?: number;
}

/** A map's picture in colour and the same under fog, painted once a page: a map does not change while a page is open. */
interface PaintedChart {
  readonly colour: ChartPicture;
  readonly fogged: ChartPicture;
}

const painted = new Map<WorldMapId, Promise<PaintedChart>>();

/** The part of a map THE MAP shows: the outdoors of a map of several places, else all of it. */
export function chartRectOf(mapId: WorldMapId): ChartRect {
  const map = getWorldMap(mapId);
  return map.areas?.[0]?.rect ?? { x: 0, y: 0, width: map.width, height: map.height };
}

function paintedChart(mapId: WorldMapId): Promise<PaintedChart> {
  const held = painted.get(mapId);
  if (held) {
    return held;
  }
  const map = getWorldMap(mapId);
  const rect = chartRectOf(mapId);
  const painting = chartSheetsFor(map).then((sheets) => {
    const colour = paintChart(map, rect, tileCells(sheets));
    return { colour, fogged: foggedChart(colour, rect) };
  });
  painting.catch(() => painted.delete(mapId));
  painted.set(mapId, painting);
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
  private zoom: ChartZoom;
  /** The tile the close view is centred on, moved by the arrows. */
  private centre: GridPosition;
  private closed = false;
  /** How many tiles of the map are in colour, once it is drawn: for a playtest to read. */
  public knownTiles: number | null = null;

  private readonly onClose: () => void;

  public constructor(scene: Phaser.Scene, view: MapScreenView, onClose: () => void) {
    this.onClose = onClose;
    this.rect = chartRectOf(view.mapId);
    this.standing = view.standing;
    // Somewhere on the map, it opens close round where they stand: a walk is a
    // road at that size, and a hair's width with the whole vale on screen.
    this.zoom = view.standing ? 'close' : 'whole';
    this.centre = view.standing ?? { x: this.rect.x + Math.floor(this.rect.width / 2), y: this.rect.y + Math.floor(this.rect.height / 2) };
    this.overlay = new MenuOverlay(scene, 'chart-screen', (event) => this.onKey(event));
    this.overlay.root.setAttribute('aria-label', `Map of ${worldMapName(view.mapId)}`);
    this.overlay.root.innerHTML = `
      <div class="chart-bar">
        <h2 class="chart-name">${worldMapName(view.mapId).toUpperCase()}</h2>
        <button type="button" class="chart-zoom" data-chart-zoom></button>
        ${view.clockMs === undefined ? '' : `<p class="chart-clock"><img src="${iconUrl('raid-clock')}" alt=""><span data-chart-clock>${formatRaidClock(view.clockMs)}</span></p>`}
        <button type="button" class="chart-close" data-chart-close aria-label="Close the map"></button>
      </div>
      <div class="chart-frame" data-chart-frame>
        <canvas class="chart-canvas" data-chart-canvas></canvas>
        ${view.standing ? '<span class="chart-here" data-chart-here hidden></span>' : ''}
      </div>`;
    this.canvas = this.overlay.root.querySelector<HTMLCanvasElement>('[data-chart-canvas]')!;
    this.frame = this.overlay.root.querySelector<HTMLElement>('[data-chart-frame]')!;
    this.here = this.overlay.root.querySelector<HTMLElement>('[data-chart-here]');
    this.zoomTag = this.overlay.root.querySelector<HTMLElement>('[data-chart-zoom]')!;
    this.zoomTag.onclick = () => this.toggleZoom();
    this.clock = this.overlay.root.querySelector<HTMLElement>('[data-chart-clock]');
    this.overlay.root.querySelector<HTMLButtonElement>('[data-chart-close]')!.onclick = () => this.close();
    this.nameZoom();
    this.resize = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => this.draw());
    this.resize?.observe(this.frame);
    audioManager.play('menuOpen');
    paintedChart(view.mapId).then(
      ({ colour, fogged }) => {
        if (this.closed) {
          return;
        }
        const light = chartLight(this.rect, view.isKnown);
        this.knownTiles = light.filter((each) => each === 'known').length;
        const seen = fogChart(colour, fogged, this.rect, light);
        const source = document.createElement('canvas');
        source.width = seen.width;
        source.height = seen.height;
        source.getContext('2d')?.putImageData(new ImageData(seen.data, seen.width, seen.height), 0, 0);
        this.source = source;
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

  public close(): void {
    if (this.closed) {
      return;
    }
    this.closed = true;
    this.resize?.disconnect();
    this.overlay.destroy();
    this.source = null;
    audioManager.play('menuClose');
    this.onClose();
  }

  private onKey(event: KeyboardEvent): void {
    if (isOverlayDismissKey(event, RAID_KEY_LETTERS.map)) {
      event.preventDefault();
      this.close();
      return;
    }
    const key = event.key.toLowerCase();
    if (key === CHART_ZOOM_KEY.toLowerCase()) {
      event.preventDefault();
      this.toggleZoom();
      return;
    }
    const step = PAN_KEYS[key];
    if (step && this.zoom === 'close') {
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

  /** The picture at the size the frame is now, in the screen's own pixels. */
  private draw(): void {
    const source = this.source;
    if (!source || this.closed) {
      return;
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
    const place = placeChart(this.rect, { width, height }, this.zoom, this.centre, cellPixels);
    // Close up the cells are drawn whole and sharp; the whole place is shrunk
    // smoothly, because a quarter-tile is finer than the screen has pixels for
    // and a nearest pick would drop one-tile lanes.
    context.imageSmoothingEnabled = this.zoom === 'whole';
    context.imageSmoothingQuality = 'high';
    context.clearRect(0, 0, width, height);
    context.drawImage(source, place.left, place.top, this.rect.width * place.tilePixels, this.rect.height * place.tilePixels);
    if (this.here && this.standing) {
      this.here.hidden = false;
      this.here.style.left = `${(place.left + (this.standing.x - this.rect.x + 0.5) * place.tilePixels) / ratio}px`;
      this.here.style.top = `${(place.top + (this.standing.y - this.rect.y + 0.5) * place.tilePixels) / ratio}px`;
    }
  }
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
