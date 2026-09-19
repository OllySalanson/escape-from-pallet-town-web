import { describe, expect, it } from 'vitest';
import { TRADER_BARTERS, TRADER_STOCK } from '../hub/trader';
import { outfitterMaterialKinds } from '../hub/outfitter';
import { BULBASAUR, CHARMANDER, PIKACHU, Pokemon, SQUIRTLE } from '../pokemon';
import { MACHINES } from '../pokemon/machines';
import { MINIMUM_SUPPLIES, Stash } from '../stash';
import { WORLD_MAPS } from '../worldMap';
import { MACHINE_ITEM_IDS, getItemById, isMachine, useFieldItem, type ItemDefinition } from './items';
import { canBeTaught, machineForItemId, teachFromMachine } from './teaching';

const disc = (id: string): ItemDefinition => getItemById(id)!;
const AERIAL_ACE = disc('tm40-aerial-ace');
const IRON_TAIL = disc('tm23-iron-tail');
const ROCK_SMASH = disc('hm06-rock-smash');

/** A Pokemon with four moves already, which is the case the chooser exists for. */
const withFullMoveset = (): Pokemon => {
  const charmander = new Pokemon(CHARMANDER, 20);
  expect(charmander.moves.length).toBe(4);
  return charmander;
};

describe('reading a machine', () => {
  it('teaches into a free slot and spends the disc', () => {
    const bulbasaur = new Pokemon(BULBASAUR, 5);
    const charmander = new Pokemon(CHARMANDER, 5);
    const before = charmander.moves.map((move) => move.base.name);
    expect(charmander.hasFreeMoveSlot).toBe(true);

    const outcome = teachFromMachine(AERIAL_ACE, charmander);

    expect(outcome).toMatchObject({ kind: 'learned', machineIsSpent: true });
    // The disc is the only thing that was spent: nothing was forgotten.
    expect(charmander.moves.map((move) => move.base.name)).toEqual([...before, 'Aerial Ace']);
    expect(canBeTaught(AERIAL_ACE, bulbasaur)).toBe(false);
  });

  it('refuses a species canon refuses, and spends nothing doing it', () => {
    const squirtle = new Pokemon(SQUIRTLE, 5);
    const before = squirtle.moves.map((move) => move.base.name);

    const outcome = teachFromMachine(AERIAL_ACE, squirtle);

    expect(outcome).toEqual({
      kind: 'refused',
      machineIsSpent: false,
      message: 'SQUIRTLE cannot learn AERIAL ACE.',
    });
    expect(squirtle.moves.map((move) => move.base.name)).toEqual(before);
    expect(squirtle.pendingMoves).toEqual([]);
    expect(canBeTaught(AERIAL_ACE, squirtle)).toBe(false);
  });

  it('refuses a move the Pokemon already knows', () => {
    const pikachu = new Pokemon(PIKACHU, 5);
    teachFromMachine(IRON_TAIL, pikachu);

    const again = teachFromMachine(IRON_TAIL, pikachu);

    expect(again).toMatchObject({ kind: 'refused', machineIsSpent: false });
    expect(again.kind === 'refused' && again.message).toContain('already knows');
  });

  it('never spends an HM, however many Pokemon read it', () => {
    const first = teachFromMachine(ROCK_SMASH, new Pokemon(BULBASAUR, 5));
    const second = teachFromMachine(ROCK_SMASH, new Pokemon(SQUIRTLE, 5));

    expect(first).toMatchObject({ kind: 'learned', machineIsSpent: false });
    expect(second).toMatchObject({ kind: 'learned', machineIsSpent: false });
    expect(MACHINES['hm06-rock-smash'].reusable).toBe(true);
  });

  it('queues the move for the chooser when four are already known', () => {
    const charmander = withFullMoveset();
    const known = charmander.moves.map((move) => move.base.name);

    const outcome = teachFromMachine(IRON_TAIL, charmander);

    expect(outcome.kind).toBe('choose');
    // Nothing is forgotten by the reading itself - the queue is the same road a
    // level-up takes, so the same chooser settles it.
    expect(charmander.moves.map((move) => move.base.name)).toEqual(known);
    expect(charmander.pendingMoves.map((move) => move.name)).toEqual(['Iron Tail']);

    const forgotten = charmander.resolvePendingMove(charmander.pendingMoves[0], 0);

    expect(forgotten?.forgotten?.name).toBe(known[0]);
    expect(charmander.moves.map((move) => move.base.name)).toContain('Iron Tail');
    expect(charmander.pendingMoves).toEqual([]);
  });

  it('leaves the moveset alone when the chooser is declined', () => {
    const charmander = withFullMoveset();
    const known = charmander.moves.map((move) => move.base.name);
    teachFromMachine(IRON_TAIL, charmander);

    const declined = charmander.resolvePendingMove(charmander.pendingMoves[0], null);

    expect(declined).toEqual({ forgotten: null });
    expect(charmander.moves.map((move) => move.base.name)).toEqual(known);
    expect(charmander.pendingMoves).toEqual([]);
  });

  // A taught move is in no learnset, so a save's list of move *names* could not
  // resolve it before `machineMovesFor` was part of that lookup - the move was
  // dropped silently by the next load and by every raid settlement.
  it('survives a moveset being restored from names', () => {
    const charmander = new Pokemon(CHARMANDER, 5);
    teachFromMachine(AERIAL_ACE, charmander);
    const names = charmander.moves.map((move) => move.base.name);

    const reloaded = new Pokemon(CHARMANDER, 5);
    reloaded.restoreMoveset(names, ['Iron Tail']);

    expect(reloaded.moves.map((move) => move.base.name)).toEqual(names);
    expect(reloaded.pendingMoves.map((move) => move.name)).toEqual(['Iron Tail']);
  });

  it('is not something a bag, a battle or a treatment bench can spend', () => {
    const charmander = new Pokemon(CHARMANDER, 5);

    // `useFieldItem` is deliberately not the road in: teaching can open a
    // screen, so `teachFromMachine` owns it and this refusal is the answer for
    // anything that only ever offers medicine.
    expect(useFieldItem(AERIAL_ACE, charmander).used).toBe(false);
    expect(charmander.moves.map((move) => move.base.name)).not.toContain('Aerial Ace');
  });
});

