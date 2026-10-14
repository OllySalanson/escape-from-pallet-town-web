import { describe, expect, it } from 'vitest';
import { Bag } from '../items';
import { BULBASAUR, CHARMANDER, Pokemon, PokemonParty, SQUIRTLE, getSpeciesById } from '../pokemon';
import { experienceForLevel } from '../pokemon/Pokemon';
import {
  DEFAULT_RAID_PROGRESS,
  SaveManager,
  type RaidProgress,
  type StorageLike,
} from '../save/SaveManager';
import { partnerOf } from '../base/partner';
import { Stash, createStartingStash } from '../stash/Stash';
import {
  DAY_CARE_SHARE_OF_A_LEVEL,
  checkOnLines,
  dayCareExperience,
  dayCareRefusal,
  dayCareReport,
  dayCareStatusLine,
  raidsCompleted,
  takeBack,
} from './dayCare';

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

/** A vault of a starter and two more, and the ids they are kept under. */
function vault(): { stash: Stash; partner: string; pidgey: string; rattata: string } {
  const stash = createStartingStash(CHARMANDER);
  const partner = stash.partnerId()!;
  const pidgey = stash.addPokemon(new Pokemon(getSpeciesById('pidgey')!, 4));
  const rattata = stash.addPokemon(new Pokemon(getSpeciesById('rattata')!, 6));
  return { stash, partner, pidgey, rattata };
}

const progressAfter = (raids: number): RaidProgress => ({
  ...DEFAULT_RAID_PROGRESS,
  raidRecord: { 'floodplain-relay': { deployed: raids, extracted: raids, wiped: 0 } },
});

describe('what the Day-Care pays', () => {
  it('pays half a level a raid, so two raids are a level on every growth curve', () => {
    expect(DAY_CARE_SHARE_OF_A_LEVEL).toBe(1 / 2);
    for (const species of ['pidgey', 'rattata', 'charmander', 'geodude', 'clefairy']) {
      const base = getSpeciesById(species)!;
      for (const level of [3, 10, 25, 50]) {
        const pokemon = new Pokemon(base, level);
        const one = dayCareExperience(pokemon, 1);
        const two = dayCareExperience(pokemon, 2);
        const span = experienceForLevel(level + 1, base.growthRate) - experienceForLevel(level, base.growthRate);
        // Never a level in one raid, and exactly the level in two.
        expect([species, level, pokemon.experience + one < experienceForLevel(level + 1, base.growthRate)]).toEqual([
          species,
          level,
          true,
        ]);
        expect([species, level, two >= span]).toEqual([species, level, true]);
      }
    }
  });

  it('pays nothing for raids that have not ended, and nothing past level 100', () => {
    const fresh = new Pokemon(CHARMANDER, 12);
    expect(dayCareExperience(fresh, 0)).toBe(0);
    const capped = new Pokemon(CHARMANDER, 99);
    const ceiling = experienceForLevel(100, CHARMANDER.growthRate);
    expect(capped.experience + dayCareExperience(capped, 40)).toBe(ceiling);
    expect(dayCareExperience(new Pokemon(CHARMANDER, 100), 10)).toBe(0);
  });

  it('grows a long stay level by level, at the share of the level it has reached', () => {
    // Ten raids is five levels however far up the curve it starts.
    for (const level of [5, 20, 40]) {
      const stash = new Stash({ pokemon: [{ id: 'a', pokemon: new Pokemon(SQUIRTLE, level) }] });
      stash.addPokemon(new Pokemon(BULBASAUR, 5));
      stash.leaveAtDayCare('a', 0);
      expect(dayCareReport(stash.dayCare()!, 10).levelNow).toBe(level + 5);
    }
  });

  it('counts raids that have ended, never the one still being played', () => {
    expect(raidsCompleted(progressAfter(7))).toBe(7);
    expect(raidsCompleted(progressAfter(7), { id: 'raid-1' } as never)).toBe(6);
    expect(raidsCompleted(DEFAULT_RAID_PROGRESS)).toBe(0);
  });
});

