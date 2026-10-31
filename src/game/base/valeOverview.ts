import type { GridPosition } from '../movement/gridMovement';

/**
 * What a player sees through THE RAID ARENA's brass telescopes, as rules: the
 * whole of the map at the bottom of the pit fitted to the screen, which no spot on
 * the rail can ever show, and a closer look that can be moved about. Nothing here
 * knows Phaser; `valeOverviewView.ts` draws it.
 *
 * It keeps its own idea of what it is looking at, in pixels of the map's square of
 * the pit's floor (a pixel to the tile, on Greystone Vale), and every number it
 * hands back for drawing is a whole game pixel once the view has come to rest.
 *
 * **It is one screen and a mouse tool as well as a keyboard one.** The arrows and
 * W, A, S and D pan, as a drag does; a wheel and Z go closer; Q and E, or a click
 * on a light, walk the ways in. Panning never moves the choice and choosing only
 * moves the view if the choice would be out of sight, so the two cannot fight.
 */

export interface OverviewScreen {
  readonly width: number;
  readonly height: number;
}

export interface OverviewPoint {
  readonly x: number;
  readonly y: number;
}

/** The row along the screen's foot that names the keys. The map never goes under it. */
export const OVERVIEW_BAR_HEIGHT = 18;
/** How far above the bar and off the screen's top the whole map is kept when it is fitted. */
const FIT_MARGIN = 1;

/** How fast a held key pans, in screen pixels a second: the same on any level. */
const PAN_SPEED = 170;
/** How long the view takes to come most of the way to where it is going. */
const VIEW_EASE_MS = 90;

/** The part of the screen the map is seen in. */
export function overviewArea(screen: OverviewScreen): OverviewScreen {
  return { width: screen.width, height: screen.height - OVERVIEW_BAR_HEIGHT };
}

/**
 * How big the map is drawn at each level, in screen pixels to a pixel of the
 * map's floor: first the size at which the whole of it fits, then the floor as it
 * is, then twice that.
 */
export function overviewLevels(map: OverviewScreen, screen: OverviewScreen): readonly number[] {
  const area = overviewArea(screen);
  const fit = Math.min((area.width - FIT_MARGIN * 2) / map.width, (area.height - FIT_MARGIN * 2) / map.height);
  return fit < 1 ? [fit, 1, 2] : [1, 2];
}

/** The size of the picture drawn for the first level, a whole number of game pixels each way. */
export function fittedPictureSize(map: OverviewScreen, screen: OverviewScreen): OverviewScreen {
  const [fit] = overviewLevels(map, screen);
  return { width: Math.round(map.width * fit), height: Math.round(map.height * fit) };
}

/** Where the map is looked at, for one level: over the map, and never so far that anything past its edge shows. */
function clampedCentre(at: OverviewPoint, zoom: number, map: OverviewScreen, area: OverviewScreen): OverviewPoint {
  const along = (value: number, mapSize: number, areaSize: number): number => {
    const half = areaSize / 2 / zoom;
    return half * 2 >= mapSize ? mapSize / 2 : Math.max(half, Math.min(mapSize - half, value));
  };
  return { x: along(at.x, map.width, area.width), y: along(at.y, map.height, area.height) };
}

/** The view through a telescope: where it is looking and how close, and where it is on its way to. */
export class OverviewView {
  private readonly map: OverviewScreen;
  private screen: OverviewScreen;
  private levels: readonly number[];
  private levelIndex = 0;
  private zoomNow: number;
  private at: OverviewPoint;
  private goal: OverviewPoint;

  public constructor(map: OverviewScreen, screen: OverviewScreen) {
    this.map = map;
    this.screen = screen;
    this.levels = overviewLevels(map, screen);
    this.zoomNow = this.levels[0];
    this.at = { x: map.width / 2, y: map.height / 2 };
    this.goal = this.at;
  }

  public get zoom(): number {
    return this.zoomNow;
  }

  public get level(): number {
    return this.levelIndex;
  }

  /** Whether it is at rest on the first level, where the fitted picture is drawn. */
  public get isWhole(): boolean {
    return this.levelIndex === 0 && this.zoomNow === this.levels[0];
  }

  /** Whether there is more of the map than the screen shows, so that panning does anything. */
  public get canPan(): boolean {
    const area = overviewArea(this.screen);
    const zoom = this.levels[this.levelIndex];
    return this.map.width * zoom > area.width || this.map.height * zoom > area.height;
  }

