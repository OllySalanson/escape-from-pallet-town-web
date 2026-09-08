import { describe, expect, it } from 'vitest';
import { Bag } from '../items';
import {
  CHARMANDER,
  Pokemon,
  PokemonParty,
  experienceAwardForDefeat,
  experienceForLevel,
} from '../pokemon';
import { SAVE_KEY, SaveManager, type StorageLike } from '../save/SaveManager';
import { createStartingStash } from '../stash';
import { createActiveRunSession } from './RunSession';
import { RunManager } from './RunManager';
import { buildExtractionReport } from './extractionReport';
import { buildRaidSettlement, deployedRaidCondition } from './raidSettlement';
import { RAID_DURATION_MS } from './raidClock';

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

const RUN_CONFIG = { mapId: 'pallet-town', durationMs: 60_000 };

/** Reads the field straight out of storage, so persistence is proven, not inferred. */
function persistedStarterSpeciesId(storage: StorageLike): unknown {
  return (JSON.parse(storage.getItem(SAVE_KEY)!) as Record<string, unknown>).starterSpeciesId;
}

function seedNewPlayer(storage: StorageLike): SaveManager {
  const saves = new SaveManager(storage);
  saves.save({
    party: new PokemonParty(),
    mapId: 'pallet-town',
    position: { x: 6, y: 8 },
    bag: new Bag(),
    stash: createStartingStash(),
  });
  return saves;
}