describe('where machines come from', () => {
  it('is never restocked, never a kit line, and never handed out by a wipe', () => {
    const stash = new Stash();
    for (const id of MACHINE_ITEM_IDS) {
      expect(MINIMUM_SUPPLIES).not.toHaveProperty(id);
    }

    stash.restockMinimumSupplies();

    for (const id of MACHINE_ITEM_IDS) {
      expect(stash.itemCount(id), `${id} was restocked`).toBe(0);
    }
  });

  it('is never on the shelf, whatever a player is holding', () => {
    for (const item of TRADER_STOCK) {
      expect(isMachine(item.itemId), `${item.itemId} is for sale`).toBe(false);
    }
  });

  it('is bartered only as the HM, and only once', () => {
    const bartered = TRADER_BARTERS.filter((barter) => isMachine(barter.gives.itemId));

    expect(bartered.map((barter) => barter.gives.itemId)).toEqual(['hm06-rock-smash']);
    expect(bartered[0].once).toBe(true);
    // Never for money: a taught move cannot be taken off a Pokemon even by a
    // wipe, which makes it the last thing on the boat that scrip should reach.
    for (const takes of bartered[0].takes) {
      expect(takes.itemId).not.toBe('scrip');
    }
  });

  it('is rolled field loot for every TM, one per map and two on the vast one', () => {
    const found = Object.values(WORLD_MAPS).flatMap((map) =>
      map.loot.filter((piece) => isMachine(piece.itemId)).map((piece) => ({ map: map.id, piece })),
    );

    expect(found.map(({ piece }) => piece.itemId).sort()).toEqual(
      MACHINE_ITEM_IDS.filter((id) => !machineForItemId(id)!.reusable).sort(),
    );
    for (const { map, piece } of found) {
      // On its own roll rather than in the pool, like the evolution stone: at
      // pool odds a permanent change to a Pokemon would be a formality.
      expect(piece.chance, `${map} ${piece.id} is pool loot`).toBeGreaterThan(0);
      expect(piece.chance).toBeLessThan(0.5);
      expect(piece.quantity).toBe(1);
    }
    expect(found.filter(({ map }) => map === 'floodplain-relay').length).toBe(2);
  });

  it('is never something a contract or the standing board can pay out', () => {
    const everyRung = outfitterMaterialKinds([]);

    for (const id of everyRung) {
      expect(isMachine(id), `${id} is an Outfitter price`).toBe(false);
    }
  });
});