  public get isClosest(): boolean {
    return this.levelIndex === this.levels.length - 1;
  }

  /** The window has changed: back to the whole map, which is what fits whatever it now is. */
  public resize(screen: OverviewScreen): void {
    if (screen.width === this.screen.width && screen.height === this.screen.height) {
      return;
    }
    this.screen = screen;
    this.levels = overviewLevels(this.map, screen);
    this.levelIndex = 0;
    this.zoomNow = this.levels[0];
    this.at = { x: this.map.width / 2, y: this.map.height / 2 };
    this.goal = this.at;
  }

  private clampGoal(goal: OverviewPoint): OverviewPoint {
    return clampedCentre(goal, this.levels[this.levelIndex], this.map, overviewArea(this.screen));
  }

  /** A frame: `held` is which way the keys are pressing, each of -1, 0 or 1. */
  public advance(deltaMs: number, held: OverviewPoint, still: boolean): void {
    const zoom = this.levels[this.levelIndex];
    if (held.x !== 0 || held.y !== 0) {
      const reach = (PAN_SPEED * deltaMs) / 1000 / zoom;
      this.goal = this.clampGoal({ x: this.goal.x + held.x * reach, y: this.goal.y + held.y * reach });
    }
    const share = still ? 1 : 1 - Math.exp(-deltaMs / VIEW_EASE_MS);
    const settled = (from: number, to: number, within: number): number => {
      const next = from + (to - from) * share;
      return Math.abs(to - next) < within ? to : next;
    };
    this.zoomNow = settled(this.zoomNow, zoom, 0.004);
    const area = overviewArea(this.screen);
    this.at = clampedCentre(
      { x: settled(this.at.x, this.goal.x, 0.25 / zoom), y: settled(this.at.y, this.goal.y, 0.25 / zoom) },
      this.zoomNow,
      this.map,
      area,
    );
  }

  /** Follows a drag: the map stays under the pointer, and stops at its edges. */
  public dragBy(screenX: number, screenY: number): void {
    const zoom = this.levels[this.levelIndex];
    this.goal = this.clampGoal({ x: this.goal.x - screenX / zoom, y: this.goal.y - screenY / zoom });
    this.at = clampedCentre(this.goal, this.zoomNow, this.map, overviewArea(this.screen));
  }

  /** A level closer or further, keeping whatever is under `anchor` on the screen where it is. False if there is none. */
  public changeLevel(by: number, anchor: OverviewPoint | null): boolean {
    const next = this.levelIndex + by;
    if (next < 0 || next >= this.levels.length) {
      return false;
    }
    this.setLevel(next, anchor);
    return true;
  }

  /** The one key: closer, closer, and from the closest back out to the whole map. */
  public cycleLevel(anchor: OverviewPoint | null): void {
    this.setLevel((this.levelIndex + 1) % this.levels.length, anchor);
  }

  private setLevel(index: number, anchor: OverviewPoint | null): void {
    const area = overviewArea(this.screen);
    const on = anchor ?? { x: area.width / 2, y: area.height / 2 };
    const under = this.pointAt(on);
    this.levelIndex = index;
    const zoom = this.levels[index];
    this.goal = this.clampGoal({
      x: under.x - (on.x - area.width / 2) / zoom,
      y: under.y - (on.y - area.height / 2) / zoom,
    });
  }

  /** Turns to look straight at a point of the map, as near as the map's edges allow. */
  public lookAt(point: OverviewPoint): void {
    this.goal = this.clampGoal(point);
  }

  /** Brings a point of the map into sight if it is not, with room round it for its name. */
  public reveal(point: OverviewPoint, margin: number): void {
    const area = overviewArea(this.screen);
    const zoom = this.levels[this.levelIndex];
    const halfX = Math.max(0, area.width / 2 / zoom - margin / zoom);
    const halfY = Math.max(0, area.height / 2 / zoom - margin / zoom);
    this.goal = this.clampGoal({
      x: Math.max(point.x - halfX, Math.min(point.x + halfX, this.goal.x)),
      y: Math.max(point.y - halfY, Math.min(point.y + halfY, this.goal.y)),
    });
  }

  /** Where a point of the map is on the screen, in whole pixels. */
  public screenOf(point: OverviewPoint): OverviewPoint {
    const area = overviewArea(this.screen);
    return {
      x: Math.round(area.width / 2 + (point.x - this.at.x) * this.zoomNow),
      y: Math.round(area.height / 2 + (point.y - this.at.y) * this.zoomNow),
    };
  }

