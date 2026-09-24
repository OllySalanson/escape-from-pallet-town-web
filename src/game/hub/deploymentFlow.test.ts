import { describe, expect, it } from 'vitest';
import { blocksFor, BASE_SECURE_GRID, gridCells, packGridFor, RAID_BAG_GRID, stackSizeOf } from '../items';
import { CHARMANDER, IVYSAUR, Pokemon, SQUIRTLE } from '../pokemon';
import { createStartingStash, Stash } from '../stash';
import { DeploymentFlow, MEDICINE_PREPACK_SHARE } from './deploymentFlow';

function seedFlow(): { flow: DeploymentFlow; stash: Stash } {
  const stash = createStartingStash();
  stash.addPokemon(new Pokemon(CHARMANDER, 7), 'charmander-1');
  return { flow: new DeploymentFlow(stash), stash };
}

/**
 * Takes out what the medicine default packed, for a test about packing from
 * an empty pack. The default is its own describe block below.
 */
function emptied(flow: DeploymentFlow): DeploymentFlow {
  for (const { itemId } of flow.items) {
    flow.setItemQuantity(itemId, 0);
  }
  return flow;
}

describe('the pack a raid is worn into', () => {
  /** A vault holding one of each pack, plus a Pokemon to deploy with. */
  function packedVault(): Stash {
    const { stash } = seedFlow();
    for (const itemId of ['satchel', 'ranger-pack', 'hauler-frame']) {
      stash.addItem(itemId, 1);
    }
    return stash;
  }

  it('opens on the biggest pack at base, and packs against its squares', () => {
    const flow = new DeploymentFlow(packedVault());

    expect(flow.packItemId).toBe('hauler-frame');
    expect(flow.bagGrid).toEqual(packGridFor('hauler-frame'));
    expect(flow.bagCells.total).toBe(30);
    expect(flow.packName).toBe('Hauler frame');
  });

  it('falls back to the starting squares for a vault that holds no pack at all', () => {
    const stash = new Stash();
    stash.addPokemon(new Pokemon(CHARMANDER, 7), 'charmander-1');
    const flow = new DeploymentFlow(stash);

    expect(flow.packItemId).toBeUndefined();
    expect(flow.bagGrid).toEqual(RAID_BAG_GRID);
    expect(flow.packChoices).toEqual([]);
    expect(flow.deploy.bind(flow)).toThrow();
  });

  it('wears a different pack, and re-measures the loadout against it', () => {
    const stash = packedVault();
    stash.addItem('potion', 20);
    const flow = new DeploymentFlow(stash);

    expect(flow.choosePack('satchel')).toBeUndefined();
    expect(flow.bagCells.total).toBe(12);
    expect(flow.packLimit('potion')).toBe(12);

    expect(flow.choosePack('ranger-pack')).toBeUndefined();
    expect(flow.bagCells.total).toBe(24);
  });

  /**
   * A smaller pack is refused rather than spilling what is packed: the player
   * packed it, and this game never silently puts something of theirs down.
   */
  it('refuses a pack too small for what is already packed, and says what it holds', () => {
    const stash = packedVault();
    stash.addItem('potion', 20);
    const flow = new DeploymentFlow(stash);
    flow.setItemQuantity('potion', 20);

    expect(flow.bagCells.used).toBe(20);
    expect(flow.choosePack('satchel')).toMatch(/Satchel holds 12 squares and you have packed 20/);
    expect(flow.packItemId).toBe('hauler-frame');
    // The row is still listed, with the reason on it, because a control the
    // cursor cannot reach can never say why it would do nothing.
    const satchel = flow.packChoices.find((choice) => choice.itemId === 'satchel')!;
    expect(satchel.wouldNotHold).toMatch(/holds 12 squares/);
    expect(satchel.chosen).toBe(false);
  });

  it('refuses a pack the vault does not hold', () => {
    const { flow } = seedFlow();
    expect(flow.choosePack('hauler-frame')).toMatch(/no Hauler frame at base/);
    expect(flow.packItemId).toBe('raid-pack');
  });

  it('lists every pack at base, smallest first, with how many there are', () => {
    const stash = packedVault();
    stash.addItem('satchel', 2);
    const flow = new DeploymentFlow(stash);

    expect(flow.packChoices.map(({ itemId, squares, held, chosen }) => ({ itemId, squares, held, chosen }))).toEqual([
      { itemId: 'satchel', squares: 12, held: 3, chosen: false },
      { itemId: 'raid-pack', squares: 18, held: 1, chosen: false },
      { itemId: 'ranger-pack', squares: 24, held: 1, chosen: false },
      { itemId: 'hauler-frame', squares: 30, held: 1, chosen: true },
    ]);
  });

  it('names the pack on the deployment, because nothing else can', () => {
    const flow = new DeploymentFlow(packedVault());
    flow.togglePokemon('charmander-1');
    flow.choosePack('ranger-pack');
    flow.advance();
    flow.advance();

    const deployment = flow.deploy();
    expect(deployment.packItemId).toBe('ranger-pack');
    // It is never one of the packed supplies: it is not in the bag, it is the bag.
    expect(deployment.items.map(({ itemId }) => itemId)).not.toContain('ranger-pack');
  });

  it('never packs a spare pack into the pack you are wearing', () => {
    const flow = new DeploymentFlow(packedVault());

    expect(flow.setItemQuantity('satchel', 1)).toBeUndefined();
    expect(flow.itemQuantity('satchel')).toBe(0);
    expect(flow.packLimit('satchel')).toBe(0);
  });
});

