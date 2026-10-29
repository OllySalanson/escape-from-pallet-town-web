import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    GameObjects: { Container: class {} },
    Input: { Keyboard: { JustDown: () => false } },
  },
}));

import type { GridPosition } from '../movement/gridMovement';
import { RunPhase } from '../run/RunManager';
import { getWorldMap } from '../worldMap';
import { BUILDING_INSIDES } from '../world/buildingInsides';
import { collisionBlocker, DEFAULT_HUNTER_TUNING, type HunterState } from '../world/hunter';
import { placedAreaAt } from '../world/mapAreas';
import { stepDistances } from '../world/mapStructure';
import { WorldScene } from './WorldScene';
import { audioManager } from '../audio/AudioManager';
import { HUNTER_NEAR_STEPS } from '../audio/worldSounds';

/** The parts of the scene these tests drive, which are private to it. */
interface Driven {
  hunterState: HunterState;
  currentTile: GridPosition;
  hunterNear: boolean;
  advanceHunterPursuit(): void;
  resumeHunterProximity(): void;
}

/**
 * The press house on the real Floodplain, with the player stood inside it and
 * the hunter out in the yard: the room is a building with two doors, so it is
 * off the hunter's line (`buildingInsides.ts`).
 */
function inThePressHouse({ player, hunter }: { player: GridPosition; hunter: GridPosition }) {
  const map = getWorldMap('floodplain-relay');
  const bounds = { width: map.width, height: map.height, links: map.links };
  const scene = Object.create(WorldScene.prototype) as WorldScene;
  Object.assign(scene as object, {
    currentMap: map,
    collisionData: map.collision,
    bounds,
    currentTile: player,
    currentInterior: null,
    hunterNear: false,
    hunterFacing: 'down',
    hunterState: {
      spawned: true,
      defeated: false,
      mapId: map.id,
      position: hunter,
      // Where it last saw the player: the doorstep they went in by.
      lastSeen: PRESS.doors[0].street,
    },
    runSession: {
      manager: { phase: RunPhase.InRun, isEnraged: false },
      plan: { hunter: { ...DEFAULT_HUNTER_TUNING, aggressionStepsPerPlayerStep: 1 } },
    },
    placeFigure: vi.fn(),
    hunterBlocker: () => collisionBlocker(map.collision),
  });
  return { scene: scene as unknown as Driven, map };
}

const PRESS = BUILDING_INSIDES.find((inside) => inside.area.id === 'press-house')!;

/** A tile of the press house's floor, in the composed grid. */
function roomTile(): GridPosition {
  const map = getWorldMap('floodplain-relay');
  const room = map.areas!.find((area) => area.id === PRESS.area.id)!;
  return { x: room.rect.x + 6, y: room.rect.y + room.rect.height - 1 };
}

/** An outdoor tile exactly `steps` walking steps from `tile`. */
function stepsFrom(tile: GridPosition, steps: number): GridPosition {
  const map = getWorldMap('floodplain-relay');
  const distances = stepDistances(map.collision, tile, undefined, map.links);
  const outdoors = map.areas![0];
  for (let y = 0; y < outdoors.rect.height; y += 1) {
    for (let x = 0; x < outdoors.rect.width; x += 1) {
      if (distances[y][x] === steps) {
        return { x, y };
      }
    }
  }
  throw new Error(`nothing ${steps} steps from ${tile.x},${tile.y}`);
}

describe('a building with two doors is off the hunter’s line', () => {
  it('walks the hunter to the doorstep it last saw you on, and no further', () => {
    const street = PRESS.doors[0].street;
    const { scene, map } = inThePressHouse({ player: roomTile(), hunter: stepsFrom(street, 6) });
    for (let tick = 0; tick < 30; tick += 1) {
      scene.advanceHunterPursuit();
    }
    // It closes on the sighting as it closes on a player, to the tile beside
    // it, and holds there: out in the yard, never in the room.
    const held = scene.hunterState.position!;
    expect(Math.abs(held.x - street.x) + Math.abs(held.y - street.y)).toBe(1);
    for (let tick = 0; tick < 30; tick += 1) {
      scene.advanceHunterPursuit();
    }
    expect(scene.hunterState.position).toEqual(held);
    expect(placedAreaAt(map.areas!, held)?.id).toBeUndefined();
    expect(scene.hunterState.lastSeen).toEqual(street);
  });

  it('sees you again the moment you step out of the other door', () => {
    const street = PRESS.doors[0].street;
    const other = PRESS.doors[1].street;
    const beside = { x: street.x - 1, y: street.y };
    const { scene } = inThePressHouse({ player: roomTile(), hunter: beside });
    scene.advanceHunterPursuit();
    expect(scene.hunterState.position).toEqual(beside);
    scene.currentTile = other;
    scene.advanceHunterPursuit();
    expect(scene.hunterState.lastSeen).toEqual(other);
    expect(scene.hunterState.position).not.toEqual(beside);
  });

  it('follows you through the door when it is already in the room with you', () => {
    const tile = roomTile();
    const inside = { x: tile.x - 4, y: tile.y };
    const { scene } = inThePressHouse({ player: tile, hunter: inside });
    scene.advanceHunterPursuit();
    expect(scene.hunterState.lastSeen).toEqual(tile);
    expect(scene.hunterState.position).toEqual({ x: inside.x + 1, y: inside.y });
  });
});

describe('coming back from a fight beside the hunter', () => {
  /** A tile of the press house and an outdoor tile `steps` walking steps from it. */
  function besideTheDoor(steps: number): { room: GridPosition; yard: GridPosition } {
    const map = getWorldMap('floodplain-relay');
    const room = map.areas!.find((area) => area.id === PRESS.area.id)!.rect;
    const outdoors = map.areas![0].rect;
    for (let y = room.y; y < room.y + room.height; y += 1) {
      for (let x = room.x; x < room.x + room.width; x += 1) {
        if (map.collision[y][x]) {
          continue;
        }
        const distances = stepDistances(map.collision, { x, y }, undefined, map.links);
        for (let oy = 0; oy < outdoors.height; oy += 1) {
          for (let ox = 0; ox < outdoors.width; ox += 1) {
            if (distances[oy][ox] === steps) {
              return { room: { x, y }, yard: { x: ox, y: oy } };
            }
          }
        }
      }
    }
    throw new Error(`no yard tile ${steps} steps from the press house`);
  }

  it('remembers a hunter on the doorstep was already near, counted by the walk through the door', () => {
    const { room, yard } = besideTheDoor(3);
    // Straight across the composed grid the room is laid far east of the yard.
    expect(Math.abs(room.x - yard.x) + Math.abs(room.y - yard.y)).toBeGreaterThan(
      HUNTER_NEAR_STEPS,
    );
    const { scene } = inThePressHouse({ player: room, hunter: yard });
    scene.resumeHunterProximity();
    expect(scene.hunterNear).toBe(true);
    // So the next step of the pursuit does not sound the heartbeat again.
    const played = vi.spyOn(audioManager, 'play').mockImplementation(() => true);
    scene.advanceHunterPursuit();
    expect(played).not.toHaveBeenCalledWith('hunterNear');
  });

  it('does not count a hunter far off by the walk as near', () => {
    const { room, yard } = besideTheDoor(12);
    const { scene } = inThePressHouse({ player: room, hunter: yard });
    scene.resumeHunterProximity();
    expect(scene.hunterNear).toBe(false);
  });
});
