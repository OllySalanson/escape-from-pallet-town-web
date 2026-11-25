import { describe, expect, it } from 'vitest';
import { getWorldMap } from '../worldMap';
import { isEvolutionStone } from '../items';
import { frontDoorFor, generateRoomLoot, generateRunPlan } from '../run/runGeneration';
import { winRateAgainst } from './encounterMeasure';
import { guardedTiles, guardReaches } from './guards';
import { gymLeadLevel } from './gymGuide';
import { collisionBlocker } from './hunter';
import { stepDistances } from './mapStructure';
import { playerLinks } from './sailing';
import { MISTY_BOSS_ID } from './valeQuarters';

/**
 * Where the game's own guards stand (`guards.ts`), held to being fair: each in
 * front of the one landmark it names, the first a new player is likely to meet
 * a gentle one with nothing but the landmark behind it, and the ones sat on a
 * stone a fight for the ring they stand in. Where a guard may stand at all -
 * never across the way to anything else - is the structure sweep's
 * (`mapStructure.testkit.ts`); that no job is dealt into a reach is the board's
 * (`standingBoard.test.ts`).
 */

const STARTERS = ['bulbasaur', 'charmander', 'squirtle'] as const;
/** A save's starter as Oak hands it over. */
const FRESH_LEVEL = 5;
/** How often a fresh starter beats a gentle guard, at least. */
const GENTLE_WIN_RATE = 0.8;

const vale = getWorldMap('greystone-vale');
const isBlocked = collisionBlocker(vale.collision);
const guards = vale.entities.filter((entity) => entity.guards !== undefined);
const door = frontDoorFor('greystone-vale')!;
const fromTheFrontDoor = stepDistances(vale.collision, door.position, new Set(), playerLinks(vale));
/** The same walk with every standing figure solid, as a raid walks it. */
const withGuardsStanding = stepDistances(
  vale.collision,
  door.position,
  new Set(vale.entities.map(({ position }) => `${position.x},${position.y}`)),
  playerLinks(vale),
);
/** Walked steps from the front door to beside a guard (its own tile is solid). */
const walkTo = (position: { x: number; y: number }): number =>
  Math.min(
    ...[
      { x: position.x + 1, y: position.y },
      { x: position.x - 1, y: position.y },
      { x: position.x, y: position.y + 1 },
      { x: position.x, y: position.y - 1 },
    ]
      .map((tile) => fromTheFrontDoor[tile.y]?.[tile.x] ?? -1)
      .filter((steps) => steps >= 0),
  );
/** The evolution stone a guard sits on, if it sits on one. */
const stoneOf = (guard: (typeof guards)[number]): string | undefined =>
  guard.guards?.hoard !== undefined && isEvolutionStone(guard.guards.hoard) ? guard.guards.hoard : undefined;
const gentle = (guard: (typeof guards)[number]): boolean =>
  STARTERS.every((starter) => winRateAgainst(starter, FRESH_LEVEL, guard.pokemon!, guard.wildLevel!, 200) >= GENTLE_WIN_RATE);