describe('deployment flow', () => {
  it('starts preparation with no Pokemon selected, so no partner is chosen for the player', () => {
    const { flow } = seedFlow();

    expect(flow.step).toBe('loadout');
    expect(flow.party).toEqual([]);
    // Medicine is the one thing packed for the player (see below); a Pokemon
    // and everything else is still theirs to choose.
    expect(flow.items).toEqual([{ itemId: 'potion', quantity: 3 }]);
    expect(flow.isDeployable).toBe(false);
  });

  it('deploys, and secures, a Pokemon kept in a later box exactly as one kept in the first', () => {
    const { flow, stash } = seedFlow();
    const shelf = stash.addBox();
    stash.movePokemon('charmander-1', shelf);

    expect(flow.togglePokemon('charmander-1')).toBeUndefined();
    flow.advance();
    flow.advance();

    expect(flow.deploy().party.map((stored) => stored.id)).toEqual(['charmander-1']);
    // Nobody pressed anything: the container fills itself with the party's
    // best, which is the whole point of it filling itself.
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
    // Where to drop in is its own step now, and it stands between the loadout
    // and the confirmation: a raid can no more start from it than from the kit.
    expect(flow.step).toBe('dropin');
    expect(() => flow.deploy()).toThrow(/confirmed loadout/);
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
    expect(flow.step).toBe('dropin');
  });

  it('still deploys a fainted Pokemon alongside one that can fight', () => {
    const { flow, stash } = seedFlow();
    const fainted = stash.listPokemon().find((stored) => stored.id === 'charmander-1')!.pokemon;
    fainted.takeDamage(fainted.maxHp);

    flow.togglePokemon('charmander-1');
    flow.togglePokemon('bulbasaur-1');

    expect(flow.isDeployable).toBe(true);
    expect(flow.advance()).toBeUndefined();
    expect(flow.advance()).toBeUndefined();
    expect(flow.deploy().party.map((stored) => stored.id)).toEqual(['charmander-1', 'bulbasaur-1']);
  });

  it('deploys exactly the party, supplies, insertion and secure slot that were confirmed', () => {
    const { stash } = seedFlow();
    // A grown container, because a 2x2 one holds a first-stage Pokemon and
    // nothing else - which is its own test, below.
    const flow = new DeploymentFlow(stash, 'floodplain-relay', {
      pokemon: 1,
      secureGrid: { width: 3, height: 2 },
    });

    emptied(flow);
    flow.togglePokemon('charmander-1');
    flow.togglePokemon('bulbasaur-1');
    flow.adjustItem('potion', 2);
    flow.adjustItem('poke-ball', 1);
    flow.chooseInsertion('viridian-forest');
    flow.openSecureSlot();
    flow.adjustSecureItem('potion', 2);
    // Out of the secure detour, on to the drop-in, then to the confirmation.
    flow.advance();
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

  /**
   * The captain's addition of 2026-09-19: the container fills itself, Pokemon
   * first and by level, so nobody ever deploys with their best unprotected
   * because they did not open a screen.
   */
  it('fills itself with the highest-level Pokemon when the player never opens the secure slot', () => {
    const { flow } = seedFlow();

    flow.togglePokemon('bulbasaur-1');
    flow.togglePokemon('charmander-1');
    flow.advance();
    flow.advance();

    // Charmander is level 7 against Bulbasaur's 5, and four squares fill the
    // base container, so it is the one and only thing protected.
    expect(flow.deploy().stashSecureSlot).toEqual({
      pokemonIds: ['charmander-1'],
      items: [],
    });
    expect(flow.secureCells).toEqual({ used: 4, total: 4 });
    expect(flow.securePreference).toEqual({ pokemon: true, items: [] });
  });

  it('is a default and not a cage: letting the Pokemon go frees the container for gear', () => {
    const { flow } = seedFlow();

    flow.togglePokemon('charmander-1');
    flow.adjustItem('potion', 3);
    expect(flow.securesPokemon('charmander-1')).toBe(true);
    // Four squares of four: nothing else goes in, and the refusal says why.
    expect(flow.adjustSecureItem('potion', 1)).toMatch(/CHARMANDER/);

    expect(flow.toggleSecurePokemon('charmander-1')).toBeUndefined();
    expect(flow.adjustSecureItem('potion', 1)).toBeUndefined();
    // And the choice is what is remembered for next raid, not the default.
    expect(flow.securePreference).toEqual({
      pokemon: false,
      items: [{ itemId: 'potion', quantity: 1 }],
    });
  });

  it('says in squares why an evolved Pokemon will not go into a container that has not grown', () => {
    const stash = createStartingStash();
    stash.addPokemon(new Pokemon(IVYSAUR, 16), 'ivysaur-1');
    const flow = new DeploymentFlow(stash);

    flow.togglePokemon('ivysaur-1');
    // Six squares against four: the auto-fill leaves it out rather than
    // pretending, and pressing it says the number.
    expect(flow.securedPokemon).toEqual([]);
    expect(flow.toggleSecurePokemon('ivysaur-1')).toMatch(/IVYSAUR needs 6 squares/);

    const grown = new DeploymentFlow(stash, 'floodplain-relay', {
      pokemon: 1,
      secureGrid: { width: 3, height: 2 },
    });
    grown.togglePokemon('ivysaur-1');
    expect(grown.securedPokemon.map(({ id }) => id)).toEqual(['ivysaur-1']);
  });

  it('starts the next raid from what the container held last time', () => {
    const { stash } = seedFlow();
    const flow = new DeploymentFlow(
      stash,
      'floodplain-relay',
      { pokemon: 1, secureGrid: { width: 3, height: 2 } },
      { pokemon: true, items: [{ itemId: 'potion', quantity: 2 }] },
    );

    flow.togglePokemon('charmander-1');
    flow.adjustItem('potion', 3);

    // Pokemon first, then the remembered Potions in what is left.
    expect(flow.securedPokemon.map(({ id }) => id)).toEqual(['charmander-1']);
    expect(flow.securedItems).toEqual([{ itemId: 'potion', quantity: 2 }]);
  });

  it('never lets a remembered supply keep a Pokemon out', () => {
    const { flow } = seedFlow();
    const remembered = new DeploymentFlow(
      createStartingStash(),
      'floodplain-relay',
      { pokemon: 1, secureGrid: BASE_SECURE_GRID },
      { pokemon: true, items: [{ itemId: 'potion', quantity: 4 }] },
    );

    remembered.adjustItem('potion', 3);
    remembered.togglePokemon('bulbasaur-1');

    expect(remembered.securedPokemon.map(({ id }) => id)).toEqual(['bulbasaur-1']);
    expect(remembered.securedItems).toEqual([]);
    expect(flow.securedItems).toEqual([]);
  });

  it('caps the party at six and the secure slot at one Pokemon and two stacks', () => {
    const stash = createStartingStash();
    const ids = ['bulbasaur-1'];
    for (let index = 0; index < 6; index += 1) {
      ids.push(stash.addPokemon(new Pokemon(SQUIRTLE, 5)));
    }
    // A container two columns grown, so one Pokemon and two stacks all fit and
    // the caps under test are the caps rather than the squares.
    const flow = new DeploymentFlow(stash, 'floodplain-relay', {
      pokemon: 1,
      secureGrid: { width: 4, height: 2 },
    });

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

  /**
   * A playtest found this and only a playtest could have: a raid that carried
   * ₽40 out, with the money's own row in the container, came home with
   * one Pokedollar. The container is measured in squares and the money stacks a
   * bundle to a square, so a press has to reserve the whole square.
   */
  it('reserves a whole square of a stacked kind, not one of it', () => {
    const { flow } = seedFlow();
    flow.togglePokemon('charmander-1');
    flow.openSecureSlot();
    // The container filled itself with the Charmander; this test is about the
    // squares a stacked kind takes, so the player takes it back out first.
    flow.toggleSecurePokemon('charmander-1');

    expect(flow.adjustSecureItem('money', 1)).toBeUndefined();
    expect(flow.secureQuantity('money')).toBe(stackSizeOf('money'));
    expect(blocksFor('money', flow.secureQuantity('money'))).toBe(1);
    // And it is still one square of the container, not a stack of them.
    expect(flow.secureCells.used).toBe(1);

    // A second press is a second square, and taking one out takes a square out.
    expect(flow.adjustSecureItem('money', 1)).toBeUndefined();
    expect(flow.secureCells.used).toBe(2);
    flow.adjustSecureItem('money', -1);
    expect(flow.secureQuantity('money')).toBe(stackSizeOf('money'));

    // Everything a square holds one of is unchanged: a press is still one.
    flow.adjustItem('potion', 2);
    flow.adjustSecureItem('potion', 1);
    expect(flow.secureQuantity('potion')).toBe(1);
  });

  it('drops protection when the protected Pokemon or supplies leave the loadout', () => {
    const { stash } = seedFlow();
    const flow = new DeploymentFlow(stash, 'floodplain-relay', {
      pokemon: 1,
      secureGrid: { width: 3, height: 2 },
    });

    emptied(flow);
    flow.togglePokemon('charmander-1');
    flow.adjustItem('potion', 2);
    flow.openSecureSlot();
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
    flow.advance();
    flow.openSecureSlot();

    expect(flow.secureReturnStep).toBe('confirm');
    expect(flow.retreat()).toBe(true);
    expect(flow.step).toBe('confirm');
    expect(flow.retreat()).toBe(true);
    expect(flow.step).toBe('dropin');
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
    // Two Pokemon are eight squares, so the two-slot locker needs the columns
    // to go with it: 4x2 is the smallest container that can use both.
    const flow = new DeploymentFlow(stash, 'floodplain-relay', { pokemon: 2, secureGrid: { width: 4, height: 2 } });
    for (const id of ['bulbasaur-1', 'charmander-1', 'squirtle-1']) {
      flow.togglePokemon(id);
    }
    // The container filled itself; this test is about the slot moving under
    // the player's own presses, so it starts from an empty one.
    for (const stored of [...flow.securedPokemon]) {
      flow.toggleSecurePokemon(stored.id);
    }
    for (const id of ['bulbasaur-1', 'charmander-1', 'squirtle-1']) {
      flow.toggleSecurePokemon(id);
    }
    // A third pick lets go of the first rather than refusing the click.
    expect(flow.securedPokemon.map(({ id }) => id)).toEqual(['charmander-1', 'squirtle-1']);

    flow.advance();
    flow.advance();
    const deployment = flow.deploy();
    expect(deployment.stashSecureSlot.pokemonIds).toEqual(['charmander-1', 'squirtle-1']);
    expect(deployment.secureSlot.pokemon).toHaveLength(2);

    // A secured Pokemon that leaves the party stops holding a slot.
    flow.togglePokemon('squirtle-1');
    expect(flow.securedPokemon.map(({ id }) => id)).toEqual(['charmander-1']);
  });

  it('never packs a material, but lets the secure slot name its kind', () => {
    const { flow: seeded, stash } = seedFlow();
    const flow = emptied(seeded);
    stash.addItem('radio-valve', 2);
    flow.togglePokemon('bulbasaur-1');
    // Squares for a material means squares the Pokemon is not standing on.
    flow.toggleSecurePokemon('bulbasaur-1');

    flow.adjustItem('radio-valve', 1);
    expect(flow.items).toEqual([]);

    // A material is found rather than brought, so the container keeps room for
    // it: two squares of a four-square container, for one radio valve.
    expect(flow.adjustSecureItem('radio-valve', 1)).toBeUndefined();
    expect(flow.securesItem('radio-valve')).toBe(true);
    expect(flow.securedItems).toEqual([{ itemId: 'radio-valve', quantity: 1 }]);
    flow.advance();
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
    const { flow: seeded, stash } = seedFlow();
    const flow = emptied(seeded);
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
   * deep - so six of them stand a column apiece and the bottom row is left.
   * That row used to be the end of it: only one-square things could use it, and
   * the seventh Super Potion was refused with six squares free. It can lie down
   * now, so the pack fills exactly, which is what twice the heal for twice the
   * room ought to have meant all along.
   */
  it('measures a Super Potion at two squares, and lets it lie down to use the last row', () => {
    const { flow: seeded, stash } = seedFlow();
    const flow = emptied(seeded);
    stash.addItem('super-potion', 20);
    stash.addItem('potion', 20);
    for (let index = 0; index < 6; index += 1) {
      expect(flow.adjustItem('super-potion', 1)).toBeUndefined();
    }
    expect(flow.bagCells).toEqual({ used: 12, total: 18 });

    // Three more lie flat across the bottom row, and the tenth has nowhere.
    for (let index = 0; index < 3; index += 1) {
      expect(flow.adjustItem('super-potion', 1)).toBeUndefined();
    }
    expect(flow.bagCells).toEqual({ used: 18, total: 18 });
    expect(flow.adjustItem('super-potion', 1)).toMatch(/No room/);
    expect(flow.adjustItem('potion', 1)).toMatch(/No room/);
  });

  describe('counts', () => {
    it('packs a whole number at once, and stops at what the pack will hold', () => {
      const { flow, stash } = seedFlow();
      stash.addItem('potion', 60);
      const limit = flow.packLimit('potion');

      expect(limit).toBeGreaterThan(0);
      expect(limit).toBeLessThan(stash.itemCount('potion'));
      expect(flow.setItemQuantity('potion', 3)).toBeUndefined();
      expect(flow.itemQuantity('potion')).toBe(3);
      // Asking for more than fits is met as far as it can be, never refused
      // outright, and never past the number the selector showed.
      expect(flow.setItemQuantity('potion', 999)).toBeUndefined();
      expect(flow.itemQuantity('potion')).toBe(limit);
      expect(flow.adjustItem('potion', 1)).toMatch(/No room in the pack/);
      expect(flow.setItemQuantity('potion', 0)).toBeUndefined();
      expect(flow.itemQuantity('potion')).toBe(0);
    });

    it('cuts a supply\'s limit by what else is packed, and never above what the base holds', () => {
      const { flow, stash } = seedFlow();
      const held = stash.itemCount('poke-ball');
      expect(flow.packLimit('poke-ball')).toBeLessThanOrEqual(held);
      stash.addItem('potion', 60);
      const alone = flow.packLimit('potion');
      flow.setItemQuantity('poke-ball', held);
      expect(flow.packLimit('potion')).toBeLessThanOrEqual(alone);
    });

    it('seats a number of squares in the container, or as many as fit', () => {
      const { flow, stash } = seedFlow();
      stash.addItem('potion', 60);
      flow.setItemQuantity('potion', flow.packLimit('potion'));
      const limit = flow.secureLimit('potion');

      expect(limit).toBeLessThanOrEqual(gridCells(flow.secureGrid));
      expect(flow.setSecureSquares('potion', 999)).toBeUndefined();
      expect(blocksFor('potion', flow.secureQuantity('potion'))).toBe(limit);
      expect(flow.setSecureSquares('potion', 0)).toBeUndefined();
      expect(flow.secureQuantity('potion')).toBe(0);
    });

    it('will not secure what was never packed, and says why', () => {
      const flow = emptied(seedFlow().flow);
      expect(flow.secureLimit('potion')).toBe(0);
      expect(flow.setSecureSquares('potion', 2)).toMatch(/Pack some of this first/);
    });
  });
});

/**
 * The captain, 2026-09-23, on a playtest that lost its first fight with an
 * empty bag: "put the stash's medicine in the pack by default". A default and
 * never a cage, like the pack worn and the secure container filling itself.
 */
describe('medicine packed by default', () => {
  it('packs a fresh save\'s Potions, so a first raid is not deployed with an empty bag', () => {
    const { flow } = seedFlow();

    expect(flow.itemQuantity('potion')).toBe(3);
    expect(flow.isPrepacked('potion')).toBe(true);
    // Only medicine: a Poke Ball is a choice about what the raid is for.
    expect(flow.itemQuantity('poke-ball')).toBe(0);
  });

  it('packs no more than half the pack, so a full vault still leaves room for a find', () => {
    const { stash } = seedFlow();
    stash.addItem('potion', 40);
    stash.addItem('super-potion', 10);
    const flow = new DeploymentFlow(stash);

    expect(flow.bagCells.used).toBeLessThanOrEqual(gridCells(flow.bagGrid) * MEDICINE_PREPACK_SHARE);
    expect(flow.bagCells.used).toBeGreaterThan(0);
  });

  it('is the player\'s to change: taking it out keeps it out, and the row stops saying it was packed for them', () => {
    const { flow } = seedFlow();

    expect(flow.setItemQuantity('potion', 1)).toBeUndefined();
    expect(flow.isPrepacked('potion')).toBe(false);
    expect(flow.setItemQuantity('potion', 0)).toBeUndefined();
    expect(flow.items).toEqual([]);
  });

  /**
   * The trap the default could have set: a player who never chose those
   * Potions being told the Satchel "holds 12 squares - take something out
   * first". What the default packed is packed again for the new pack instead.
   */
  it('packs again for a smaller pack rather than standing in the way of it', () => {
    const { stash } = seedFlow();
    stash.addItem('hauler-frame', 1);
    stash.addItem('satchel', 1);
    stash.addItem('potion', 30);
    const flow = new DeploymentFlow(stash);
    expect(flow.packItemId).toBe('hauler-frame');
    expect(flow.itemQuantity('potion')).toBe(15);

    expect(flow.packChoices.find((choice) => choice.itemId === 'satchel')?.wouldNotHold).toBeUndefined();
    expect(flow.choosePack('satchel')).toBeUndefined();
    expect(flow.itemQuantity('potion')).toBe(6);
    expect(flow.isPrepacked('potion')).toBe(true);
    expect(flow.choosePack('hauler-frame')).toBeUndefined();
    expect(flow.itemQuantity('potion')).toBe(15);
  });

  it('never re-packs over a count the player chose', () => {
    const { stash } = seedFlow();
    stash.addItem('hauler-frame', 1);
    stash.addItem('satchel', 1);
    stash.addItem('potion', 30);
    const flow = new DeploymentFlow(stash);
    flow.setItemQuantity('potion', 14);

    expect(flow.choosePack('satchel')).toMatch(/Satchel holds 12 squares/);
    flow.setItemQuantity('potion', 2);
    expect(flow.choosePack('satchel')).toBeUndefined();
    expect(flow.itemQuantity('potion')).toBe(2);
  });
});
