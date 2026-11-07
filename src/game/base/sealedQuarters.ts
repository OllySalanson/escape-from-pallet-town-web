import type { GridPosition } from '../movement/gridMovement';
import { districtsForMap, type DistrictArea } from '../world/districts';
import type { PaintedPicture } from '../world/minimap';
import { VALE_QUARTERS } from '../world/valeQuarters';
import type { WorldMapId } from '../worldMap';
import type { Rgb } from './arenaPit';
import { BADGES, type Badge } from './badgeCase';

/**
 * A quarter a gym still holds shut, as THE RAID ARENA's telescope shows it
 * (firstmate's `eptw-gyms-loadouts-plan`, section 1.3: "a locked quarter lies
 * under a heavier cloud with the badge's outline pressed into it, like the empty
 * slot in the badge case. A won badge thins that cloud").
 *
 * The heavy cloud covers all of it, walked or not: an old save that walked the
 * Old Quay before Misty held it sees it sealed like everybody else, because it
 * is - its landings are held back too (`valeQuarters.ts`, `isLandingOpen`). Once
 * the leader is beaten the quarter is ordinary ground again, under the ordinary
 * cloud wherever it has not been walked. Phaser-free.
 */

export interface SealedQuarter {
  /** The quarter's name, as the map says it. */
  readonly name: string;
  readonly leader: string;
  readonly building: string;
  readonly badge: Badge;
  /** The tiles it covers: its districts' rectangles. */
  readonly areas: readonly DistrictArea[];
  /** Where its badge is pressed in: the middle of everything it covers. */
  readonly centre: GridPosition;
}

/** How dark the sealed cloud is against the ordinary cloud's ink, and the step its dither takes. */
const SEALED_SHARE = 0.46;
const SEALED_DITHER = 8;
/** How much of what was there shows through: a shape under the cloud, never a lane. */
const SEALED_SHOWS = 0.18;

/** The quarters of this map a save has not opened yet. `opened` is `openedDoors`: bosses beaten, and the explorer run's every door. */
export function sealedQuarters(mapId: WorldMapId, opened: readonly string[]): readonly SealedQuarter[] {
  if (mapId !== 'greystone-vale') {
    return [];
  }
  const districts = districtsForMap(mapId);
  return VALE_QUARTERS.flatMap((quarter) => {
    const gym = quarter.gym;
    const badge = gym && BADGES.find((each) => each.bossId === gym.bossId);
    if (!gym || !badge || opened.includes(gym.bossId)) {
      return [];
    }
    const areas = quarter.districts.flatMap((name) => districts.find((district) => district.name === name)?.areas ?? []);
    if (areas.length === 0) {
      return [];
    }
    const left = Math.min(...areas.map((area) => area.x));
    const top = Math.min(...areas.map((area) => area.y));
    const right = Math.max(...areas.map((area) => area.x + area.width));
    const bottom = Math.max(...areas.map((area) => area.y + area.height));
    return [
      {
        name: quarter.name,
        leader: gym.leader,
        building: gym.building,
        badge,
        areas,
        centre: { x: Math.floor((left + right) / 2), y: Math.floor((top + bottom) / 2) },
      },
    ];
  });
}

/** The sealed quarter a tile lies in, if any. */
export function sealedAt(sealed: readonly SealedQuarter[], tile: GridPosition): SealedQuarter | undefined {
  return sealed.find((quarter) =>
    quarter.areas.some((area) => tile.x >= area.x && tile.y >= area.y && tile.x < area.x + area.width && tile.y < area.y + area.height),
  );
}

/** What the card beside the telescope's cursor says over a sealed quarter. */
export function sealedCard(quarter: SealedQuarter): { readonly title: string; readonly lines: readonly string[] } {
  return {
    title: quarter.name,
    lines: [`Sealed. The ${quarter.badge.name} opens it.`, `${quarter.leader.toUpperCase()} holds it, at ${quarter.building.toUpperCase()}.`],
  };
}

/**
 * The heavier cloud, laid over every pixel `isSealed` names: a darker step of the
 * ordinary cloud's own ink on a checker dither, with only a faint trace of what is
 * under it, in whole multiples of eight as the rest of the picture is.
 */
export function heavyCloud(picture: PaintedPicture, isSealed: (x: number, y: number) => boolean, ink: Rgb): PaintedPicture {
  const { width, height } = picture;
  const data = new Uint8ClampedArray(picture.data);
  const step = (value: number): number => Math.max(0, Math.min(248, Math.round(value / 8) * 8));
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const at = (y * width + x) * 4;
      if (data[at + 3] === 0 || !isSealed(x, y)) {
        continue;
      }
      const lift = (x + y) % 2 === 0 ? SEALED_DITHER : 0;
      for (let channel = 0; channel < 3; channel += 1) {
        data[at + channel] = step(ink[channel] * SEALED_SHARE + data[at + channel] * SEALED_SHOWS + lift);
      }
    }
  }
  return { width, height, data };
}

/**
 * The badge's shape pressed into the cloud, as the empty slot in the badge case
 * is pressed into its velvet: every pixel of the badge's art as a step darker,
 * with a lighter edge below and to the right where the press catches the light.
 * Hands back the squares to fill, relative to the badge's middle, at `size`
 * screen pixels to a pixel of the art.
 */
export function pressedBadge(badge: Badge, size: number): readonly { readonly x: number; readonly y: number; readonly ink: 'press' | 'edge' }[] {
  const rows = badge.art;
  const half = (rows.length * size) / 2;
  const filled = (x: number, y: number): boolean => (rows[y]?.[x] ?? '.') !== '.';
  const squares: { x: number; y: number; ink: 'press' | 'edge' }[] = [];
  for (let y = 0; y <= rows.length; y += 1) {
    for (let x = 0; x <= rows[0].length; x += 1) {
      if (filled(x, y)) {
        squares.push({ x: x * size - half, y: y * size - half, ink: 'press' });
      } else if (filled(x - 1, y - 1) || filled(x, y - 1) || filled(x - 1, y)) {
        squares.push({ x: x * size - half, y: y * size - half, ink: 'edge' });
      }
    }
  }
  return squares;
}
