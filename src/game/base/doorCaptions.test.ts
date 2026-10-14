import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import { CHARACTER_FEET_PIXEL_Y, CHARACTER_HEAD_PIXEL_Y } from '../playerFrames';
import { TILE_SIZE } from '../worldMap';
import { placeCaptions, type Rect } from '../ui/labelPlacement';
import { tabOverGame } from '../feedback/feedbackTabCover';
import { WorldLabel } from '../ui/WorldLabel';
import { BASE_TILESET } from './baseTileset';
import { BASE_DOORS, type BaseDoor } from './doors';
import { BASE_MAP_HEIGHT, BASE_MAP_WIDTH, BASE_SPAWN } from './baseMap';
import type { GridPosition } from '../movement/gridMovement';

/**
 * The harbour's door captions, seated the way `BaseScene.updateCaptions` seats
 * them: a real `WorldLabel` per door, told where the player is, asked for its
 * request and handed `placeCaptions`' answer. The scene is a stand-in that
 * draws nothing; the one thing it has to get right is how wide each caption is,
 * and those are the widths the real yard measured at 1200x768 on a save with
 * one Pokémon (`POKÉMON CENTER / Your last partner can be swapped here` is the
 * widest), in the game's own face.
 */
const MEASURED_WIDTH: Record<string, number> = {
  'oaks-lab': 123,
  'pokemon-centre': 203,
  'brocks-workshop': 110,
  'bills-cottage': 124,
  bolthole: 81,
};
const MEASURED_HEIGHT = 33;
/** `WorldLabel`'s own padding, which its window adds round the text. */
const PADDING_X = 3;
const PADDING_Y = 2;
const VIEW = { width: 400, height: 256 };

function standInScene(): Phaser.Scene {
  const chain: unknown = new Proxy(() => chain, { get: () => () => chain });
  const text = (width: number) => {
    const label = {
      x: 0,
      y: 0,
      width: width - PADDING_X * 2,
      height: MEASURED_HEIGHT - PADDING_Y * 2,
      visible: true,
      setOrigin: () => label,
      setDepth: () => label,
      setVisible: (visible: boolean) => {
        label.visible = visible;
        return label;
      },
      setPosition: (x: number, y: number) => {
        label.x = x;
        label.y = y;
        return label;
      },
    };
    return label;
  };
  return {
    add: {
      graphics: () => chain,
      text: (_x: number, _y: number, words: string) => text(MEASURED_WIDTH[words.split('\n')[0]]),
    },
  } as unknown as Phaser.Scene;
}

/** The whole building, as `BaseScene` names a door. */
function building(door: BaseDoor): Rect {
  const art = BASE_TILESET.props[door.building.prop];
  return {
    x: door.building.x * TILE_SIZE,
    y: door.building.y * TILE_SIZE,
    width: art.width * TILE_SIZE,
    height: art.height * TILE_SIZE,
  };
}

/** The player's figure, as `BaseScene.figureRect` has it. */
function figure(tile: GridPosition): Rect {
  return {
    x: tile.x * TILE_SIZE,
    y: tile.y * TILE_SIZE + TILE_SIZE - CHARACTER_FEET_PIXEL_Y + CHARACTER_HEAD_PIXEL_Y,
    width: TILE_SIZE,
    height: CHARACTER_FEET_PIXEL_Y - CHARACTER_HEAD_PIXEL_Y + 1,
  };
}

/** The camera following the player, held inside the map as `BaseScene` holds it. */
function viewOn(tile: GridPosition): Rect {
  const clampTo = (centre: number, size: number, span: number) =>
    Math.min(Math.max(0, centre - size / 2), span - size);
  return {
    x: clampTo(tile.x * TILE_SIZE + TILE_SIZE / 2, VIEW.width, BASE_MAP_WIDTH * TILE_SIZE),
    y: clampTo(tile.y * TILE_SIZE + TILE_SIZE / 2, VIEW.height, BASE_MAP_HEIGHT * TILE_SIZE),
    ...VIEW,
  };
}

