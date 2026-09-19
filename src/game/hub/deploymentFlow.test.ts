import { describe, expect, it } from 'vitest';
import { SECURED_MATERIAL_QUANTITY } from '../items';
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
    flow.toggleSecureItem('potion');
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
    expect(flow.toggleSecureItem('potion')).toBeUndefined();
    expect(flow.toggleSecureItem('poke-ball')).toBeUndefined();
    expect(flow.securedItems).toHaveLength(2);
  });

  it('drops protection when the protected Pokemon or supplies leave the loadout', () => {
    const { flow } = seedFlow();

    flow.togglePokemon('charmander-1');
    flow.adjustItem('potion', 2);
    flow.openSecureSlot();
    flow.toggleSecurePokemon('charmander-1');
    flow.toggleSecureItem('potion');
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
    const flow = new DeploymentFlow(stash, 'floodplain-relay', { pokemon: 2, itemStacks: 3 });
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

    // A material is found rather than brought, so protecting it is naming the kind.
    expect(flow.toggleSecureItem('radio-valve')).toBeUndefined();
    expect(flow.securesItem('radio-valve')).toBe(true);
    expect(flow.securedItems).toEqual([{ itemId: 'radio-valve', quantity: SECURED_MATERIAL_QUANTITY }]);
    flow.advance();
    const deployment = flow.deploy();
    expect(deployment.items).toEqual([]);
    expect(deployment.stashSecureSlot.items).toEqual([{ itemId: 'radio-valve', quantity: SECURED_MATERIAL_QUANTITY }]);
  });

  it('counts a secured material against the same slots as any other stack', () => {
    const { flow } = seedFlow();
    flow.toggleSecureItem('radio-valve');
    flow.toggleSecureItem('lamp-oil');
    expect(flow.toggleSecureItem('cable-coil')).toMatch(/2 item stacks/);
  });
});
