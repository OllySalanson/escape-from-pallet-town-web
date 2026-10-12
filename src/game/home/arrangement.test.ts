import { describe, expect, it } from 'vitest';
import type { GridPosition } from '../movement/gridMovement';
import { baseGame, restoreBase } from '../base/baseGames.testkit';
import { buildRoom, homeFloorPlans, PUMPKIN_SPOT, roomNamed } from '../base/rooms';
import { stepsFrom } from '../base/baseWalks';
import { CHARMANDER, Pokemon } from '../pokemon';
import { SPECIES_BY_ID } from '../pokemon/species';
import { createStartingStash } from '../stash';
import { SaveManager, type RestoredGame, type StorageLike } from '../save/SaveManager';
import { Bag } from '../items';
import { PokemonParty } from '../pokemon';
import {
  arrangeHouse,
  boxContents,
  DEFAULT_HOME_LAYOUT,
  homeLayoutOf,
  ownedFurniture,
  placedPiece,
  placementRefusal,
  readHomeLayout,
  type FloorPlan,
  type PlacedPiece,
  type Placement,
} from './arrangement';
import { furnitureNamed } from './furniture';

/**
 * Where the player's furniture may stand. Every rule here is one a player
 * meets with a piece in their hands, so each is asked the way the house asks
 * it: of the room as it is really built, through `buildRoom`.
 */

const JUNE = new Date(2026, 5, 15, 12);
const plans = (game: RestoredGame = baseGame()) => homeFloorPlans(game, JUNE);
const piece = (placement: Omit<Placement, 'room' | 'facing'> & Partial<Placement>): PlacedPiece =>
  placedPiece({ room: 'bolthole', facing: 0, ...placement })!;
const refusal = (plan: FloorPlan, pieces: readonly PlacedPiece[], candidate: PlacedPiece, standing: GridPosition[] = []) =>
  placementRefusal(plan, pieces, candidate, standing);
const house = (game: RestoredGame, layout: readonly Placement[]) =>
  arrangeHouse(plans(game), layout, ownedFurniture(game));
const withLayout = (game: RestoredGame, homeLayout: readonly Placement[]): RestoredGame => ({
  ...game,
  raidProgress: { ...game.raidProgress, homeLayout },
});
const downstairs = roomNamed('bolthole')!;

describe('the house before anybody has moved anything', () => {
  it('stands the table and both pot plants where the house always had them', () => {
    const built = buildRoom(downstairs, baseGame(), JUNE);
    expect(built.home?.placed.map((each) => [each.id, each.x, each.y])).toEqual([
      ['dining-table', 4, 3],
      ['pot-plant', 0, 6],
      ['pot-plant', 14, 6],
    ]);
    // The table is solid and the rug round it is not; the plants are solid
    // all the way up - exactly the collision the house was drawn with.
    for (const [x, y] of [[6, 4], [7, 4], [6, 5], [7, 5], [0, 6], [0, 7], [14, 6], [14, 7]]) {
      expect([x, y, built.collision[y][x]]).toEqual([x, y, true]);
    }
    for (const [x, y] of [[4, 3], [5, 4], [9, 6], [8, 3]]) {
      expect([x, y, built.collision[y][x]]).toEqual([x, y, false]);
    }
  });

  it('owns the house pieces and has a few more in the box to start with', () => {
    const game = baseGame();
    const owned = ownedFurniture(game);
    expect(owned.get('pot-plant')).toBe(2);
    const box = boxContents(owned, homeLayoutOf(game.raidProgress)).map((entry) => entry.definition.id);
    expect(box).toEqual(expect.arrayContaining(['small-desk', 'small-chair', 'red-plant', 'round-cushion']));
    expect(box).not.toContain('pot-plant');
    expect(box).not.toContain('dining-table');
  });
});