describe('leaving a Pokémon with him', () => {
  it('takes it out of the vault, so no raid, payment or wipe can reach it', () => {
    const { stash, pidgey } = vault();
    expect(stash.leaveAtDayCare(pidgey, 3)).toBe(true);
    expect(stash.listPokemon().map((stored) => stored.id)).not.toContain(pidgey);
    expect(stash.listBoxes().flatMap((box) => box.pokemonIds)).not.toContain(pidgey);
    // A wipe of everything that was at base still leaves it with him.
    stash.applyWipeLoss(
      stash.listPokemon().map((stored) => stored.id).concat(pidgey),
      [],
    );
    expect(stash.listPokemon()).toEqual([]);
    expect(stash.dayCare()?.id).toBe(pidgey);
    expect(stash.dayCare()?.leftAfterRaids).toBe(3);
  });

  it('raises one at a time, and says why it will not take one', () => {
    const { stash, partner, pidgey, rattata } = vault();
    expect(dayCareRefusal(stash, pidgey)).toBeUndefined();
    stash.leaveAtDayCare(pidgey, 0);
    expect(dayCareRefusal(stash, rattata)).toBe('I’m already raising your Pidgey.');
    expect(stash.leaveAtDayCare(rattata, 0)).toBe(false);

    const one = createStartingStash(BULBASAUR);
    expect(dayCareRefusal(one, one.partnerId()!)).toBe('Oh? You only have one Pokémon.');

    // FireRed's other refusal: leaving the last one still standing.
    const hurt = vault();
    hurt.stash.listPokemon().forEach((stored) => {
      if (stored.id !== hurt.partner) stored.pokemon.takeDamage(stored.pokemon.maxHp);
    });
    expect(dayCareRefusal(hurt.stash, hurt.partner)).toBe(
      'If you leave me that Pokémon, what will you battle with?',
    );
    // The fainted ones are sent to the Pokémon Center rather than taken.
    expect(dayCareRefusal(hurt.stash, hurt.pidgey)).toMatch(/has fainted!/);
    expect(partner).toBeTruthy();
  });

  it('will not take a fainted one, and sends it to the Pokémon Center', () => {
    const { stash, pidgey, rattata } = vault();
    const fainted = stash.listPokemon().find((stored) => stored.id === pidgey)!.pokemon;
    fainted.takeDamage(fainted.maxHp);
    expect(dayCareRefusal(stash, pidgey)).toBe(
      'Your Pidgey has fainted! I can raise it, but I can’t revive it. Take it to the Pokémon Center first.',
    );

    // Once Nurse Joy has it on its feet he takes it, as hurt as it is.
    expect(stash.recoverPokemon(pidgey)).toBe(true);
    fainted.takeDamage(fainted.maxHp - 1);
    expect(dayCareRefusal(stash, pidgey)).toBeUndefined();
    // A Pokémon with a status or holding gear is still his to raise.
    const rattataPokemon = stash.listPokemon().find((stored) => stored.id === rattata)!.pokemon;
    rattataPokemon.primaryStatus = 'poison';
    rattataPokemon.heldItemId = 'quick-claw';
    expect(dayCareRefusal(stash, rattata)).toBeUndefined();
  });

  it('keeps its id and its place as the partner while it is away', () => {
    const { stash, partner } = vault();
    stash.leaveAtDayCare(partner, 0);
    expect(stash.partnerId()).toBe(partner);
    expect(stash.partner()).toBeUndefined();
    // Nothing new can be given the id it is coming back under.
    const fresh = stash.addPokemon(new Pokemon(CHARMANDER, 5));
    expect(fresh).not.toBe(partner);
    expect(() => stash.addPokemon(new Pokemon(CHARMANDER, 5), partner)).toThrow();

    takeBack(stash, 0);
    expect(stash.partner()?.id).toBe(partner);
  });

  it('does not count towards a playable vault: a wipe of the rest still re-issues a starter', () => {
    const { stash, pidgey } = vault();
    stash.leaveAtDayCare(pidgey, 0);
    stash.applyWipeLoss(stash.listPokemon().map((stored) => stored.id), []);
    expect(stash.ensurePlayable(CHARMANDER)).toBe(true);
    expect(stash.listPokemon()).toHaveLength(1);
    expect(stash.listPokemon()[0].id).not.toBe(pidgey);
    expect(stash.canSwapStarter()).toBe(false);
  });

  it('keeps the partner through a wipe of the rest: the re-issued starter never follows, the one taken back does', () => {
    const { stash, partner } = vault();
    stash.leaveAtDayCare(partner, 0);
    expect(partnerOf(stash)).toBeNull();
    stash.applyWipeLoss(stash.listPokemon().map((stored) => stored.id), []);
    expect(stash.ensurePlayable(CHARMANDER)).toBe(true);
    const reissued = stash.listPokemon()[0];
    expect(reissued.pokemon.base.id).toBe('charmander');
    expect(reissued.id).not.toBe(partner);
    // The fresh Charmander is a stand-in, not the friend who is away.
    expect(partnerOf(stash)).toBeNull();

    takeBack(stash, 0);
    expect(partnerOf(stash)?.id).toBe(partner);
  });
});

