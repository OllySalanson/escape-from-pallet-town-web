import { describe, expect, it, vi } from 'vitest';
import { Pokemon } from '../pokemon';
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
      { mapId: 'pallet-town', durationMs: 60_000 },
      { pokemon: partyMember, items: [{ itemId: 'potion', quantity: 1 }] },
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
      { mapId: 'pallet-town', durationMs: 60_000 },
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
      { mapId: 'pallet-town', durationMs: 60_000 },
    );
    manager.registerCaughtPokemon(caught);
    manager.registerCaughtPokemon(secondCaught);
    manager.registerFoundItem('potion', 3);
    manager.registerFoundItem('great-ball', 2);

    expect(
      manager.resolveWipe({
        pokemon: caught,
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

  it('retains the secure slot selected when the run starts', () => {
    const manager = new RunManager();
    const partyMember = makePokemon(BULBASAUR);
    manager.startRun(
      { party: [partyMember], items: [{ itemId: 'potion', quantity: 2 }] },
      { mapId: 'pallet-town', durationMs: 60_000 },
      { pokemon: partyMember, items: [{ itemId: 'potion', quantity: 1 }] },
    );

    expect(manager.snapshot().secureSlot).toEqual({
      pokemon: partyMember,
      items: [{ itemId: 'potion', quantity: 1 }],
    });
    expect(manager.resolveWipe()).toMatchObject({
      bankedPokemon: [partyMember],
      bankedItems: [{ itemId: 'potion', quantity: 1 }],
    });
  });

  it('rejects secure-slot selections that do not belong to the run', () => {
    const manager = new RunManager();
    startRun(manager);

    expect(() =>
      manager.resolveWipe({ pokemon: makePokemon(CHARMANDER), items: [] }),
    ).toThrow('secure-slot Pokemon');
  });
});