describe('a doll for every kind of Pokémon brought home', () => {
  it('is owned for each kind in the Pokédex, and only those', () => {
    const owned = ownedFurniture(baseGame({ progress: { pokedexOwned: [25, 143] } }));
    // The starting stash's Charmander and the base's Pidgey are owned too.
    expect(owned.get('doll-25')).toBe(1);
    expect(owned.get('doll-143')).toBe(1);
    expect(owned.get('doll-4')).toBe(1);
    expect(owned.get('doll-26')).toBeUndefined();
  });

  it('comes home the first time a kind is banked into the vault', () => {
    const stash = createStartingStash(CHARMANDER);
    const before = ownedFurniture(restoreBase(stash));
    expect(before.get('doll-143')).toBeUndefined();
    stash.addPokemon(new Pokemon(SPECIES_BY_ID.snorlax, 30), 'snorlax-1');
    expect(ownedFurniture(restoreBase(stash)).get('doll-143')).toBe(1);
  });

  it("is Emerald's own doll where Emerald drew one, big or small, and FireRed's icon otherwise", () => {
    expect(furnitureNamed('doll-25')).toMatchObject({ name: 'PIKACHU DOLL', layer: 'small', width: 1 });
    expect(furnitureNamed('doll-25')?.facings[0]).toMatchObject({ kind: 'sheet', piece: 'doll-25' });
    expect(furnitureNamed('doll-143')).toMatchObject({ name: 'SNORLAX DOLL', layer: 'standing', width: 2, height: 2 });
    expect(furnitureNamed('doll-4')?.facings[0]).toMatchObject({ kind: 'icon', species: 'charmander' });
  });
});

