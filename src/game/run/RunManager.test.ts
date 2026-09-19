import { describe, expect, it, vi } from 'vitest';
import { Pokemon, experienceForLevel } from '../pokemon';
import { pokemonCargoCells } from '../pokemon/pokemonCargo';
import { BULBASAUR, CHARMANDER, PIDGEY } from '../pokemon/species';
import { ENRAGE_GRACE_MS, RunManager, RunPhase, RunTransitionError } from './RunManager';

const makePokemon = (species = BULBASAUR): Pokemon => new Pokemon(species, 5);

const startRun = (manager: RunManager, party: readonly Pokemon[] = [makePokemon()]): void => {
  manager.startRun(
    { party, items: [{ itemId: 'potion', quantity: 2 }] },
    { mapId: 'pallet-town', durationMs: 60_000 },
  );
};

describe('RunManager lifecycle', () => {
  it('enforces the run lifecycle and exposes an extracting phase', () => {
    const manager = new RunManager();

    expect(manager.phase).toBe(RunPhase.InHub);
    expect(() => manager.resolveEscape()).toThrow(RunTransitionError);

    startRun(manager);
    expect(manager.beginExtraction().phase).toBe(RunPhase.Extracting);
    expect(() => manager.registerFoundItem('potion')).toThrow(RunTransitionError);

    manager.resolveEscape();
    expect(manager.phase).toBe(RunPhase.Escaped);
    expect(() =>
      manager.startRun(
        { party: [], items: [] },
        { mapId: 'pallet-town', durationMs: 1 },
      ),
    ).not.toThrow();
  });

  it('accumulates catches and quantities of found loot', () => {
    const manager = new RunManager();
    const caught = makePokemon(CHARMANDER);
    startRun(manager);

    manager.registerCaughtPokemon(caught);
    manager.registerFoundItem('potion', 2);
    manager.registerFoundItem('potion');
    manager.registerFoundItem('great-ball', 3);

    expect(manager.snapshot()).toMatchObject({
      caughtPokemon: [caught],
      foundItems: [
        { itemId: 'potion', quantity: 3 },
        { itemId: 'great-ball', quantity: 3 },
      ],
    });
  });

  it('enrages once at zero without immediately wiping the run', () => {
    const onEnrage = vi.fn();
    const onExpire = vi.fn();
    const manager = new RunManager({ onEnrage, onExpire });
    startRun(manager);

    expect(manager.tick(15_000).remainingMs).toBe(45_000);
    manager.tick(45_000);
    manager.tick(1_000);

    expect(manager.remainingMs()).toBe(0);
    expect(manager.isEnraged).toBe(true);
    expect(manager.phase).toBe(RunPhase.InRun);
    expect(onEnrage).toHaveBeenCalledTimes(1);
    expect(onEnrage).toHaveBeenCalledWith(
      expect.objectContaining({
        phase: RunPhase.InRun,
        elapsedMs: 60_000,
        remainingMs: 0,
        isEnraged: true,
      }),
    );
    expect(onExpire).not.toHaveBeenCalled();
  });

  it('allows extraction after enrage before the grace period ends', () => {
    const manager = new RunManager();
    startRun(manager);

    manager.tick(60_000);
    expect(manager.beginExtraction().phase).toBe(RunPhase.Extracting);
    expect(manager.resolveEscape().outcome).toBe('ESCAPED');
  });

  it('notifies expiry after the enrage grace window for secure-slot wiping', () => {
    const onExpire = vi.fn();
    const manager = new RunManager({ onExpire });
    const partyMember = makePokemon(BULBASAUR);
    manager.startRun(
      { party: [partyMember], items: [{ itemId: 'potion', quantity: 2 }] },
      // A Bulbasaur is four squares of the container and a Potion is a fifth,
      // so protecting both needs a container a column wider than the base.
      { mapId: 'pallet-town', durationMs: 60_000, secureGrid: { width: 3, height: 2 } },
      { pokemon: [partyMember], items: [{ itemId: 'potion', quantity: 1 }] },
    );

    manager.tick(60_000 + ENRAGE_GRACE_MS - 1);
    expect(manager.isEnrageGraceExpired).toBe(false);
    expect(onExpire).not.toHaveBeenCalled();

    manager.tick(1);
    expect(manager.isEnrageGraceExpired).toBe(true);
    expect(onExpire).toHaveBeenCalledTimes(1);
    expect(manager.resolveWipe()).toMatchObject({
      bankedPokemon: [partyMember],
      bankedItems: [{ itemId: 'potion', quantity: 1 }],
    });
    expect(manager.phase).toBe(RunPhase.Wiped);
  });

  it('banks the full loadout and found loot after a successful extraction', () => {
    const manager = new RunManager();
    const partyMember = makePokemon(BULBASAUR);
    const caught = makePokemon(CHARMANDER);
    manager.startRun(
      { party: [partyMember], items: [{ itemId: 'potion', quantity: 2 }] },
      // A caught Bulbasaur is four squares and five one-square things come
      // home beside it, so the container is three columns wider than the base.
      { mapId: 'pallet-town', durationMs: 60_000, secureGrid: { width: 5, height: 2 } },
    );
    manager.registerCaughtPokemon(caught);
    manager.registerFoundItem('potion');
    manager.registerFoundItem('great-ball', 2);

    expect(manager.resolveEscape()).toEqual({
      outcome: 'ESCAPED',
      bankedPokemon: [partyMember, caught],
      bankedItems: [
        { itemId: 'potion', quantity: 3 },
        { itemId: 'great-ball', quantity: 2 },
      ],
      lostPokemon: [],
      lostItems: [],
      permadeathPokemon: [],
    });
  });

  it('keeps only the selected secure-slot Pokemon and item stacks after a wipe', () => {
    const manager = new RunManager();
    const partyMember = makePokemon(BULBASAUR);
    const caught = makePokemon(CHARMANDER);
    const secondCaught = makePokemon(PIDGEY);
    manager.startRun(
      {
        party: [partyMember],
        items: [
          { itemId: 'potion', quantity: 2 },
          { itemId: 'poke-ball', quantity: 3 },
        ],
      },
      // A caught Bulbasaur is four squares and five one-square things come
      // home beside it, so the container is three columns wider than the base.
      { mapId: 'pallet-town', durationMs: 60_000, secureGrid: { width: 5, height: 2 } },
    );
    manager.registerCaughtPokemon(caught);
    manager.registerCaughtPokemon(secondCaught);
    manager.registerFoundItem('potion', 3);
    manager.registerFoundItem('great-ball', 2);

    expect(
      manager.resolveWipe({
        pokemon: [caught],
        items: [
          { itemId: 'potion', quantity: 4 },
          { itemId: 'great-ball', quantity: 1 },
        ],
      }),
    ).toEqual({
      outcome: 'WIPED',
      bankedPokemon: [caught],
      bankedItems: [
        { itemId: 'potion', quantity: 4 },
        { itemId: 'great-ball', quantity: 1 },
      ],
      lostPokemon: [partyMember, secondCaught],
      lostItems: [
        { itemId: 'potion', quantity: 1 },
        { itemId: 'poke-ball', quantity: 3 },
        { itemId: 'great-ball', quantity: 1 },
      ],
      permadeathPokemon: [partyMember, secondCaught],
    });
    expect(manager.phase).toBe(RunPhase.Wiped);
  });

  it('lets the secure slot name a material that was never packed, and still refuses an unpacked supply', () => {
    const start = (itemId: 'radio-valve' | 'great-ball'): unknown =>
      new RunManager().startRun(
        { party: [makePokemon()], items: [{ itemId: 'potion', quantity: 1 }] },
        { mapId: 'pallet-town', durationMs: 60_000 },
        { items: [{ itemId, quantity: 1 }] },
      );

    expect(() => start('radio-valve')).not.toThrow();
    expect(() => start('great-ball')).toThrow(/unavailable item/);
  });

  it('retains the secure slot selected when the run starts', () => {
    const manager = new RunManager();
    const partyMember = makePokemon(BULBASAUR);
    manager.startRun(
      { party: [partyMember], items: [{ itemId: 'potion', quantity: 2 }] },
      { mapId: 'pallet-town', durationMs: 60_000, secureGrid: { width: 3, height: 2 } },
      { pokemon: [partyMember], items: [{ itemId: 'potion', quantity: 1 }] },
    );

    expect(manager.snapshot().secureSlot).toEqual({
      pokemon: [partyMember],
      items: [{ itemId: 'potion', quantity: 1 }],
    });
    expect(manager.resolveWipe()).toMatchObject({
      bankedPokemon: [partyMember],
      bankedItems: [{ itemId: 'potion', quantity: 1 }],
    });
  });

  it('resolves a trainer-battle party wipe through the standard secure-slot path', () => {
    const manager = new RunManager();
    const activePokemon = makePokemon(CHARMANDER);
    const securedPokemon = makePokemon(BULBASAUR);
    manager.startRun(
      { party: [activePokemon, securedPokemon], items: [{ itemId: 'poke-ball', quantity: 2 }] },
      { mapId: 'route-1', durationMs: 60_000 },
      { pokemon: [securedPokemon] },
    );

    // BattleScene delegates any in-run all-party faint, trainer or wild, here.
    expect(manager.resolveWipe()).toMatchObject({
      outcome: 'WIPED',
      bankedPokemon: [securedPokemon],
      lostPokemon: [activePokemon],
    });
    expect(manager.phase).toBe(RunPhase.Wiped);
  });

  it('rejects secure-slot selections that do not belong to the run', () => {
    const manager = new RunManager();
    startRun(manager);

    expect(() =>
      manager.resolveWipe({ pokemon: [makePokemon(CHARMANDER)], items: [] }),
    ).toThrow('secure-slot Pokemon');
  });

  it('protects as many Pokemon as the raid was configured for, and no more', () => {
    const first = makePokemon(CHARMANDER);
    const second = makePokemon(BULBASAUR);
    const loadout = { party: [first, second, makePokemon(CHARMANDER)], items: [] };

    // Two Pokemon are eight squares, so a two-slot container has to be four
    // columns wide before the count is what limits it.
    const twoSlots = {
      mapId: 'route-1',
      durationMs: 60_000,
      securePokemonLimit: 2,
      secureGrid: { width: 4, height: 2 },
    };

    expect(() =>
      new RunManager().startRun(
        loadout,
        { ...twoSlots, securePokemonLimit: 1 },
        { pokemon: [first, second] },
      ),
    ).toThrow('at most 1 Pokemon');
    expect(() =>
      new RunManager().startRun(loadout, twoSlots, { pokemon: [first, first] }),
    ).toThrow('same Pokemon twice');
    // And the squares are the second cap: two Pokemon do not go into the base
    // container however many slots it is configured for.
    expect(() =>
      new RunManager().startRun(
        loadout,
        { mapId: 'route-1', durationMs: 60_000, securePokemonLimit: 2 },
        { pokemon: [first, second] },
      ),
    ).toThrow(/2x2 cannot hold/);

    const manager = new RunManager();
    manager.startRun(loadout, twoSlots, { pokemon: [first, second] });
    expect(manager.resolveWipe()).toMatchObject({
      bankedPokemon: [first, second],
      lostPokemon: [loadout.party[2]],
    });
  });

  /**
   * A secured Pokemon that evolves in the field is a stage taller than the room
   * it was given - a Bulbasaur crossing 16 goes from four squares to six, which
   * does not fit the 2x2 every save starts with. The container was filled at the
   * door, so what it accepted is what it is holding; re-measuring it here threw,
   * and a raid that ended in a wipe ended on an uncaught error instead of a
   * result screen. Found by playing: it is reachable by anything that can
   * evolve, which since the import is most of the roster.
   */
  it('keeps protecting a Pokemon that grew out of its own squares', () => {
    const partner = makePokemon();
    const manager = new RunManager();
    manager.startRun(
      { party: [partner, makePokemon(PIDGEY)], items: [] },
      { mapId: 'pallet-town', durationMs: 60_000 },
      { pokemon: [partner] },
    );

    partner.gainExperience(experienceForLevel(16) - partner.experience);
    expect(partner.base.id).toBe('ivysaur');
    expect(pokemonCargoCells('ivysaur')).toBeGreaterThan(2 * 2);

    expect(manager.resolveWipe()).toMatchObject({ bankedPokemon: [partner] });
  });
});
