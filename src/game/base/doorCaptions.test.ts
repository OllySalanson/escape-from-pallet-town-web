import { describe, expect, it } from 'vitest';
import type Phaser from 'phaser';
import { CHARACTER_FEET_PIXEL_Y, CHARACTER_HEAD_PIXEL_Y } from '../playerFrames';
import { TILE_SIZE } from '../worldMap';
import { placeCaptions, type Rect } from '../ui/labelPlacement';
import { WorldLabel } from '../ui/WorldLabel';
import { BASE_TILESET } from './baseTileset';
import { BASE_DOORS, type BaseDoor } from './doors';
import { BASE_MAP_HEIGHT, BASE_MAP_WIDTH } from './baseMap';
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

/** The building's frontage, as `BaseScene` names a door: a tall building by its bottom row. */
function frontage(door: BaseDoor): Rect {
  const art = BASE_TILESET.props[door.building.prop];
  const rows = art.height > 3 ? 1 : art.height;
  return {
    x: door.building.x * TILE_SIZE,
    y: (door.building.y + art.height - rows) * TILE_SIZE,
    width: art.width * TILE_SIZE,
    height: rows * TILE_SIZE,
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

/** Which doors are named with the player standing on `tile`, the look key held. */
function namedFrom(tile: GridPosition): string[] {
  const scene = standInScene();
  const labels = BASE_DOORS.map(
    (door) =>
      new WorldLabel(scene, {
        subject: frontage(door),
        text: `${door.id}\nstatus`,
        tone: { fill: 0, border: 0, ink: '#fff' },
        depth: 0,
        speech: { voice: 'name', tiles: door.tiles },
      }),
  );
  labels.forEach((label) => label.describe({ player: tile, looking: true, raidRemainingMs: Infinity }));
  const placements = placeCaptions(
    labels.map((label) => label.request()),
    { bounds: viewOn(tile), furniture: [], keepClear: [], canopy: [], player: [figure(tile)] },
  );
  return BASE_DOORS.filter((_, index) => placements[index].visible).map((door) => door.id);
}

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
});