  /** Which point of the map is at a point of the screen. */
  public pointAt(screen: OverviewPoint): OverviewPoint {
    const area = overviewArea(this.screen);
    return {
      x: this.at.x + (screen.x - area.width / 2) / this.zoomNow,
      y: this.at.y + (screen.y - area.height / 2) / this.zoomNow,
    };
  }

  /** The map's own rectangle on the screen. */
  public mapRect(): { readonly left: number; readonly top: number; readonly right: number; readonly bottom: number } {
    const { x: left, y: top } = this.screenOf({ x: 0, y: 0 });
    const { x: right, y: bottom } = this.screenOf({ x: this.map.width, y: this.map.height });
    return { left, top, right, bottom };
  }
}

/** The way in `by` along from the one chosen, round and round: the order they lie round the map. */
export function nextWayIn<T extends { readonly id: string }>(landings: readonly T[], chosenId: string | null, by: number): T | null {
  if (landings.length === 0) {
    return null;
  }
  const at = landings.findIndex((landing) => landing.id === chosenId);
  const from = at < 0 ? (by > 0 ? -1 : 0) : at;
  return landings[((from + by) % landings.length + landings.length) % landings.length];
}

/** How near a click has to be to a way in's light to mean it, in screen pixels. */
export const WAY_IN_CLICK_REACH = 10;

/** The way in a click means, the nearest within reach, or null. */
export function wayInNear<T>(lights: readonly { readonly landing: T; readonly at: OverviewPoint }[], click: OverviewPoint): T | null {
  let best: T | null = null;
  let nearest = WAY_IN_CLICK_REACH;
  for (const { landing, at } of lights) {
    const away = Math.hypot(at.x - click.x, at.y - click.y);
    if (away <= nearest) {
      nearest = away;
      best = landing;
    }
  }
  return best;
}

/** How far above a light its name sits, and below it when there is no room above. */
const PLATE_ABOVE = 22;
const PLATE_BELOW = 8;
/** Kept clear at the screen's right edge, where the page's FEEDBACK tab stands over the canvas. */
const PLATE_RIGHT_CLEAR = 14;

export interface PlatePlace {
  readonly x: number;
  readonly y: number;
  /** Which way a light out of sight lies from its name, or null when it is in sight. */
  readonly points: { readonly x: number; readonly y: number } | null;
}

/**
 * Where the chosen way in's name goes: over its light, whole and on the screen.
 * If the light has been panned out of sight the name stays, at the edge nearest
 * it, with a pointer: what has been chosen is never lost by looking elsewhere.
 */
export function platePlace(
  mark: OverviewPoint,
  plate: OverviewScreen,
  screen: OverviewScreen,
  keepClear: { readonly right: number; readonly bottom: number },
): PlatePlace {
  const area = overviewArea(screen);
  const right = area.width - PLATE_RIGHT_CLEAR;
  const inSight = mark.x >= 0 && mark.y >= 0 && mark.x < area.width && mark.y < area.height;
  const x = Math.max(2, Math.min(right - plate.width, Math.round(mark.x - plate.width / 2)));
  const above = Math.round(mark.y) - PLATE_ABOVE;
  let y = above >= 2 ? above : Math.round(mark.y) + PLATE_BELOW;
  y = Math.max(2, Math.min(area.height - plate.height - 2, y));
  if (x < keepClear.right && y < keepClear.bottom) {
    y = keepClear.bottom + 2;
  }
  return {
    x,
    y,
    points: inSight ? null : { x: Math.sign(mark.x - (x + plate.width / 2)), y: Math.sign(mark.y - (y + plate.height / 2)) },
  };
}

/** How long the eye takes going to the glass, and the view opening out of it, each. */
export const IRIS_MS = 240;

/** How open the round of the glass is, from nothing (dark) to 1 (the whole screen), a stepped ease. */
export function irisOpen(share: number): number {
  const clamped = Math.max(0, Math.min(1, share));
  return clamped * clamped * (3 - 2 * clamped);
}

/** The radius that opens a screen wholly from a point on it. */
export function irisReach(screen: OverviewScreen, from: OverviewPoint): number {
  return Math.ceil(Math.hypot(Math.max(from.x, screen.width - from.x), Math.max(from.y, screen.height - from.y)));
}

/** How a tile of the map stands on the map's own floor pixels. */
export function mapPointOfTile(tile: GridPosition, scale: number): OverviewPoint {
  return { x: (tile.x + 0.5) * scale, y: (tile.y + 0.5) * scale };
}
