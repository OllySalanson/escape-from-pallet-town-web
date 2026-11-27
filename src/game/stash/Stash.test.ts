import { describe, expect, it } from 'vitest';
import { Bag } from '../items';
import { BULBASAUR, CHARIZARD, CHARMANDER, CHARMELEON, PIDGEY, Pokemon, PokemonParty, SQUIRTLE } from '../pokemon';
import { PrimaryStatus } from '../pokemon/battle/status';
import { SaveManager, type StorageLike } from '../save/SaveManager';
import { createStartingStash, MINIMUM_SUPPLIES, STARTING_SUPPLIES, Stash, starterInConditionOf } from './Stash';

class MemoryStorage implements StorageLike {
  private readonly values = new Map<string, string>();

  public getItem(key: string): string |null {
    return this.values.get(key) ?? null;
  }

  public setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  public removeItem(key: string): void {
    this.values.delete(key);
  }
}

describe('Stash', () => {
  it('adds, lists, and removes Pokemon and item stacks', () => {
    const stash = new Stash();
    const charmander = new Pokemon(CHARMANDER, 5);

    stash.addPokemon(charmander, 'starter');
    expect(stash.addItem('poke-ball', 3)).toBe(true);
    expect(stash.listPokemon()).toEqual([{ id: 'starter', pokemon: charmander }]);
    expect(stash.listItems()).toEqual({ 'poke-ball': 3 });

    expect(stash.removePokemon('starter')).toBe(charmander);
    expect(stash.removeItem('poke-ball', 2)).toBe(true);
    expect(stash.listPokemon()).toEqual([]);
    expect(stash.listItems()).toEqual({ 'poke-ball': 1 });
  });

  it.each([BULBASAUR, CHARMANDER, SQUIRTLE])('grants the selected %s starter and supplies only once', (starter) => {
    const stash = new Stash();

    expect(stash.ensurePlayable(starter)).toBe(true);
    expect(stash.ensurePlayable(starter)).toBe(false);
    expect(stash.listPokemon()).toMatchObject([{ pokemon: { base: { id: starter.id }, level: 5 } }]);
    // The kit, and something to carry it in: a vault with no pack cannot raid.
    expect(stash.listItems()).toEqual({ 'poke-ball': 2, potion: 1, satchel: 1 });
  });

  it('leaves existing Pokemon and supplies completely unchanged', () => {
    const stash = new Stash();
    stash.addPokemon(new Pokemon(CHARMANDER, 5), 'charmander-1');
    stash.addItem('potion', 2);
    const contents = stash.toJSON();

    expect(stash.ensurePlayable()).toBe(false);
    expect(stash.toJSON()).toEqual(contents);
  });

  it('tops partial supplies back up to the minimum when it re-grants a starter', () => {
    const stash = new Stash({ items: { 'poke-ball': 1 } });

    expect(stash.ensurePlayable()).toBe(true);
    expect(stash.listPokemon()).toMatchObject([{ pokemon: { base: { id: 'bulbasaur' }, level: 5 } }]);
    expect(stash.listItems()).toEqual(MINIMUM_SUPPLIES);
  });

  it('re-grants a full supply alongside a starter when only an unrelated item survived', () => {
    const stash = new Stash({ items: { antidote: 1 } });

    expect(stash.ensurePlayable()).toBe(true);
    expect(stash.listItems()).toEqual({ antidote: 1, ...MINIMUM_SUPPLIES });
  });

  it('tops up only what the kit is short of, without ever reducing a larger hoard', () => {
    const stash = new Stash({ items: { 'poke-ball': 12 } });

    expect(stash.supplyShortfall()).toEqual({ potion: 1, satchel: 1 });
    expect(stash.restockMinimumSupplies()).toBe(true);
    expect(stash.listItems()).toEqual({ 'poke-ball': 12, potion: 1, satchel: 1 });

    // Repeating it adds nothing, so the restock cannot be farmed.
    expect(stash.supplyShortfall()).toEqual({});
    expect(stash.restockMinimumSupplies()).toBe(false);
    expect(stash.listItems()).toEqual({ 'poke-ball': 12, potion: 1, satchel: 1 });
  });

  /**
   * The overnight critic's problem 11 (25 Nov 2026): one Potion and one Poké
   * Ball before a wipe, three and five after it, so losing was the cheapest
   * shop in the game. The kit is only what a raid cannot be played without, and
   * a new save is given more than it - so no save is ever topped up past where
   * it started.
   */
  it('hands a wiped player less than a new save is given, and never more than one Potion', () => {
    const stash = new Stash({ items: { potion: 1, 'poke-ball': 1 } });
    stash.restockMinimumSupplies();
    expect(stash.itemCount('potion')).toBe(1);
    expect(stash.itemCount('poke-ball')).toBe(2);
    for (const [itemId, quantity] of Object.entries(MINIMUM_SUPPLIES)) {
      expect(quantity, itemId).toBeLessThanOrEqual(STARTING_SUPPLIES[itemId] ?? 1);
    }
    expect(createStartingStash().listItems()).toMatchObject(STARTING_SUPPLIES);
  });

  /**
   * The restock is for a player who cannot attempt a raid. One holding four
   * Super Potions and a handful of Great Balls can, and used to be handed two
   * Potions and five Poke Balls on every wipe regardless.
   */
  it('gives nothing to a player whose better supplies already cover the kit', () => {
    const items = { potion: 1, 'super-potion': 4, 'great-ball': 3, 'poke-ball': 2, 'ranger-pack': 1 };
    const stash = new Stash({ items });

    expect(stash.supplyShortfall()).toEqual({});
    expect(stash.restockMinimumSupplies()).toBe(false);
    expect(stash.listItems()).toEqual(items);
  });

  it('counts a better item towards the kit, and only the shortfall is basic stock', () => {
    const stash = new Stash({ items: { 'super-potion': 1, 'great-ball': 4, 'hauler-frame': 1 } });

    // A Super Potion is the kit's Potion and the Great Balls its Poké Balls.
    expect(stash.restockMinimumSupplies()).toBe(false);
    // A Hauler frame answers the kit's pack line, so no Satchel is handed out:
    // the kit is a capability, and that is as true of the pack as of the balls.
    expect(stash.listItems()).toEqual({
      'super-potion': 1,
      'great-ball': 4,
      'hauler-frame': 1,
    });
  });

  it('does not mistake an Antidote for a way to heal', () => {
    const stash = new Stash({ items: { antidote: 9 } });

    expect(stash.supplyShortfall()).toEqual(MINIMUM_SUPPLIES);
  });

  it.each([BULBASAUR, CHARMANDER, SQUIRTLE])('swaps a sole Pokemon for a level 5 %s and hands over no supplies', (starter) => {
    const stash = new Stash({ items: { potion: 2 } });
    stash.addPokemon(new Pokemon(PIDGEY, 21), 'survivor');

    expect(stash.canSwapStarter()).toBe(true);
    expect(stash.swapStarter(starter)).toBe(true);
    expect(stash.listPokemon()).toMatchObject([
      { id: `${starter.id}-1`, pokemon: { base: { id: starter.id }, level: 5 } },
    ]);
    // The kit is the wipe's guarantee, not the swap's: a vault short of it
    // stays short, or every swap is a restock.
    expect(stash.listItems()).toEqual({ potion: 2 });
  });

  it('is not a heal or a restock: the playtest-3 side door (1/17 HP, no Potions, 4 Poke Balls)', () => {
    const stash = new Stash({ items: { 'poke-ball': 4 } });
    const squirtle = new Pokemon(SQUIRTLE, 5);
    squirtle.takeDamage(squirtle.maxHp - 1);
    stash.addPokemon(squirtle, 'squirtle-1');

    expect(stash.swapStarter(CHARMANDER)).toBe(true);

    const [{ pokemon: charmander }] = stash.listPokemon();
    expect(charmander.currentHp).toBe(1);
    expect(stash.listItems()).toEqual({ 'poke-ball': 4 });

    // Swapping back for the original species is no better.
    expect(stash.swapStarter(SQUIRTLE)).toBe(true);
    expect(stash.listPokemon()[0].pokemon.currentHp).toBe(1);
    expect(stash.listItems()).toEqual({ 'poke-ball': 4 });
  });

  it('carries the status and the fainted state across a swap, so the bay is still owed', () => {
    const poisoned = new Pokemon(BULBASAUR, 9);
    poisoned.takeDamage(Math.floor(poisoned.maxHp / 2));
    poisoned.primaryStatus = PrimaryStatus.Poison;
    const incoming = starterInConditionOf(poisoned, CHARMANDER);
    expect(incoming.primaryStatus).toBe(PrimaryStatus.Poison);
    expect(incoming.currentHp / incoming.maxHp).toBeLessThanOrEqual(poisoned.currentHp / poisoned.maxHp);
    expect(incoming.currentHp).toBeGreaterThan(0);

    const fainted = new Pokemon(SQUIRTLE, 5);
    fainted.takeDamage(fainted.maxHp);
    expect(starterInConditionOf(fainted, BULBASAUR).isFainted).toBe(true);

    const fit = new Pokemon(PIDGEY, 21);
    const fresh = starterInConditionOf(fit, SQUIRTLE);
    expect(fresh.currentHp).toBe(fresh.maxHp);
    expect(fresh.primaryStatus).toBeNull();
  });

  it('never gains health however many times a partner is swapped', () => {
    const stash = new Stash();
    const bulbasaur = new Pokemon(BULBASAUR, 5);
    bulbasaur.takeDamage(7);
    stash.addPokemon(bulbasaur, 'bulbasaur-1');

    let share = bulbasaur.currentHp / bulbasaur.maxHp;
    for (const starter of [CHARMANDER, SQUIRTLE, BULBASAUR, SQUIRTLE, CHARMANDER, BULBASAUR]) {
      expect(stash.swapStarter(starter)).toBe(true);
      const { pokemon } = stash.listPokemon()[0];
      expect(pokemon.currentHp / pokemon.maxHp).toBeLessThanOrEqual(share);
      share = pokemon.currentHp / pokemon.maxHp;
    }
  });

  it('refuses to swap a starter while more than one Pokemon remains', () => {
    const stash = new Stash();
    stash.addPokemon(new Pokemon(CHARMANDER, 12), 'charmander-1');
    stash.addPokemon(new Pokemon(PIDGEY, 4), 'pidgey-1');
    const contents = stash.toJSON();

    expect(stash.canSwapStarter()).toBe(false);
    expect(stash.swapStarter(SQUIRTLE)).toBe(false);
    expect(stash.toJSON()).toEqual(contents);
  });

  it('refuses to swap a starter when no Pokemon remain', () => {
    const stash = new Stash();

    expect(stash.canSwapStarter()).toBe(false);
    expect(stash.swapStarter(SQUIRTLE)).toBe(false);
    expect(stash.listPokemon()).toEqual([]);
  });

  it('recovers a worn Pokemon to full health and clears its status', () => {
    const stash = new Stash({ items: { potion: 2 } });
    const charmander = new Pokemon(CHARMANDER, 7);
    charmander.takeDamage(charmander.maxHp - 3);
    charmander.primaryStatus = PrimaryStatus.Poison;
    stash.addPokemon(charmander, 'charmander-1');

    expect(stash.recoverPokemon('charmander-1')).toBe(true);
    expect(charmander.currentHp).toBe(charmander.maxHp);
    expect(charmander.primaryStatus).toBeNull();
    // Recovery is paid for in raid time, so it neither spends nor mints supplies.
    expect(stash.listItems()).toEqual({ potion: 2 });
  });

  it('revives a Pokemon that came home fainted, the state nothing else could undo', () => {
    const stash = new Stash();
    const survivor = new Pokemon(PIDGEY, 6);
    survivor.takeDamage(survivor.maxHp);
    stash.addPokemon(survivor, 'pidgey-1');

    expect(survivor.isFainted).toBe(true);
    expect(stash.recoverPokemon('pidgey-1')).toBe(true);
    expect(survivor.isFainted).toBe(false);
    expect(survivor.currentHp).toBe(survivor.maxHp);
  });

  it('reports nothing to do for a fit Pokemon or an unknown ID', () => {
    const stash = new Stash();
    stash.addPokemon(new Pokemon(CHARMANDER, 5), 'charmander-1');
    const contents = stash.toJSON();

    expect(stash.recoverPokemon('charmander-1')).toBe(false);
    expect(stash.recoverPokemon('nobody')).toBe(false);
    expect(stash.toJSON()).toEqual(contents);
  });

  it('persists the stash and banks extraction rewards', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    const stash = new Stash();
    stash.addPokemon(new Pokemon(CHARMANDER, 5), 'starter');
    stash.addItem('potion', 1);
    saves.save({
      party: new PokemonParty([new Pokemon(CHARMANDER, 5)]),
      mapId: 'pallet-town',
      position: { x: 1, y: 1 },
      bag: new Bag(),
      stash,
    });

    expect(
      saves.bankRun({
        pokemon: [new Pokemon(PIDGEY, 4)],
        items: [{ itemId: 'poke-ball', quantity: 2 }],
      }),
    ).toBe(true);

    const restored = saves.load();
    expect(restored?.stash.listPokemon()).toMatchObject([
      { id: 'starter', pokemon: { base: { id: 'charmander' } } },
      { pokemon: { base: { id: 'pidgey' }, level: 4 } },
    ]);
    // The Raid pack every save is issued on load, beside the banked haul.
    expect(restored?.stash.listItems()).toEqual({ potion: 1, 'poke-ball': 2, 'raid-pack': 1 });
  });

  it('keeps only secured deployed assets on a wipe', () => {
    const storage = new MemoryStorage();
    const saves = new SaveManager(storage);
    const stash = new Stash();
    stash.addPokemon(new Pokemon(CHARMANDER, 5), 'secured');
    stash.addPokemon(new Pokemon(PIDGEY, 4), 'lost');
    stash.addPokemon(new Pokemon(PIDGEY, 3), 'home');
    stash.addItem('poke-ball', 5);
    stash.addItem('potion', 3);
    saves.save({
      party: new PokemonParty([new Pokemon(CHARMANDER, 5)]),
      mapId: 'pallet-town',
      position: { x: 1, y: 1 },
      bag: new Bag(),
      stash,
    });

    expect(
      saves.applyWipeLoss(
        ['secured', 'lost'],
        [
          { itemId: 'poke-ball', quantity: 4 },
          { itemId: 'potion', quantity: 2 },
        ],
        {
          pokemonIds: ['secured'],
          items: [{ itemId: 'poke-ball', quantity: 1 }, { itemId: 'potion', quantity: 2 }],
        },
      ),
    ).toBe(true);

    const restored = saves.load();
    expect(restored?.stash.listPokemon().map(({ id }) => id)).toEqual(['secured', 'home']);
    // Three unsecured Poké Balls are gone for good, then the wipe tops the
    // survivor back up to the minimum needed to attempt another run - which
    // includes a pack, because a vault with none cannot deploy at all.
    expect(restored?.stash.listItems()).toEqual({ 'poke-ball': 2, potion: 3, 'raid-pack': 1 });
  });

  /**
   * The hunt of 11 Nov 2026, finding 1, end to end through the save: a
   * Charmeleon partner, a level-6 catch in the 2x2 container, the raid lost.
   * The partner used to be deleted for good. It has a place of its own now
   * (the captain's call, option B), kept by the vault's own mark, which counts
   * against neither the container's Pokemon nor its squares.
   */
  it('never lets a wipe take the partner, evolved or not, and keeps the container\'s Pokemon as well', () => {
    for (const species of [CHARMANDER, CHARMELEON, CHARIZARD]) {
      const storage = new MemoryStorage();
      const saves = new SaveManager(storage);
      const stash = new Stash();
      const partnerId = stash.addPokemon(new Pokemon(species, 36), 'charmander-1');
      stash.addPokemon(new Pokemon(PIDGEY, 6), 'pidgey-1');
      stash.addPokemon(new Pokemon(PIDGEY, 4), 'lost');
      stash.adoptPartner(partnerId);
      saves.save({
        party: new PokemonParty([]),
        mapId: 'pallet-town',
        position: { x: 1, y: 1 },
        bag: new Bag(),
        stash,
      });

      // The slot names only the container: nothing about the partner is passed.
      expect(saves.applyWipeLoss(['charmander-1', 'pidgey-1', 'lost'], [], { pokemonIds: ['pidgey-1'] })).toBe(true);

      const restored = saves.load();
      expect(restored?.stash.listPokemon().map(({ id }) => id)).toEqual(['charmander-1', 'pidgey-1']);
      expect(restored?.stash.partnerId()).toBe('charmander-1');
      expect(restored?.stash.partner()?.pokemon.base.id).toBe(species.id);
    }
  });

  it('keeps the partner out of the container\'s count, so a slot naming it protects nobody else less', () => {
    const stash = new Stash();
    stash.addPokemon(new Pokemon(CHARMELEON, 16), 'partner');
    stash.addPokemon(new Pokemon(PIDGEY, 5), 'catch');
    stash.adoptPartner('partner');

    // An old slot that listed the partner first still protects the one Pokemon
    // the container holds, and the partner is safe in its own place.
    stash.applyWipeLoss(['partner', 'catch'], [], { pokemonIds: ['partner', 'catch'] }, { pokemon: 1, grid: { width: 2, height: 2 } });
    expect(stash.listPokemon().map(({ id }) => id)).toEqual(['partner', 'catch']);
  });

  it('protects exactly as much on a wipe as the limits it is told, never a hard-coded two', () => {
    const build = (): Stash => {
      const stash = new Stash({ items: { potion: 2, 'poke-ball': 2, antidote: 2, 'great-ball': 2 } });
      stash.addPokemon(new Pokemon(CHARMANDER, 5), 'first');
      stash.addPokemon(new Pokemon(PIDGEY, 5), 'second');
      return stash;
    };
    const brought = ['potion', 'poke-ball', 'antidote', 'great-ball'].map((itemId) => ({ itemId, quantity: 2 }));
    const secureSlot = { pokemonIds: ['first', 'second'], items: brought };

    const base = build();
    base.applyWipeLoss(['first', 'second'], brought, secureSlot);
    expect(base.listPokemon().map(({ id }) => id)).toEqual(['first']);
    expect(base.listItems()).toEqual({ potion: 2, 'poke-ball': 2 });

    const upgraded = build();
    upgraded.applyWipeLoss(['first', 'second'], brought, secureSlot, { pokemon: 2, grid: { width: 4, height: 2 } });
    expect(upgraded.listPokemon().map(({ id }) => id)).toEqual(['first', 'second']);
    expect(upgraded.listItems()).toEqual({ potion: 2, 'poke-ball': 2, antidote: 2, 'great-ball': 2 });
  });

  /**
   * The container is the last word on what a wipe honours, whoever built the
   * slot. The loadout screen already cuts it, but the stash is the thing that
   * actually deletes, so it packs the slot itself rather than trusting a count.
   */
  it('keeps only what the container holds, dropping the entry that overflows it', () => {
    const stash = new Stash({ items: { potion: 3, 'poke-ball': 3 } });
    stash.addPokemon(new Pokemon(CHARMANDER, 5), 'first');
    const brought = [
      { itemId: 'potion', quantity: 3 },
      { itemId: 'poke-ball', quantity: 3 },
    ];

    // Six one-square supplies named for a four-square container: the Potions
    // fit, and the balls are the entry that does not.
    stash.applyWipeLoss(['first'], brought, { items: brought });

    // The kit restock is a later step, so what the wipe itself left is exact.
    expect(stash.listItems()).toEqual({ potion: 3 });
  });

  it('brings a secured material home from a wipe and takes no other found one', () => {
    const stash = new Stash({ items: { potion: 1, 'radio-valve': 1 } });
    stash.addPokemon(new Pokemon(BULBASAUR, 5), 'first');

    // The caller has cut the slot to what the pack still held: two valves.
    stash.applyWipeLoss(['first'], [{ itemId: 'potion', quantity: 1 }], {
      items: [{ itemId: 'radio-valve', quantity: 2 }],
    });

    expect(stash.itemCount('radio-valve')).toBe(3);
    expect(stash.itemCount('potion')).toBe(0);
    expect(stash.itemCount('mooring-rope')).toBe(0);
  });
});