describe('extraction loop integration', () => {
  it('banks caught Pokemon and found items on escape without duplicating deployed stash assets', () => {
    const saves = seedNewPlayer(new MemoryStorage());
    const seeded = saves.load()?.stash;

    expect(seeded?.listPokemon()).toMatchObject([
      { id: 'bulbasaur-1', pokemon: { base: { id: 'bulbasaur' }, level: 5 } },
    ]);
    expect(seeded?.listItems()).toEqual({ 'poke-ball': 5, potion: 3 });

    const starter = seeded!.listPokemon()[0];
    const loadout = {
      party: [starter.pokemon],
      items: [
        { itemId: 'poke-ball', quantity: 5 },
        { itemId: 'potion', quantity: 3 },
      ],
    } as const;
    const secureSlot = { pokemon: starter.pokemon, items: loadout.items };
    const stashSecureSlot = { pokemonId: starter.id, items: loadout.items };
    const manager = new RunManager();
    manager.startRun(loadout, RUN_CONFIG, secureSlot);
    const session = createActiveRunSession(
      manager,
      secureSlot,
      stashSecureSlot,
      [starter.id],
      loadout.items,
    );
    const caught = new Pokemon(CHARMANDER, 4);

    session.manager.registerCaughtPokemon(caught);
    session.manager.registerFoundItem('antidote', 2);
    session.manager.resolveEscape();
    const resolved = session.manager.snapshot();

    expect(saves.bankRun({ pokemon: resolved.caughtPokemon, items: resolved.foundItems })).toBe(true);

    const escapedStash = saves.load()!.stash;
    expect(escapedStash.listPokemon()).toMatchObject([
      { id: starter.id, pokemon: { base: { id: 'bulbasaur' } } },
      { pokemon: { base: { id: 'charmander' }, level: 4 } },
    ]);
    expect(escapedStash.listItems()).toEqual({ 'poke-ball': 5, potion: 3, antidote: 2 });
  });

  /**
   * The regression this change exists for. A raid used to be free: the deployed
   * Pokemon were the stash's own objects, but every write-back path reloads the
   * stash from storage, so the HP they lost, the status they caught and the
   * supplies they drank were all discarded the moment the raid resolved. Losing
   * everything then re-granted a fresh level-5 starter, which made wiping the
   * cheapest way to heal a worn party.
   */
  it('carries the damage, status and supply use of an extracted raid back into the stash', () => {
    const saves = seedNewPlayer(new MemoryStorage());
    const starter = saves.load()!.stash.listPokemon()[0];
    const loadout = {
      party: [starter.pokemon],
      items: [
        { itemId: 'poke-ball', quantity: 5 },
        { itemId: 'potion', quantity: 3 },
      ],
    } as const;
    const manager = new RunManager();
    manager.startRun(loadout, RUN_CONFIG, {});
    const session = createActiveRunSession(manager, {}, {}, [starter.id], loadout.items);

    // The raid itself: a beating, a burn nobody cured, two Potions and a ball spent.
    starter.pokemon.takeDamage(7);
    starter.pokemon.primaryStatus = 'burn';
    const survivingHp = starter.pokemon.currentHp;
    expect(survivingHp).toBeGreaterThan(0);
    expect(survivingHp).toBeLessThan(starter.pokemon.maxHp);
    const carriedOut = new Bag({ 'poke-ball': 4, potion: 1 }).toJSON();

    session.manager.resolveEscape();
    const resolved = session.manager.snapshot();
    expect(
      saves.bankRun(
        { pokemon: resolved.caughtPokemon, items: [] },
        buildRaidSettlement(session.broughtPokemonIds, resolved, carriedOut),
      ),
    ).toBe(true);

    const banked = saves.load()!.stash;
    expect(banked.listPokemon()).toMatchObject([
      { id: starter.id, pokemon: { currentHp: survivingHp, primaryStatus: 'burn' } },
    ]);
    expect(banked.listItems()).toEqual(carriedOut);
  });

  /**
   * The other half of the same seam, and the fault the morning playtest found:
   * damage came home but the win that caused it did not. A raid was played on
   * the stash's own Pokemon, so the experience it earned was real - and then
   * every write-back path reloaded the vault from storage and handed the player
   * back the level-5 starter they deployed. The starter could never reach the
   * level-7 typed move the whole early curve is built around, so the hunter and
   * RAIDER MAYA were unreachable by construction.
   */
  it('carries experience earned in a raid home through an extraction', () => {
    const saves = seedNewPlayer(new MemoryStorage());
    const starter = saves.load()!.stash.listPokemon()[0];
    const deployedXp = starter.pokemon.experience;
    const loadout = { party: [starter.pokemon], items: [] } as const;
    const manager = new RunManager();
    manager.startRun(loadout, RUN_CONFIG, {});
    const session = createActiveRunSession(manager, {}, {}, [starter.id], []);

    // One win in the field, exactly as a battle awards it.
    const awarded = starter.pokemon.gainExperience(experienceAwardForDefeat(3)).awarded;
    expect(awarded).toBeGreaterThan(0);

    session.manager.resolveEscape();
    expect(
      saves.bankRun(
        { pokemon: [], items: [] },
        buildRaidSettlement(session.broughtPokemonIds, session.manager.snapshot(), {}),
      ),
    ).toBe(true);

    expect(saves.load()!.stash.listPokemon()[0].pokemon.experience).toBe(deployedXp + awarded);
  });

  it('carries a mid-raid level up home with the stats and the move it earned', () => {
    const saves = seedNewPlayer(new MemoryStorage());
    const starter = saves.load()!.stash.listPokemon()[0];
    const manager = new RunManager();
    manager.startRun({ party: [starter.pokemon], items: [] }, RUN_CONFIG, {});
    const session = createActiveRunSession(manager, {}, {}, [starter.id], []);

    // Enough to cross two boundaries, which is where the level-7 typed move is.
    const result = starter.pokemon.gainExperience(experienceForLevel(7) - starter.pokemon.experience);
    expect(result.levelsGained).toEqual([6, 7]);
    const raidLevel = starter.pokemon.level;
    const raidStats = { ...starter.pokemon.stats };
    const raidHp = starter.pokemon.currentHp;

    session.manager.resolveEscape();
    expect(
      saves.bankRun(
        { pokemon: [], items: [] },
        buildRaidSettlement(session.broughtPokemonIds, session.manager.snapshot(), {}),
      ),
    ).toBe(true);

    const banked = saves.load()!.stash.listPokemon()[0].pokemon;
    expect(banked.level).toBe(raidLevel);
    expect(banked.experience).toBe(experienceForLevel(7));
    expect(banked.stats).toEqual(raidStats);
    expect(banked.currentHp).toBe(raidHp);
    expect(banked.moves.map((move) => move.base.name)).toContain('Vine Whip');
  });

  it('carries experience home when the raid runs out of clock with the party still standing', () => {
    // A timeout is settled exactly as a defeat is - the same applyWipeLoss with
    // the same condition - so the third ending is covered by the same seam. The
    // difference on the ground is only that the secured Pokemon walks away.
    const saves = seedNewPlayer(new MemoryStorage());
    const starter = saves.load()!.stash.listPokemon()[0];
    const secureSlot = { pokemon: starter.pokemon };
    const manager = new RunManager();
    manager.startRun({ party: [starter.pokemon], items: [] }, RUN_CONFIG, secureSlot);
    const session = createActiveRunSession(
      manager,
      secureSlot,
      { pokemonId: starter.id },
      [starter.id],
      [],
    );

    starter.pokemon.gainExperience(experienceAwardForDefeat(4));
    starter.pokemon.takeDamage(5);
    const raidXp = starter.pokemon.experience;
    const raidHp = starter.pokemon.currentHp;
    manager.tick(RAID_DURATION_MS);
    session.manager.resolveWipe(session.secureSlot);
    expect(
      saves.applyWipeLoss(
        session.broughtPokemonIds,
        session.broughtItems,
        session.stashSecureSlot,
        deployedRaidCondition(session.broughtPokemonIds, session.manager.snapshot()),
      ),
    ).toBe(true);

    const secured = saves.load()!.stash.listPokemon()[0].pokemon;
    expect(secured.experience).toBe(raidXp);
    expect(secured.currentHp).toBe(raidHp);
  });

  it('carries experience home when the raid is lost and the secure slot saves the Pokemon', () => {
    // A wipe deletes every deployed Pokemon but the secured one, so this is the
    // only ending where in-raid experience still has a body to come home to -
    // and the secure slot is the game's promise that what it protects comes back
    // as it was, not demoted.
    const saves = seedNewPlayer(new MemoryStorage());
    const starter = saves.load()!.stash.listPokemon()[0];
    const secureSlot = { pokemon: starter.pokemon };
    const manager = new RunManager();
    manager.startRun({ party: [starter.pokemon], items: [] }, RUN_CONFIG, secureSlot);
    const session = createActiveRunSession(
      manager,
      secureSlot,
      { pokemonId: starter.id },
      [starter.id],
      [],
    );

    starter.pokemon.gainExperience(experienceForLevel(6) - starter.pokemon.experience);
    starter.pokemon.takeDamage(starter.pokemon.maxHp);
    session.manager.resolveWipe(session.secureSlot);
    expect(
      saves.applyWipeLoss(
        session.broughtPokemonIds,
        session.broughtItems,
        session.stashSecureSlot,
        deployedRaidCondition(session.broughtPokemonIds, session.manager.snapshot()),
      ),
    ).toBe(true);

    const secured = saves.load()!.stash.listPokemon()[0].pokemon;
    expect(secured.level).toBe(6);
    expect(secured.experience).toBe(experienceForLevel(6));
    expect(secured.currentHp).toBe(0);
  });

  it('brings a Pokemon that fainted mid-raid home fainted rather than deleting it', () => {
    // Fainting is a wound, not a death: deleting deployed Pokemon is the wipe's
    // job, and doing it here too would charge one faint twice. The recovery bay
    // revive premium is what a faint actually costs.
    const saves = seedNewPlayer(new MemoryStorage());
    const stash = saves.load()!.stash;
    const starter = stash.listPokemon()[0];
    const partner = new Pokemon(CHARMANDER, 5);
    const partnerId = stash.addPokemon(partner, 'charmander-1');
    saves.save({
      party: new PokemonParty(),
      mapId: 'pallet-town',
      position: { x: 6, y: 8 },
      bag: new Bag(),
      stash,
    });

    const manager = new RunManager();
    manager.startRun({ party: [starter.pokemon, partner], items: [] }, RUN_CONFIG);
    const session = createActiveRunSession(manager, {}, {}, [starter.id, partnerId], []);
    partner.takeDamage(partner.maxHp);
    expect(partner.isFainted).toBe(true);

    session.manager.resolveEscape();
    expect(
      saves.bankRun(
        { pokemon: [], items: [] },
        buildRaidSettlement(session.broughtPokemonIds, session.manager.snapshot(), {}),
      ),
    ).toBe(true);

    expect(saves.load()!.stash.listPokemon()).toMatchObject([
      { id: starter.id, pokemon: { currentHp: starter.pokemon.maxHp } },
      { id: partnerId, pokemon: { currentHp: 0 } },
    ]);
  });

  it('banks field loot exactly once, through the bag it was picked up into', () => {
    // Found items travel home inside the bag, so the supply delta already
    // carries them. Banking them again as a reward would double the haul.
    const saves = seedNewPlayer(new MemoryStorage());
    const starter = saves.load()!.stash.listPokemon()[0];
    const items = [{ itemId: 'potion', quantity: 3 }] as const;
    const manager = new RunManager();
    manager.startRun({ party: [starter.pokemon], items }, RUN_CONFIG);
    const session = createActiveRunSession(manager, {}, {}, [starter.id], items);

    // One Potion drunk, two more found: the bag ends holding four.
    session.manager.registerFoundItem('potion', 2);
    session.manager.resolveEscape();
    expect(
      saves.bankRun(
        { pokemon: [], items: [] },
        buildRaidSettlement(session.broughtPokemonIds, session.manager.snapshot(), { potion: 4 }),
      ),
    ).toBe(true);

    expect(saves.load()!.stash.listItems()).toEqual({ 'poke-ball': 5, potion: 4 });
  });

  it('returns a secured Pokemon from a lost raid in the state the raid left it', () => {
    const saves = seedNewPlayer(new MemoryStorage());
    const starter = saves.load()!.stash.listPokemon()[0];
    const loadout = { party: [starter.pokemon], items: [] } as const;
    const secureSlot = { pokemon: starter.pokemon };
    const manager = new RunManager();
    manager.startRun(loadout, RUN_CONFIG, secureSlot);
    const session = createActiveRunSession(
      manager,
      secureSlot,
      { pokemonId: starter.id },
      [starter.id],
      [],
    );

    starter.pokemon.takeDamage(starter.pokemon.maxHp);
    session.manager.resolveWipe(session.secureSlot);
    expect(
      saves.applyWipeLoss(
        session.broughtPokemonIds,
        session.broughtItems,
        session.stashSecureSlot,
        deployedRaidCondition(session.broughtPokemonIds, session.manager.snapshot()),
      ),
    ).toBe(true);

    // Saved by the secure slot, but fainted - and the restock still leaves the
    // player able to attempt another raid once the bay revives it.
    const wiped = saves.load()!.stash;
    expect(wiped.listPokemon()).toMatchObject([{ id: starter.id, pokemon: { currentHp: 0 } }]);
    expect(wiped.listItems()).toEqual({ 'poke-ball': 5, potion: 3 });
  });

  it('preserves only the secure slot when a run wipes', () => {
    const saves = seedNewPlayer(new MemoryStorage());
    const stash = saves.load()!.stash;
    const starter = stash.listPokemon()[0];
    const deployedPartner = new Pokemon(CHARMANDER, 5);
    const partnerId = stash.addPokemon(deployedPartner, 'charmander-1');
    saves.save({
      party: new PokemonParty(),
      mapId: 'pallet-town',
      position: { x: 6, y: 8 },
      bag: new Bag(),
      stash,
    });

    const loadout = {
      party: [starter.pokemon, deployedPartner],
      items: [
        { itemId: 'poke-ball', quantity: 5 },
        { itemId: 'potion', quantity: 3 },
      ],
    } as const;
    const secureSlot = { pokemon: starter.pokemon, items: loadout.items };
    const stashSecureSlot = { pokemonId: starter.id, items: loadout.items };
    const manager = new RunManager();
    manager.startRun(loadout, RUN_CONFIG, secureSlot);
    const session = createActiveRunSession(
      manager,
      secureSlot,
      stashSecureSlot,
      [starter.id, partnerId],
      loadout.items,
    );

    const result = session.manager.resolveWipe(session.secureSlot);
    expect(result.permadeathPokemon).toEqual([deployedPartner]);
    expect(saves.applyWipeLoss(
      session.broughtPokemonIds,
      session.broughtItems,
      session.stashSecureSlot,
    )).toBe(true);

    const wipedStash = saves.load()!.stash;
    expect(wipedStash.listPokemon().map(({ id }) => id)).toEqual([starter.id]);
    expect(wipedStash.listItems()).toEqual({ 'poke-ball': 5, potion: 3 });
  });

  it('returns a player who wiped holding an unrelated leftover item with a usable supply of balls and potions', () => {
    const saves = seedNewPlayer(new MemoryStorage());
    const stash = saves.load()!.stash;
    const starter = stash.listPokemon()[0];
    // One odd end banked from an earlier raid is enough to suppress the restock.
    stash.addItem('antidote', 1);
    saves.save({
      party: new PokemonParty(),
      mapId: 'pallet-town',
      position: { x: 6, y: 8 },
      bag: new Bag(),
      stash,
    });

    const loadout = {
      party: [starter.pokemon],
      items: [
        { itemId: 'poke-ball', quantity: 5 },
        { itemId: 'potion', quantity: 3 },
      ],
    } as const;
    const manager = new RunManager();
    manager.startRun(loadout, RUN_CONFIG);
    const session = createActiveRunSession(manager, {}, {}, [starter.id], loadout.items);
    session.manager.resolveWipe(session.secureSlot);

    expect(
      saves.applyWipeLoss(session.broughtPokemonIds, session.broughtItems, session.stashSecureSlot),
    ).toBe(true);

    const recovered = saves.load()!.stash;
    expect(recovered.listPokemon()).toMatchObject([
      { pokemon: { base: { id: 'bulbasaur' }, level: 5 } },
    ]);
    // The kept antidote is never taken away, and the balls and potions come back.
    expect(recovered.listItems()).toEqual({ antidote: 1, 'poke-ball': 5, potion: 3 });
  });

  it('restocks a wiped player whose secure slot saved a Pokemon but no supplies', () => {
    const saves = seedNewPlayer(new MemoryStorage());
    const stash = saves.load()!.stash;
    const starter = stash.listPokemon()[0];

    const loadout = {
      party: [starter.pokemon],
      items: [
        { itemId: 'poke-ball', quantity: 5 },
        { itemId: 'potion', quantity: 3 },
      ],
    } as const;
    const secureSlot = { pokemon: starter.pokemon };
    const stashSecureSlot = { pokemonId: starter.id };
    const manager = new RunManager();
    manager.startRun(loadout, RUN_CONFIG, secureSlot);
    const session = createActiveRunSession(
      manager,
      secureSlot,
      stashSecureSlot,
      [starter.id],
      loadout.items,
    );
    session.manager.resolveWipe(session.secureSlot);

    expect(
      saves.applyWipeLoss(session.broughtPokemonIds, session.broughtItems, session.stashSecureSlot),
    ).toBe(true);

    // No starter is re-granted - the secured one survived - but the supplies it
    // needs to attempt another run still come back.
    const recovered = saves.load()!.stash;
    expect(recovered.listPokemon().map(({ id }) => id)).toEqual([starter.id]);
    expect(recovered.listItems()).toEqual({ 'poke-ball': 5, potion: 3 });
  });

  it('lets a wiped player re-specialise, and re-grants the newly chosen starter on the next wipe', () => {
    const storage = new MemoryStorage();
    const saves = seedNewPlayer(storage);
    const wipeWith = (manager: SaveManager, stored: { id: string; pokemon: Pokemon }): void => {
      const runManager = new RunManager();
      runManager.startRun({ party: [stored.pokemon], items: [] }, RUN_CONFIG);
      const session = createActiveRunSession(runManager, {}, {}, [stored.id], []);
      session.manager.resolveWipe(session.secureSlot);
      expect(
        manager.applyWipeLoss(session.broughtPokemonIds, session.broughtItems, session.stashSecureSlot),
      ).toBe(true);
    };

    // The captain's starting position: a first wipe hands back the same species.
    wipeWith(saves, saves.load()!.stash.listPokemon()[0]);
    expect(saves.load()!.stash.listPokemon()).toMatchObject([
      { pokemon: { base: { id: 'bulbasaur' }, level: 5 } },
    ]);
    expect(saves.load()!.stash.listItems()).toEqual({ 'poke-ball': 5, potion: 3 });
    expect(persistedStarterSpeciesId(storage)).toBe('bulbasaur');
    expect(saves.load()!.stash.canSwapStarter()).toBe(true);

    // Re-specialising rewrites the recorded species, not just the stash.
    expect(saves.reselectStarter('squirtle')).toBe(true);
    expect(persistedStarterSpeciesId(storage)).toBe('squirtle');
    expect(saves.load()!.stash.listPokemon()).toMatchObject([
      { id: 'squirtle-1', pokemon: { base: { id: 'squirtle' }, level: 5 } },
    ]);
    // Re-specialising hands over a usable kit too, not just a new species.
    expect(saves.load()!.stash.listItems()).toEqual({ 'poke-ball': 5, potion: 3 });

    // Reload the page, then wipe again: the re-grant follows the new choice.
    const afterReload = new SaveManager(storage);
    expect(afterReload.load()!.starterSpeciesId).toBe('squirtle');
    wipeWith(afterReload, afterReload.load()!.stash.listPokemon()[0]);

    const regranted = afterReload.load()!.stash.listPokemon();
    expect(regranted).toMatchObject([{ pokemon: { base: { id: 'squirtle' }, level: 5 } }]);
    expect(regranted.map(({ pokemon }) => pokemon.base.id)).not.toContain('bulbasaur');

    // The offer withdraws itself the moment a second Pokemon is banked.
    expect(afterReload.bankRun({ pokemon: [new Pokemon(CHARMANDER, 4)], items: [] })).toBe(true);
    expect(afterReload.load()!.stash.canSwapStarter()).toBe(false);
    expect(afterReload.reselectStarter('bulbasaur')).toBe(false);
    expect(persistedStarterSpeciesId(storage)).toBe('squirtle');
    expect(afterReload.load()!.stash.listPokemon().map(({ id }) => id)).toEqual([
      'squirtle-1',
      'charmander-1',
    ]);
  });

  it('reports exactly the stash change a survived raid produced', () => {
    const saves = seedNewPlayer(new MemoryStorage());
    const starter = saves.load()!.stash.listPokemon()[0];
    const loadout = {
      party: [starter.pokemon],
      items: [
        { itemId: 'poke-ball', quantity: 5 },
        { itemId: 'potion', quantity: 3 },
      ],
    } as const;
    const secureSlot = { pokemon: starter.pokemon, items: [loadout.items[1]] };
    const manager = new RunManager();
    manager.startRun(loadout, { mapId: 'floodplain-relay', durationMs: RAID_DURATION_MS }, secureSlot);
    const session = createActiveRunSession(
      manager,
      secureSlot,
      { pokemonId: starter.id, items: [loadout.items[1]] },
      [starter.id],
      loadout.items,
    );
    const caught = new Pokemon(CHARMANDER, 4);
    session.manager.tick(94_000);
    session.manager.registerCaughtPokemon(caught);
    session.manager.registerFoundItem('great-ball', 2);
    session.manager.resolveEscape();
    const snapshot = session.manager.snapshot();

    const before = saves.load()!.stash.listItems();
    const banked = { pokemon: snapshot.caughtPokemon, items: snapshot.foundItems };
    expect(saves.bankRun(banked)).toBe(true);
    const after = saves.load()!.stash;

    const report = buildExtractionReport({
      outcome: 'ESCAPED',
      snapshot,
      durationMs: RAID_DURATION_MS,
      exitLabel: 'SOUTH GATE',
      banked,
      carriedOut: { 'poke-ball': 4, potion: 3, 'great-ball': 2 },
      saved: true,
    });

    // Every line of the ledger is a real change to persisted storage, and every
    // change to storage is on the ledger.
    expect(report.ledger.pokemon.map(({ name }) => name)).toEqual(['Charmander']);
    expect(after.listPokemon().map(({ pokemon }) => pokemon.base.name)).toEqual([
      'Bulbasaur',
      'Charmander',
    ]);
    expect(
      Object.fromEntries(report.ledger.items.map(({ itemId, quantity }) => [itemId, quantity])),
    ).toEqual({ 'great-ball': 2 });
    expect(after.listItems()).toEqual({ ...before, 'great-ball': 2 });
    // The loadout is never taken out of the stash on a survived raid, so the
    // gamble panel is the only place the risk is ever visible.
    expect(report.risked.items).toEqual([
      { itemId: 'poke-ball', label: 'Poke Ball', quantity: 5 },
    ]);
    expect(report.spent).toEqual([{ itemId: 'poke-ball', label: 'Poke Ball', quantity: 1 }]);
    expect(report.clockLabel).toBe('1:34 of 5:00');
  });

  it('reports exactly the stash losses a wiped raid produced', () => {
    const saves = seedNewPlayer(new MemoryStorage());
    const stash = saves.load()!.stash;
    const starter = stash.listPokemon()[0];
    const partner = new Pokemon(CHARMANDER, 5);
    const partnerId = stash.addPokemon(partner, 'charmander-1');
    saves.save({
      party: new PokemonParty(),
      mapId: 'floodplain-relay',
      position: { x: 15, y: 3 },
      bag: new Bag(),
      stash,
    });

    const loadout = {
      party: [starter.pokemon, partner],
      items: [{ itemId: 'poke-ball', quantity: 5 }],
    } as const;
    const secureSlot = { pokemon: starter.pokemon };
    const manager = new RunManager();
    manager.startRun(loadout, { mapId: 'floodplain-relay', durationMs: RAID_DURATION_MS }, secureSlot);
    const session = createActiveRunSession(
      manager,
      secureSlot,
      { pokemonId: starter.id },
      [starter.id, partnerId],
      loadout.items,
    );
    // Running the clock out is the wipe the new duration makes reachable.
    session.manager.tick(RAID_DURATION_MS);
    expect(session.manager.isEnraged).toBe(true);
    const result = session.manager.resolveWipe(session.secureSlot);
    const snapshot = session.manager.snapshot();
    expect(
      saves.applyWipeLoss(session.broughtPokemonIds, session.broughtItems, session.stashSecureSlot),
    ).toBe(true);

    const report = buildExtractionReport({
      outcome: 'WIPED',
      cause: 'timer',
      snapshot,
      durationMs: RAID_DURATION_MS,
      lost: { pokemon: result.lostPokemon, items: result.lostItems },
      saved: true,
    });

    expect(report.ledger.pokemon.map(({ name }) => name)).toEqual(['Charmander']);
    expect(saves.load()!.stash.listPokemon().map(({ id }) => id)).toEqual([starter.id]);
    expect(report.secured.pokemon.map(({ name }) => name)).toEqual(['Bulbasaur']);
    expect(report.headline).toBe('The clock ran out with you still inside.');
    expect(report.haulTier).toBe('empty');
  });

  it('unlocks the three remaining insertions and grants one supply exactly once after extracting the recovered field kit', () => {
    const saves = seedNewPlayer(new MemoryStorage());
    const starter = saves.load()!.stash.listPokemon()[0];
    const loadout = { party: [starter.pokemon], items: [] };
    const manager = new RunManager();
    manager.startRun(loadout, RUN_CONFIG);
    manager.recoverFieldKit();
    manager.resolveEscape();
    const snapshot = manager.snapshot();

    const result = { pokemon: snapshot.caughtPokemon, items: snapshot.foundItems };
    expect(saves.bankFirstContractRun(result)).toEqual({ saved: true, granted: true });
    expect(saves.load()!.raidProgress).toEqual({
      firstContractExtracted: true,
      completedContracts: ['recover-lost-field-kit'],
      unlockedInsertions: ['floodplain-relay', 'town-square', 'route-1', 'viridian-forest'],
    });
    expect(saves.load()!.stash.itemCount('super-potion')).toBe(1);

    expect(saves.bankFirstContractRun(result)).toEqual({ saved: true, granted: false });
    expect(saves.load()!.stash.itemCount('super-potion')).toBe(1);
  });
});