describe('taking it back', () => {
  it('grows it by every raid that ended, learning its moves on the way', () => {
    const stash = new Stash({
      pokemon: [
        { id: 'charmander-1', pokemon: new Pokemon(CHARMANDER, 6) },
        { id: 'bulbasaur-1', pokemon: new Pokemon(BULBASAUR, 5) },
      ],
    });
    stash.leaveAtDayCare('charmander-1', 4);
    expect(checkOnLines(dayCareReport(stash.dayCare()!, 4))[0]).toMatch(/^You’re back already\?/);
    expect(dayCareStatusLine(stash, 6)).toBe('Raising Charmander · Lv 7');

    const taken = takeBack(stash, 6)!;
    expect(taken.id).toBe('charmander-1');
    expect(taken.pokemon.level).toBe(7);
    expect(taken.grown.learnedMoves.map((move) => move.name)).toEqual(['Ember']);
    expect(stash.listPokemon().find((stored) => stored.id === 'charmander-1')?.pokemon.level).toBe(7);
    expect(stash.dayCare()).toBeNull();
  });

  it('never evolves it there, as FireRed’s never does', () => {
    const stash = new Stash({
      pokemon: [
        { id: 'c', pokemon: new Pokemon(CHARMANDER, 15) },
        { id: 'b', pokemon: new Pokemon(BULBASAUR, 5) },
      ],
    });
    stash.leaveAtDayCare('c', 0);
    const taken = takeBack(stash, 4)!;
    expect(taken.pokemon.level).toBe(17);
    expect(taken.pokemon.base.id).toBe('charmander');
    expect(taken.grown.evolutions).toEqual([]);
  });

  it('queues a move it has no room for rather than forgetting one', () => {
    const charmander = new Pokemon(CHARMANDER, 18);
    const known = charmander.moves.map((move) => move.base.name);
    expect(known).toHaveLength(4);
    const stash = new Stash({
      pokemon: [
        { id: 'c', pokemon: charmander },
        { id: 'b', pokemon: new Pokemon(BULBASAUR, 5) },
      ],
    });
    stash.leaveAtDayCare('c', 0);
    const taken = takeBack(stash, 2)!;
    expect(taken.pokemon.level).toBe(19);
    expect(taken.pokemon.moves.map((move) => move.base.name)).toEqual(known);
    expect(taken.pokemon.pendingMoves.map((move) => move.name)).toEqual(['Smokescreen']);
  });

  it('is not a heal: it comes back as hurt as it was left', () => {
    const hurt = new Pokemon(CHARMANDER, 10);
    hurt.takeDamage(hurt.maxHp - 3);
    hurt.primaryStatus = 'poison';
    const stash = new Stash({
      pokemon: [
        { id: 'c', pokemon: hurt },
        { id: 'b', pokemon: new Pokemon(BULBASAUR, 5) },
      ],
    });
    stash.leaveAtDayCare('c', 0);
    const taken = takeBack(stash, 2)!;
    expect(taken.pokemon.level).toBe(11);
    expect(taken.pokemon.currentHp).toBeLessThan(taken.pokemon.maxHp);
    expect(taken.pokemon.primaryStatus).toBe('poison');
  });
});

describe('the save', () => {
  it('keeps the stay across a save and a load, partner and all', () => {
    const storage = new MemoryStorage();
    const { stash, partner } = vault();
    stash.leaveAtDayCare(partner, 5);
    const manager = new SaveManager(storage);
    manager.save({ party: new PokemonParty(), mapId: 'pallet-town', position: { x: 0, y: 0 }, bag: new Bag(), stash });

    const loaded = manager.load()!;
    const stay = loaded.stash.dayCare()!;
    expect(stay.id).toBe(partner);
    expect(stay.leftAfterRaids).toBe(5);
    expect(stay.pokemon.base.id).toBe('charmander');
    expect(loaded.stash.partnerId()).toBe(partner);
    expect(loaded.stash.listPokemon().map((stored) => stored.id)).not.toContain(partner);
  });

  it('reads a save from before the Day-Care as nobody there', () => {
    const storage = new MemoryStorage();
    const manager = new SaveManager(storage);
    manager.save({
      party: new PokemonParty(),
      mapId: 'pallet-town',
      position: { x: 0, y: 0 },
      bag: new Bag(),
      stash: createStartingStash(),
    });
    const key = [...(storage as unknown as { values: Map<string, string> }).values.keys()][0];
    const raw = JSON.parse(storage.getItem(key)!) as { stash: { dayCare?: unknown } };
    delete raw.stash.dayCare;
    storage.setItem(key, JSON.stringify(raw));
    expect(manager.load()!.stash.dayCare()).toBeNull();
  });
});
