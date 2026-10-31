import type { GridPosition } from '../movement/gridMovement';

/**
 * What a player sees through THE RAID ARENA's brass telescopes, as rules: the
 * whole of the map at the bottom of the pit fitted to the screen, which no spot on
 * the rail can ever show, and a cursor to point at it with, as FireRed's Town Map
 * has. Nothing here knows Phaser; `valeOverviewView.ts` draws it.
 *
 * It keeps its own idea of what it is looking at, in pixels of the map's square of
 * the pit's floor (a pixel to the tile, on Greystone Vale), and every number it
 * hands back for drawing is a whole game pixel once the view has come to rest.
 *
 * **There is one thing to move, and it always moves.** The arrows and W, A, S and D
 * move the cursor, on the whole map as on a closer look, and the view goes with it
 * when it nears the screen's edge. The mouse is the cursor; a drag moves the view
 * under it. The cursor is drawn to a way in as it comes by and waits there a moment,
 * so a held key cannot overshoot one, and what is under it is the only thing the
 * screen says anything about (`cardPlace`).
 */

export interface OverviewScreen {
  readonly width: number;
  readonly height: number;
}

export interface OverviewPoint {
  readonly x: number;
  readonly y: number;
}

export interface OverviewRect {
  readonly left: number;
  readonly top: number;
  readonly width: number;
  readonly height: number;
}

/** A way in, as the cursor knows it: where it lies on the map's square. */
export interface OverviewLight {
  readonly id: string;
  readonly at: OverviewPoint;
}

/** The row along the screen's foot that names the keys. The map never goes under it. */
export const OVERVIEW_BAR_HEIGHT = 16;
/** How far above the bar and off the screen's top the whole map is kept when it is fitted. */
const FIT_MARGIN = 1;

/** How fast a held key moves the cursor, in screen pixels a second: slow enough to tap, quick once held. */
const CURSOR_SLOW = 60;
const CURSOR_FAST = 150;
const CURSOR_RAMP_MS = 500;
/** How near the cursor has to pass a way in, in screen pixels, to be drawn to it. */
const CURSOR_SNAP_REACH = 7;
/** How long it waits on a way in it was drawn to, with the key still held. */
export const CURSOR_WAITS_MS = 240;
/** How close to the screen's edge the cursor comes before the view goes with it, and a way in is brought into sight with. */
const CURSOR_ROOM = 36;
/** How far in from the map's edge the cursor stops, in screen pixels: its corners are this far out from its middle. */
const CURSOR_INSET = 10;
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

/**
 * What the first level draws: the whole of the screen above the bar, with the map
 * in the middle and the cloud past its edges filling the sides, so a square map on
 * a wide screen stands in a sky rather than between two black bars.
 */
export function wholePicture(mapFloor: OverviewRect, screen: OverviewScreen): { readonly square: OverviewRect; readonly size: OverviewScreen } {
  const area = overviewArea(screen);
  const [fit] = overviewLevels(mapFloor, screen);
  const width = area.width / fit;
  const height = area.height / fit;
  return {
    square: { left: mapFloor.left + (mapFloor.width - width) / 2, top: mapFloor.top + (mapFloor.height - height) / 2, width, height },
    size: area,
  };
}

/** Where the map is looked at, for one level: over the map, and never so far that anything past its edge shows. */
function clampedCentre(at: OverviewPoint, zoom: number, map: OverviewScreen, area: OverviewScreen): OverviewPoint {
  const along = (value: number, mapSize: number, areaSize: number): number => {
    const half = areaSize / 2 / zoom;
    return half * 2 >= mapSize ? mapSize / 2 : Math.max(half, Math.min(mapSize - half, value));
  };
  return { x: along(at.x, map.width, area.width), y: along(at.y, map.height, area.height) };
}

/** How near a point comes to a line from one point to another. */
function awayFromStep(point: OverviewPoint, from: OverviewPoint, to: OverviewPoint): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = dx * dx + dy * dy;
  const along = length === 0 ? 0 : Math.max(0, Math.min(1, ((point.x - from.x) * dx + (point.y - from.y) * dy) / length));
  return Math.hypot(point.x - (from.x + dx * along), point.y - (from.y + dy * along));
}