describe('putting a piece down', () => {
  const plan = plans().bolthole;
  const upstairsPlan = plans()['bolthole-upstairs'];

  it('goes on the floor: never on a wall or on what the house is built with', () => {
    expect(refusal(plan, [], piece({ id: 'red-plant', x: 9, y: 0 }))).toEqual({ kind: 'off-floor' });
    // The kitchen counter.
    expect(refusal(plan, [], piece({ id: 'small-chair', x: 0, y: 1 }))).toEqual({ kind: 'off-floor' });
    expect(refusal(plan, [], piece({ id: 'surf-mat', x: 13, y: 7 }))).toEqual({ kind: 'off-floor' });
    expect(refusal(plan, [], piece({ id: 'small-chair', x: 10, y: 6 }))).toBeNull();
  });

  it('never covers the door mat or the stairs', () => {
    expect(refusal(plan, [], piece({ id: 'small-chair', x: 7, y: 8 }))).toEqual({ kind: 'on-a-mat' });
    expect(refusal(plan, [], piece({ id: 'small-chair', x: 12, y: 2 }))).toEqual({ kind: 'on-a-mat' });
    expect(refusal(upstairsPlan, [], piece({ id: 'small-chair', room: 'bolthole-upstairs', x: 13, y: 2 }))).toEqual({
      kind: 'on-a-mat',
    });
  });

  it('lays a mat on bare floor only, and lets something stand on it', () => {
    // The upstairs rug is the house's own.
    expect(refusal(upstairsPlan, [], piece({ id: 'surf-mat', room: 'bolthole-upstairs', x: 5, y: 5 }))).toEqual({
      kind: 'not-bare',
    });
    const mat = piece({ id: 'surf-mat', x: 10, y: 5 });
    expect(refusal(plan, [], mat)).toBeNull();
    expect(refusal(plan, [mat], piece({ id: 'red-plant', x: 11, y: 5 }))).toBeNull();
    expect(refusal(plan, [mat], piece({ id: 'thunder-mat', x: 11, y: 6 }))).toEqual({ kind: 'in-the-way', by: 'SURF MAT' });
  });

  it('stands one thing in a place, but a doll or a cushion on a desk or the table top', () => {
    const desk = piece({ id: 'small-desk', x: 10, y: 6 });
    const table = piece({ id: 'dining-table', x: 4, y: 3 });
    expect(refusal(plan, [desk], piece({ id: 'red-plant', x: 10, y: 5 }))).toEqual({ kind: 'in-the-way', by: 'SMALL DESK' });
    expect(refusal(plan, [desk], piece({ id: 'doll-25', x: 10, y: 6 }))).toBeNull();
    expect(refusal(plan, [desk], piece({ id: 'round-cushion', x: 10, y: 6 }))).toBeNull();
    expect(refusal(plan, [table], piece({ id: 'doll-25', x: 6, y: 4 }))).toBeNull();
    // A chair is not a desk, and nothing stands on the table but a doll.
    expect(refusal(plan, [table], piece({ id: 'small-chair', x: 6, y: 4 }))).toEqual({ kind: 'in-the-way', by: 'THE TABLE' });
    const chair = piece({ id: 'small-chair', x: 11, y: 6 });
    expect(refusal(plan, [chair], piece({ id: 'doll-25', x: 11, y: 6 }))).toEqual({ kind: 'in-the-way', by: 'SMALL CHAIR' });
    // And nothing goes down on top of a doll.
    const doll = piece({ id: 'doll-25', x: 12, y: 6 });
    expect(refusal(plan, [doll], piece({ id: 'small-desk', x: 12, y: 6 }))).toEqual({ kind: 'in-the-way', by: 'PIKACHU DOLL' });
  });

  it('never blocks the door: the stairs, and everything that answers, can still be walked to', () => {
    // A row of plants across the room from wall to wall, door side of the stairs.
    const row = Array.from({ length: 14 }, (_x, x) => piece({ id: 'red-plant', x, y: 5 }));
    expect(refusal(plan, row, piece({ id: 'red-plant', x: 14, y: 5 }))).toEqual({ kind: 'blocks', what: 'THE STAIRS' });
    // Standing in front of the telly.
    expect(refusal(plan, [], piece({ id: 'red-plant', x: 5, y: 2 }))).toEqual({ kind: 'blocks', what: 'THE TELLY' });
    // Upstairs, the PC, which is spoken to from the one tile at the foot of its desk.
    expect(refusal(upstairsPlan, [], piece({ id: 'small-desk', room: 'bolthole-upstairs', x: 0, y: 2 }))).toEqual({
      kind: 'blocks',
      what: 'YOUR PC',
    });
  });

  it('never lands on the player, or walls them in', () => {
    expect(refusal(plan, [], piece({ id: 'small-desk', x: 10, y: 6 }), [{ x: 10, y: 6 }])).toEqual({ kind: 'under-you' });
    // A chair can be sat on.
    expect(refusal(plan, [], piece({ id: 'small-chair', x: 10, y: 6 }), [{ x: 10, y: 6 }])).toBeNull();
    // A pocket of plants with one way out of it, down the middle.
    const pen = [piece({ id: 'red-plant', x: 9, y: 6 }), piece({ id: 'red-plant', x: 11, y: 6 }), piece({ id: 'small-desk', x: 10, y: 5 })];
    const inside = [{ x: 10, y: 6 }];
    expect(refusal(plan, pen, piece({ id: 'small-desk', x: 12, y: 8 }), inside)).toBeNull();
    expect(refusal(plan, pen, piece({ id: 'small-desk', x: 10, y: 8 }), inside)).toEqual({ kind: 'blocks', what: 'YOUR WAY OUT' });
  });

  it('turns the art and the tiles together', () => {
    const plant = furnitureNamed('pot-plant')!;
    expect(plant.facings).toHaveLength(2);
    expect(furnitureNamed('round-cushion')!.facings[1]).toMatchObject({ flip: true });
    expect(furnitureNamed('surf-mat')!.facings).toHaveLength(1);
  });
});