describe('THE CHEST keeps one order, and no boxes', () => {
  const ids = (stash: Stash): readonly string[] => stash.listPokemon().map(({ id }) => id);

  it('keeps Pokémon in the order they came home, as many as come', () => {
    const stash = new Stash();
    for (let index = 0; index < 45; index += 1) {
      stash.addPokemon(new Pokemon(PIDGEY, 3), `p-${index}`);
    }
    expect(ids(stash)).toHaveLength(45);
    expect(ids(stash)[0]).toBe('p-0');
    expect(ids(stash)[44]).toBe('p-44');
  });

  it("reads an old save's boxes once, for their order: box one first, each in its own order, then anybody no box named", () => {
    const pokemon = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ id, pokemon: new Pokemon(PIDGEY, 3) }));
    const stash = new Stash({
      pokemon,
      boxes: [
        { name: 'Box 1', pokemonIds: ['c', 'ghost', 'a'] },
        { name: 'WATER', pokemonIds: ['e', 'c'] },
      ],
    });
    expect(ids(stash)).toEqual(['c', 'a', 'e', 'b', 'd']);
    // Nothing is lost or made up: every Pokémon the save held, once.
    expect([...ids(stash)].sort()).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('writes no boxes, and the order it writes is the order it reads back', () => {
    const pokemon = ['a', 'b', 'c'].map((id) => ({ id, pokemon: new Pokemon(PIDGEY, 3) }));
    const stash = new Stash({ pokemon, boxes: [{ name: 'Box 1', pokemonIds: ['b'] }, { name: 'Box 2', pokemonIds: ['c', 'a'] }] });
    const written = stash.toJSON();
    expect(written.boxes).toBeUndefined();
    expect(written.pokemon.map(({ id }) => id)).toEqual(['b', 'c', 'a']);
    expect(ids(new Stash(written))).toEqual(['b', 'c', 'a']);
  });

  it('swaps the partner in its place in the order', () => {
    const stash = new Stash();
    stash.addPokemon(new Pokemon(CHARMANDER, 5), 'partner');
    stash.adoptPartner('partner');
    expect(stash.swapStarter(SQUIRTLE)).toBe(true);
    expect(stash.listPokemon()).toHaveLength(1);
    expect(stash.partner()?.pokemon.base.id).toBe('squirtle');
  });
});