describe('the vale’s guards', () => {
  it('each stand beside the landmark they name, and reach every side it is worked from', () => {
    expect(guards.length).toBeGreaterThan(0);
    for (const guard of guards) {
      const poi = vale.pois.find((candidate) => candidate.id === guard.guards?.poiId);
      expect(poi?.label, guard.id).toBe(guard.guards?.name.toUpperCase());
      if (!poi) {
        continue;
      }
      for (const side of [
        poi.position,
        { x: poi.position.x + 1, y: poi.position.y },
        { x: poi.position.x - 1, y: poi.position.y },
        { x: poi.position.x, y: poi.position.y + 1 },
        { x: poi.position.x, y: poi.position.y - 1 },
      ]) {
        // Ground only the guard's own tile leads to is behind it, and had by beating it.
        if (isBlocked(side) || (side.x === guard.position.x && side.y === guard.position.y) || (withGuardsStanding[side.y]?.[side.x] ?? -1) < 0) {
          continue;
        }
        const reached = guardReaches(guard.position, side, isBlocked);
        expect(`${guard.id}: ${poi.label} from ${side.x},${side.y} ${reached ? 'guarded' : 'open'}`).toBe(
          `${guard.id}: ${poi.label} from ${side.x},${side.y} guarded`,
        );
      }
    }
  });

  it('guard a landmark named for itself, never for a room the player can walk into beside it', () => {
    // A guard "not letting you near QUARRY HUT" beside a Quarry Hut you walk
    // straight into reads as a rule that does not work.
    const bare = (name: string) => name.toUpperCase().replace(/^THE /, '').trim();
    const rooms = new Set((vale.areas ?? []).filter((area) => area.id !== undefined).map((area) => bare(area.name)));
    for (const guard of guards) {
      expect(`${guard.guards?.name}: ${rooms.has(bare(guard.guards!.name)) ? 'a room’s name' : 'its own'}`).toBe(
        `${guard.guards?.name}: its own`,
      );
    }
  });

  it('never have a raid’s loot laid in their reach, where it would be had before the guard was met', () => {
    const guarded = new Set(guardedTiles(vale.entities, isBlocked).map(({ x, y }) => `${x},${y}`));
    const laid: string[] = [];
    for (let seed = 1; seed <= 40; seed += 1) {
      for (const piece of generateRunPlan(seed * 7919, undefined, door.id, undefined).loot['greystone-vale'] ?? []) {
        if (guarded.has(`${piece.position.x},${piece.position.y}`)) {
          laid.push(`seed ${seed}: ${piece.itemId} at ${piece.position.x},${piece.position.y}`);
        }
      }
    }
    expect(laid).toEqual([]);
  });

  it('never have a friend room’s shared ground laid in their reach either', () => {
    const guarded = new Set(guardedTiles(vale.entities, isBlocked).map(({ x, y }) => `${x},${y}`));
    const laid: string[] = [];
    for (let seed = 1; seed <= 40; seed += 1) {
      for (const piece of generateRoomLoot('greystone-vale', seed * 104_729)) {
        if (guarded.has(`${piece.position.x},${piece.position.y}`)) {
          laid.push(`room ${seed}: ${piece.itemId} at ${piece.position.x},${piece.position.y}`);
        }
      }
    }
    expect(laid).toEqual([]);
  });

  it('teach before they tempt: the nearest to a new save’s landing is gentle, and every stone lies past every gentle one', () => {
    const byWalk = [...guards].sort((a, b) => walkTo(a.position) - walkTo(b.position));
    expect(`${byWalk[0].id} is ${gentle(byWalk[0]) ? 'gentle' : 'not gentle'}`).toBe(`${byWalk[0].id} is gentle`);
    const gentleOnes = guards.filter((each) => stoneOf(each) === undefined);
    for (const guard of gentleOnes) {
      expect(`${guard.id} keeps no stone and is ${gentle(guard) ? 'gentle' : 'not gentle'}`).toBe(`${guard.id} keeps no stone and is gentle`);
    }
    const furthestGentle = Math.max(...gentleOnes.map((each) => walkTo(each.position)));
    for (const guard of guards.filter((each) => stoneOf(each) !== undefined)) {
      expect(walkTo(guard.position), guard.id).toBeGreaterThan(furthestGentle);
    }
  });

  it('that keep a stone are a fight every starter wins at the level the first gym asks for, and none stands above it', () => {
    // Misty's Gym Guide tells a player to train to this before her gym, which is
    // in the ring the stone-keepers stand in: a guard is a fight for then, not later.
    const advised = gymLeadLevel(MISTY_BOSS_ID);
    for (const guard of guards.filter((each) => stoneOf(each) !== undefined)) {
      expect(`${guard.id} at Lv ${guard.wildLevel}`).toBe(`${guard.id} at Lv ${Math.min(guard.wildLevel!, advised)}`);
      for (const starter of STARTERS) {
        const won = winRateAgainst(starter, advised, guard.pokemon!, guard.wildLevel!, 200);
        expect(`${guard.id} against a Lv ${advised} ${starter}: ${won >= 0.5 ? 'beaten most of the time' : `${Math.round(won * 100)}%`}`).toBe(
          `${guard.id} against a Lv ${advised} ${starter}: beaten most of the time`,
        );
      }
    }
  });
});