describe('a layout read back', () => {
  it('stands only what the save owns, sharing that between the floors', () => {
    const game = baseGame();
    const twice: Placement[] = [
      { id: 'small-desk', room: 'bolthole', x: 10, y: 6, facing: 0 },
      { id: 'small-desk', room: 'bolthole-upstairs', x: 10, y: 6, facing: 0 },
      { id: 'pika-cushion', room: 'bolthole', x: 11, y: 6, facing: 0 },
    ];
    expect(house(game, twice).map((each) => [each.id, each.room])).toEqual([['small-desk', 'bolthole']]);
    game.stash.addItem('pika-cushion', 1);
    expect(house(game, twice).map((each) => each.id)).toEqual(['small-desk', 'pika-cushion']);
  });

  it('puts back in the box whatever no longer fits', () => {
    const game = baseGame();
    const layout: Placement[] = [
      { id: 'red-plant', room: 'bolthole', x: 5, y: 2, facing: 0 },
      { id: 'small-chair', room: 'bolthole', x: 7, y: 8, facing: 0 },
      { id: 'small-desk', room: 'bolthole', x: 10, y: 6, facing: 0 },
    ];
    expect(house(game, layout).map((each) => each.id)).toEqual(['small-desk']);
  });

  it('checks a doll after the desk it stands on, whatever order it was written in', () => {
    const game = baseGame({ progress: { pokedexOwned: [25] } });
    const layout: Placement[] = [
      { id: 'doll-25', room: 'bolthole', x: 10, y: 6, facing: 0 },
      { id: 'small-desk', room: 'bolthole', x: 10, y: 6, facing: 0 },
    ];
    expect(house(game, layout).map((each) => each.id).sort()).toEqual(['doll-25', 'small-desk']);
  });

  it('keeps only well-formed entries from a save', () => {
    expect(
      readHomeLayout([
        { id: 'small-desk', room: 'bolthole', x: 10, y: 6, facing: 0 },
        { id: 'no-such-thing', room: 'bolthole', x: 1, y: 1, facing: 0 },
        { id: 'small-desk', room: 'oaks-lab', x: 1, y: 1, facing: 0 },
        { id: 'surf-mat', room: 'bolthole', x: 1, y: 1, facing: 1 },
        { id: 'small-desk', room: 'bolthole', x: -1, y: 1, facing: 0 },
        'junk',
      ]),
    ).toEqual([{ id: 'small-desk', room: 'bolthole', x: 10, y: 6, facing: 0 }]);
  });
});

describe('the time of year gives way to the furniture', () => {
  const OCTOBER = new Date(2026, 9, 31, 20);

  it('puts the pumpkin out by the door when there is room for it, and not when there is not', () => {
    const game = baseGame();
    expect(buildRoom(downstairs, game, OCTOBER).things.map((thing) => thing.name)).toContain('A PUMPKIN');
    const taken = withLayout(game, [{ id: 'small-chair', room: 'bolthole', x: PUMPKIN_SPOT.x, y: PUMPKIN_SPOT.y, facing: 0 }]);
    const built = buildRoom(downstairs, taken, OCTOBER);
    expect(built.things.map((thing) => thing.name)).not.toContain('A PUMPKIN');
    expect(built.home?.placed.map((each) => each.id)).toEqual(['small-chair']);
    expect(built.collision[PUMPKIN_SPOT.y][PUMPKIN_SPOT.x]).toBe(false);
  });

  it('never lets a decoration wall the house in', () => {
    const steps = (built: ReturnType<typeof buildRoom>) => stepsFrom(built.collision, downstairs.mat!);
    const built = buildRoom(downstairs, baseGame(), new Date(2026, 11, 24, 18));
    expect(steps(built)[2][12]).toBeLessThan(Infinity);
  });
});

describe('the layout in the save', () => {
  class MemoryStorage implements StorageLike {
    private readonly values = new Map<string, string>();
    public getItem(key: string): string | null {
      return this.values.get(key) ?? null;
    }
    public setItem(key: string, value: string): void {
      this.values.set(key, value);
    }
    public removeItem(key: string): void {
      this.values.delete(key);
    }
  }

  it('is absent until the house is decorated, then kept exactly as written', () => {
    const saves = new SaveManager(new MemoryStorage());
    saves.save({ party: new PokemonParty(), mapId: 'pallet-town', position: { x: 0, y: 0 }, bag: new Bag(), stash: createStartingStash(CHARMANDER) });
    expect(saves.load()?.raidProgress.homeLayout).toBeUndefined();
    expect(homeLayoutOf(saves.load()!.raidProgress)).toEqual(DEFAULT_HOME_LAYOUT);
    const layout: Placement[] = [{ id: 'small-desk', room: 'bolthole-upstairs', x: 10, y: 6, facing: 0 }];
    expect(saves.arrangeHome(layout)?.raidProgress.homeLayout).toEqual(layout);
    expect(saves.load()?.raidProgress.homeLayout).toEqual(layout);
    // An empty house is a decision, not a missing field.
    saves.arrangeHome([]);
    expect(saves.load()?.raidProgress.homeLayout).toEqual([]);
    expect(buildRoom(downstairs, saves.load()!, JUNE).home?.placed).toEqual([]);
  });
});