/** The view through a telescope: where it is looking and how close, where it is on its way to, and the cursor. */
export class OverviewView {
  private readonly map: OverviewScreen;
  private readonly lights: readonly OverviewLight[];
  private screen: OverviewScreen;
  private levels: readonly number[];
  private levelIndex = 0;
  private zoomNow: number;
  private at: OverviewPoint;
  private goal: OverviewPoint;
  private cursorAt: OverviewPoint;
  private onLight: string | null;
  /** The way in the cursor has just come off, which does not draw it back until it is clear. */
  private leaving: string | null = null;
  private heldMs = 0;
  private waitMs = 0;

  public constructor(map: OverviewScreen, screen: OverviewScreen, lights: readonly OverviewLight[] = [], startOn: string | null = null) {
    this.map = map;
    this.lights = lights;
    this.screen = screen;
    this.levels = overviewLevels(map, screen);
    this.zoomNow = this.levels[0];
    this.at = { x: map.width / 2, y: map.height / 2 };
    this.goal = this.at;
    const start = lights.find((light) => light.id === startOn);
    this.cursorAt = start ? start.at : this.at;
    this.onLight = start ? start.id : null;
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

  /** Whether there is more of the map than the screen shows, so that a drag does anything. */
  public get canPan(): boolean {
    const area = overviewArea(this.screen);
    const zoom = this.levels[this.levelIndex];
    return this.map.width * zoom > area.width || this.map.height * zoom > area.height;
  }

  public get isClosest(): boolean {
    return this.levelIndex === this.levels.length - 1;
  }

  /** Where the cursor is on the map. */
  public get cursor(): OverviewPoint {
    return this.cursorAt;
  }

  /** The way in the cursor is on, or null out over the country. */
  public get wayIn(): string | null {
    return this.onLight;
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

  /** A frame: `held` is which way the keys are pressing, each of -1, 0 or 1. It says whether the cursor came to a way in. */
  public advance(deltaMs: number, held: OverviewPoint, still: boolean): boolean {
    const arrived = this.steer(deltaMs, held);
    const zoom = this.levels[this.levelIndex];
    const share = still ? 1 : 1 - Math.exp(-deltaMs / VIEW_EASE_MS);
    const settled = (from: number, to: number, within: number): number => {
      const next = from + (to - from) * share;
      return Math.abs(to - next) < within ? to : next;
    };
    this.zoomNow = settled(this.zoomNow, zoom, 0.004);
    this.at = clampedCentre(
      { x: settled(this.at.x, this.goal.x, 0.25 / zoom), y: settled(this.at.y, this.goal.y, 0.25 / zoom) },
      this.zoomNow,
      this.map,
      overviewArea(this.screen),
    );
    return arrived;
  }

  /** A point brought in from the map's edge by as far as the cursor's own corners reach, so they are never cut off. */
  private onTheMap(point: OverviewPoint): OverviewPoint {
    const inset = CURSOR_INSET / this.levels[this.levelIndex];
    return {
      x: Math.max(inset, Math.min(this.map.width - inset, point.x)),
      y: Math.max(inset, Math.min(this.map.height - inset, point.y)),
    };
  }

  /** The cursor, moved by the keys for a frame: to the way in it is passing if there is one, and on past it after a moment. */
  private steer(deltaMs: number, held: OverviewPoint): boolean {
    if (held.x === 0 && held.y === 0) {
      this.heldMs = 0;
      this.waitMs = 0;
      return false;
    }
    if (this.waitMs > 0) {
      this.waitMs = Math.max(0, this.waitMs - deltaMs);
      return false;
    }
    this.heldMs += deltaMs;
    const zoom = this.levels[this.levelIndex];
    const speed = CURSOR_SLOW + (CURSOR_FAST - CURSOR_SLOW) * Math.min(1, this.heldMs / CURSOR_RAMP_MS);
    const way = Math.hypot(held.x, held.y);
    const reach = (speed * deltaMs) / 1000 / zoom / way;
    const from = this.cursorAt;
    const to = this.onTheMap({ x: from.x + held.x * reach, y: from.y + held.y * reach });
    if (this.onLight) {
      this.leaving = this.onLight;
      this.onLight = null;
    }
    const snapReach = CURSOR_SNAP_REACH / zoom;
    if (this.leaving) {
      const left = this.lights.find((light) => light.id === this.leaving);
      if (!left || Math.hypot(left.at.x - to.x, left.at.y - to.y) > snapReach) {
        this.leaving = null;
      }
    }
    let nearest: OverviewLight | null = null;
    let nearestAway = snapReach;
    for (const light of this.lights) {
      const ahead = (light.at.x - from.x) * held.x + (light.at.y - from.y) * held.y > 0;
      const away = awayFromStep(light.at, from, to);
      if (light.id !== this.leaving && ahead && away <= nearestAway) {
        nearest = light;
        nearestAway = away;
      }
    }
    if (nearest) {
      this.cursorAt = nearest.at;
      this.onLight = nearest.id;
      this.leaving = null;
      this.waitMs = CURSOR_WAITS_MS;
      this.heldMs = 0;
    } else {
      this.cursorAt = to;
    }
    this.reveal(this.cursorAt, CURSOR_ROOM);
    return nearest !== null;
  }

  /** The mouse has moved over the map: the cursor is where it is, and on a way in if it is near one. It says whether it came to one. */
  public pointTo(screen: OverviewPoint): boolean {
    const point = this.pointAt(screen);
    const before = this.onLight;
    const near = wayInNear(this.lights.map((light) => ({ landing: light, at: this.screenOf(light.at) })), screen);
    this.cursorAt = near ? near.at : this.onTheMap(point);
    this.onLight = near ? near.id : null;
    this.leaving = null;
    this.waitMs = 0;
    return near !== null && near.id !== before;
  }

  /** Straight to a way in, bringing it into sight. */
  public hop(id: string): void {
    const light = this.lights.find((each) => each.id === id);
    if (!light) {
      return;
    }
    this.cursorAt = light.at;
    this.onLight = light.id;
    this.leaving = null;
    this.waitMs = 0;
    this.reveal(light.at, CURSOR_ROOM);
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

  /** The one key: closer, closer, and from the closest back out to the whole map, about the cursor. */
  public cycleLevel(): void {
    this.setLevel((this.levelIndex + 1) % this.levels.length, null);
    this.lookAt(this.cursorAt);
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
    // Whatever it was going closer about, the cursor is never left off the screen.
    this.reveal(this.cursorAt, CURSOR_ROOM);
  }

  /** Turns to look straight at a point of the map, as near as the map's edges allow. */
  public lookAt(point: OverviewPoint): void {
    this.goal = this.clampGoal(point);
  }

  /** Brings a point of the map into sight if it is not, with room round it. */
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

  /** What part of the map is on the screen, in pixels of the map: what the little whole map in the corner outlines. */
  public inSight(): OverviewRect {
    const area = overviewArea(this.screen);
    const left = Math.max(0, this.at.x - area.width / 2 / this.zoomNow);
    const top = Math.max(0, this.at.y - area.height / 2 / this.zoomNow);
    return {
      left,
      top,
      width: Math.min(this.map.width, this.at.x + area.width / 2 / this.zoomNow) - left,
      height: Math.min(this.map.height, this.at.y + area.height / 2 / this.zoomNow) - top,
    };
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

/** How far from a way in what is said about it stands. */
const CARD_GAP = 13;
/** Kept clear at the screen's right edge, where the page's FEEDBACK tab stands over the canvas. */
const CARD_RIGHT_CLEAR = 17;

/**
 * Where what is said about the thing under the cursor goes: beside it, whole, on
 * the screen, and clear of whatever else is up there. Of the four sides it takes
 * the one that hides the fewest other ways in, the right if there is nothing in it.
 */
export function cardPlace(
  mark: OverviewPoint,
  card: OverviewScreen,
  screen: OverviewScreen,
  keepClear: readonly OverviewRect[] = [],
  others: readonly OverviewPoint[] = [],
): OverviewPoint {
  const area = overviewArea(screen);
  const fit = (x: number, y: number): OverviewPoint => ({
    x: Math.max(2, Math.min(area.width - CARD_RIGHT_CLEAR - card.width, Math.round(x))),
    y: Math.max(2, Math.min(area.height - card.height - 2, Math.round(y))),
  });
  const middleY = mark.y - card.height / 2;
  const middleX = mark.x - card.width / 2;
  const sides = [
    fit(mark.x + CARD_GAP, middleY),
    fit(mark.x - CARD_GAP - card.width, middleY),
    fit(middleX, mark.y + CARD_GAP),
    fit(middleX, mark.y - CARD_GAP - card.height),
  ];
  const within = (place: OverviewPoint, point: OverviewPoint, grown: number): boolean =>
    point.x >= place.x - grown && point.x < place.x + card.width + grown && point.y >= place.y - grown && point.y < place.y + card.height + grown;
  const meets = (place: OverviewPoint, rect: OverviewRect): boolean =>
    place.x < rect.left + rect.width && place.x + card.width > rect.left && place.y < rect.top + rect.height && place.y + card.height > rect.top;
  const cost = (place: OverviewPoint): number =>
    // Over the thing itself or something else on the screen is the last thing it may do; another light only costs.
    (within(place, mark, 4) ? 1000 : 0) + keepClear.filter((rect) => meets(place, rect)).length * 100 + others.filter((point) => within(place, point, 2)).length;
  return sides.reduce((best, place) => (cost(place) < cost(best) ? place : best));
}

/**
 * The way in that lies that way of this one on the map, for keys that point at the
 * pit from the rim: ahead of it and not too far to one side, the nearest counting
 * what is to the side as further off. Null if nothing lies that way.
 */
export function wayInToward<T extends { readonly id: string; readonly tile: GridPosition }>(
  landings: readonly T[],
  fromId: string,
  way: OverviewPoint,
): T | null {
  const from = landings.find((landing) => landing.id === fromId);
  if (!from) {
    return null;
  }
  let best: T | null = null;
  let bestScore = Infinity;
  for (const landing of landings) {
    const dx = landing.tile.x - from.tile.x;
    const dy = landing.tile.y - from.tile.y;
    const ahead = dx * way.x + dy * way.y;
    const aside = Math.abs(dx * way.y) + Math.abs(dy * way.x);
    const score = ahead + aside * 1.5;
    if (landing.id !== fromId && ahead > 0 && aside <= ahead * 2 && score < bestScore) {
      best = landing;
      bestScore = score;
    }
  }
  return best;
}

/** How near doors have to stand to be one place, in tiles, and how many make a town. */
const TOWN_REACH = 9;
const TOWN_DOORS = 3;

/**
 * Where the towns are, for a mark on the map: doors standing together, counting
 * only those on ground this save has walked, so a town nobody has seen is not one.
 * Each is marked at the door nearest its middle.
 */
export function townsOf(doors: readonly GridPosition[], isKnown: (tile: GridPosition) => boolean): readonly GridPosition[] {
  const known = doors.filter(isKnown);
  const taken = new Set<number>();
  const towns: GridPosition[] = [];
  for (let start = 0; start < known.length; start += 1) {
    if (taken.has(start)) {
      continue;
    }
    const group = [start];
    taken.add(start);
    for (let next = 0; next < group.length; next += 1) {
      const at = known[group[next]];
      for (let other = 0; other < known.length; other += 1) {
        if (!taken.has(other) && Math.max(Math.abs(known[other].x - at.x), Math.abs(known[other].y - at.y)) <= TOWN_REACH) {
          taken.add(other);
          group.push(other);
        }
      }
    }
    if (group.length >= TOWN_DOORS) {
      const x = group.reduce((sum, index) => sum + known[index].x, 0) / group.length;
      const y = group.reduce((sum, index) => sum + known[index].y, 0) / group.length;
      const away = (tile: GridPosition): number => Math.hypot(tile.x - x, tile.y - y);
      towns.push(group.map((index) => known[index]).reduce((best, tile) => (away(tile) < away(best) ? tile : best)));
    }
  }
  return towns;
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
