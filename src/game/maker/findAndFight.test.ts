import { afterEach, describe, expect, it } from 'vitest';
import { frontDoorFor, generateRunPlan } from '../run/runGeneration';
import { buildPlayerMap, readMapFile, type MapFile } from '../world/mapFile';
import { registerPlayerMap, unregisterPlayerMap } from '../world/playerMaps';
import { blankMap, placeSpot, setItemHidden, setPokemonLevel, updateThing } from './draft';

/** A map with its front door, a way out, and whatever `add` puts on it. */
function mapWith(add: (file: MapFile) => MapFile): MapFile {
  let file: MapFile = { ...blankMap(30, 20, 'Finds'), maker: 'Tester' };
  for (const [kind, at] of [
    ['drop-in', { x: 4, y: 4 }],
    ['exit', { x: 25, y: 15 }],
  ] as const) {
    const outcome = placeSpot(file, kind, at);
    file = outcome.placed ? outcome.file : file;
  }
  return add(file);
}

const place = (file: MapFile, kind: 'item' | 'pokemon', x: number, y: number) => {
  const outcome = placeSpot(file, kind, { x, y });
  if (!outcome.placed) {
    throw new Error(outcome.reason);
  }
  return outcome;
};

const registered: string[] = [];
afterEach(() => {
  for (const id of registered.splice(0)) {
    unregisterPlayerMap(id as never);
  }
});

describe('a hidden item spot', () => {
  const file = mapWith((start) => {
    let next = place(start, 'item', 10, 10).file;
    next = place(next, 'item', 12, 10).file;
    return setItemHidden(next, 0, true);
  });

  it('is written to the file as hidden, and only the one chosen', () => {
    expect(file.itemSpots).toEqual([
      { x: 10, y: 10, hidden: true },
      { x: 12, y: 10 },
    ]);
    expect(setItemHidden(file, 0, false).itemSpots[0]).toEqual({ x: 10, y: 10 });
    expect(readMapFile({ ...file, itemSpots: [{ x: 10, y: 10, hidden: 'yes' }] }).ok).toBe(false);
  });

  it('stays hidden whatever a raid rolls into it, because hiding is a fact about the place', () => {
    const map = buildPlayerMap(file);
    registerPlayerMap(map);
    registered.push(map.id);
    expect(map.loot.map((piece) => piece.hidden === true)).toEqual([true, false]);
    const door = frontDoorFor(map.id)!;
    for (let seed = 1; seed <= 20; seed += 1) {
      for (const piece of generateRunPlan(seed, undefined, door.id).loot[map.id]) {
        expect(piece.hidden === true, `seed ${seed} ${piece.id}`).toBe(
          piece.position.x === 10 && piece.position.y === 10,
        );
      }
    }
  });
});

describe('a Pokemon that fights', () => {
  it('carries its level into the world, and only says its name without one', () => {
    const placed = place(
      mapWith((start) => start),
      'pokemon',
      8,
      8,
    );
    const sleeping = setPokemonLevel(
      updateThing(placed.file, placed.thing, { species: 'snorlax' }),
      0,
      30,
    );
    expect(sleeping.pokemon).toEqual([{ x: 8, y: 8, species: 'snorlax', level: 30 }]);
    const entity = buildPlayerMap(sleeping).entities.find((candidate) => candidate.pokemon);
    expect(entity).toMatchObject({ pokemon: 'snorlax', wildLevel: 30 });

    const calm = setPokemonLevel(sleeping, 0, undefined);
    expect(calm.pokemon).toEqual([{ x: 8, y: 8, species: 'snorlax' }]);
    expect(buildPlayerMap(calm).entities.find((candidate) => candidate.pokemon)).not.toHaveProperty(
      'wildLevel',
    );
  });

  it('fights at a level from 2 to 50, and nothing else', () => {
    const file = mapWith((start) => start);
    for (const level of [1, 51, 7.5]) {
      expect(
        readMapFile({ ...file, pokemon: [{ x: 8, y: 8, species: 'snorlax', level }] }).ok,
      ).toBe(false);
    }
    expect(
      readMapFile({ ...file, pokemon: [{ x: 8, y: 8, species: 'snorlax', level: 50 }] }).ok,
    ).toBe(true);
  });
});