interface Seated {
  readonly door: BaseDoor;
  readonly at: Rect;
}

/** Where every door's caption is drawn with the player on `tile`, the look key held or not. */
function seatedFrom(tile: GridPosition, looking = true, onScreen: readonly Rect[] = []): Seated[] {
  const scene = standInScene();
  const labels = BASE_DOORS.map(
    (door) =>
      new WorldLabel(scene, {
        subject: building(door),
        text: `${door.id}\nstatus`,
        tone: { fill: 0, border: 0, ink: '#fff' },
        depth: 0,
        speech: { voice: 'name', tiles: door.tiles },
      }),
  );
  labels.forEach((label) => label.describe({ player: tile, looking, raidRemainingMs: Infinity }));
  const requests = labels.map((label) => label.request());
  const placements = placeCaptions(
    requests,
    {
      bounds: viewOn(tile),
      // Screen furniture is pinned to the screen; the scene moves it into the world.
      furniture: onScreen.map((piece) => ({ ...piece, x: piece.x + viewOn(tile).x, y: piece.y + viewOn(tile).y })),
      keepClear: [],
      canopy: [],
      player: [figure(tile)],
    },
  );
  return BASE_DOORS.flatMap((door, index) => {
    const placed = placements[index];
    const { width, height } = requests[index];
    return placed.visible ? [{ door, at: { x: placed.x, y: placed.y, width, height } }] : [];
  });
}

/** Which doors are named with the player standing on `tile`, the look key held. */
function namedFrom(tile: GridPosition): string[] {
  return seatedFrom(tile).map(({ door }) => door.id);
}

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('the harbour door captions', () => {
  it.each(BASE_DOORS.map((door) => [door.id, door.returnTo] as const))(
    'names %s to a player standing on its doorstep',
    (id, doorstep) => {
      // Seated in the order the doors were made, OAK'S LAB took the row its
      // neighbours wanted, and BROCK'S WORKSHOP went unnamed with the player
      // standing under its own door.
      expect(namedFrom(doorstep)).toContain(id);
    },
  );

  it.each([['the spawn', BASE_SPAWN] as const, ...BASE_DOORS.map((door) => [`${door.id}'s doorstep`, door.returnTo] as const)])(
    'covers no building with a caption, walking from %s (playtest 47)',
    (_where, tile) => {
      // Seated against a building's bottom row, OAK'S LAB was drawn over the
      // lab's own front as the player arrived.
      const covering = seatedFrom(tile, false).flatMap(({ door, at }) =>
        BASE_DOORS.filter((other) => overlaps(at, building(other))).map((other) => `${door.id} over ${other.id}`),
      );
      expect(covering).toEqual([]);
    },
  );

  it('writes no door name under the FEEDBACK tab, from the spawn or any doorstep', () => {
    // The yard at 1200x768, drawn three to the pixel: the tab stands half way
    // down the window's right edge, 30 by 112 (`style.css`), over the map. THE
    // BOLTHOLE's name was seated against the screen's edge and read THE BOLTHOL.
    const tab = tabOverGame({ left: 1170, top: 328, width: 30, height: 112 }, { left: 0, top: 0, width: 1200, height: 768 }, VIEW);
    expect(tab).toEqual({ x: 390, y: 109, width: 10, height: 38 });
    const onScreen = (tile: GridPosition) => {
      const view = viewOn(tile);
      return { ...tab!, x: tab!.x + view.x, y: tab!.y + view.y };
    };
    const walks = [BASE_SPAWN, ...BASE_DOORS.map((door) => door.returnTo)];
    const underTheTab = (withTab: boolean) =>
      walks.flatMap((tile) =>
        seatedFrom(tile, true, withTab ? [tab!] : [])
          .filter(({ at }) => overlaps(at, onScreen(tile)))
          .map(({ door }) => `${door.id} from ${tile.x},${tile.y}`),
      );
    // Told nothing of the tab, the seating does put a name under it - which is
    // what makes the next line a test of something.
    expect(underTheTab(false)).not.toEqual([]);
    expect(underTheTab(true)).toEqual([]);
  });
});
