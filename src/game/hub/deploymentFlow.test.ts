import { describe, expect, it } from 'vitest';
import { RAID_BAG_GRID } from '../items';
import { CHARMANDER, Pokemon, SQUIRTLE } from '../pokemon';
import { createStartingStash, type Stash } from '../stash';
import { DeploymentFlow } from './deploymentFlow';

function seedFlow(): { flow: DeploymentFlow; stash: Stash } {
  const stash = createStartingStash();
  stash.addPokemon(new Pokemon(CHARMANDER, 7), 'charmander-1');
  return { flow: new DeploymentFlow(stash), stash };
}

describe('deployment flow', () => {
  it('starts preparation with nothing selected, so no partner is chosen for the player', () => {
    const { flow } = seedFlow();

    expect(flow.step).toBe('loadout');
    expect(flow.party).toEqual([]);
    expect(flow.items).toEqual([]);
    expect(flow.isDeployable).toBe(false);
  });

  it('deploys, and secures, a Pokemon kept in a later box exactly as one kept in the first', () => {
    const { flow, stash } = seedFlow();
    const shelf = stash.addBox();
    stash.movePokemon('charmander-1', shelf);

    expect(flow.togglePokemon('charmander-1')).toBeUndefined();
    expect(flow.toggleSecurePokemon('charmander-1')).toBeUndefined();
    flow.advance();
    flow.advance();

    expect(flow.deploy().party.map((stored) => stored.id)).toEqual(['charmander-1']);
    expect(flow.securedPokemon.map((stored) => stored.id)).toEqual(['charmander-1']);
  });

  it('refuses to reach the raid without a deliberate loadout confirmation', () => {
    const { flow } = seedFlow();

    expect(() => flow.deploy()).toThrow(/confirmed loadout/);
    expect(flow.advance()).toMatch(/at least one Pokemon/);
    expect(flow.step).toBe('loadout');

    flow.togglePokemon('bulbasaur-1');
    flow.openSecureSlot();
    expect(flow.step).toBe('secure');
    expect(() => flow.deploy()).toThrow(/confirmed loadout/);

    expect(flow.advance()).toBeUndefined();
    expect(flow.step).toBe('loadout');
    expect(flow.advance()).toBeUndefined();
    expect(flow.step).toBe('confirm');
    expect(() => flow.deploy()).not.toThrow();
  });

  it('refuses a loadout of nothing but fainted Pokemon, which is a wipe with extra steps', () => {
    const { flow, stash } = seedFlow();
    const fainted = stash.listPokemon().find((stored) => stored.id === 'charmander-1')!.pokemon;
    fainted.takeDamage(fainted.maxHp);

    flow.togglePokemon('charmander-1');
    expect(flow.party).toHaveLength(1);
    expect(flow.isDeployable).toBe(false);
    expect(flow.advance()).toMatch(/fainted/);
    expect(flow.step).toBe('loadout');

    // A recovery at base is the way out, and reopens the same route.
    expect(stash.recoverPokemon('charmander-1')).toBe(true);
    expect(flow.isDeployable).toBe(true);
    expect(flow.advance()).toBeUndefined();
    expect(flow.step).toBe('confirm');
  });

  it('still deploys a fainted Pokemon alongside one that can fight', () => {
    const { flow, stash } = seedFlow();
    const fainted = stash.listPokemon().find((stored) => stored.id === 'charmander-1')!.pokemon;
    fainted.takeDamage(fainted.maxHp);

    flow.togglePokemon('charmander-1');
    flow.togglePokemon('bulbasaur-1');

    expect(flow.isDeployable).toBe(true);
    expect(flow.advance()).toBeUndefined();
    expect(flow.deploy().party.map((stored) => stored.id)).toEqual(['charmander-1', 'bulbasaur-1']);
  });

  it('deploys exactly the party, supplies, insertion and secure slot that were confirmed', () => {
    const { flow, stash } = seedFlow();

    flow.togglePokemon('charmander-1');
    flow.togglePokemon('bulbasaur-1');
    flow.adjustItem('potion', 2);
    flow.adjustItem('poke-ball', 1);
    flow.chooseInsertion('viridian-forest');
    flow.openSecureSlot();
    flow.toggleSecurePokemon('charmander-1');
    flow.adjustSecureItem('potion', 2);
    flow.advance();
    flow.advance();

    const deployment = flow.deploy();

    expect(deployment.insertionId).toBe('viridian-forest');
    expect(deployment.party.map(({ id }) => id)).toEqual(['charmander-1', 'bulbasaur-1']);
    expect(deployment.party[0].pokemon).toBe(
      stash.listPokemon().find(({ id }) => id === 'charmander-1')?.pokemon,
    );
    expect(deployment.items).toEqual([
      { itemId: 'potion', quantity: 2 },
      { itemId: 'poke-ball', quantity: 1 },
    ]);
    expect(deployment.secureSlot).toEqual({
      pokemon: [stash.listPokemon().find(({ id }) => id === 'charmander-1')?.pokemon],
      items: [{ itemId: 'potion', quantity: 2 }],
    });
    expect(deployment.stashSecureSlot).toEqual({
      pokemonIds: ['charmander-1'],
      items: [{ itemId: 'potion', quantity: 2 }],
    });
  });

  it('leaves nothing protected when the player never opens the secure slot', () => {
    const { flow } = seedFlow();

    flow.togglePokemon('bulbasaur-1');
    flow.advance();

    expect(flow.deploy().secureSlot).toEqual({ items: [] });
    expect(flow.deploy().stashSecureSlot).toEqual({ items: [] });
  });

  it('caps the party at six and the secure slot at one Pokemon and two stacks', () => {
    const stash = createStartingStash();
    const ids = ['bulbasaur-1'];
    for (let index = 0; index < 6; index += 1) {
      ids.push(stash.addPokemon(new Pokemon(SQUIRTLE, 5)));
    }
    const flow = new DeploymentFlow(stash);

    for (const id of ids.slice(0, 6)) {
      expect(flow.togglePokemon(id)).toBeUndefined();
    }
    expect(flow.togglePokemon(ids[6])).toMatch(/up to 6 Pokemon/);
    expect(flow.party).toHaveLength(6);

    flow.adjustItem('potion', 3);
    flow.adjustItem('poke-ball', 5);
    flow.openSecureSlot();
    flow.toggleSecurePokemon(ids[0]);
    flow.toggleSecurePokemon(ids[1]);
    expect(flow.securedPokemon.map(({ id }) => id)).toEqual([ids[1]]);
    expect(flow.adjustSecureItem('potion', 1)).toBeUndefined();
    expect(flow.adjustSecureItem('poke-ball', 1)).toBeUndefined();
    expect(flow.securedItems).toHaveLength(2);
  });

  it('drops protection when the protected Pokemon or supplies leave the loadout', () => {
    const { flow } = seedFlow();

    flow.togglePokemon('charmander-1');
    flow.adjustItem('potion', 2);
    flow.openSecureSlot();
    flow.toggleSecurePokemon('charmander-1');
    flow.adjustSecureItem('potion', 1);
    flow.advance();

    flow.togglePokemon('charmander-1');
    flow.adjustItem('potion', -2);

    expect(flow.securedPokemon).toEqual([]);
    expect(flow.securedItems).toEqual([]);
    expect(flow.isDeployable).toBe(false);
  });

  it('never carries a confirmation back to the base screen', () => {
    const { flow } = seedFlow();

    flow.togglePokemon('bulbasaur-1');
    flow.advance();
    expect(flow.step).toBe('confirm');

    flow.restart();

    expect(flow.step).toBe('loadout');
    expect(() => flow.deploy()).toThrow(/confirmed loadout/);
    expect(flow.party.map(({ id }) => id)).toEqual(['bulbasaur-1']);
  });

  it('walks back through the route it came in by, one step at a time', () => {
    const { flow } = seedFlow();

    flow.togglePokemon('bulbasaur-1');
    flow.advance();
    flow.openSecureSlot();

    expect(flow.secureReturnStep).toBe('confirm');
    expect(flow.retreat()).toBe(true);
    expect(flow.step).toBe('confirm');
    expect(flow.retreat()).toBe(true);
    expect(flow.step).toBe('loadout');
    expect(flow.retreat()).toBe(false);
  });

  it('caps supplies at the quantity held in the stash', () => {
    const { flow } = seedFlow();

    flow.adjustItem('potion', 9);
    expect(flow.itemQuantity('potion')).toBe(3);
    flow.adjustItem('potion', -9);
    expect(flow.itemQuantity('potion')).toBe(0);
    expect(flow.items).toEqual([]);
  });

  it('moves a single protected slot, and holds two once the second locker is built', () => {
    const single = seedFlow().flow;
    single.togglePokemon('bulbasaur-1');
    single.togglePokemon('charmander-1');
    single.toggleSecurePokemon('bulbasaur-1');
    single.toggleSecurePokemon('charmander-1');
    expect(single.securedPokemon.map(({ id }) => id)).toEqual(['charmander-1']);

    const stash = createStartingStash();
    stash.addPokemon(new Pokemon(CHARMANDER, 7), 'charmander-1');
    stash.addPokemon(new Pokemon(SQUIRTLE, 6), 'squirtle-1');
    const flow = new DeploymentFlow(stash, 'floodplain-relay', { pokemon: 2, secureGrid: { width: 3, height: 2 }, bagGrid: RAID_BAG_GRID });
    for (const id of ['bulbasaur-1', 'charmander-1', 'squirtle-1']) {
      flow.togglePokemon(id);
      flow.toggleSecurePokemon(id);
    }
    // A third pick lets go of the first rather than refusing the click.
    expect(flow.securedPokemon.map(({ id }) => id)).toEqual(['charmander-1', 'squirtle-1']);

    flow.advance();
    const deployment = flow.deploy();
    expect(deployment.stashSecureSlot.pokemonIds).toEqual(['charmander-1', 'squirtle-1']);
    expect(deployment.secureSlot.pokemon).toHaveLength(2);

    // A secured Pokemon that leaves the party stops holding a slot.
    flow.togglePokemon('squirtle-1');
    expect(flow.securedPokemon.map(({ id }) => id)).toEqual(['charmander-1']);
  });

  it('never packs a material, but lets the secure slot name its kind', () => {
    const { flow, stash } = seedFlow();
    stash.addItem('radio-valve', 2);
    flow.togglePokemon('bulbasaur-1');

    flow.adjustItem('radio-valve', 1);
    expect(flow.items).toEqual([]);

    // A material is found rather than brought, so the container keeps room for
    // it: two squares of a four-square container, for one radio valve.
    expect(flow.adjustSecureItem('radio-valve', 1)).toBeUndefined();
    expect(flow.securesItem('radio-valve')).toBe(true);
    expect(flow.securedItems).toEqual([{ itemId: 'radio-valve', quantity: 1 }]);
    flow.advance();
    const deployment = flow.deploy();
    expect(deployment.items).toEqual([]);
    expect(deployment.stashSecureSlot.items).toEqual([{ itemId: 'radio-valve', quantity: 1 }]);
  });

  it('measures a secured material in the same squares as any other item', () => {
    const { flow } = seedFlow();
    // Two radio valves are two squares each: the base container is full.
    expect(flow.adjustSecureItem('radio-valve', 1)).toBeUndefined();
    expect(flow.adjustSecureItem('radio-valve', 1)).toBeUndefined();
    expect(flow.secureCells).toEqual({ used: 4, total: 4 });
    expect(flow.adjustSecureItem('lamp-oil', 1)).toMatch(/full/);
    // A four-square crate never fits a four-square container that holds anything.
    expect(flow.adjustSecureItem('cable-coil', 1)).toMatch(/full/);
  });

  it('caps the pack by its squares, not by the vault', () => {
    const { flow, stash } = seedFlow();
    stash.addItem('potion', 40);
    flow.togglePokemon('bulbasaur-1');
    // Eighteen squares, one apiece: the nineteenth Potion is refused, and the
    // refusal is a sentence rather than a disabled button.
    for (let index = 0; index < 18; index += 1) {
      expect(flow.adjustItem('potion', 1)).toBeUndefined();
    }
    expect(flow.itemQuantity('potion')).toBe(18);
    expect(flow.bagCells).toEqual({ used: 18, total: 18 });
    expect(flow.adjustItem('potion', 1)).toMatch(/No room/);
    expect(flow.packHasRoomFor('potion')).toBe(false);
    expect(flow.itemQuantity('potion')).toBe(18);
  });

  /**
   * A Super Potion is one square wide and two tall, and the pack is three rows
   * deep - so six of them stand a column apiece and leave the bottom row, which
   * only one-square things can use. Twice the heal for twice the room is the
   * rule; the leftover row is the shape of the pack answering back.
   */
  it('measures a Super Potion at two squares, and leaves a row only singles can fill', () => {
    const { flow, stash } = seedFlow();
    stash.addItem('super-potion', 20);
    stash.addItem('potion', 20);
    for (let index = 0; index < 6; index += 1) {
      expect(flow.adjustItem('super-potion', 1)).toBeUndefined();
    }
    expect(flow.bagCells).toEqual({ used: 12, total: 18 });
    expect(flow.adjustItem('super-potion', 1)).toMatch(/No room/);

    for (let index = 0; index < 6; index += 1) {
      expect(flow.adjustItem('potion', 1)).toBeUndefined();
    }
    expect(flow.bagCells).toEqual({ used: 18, total: 18 });
    expect(flow.adjustItem('potion', 1)).toMatch(/No room/);
  });
});
