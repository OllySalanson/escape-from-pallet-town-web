import { describe, expect, it } from 'vitest';
import { Bag } from '../items';
import { BULBASAUR, CHARMANDER, Pokemon, PokemonParty, SQUIRTLE } from '../pokemon';
import { MoveCategory } from '../pokemon/MoveBase';
import { RunManager } from '../run/RunManager';
import { DEFAULT_RAID_PROGRESS, SAVE_KEY, SaveManager } from '../save/SaveManager';
import { Stash } from '../stash';
import { getWorldMap } from '../worldMap';
import {
  createGiftPokemon,
  giftGivenBy,
  isGiftSpoken,
  POKEMON_GIFTS,
  REEDBEDS_PIKACHU,
} from './gifts';
import { getCharacterDesign } from './characterDesigns';
import { WORLD_ENTITIES } from './npcs';

class MemoryStorage {
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

const STARTERS = [BULBASAUR, CHARMANDER, SQUIRTLE];
const STARTER_LEVEL = 5;

const savedGame = (storage: MemoryStorage): SaveManager => {
  const saves = new SaveManager(storage);
  const stash = new Stash();
  stash.addPokemon(new Pokemon(CHARMANDER, STARTER_LEVEL), 'charmander-1');
  saves.save({
    party: new PokemonParty(),
    mapId: 'floodplain-relay',
    position: { x: 1, y: 1 },
    bag: new Bag(),
    stash,
    starterSpeciesId: 'charmander',
    raidProgress: DEFAULT_RAID_PROGRESS,
  });
  return saves;
};

describe('the giver', () => {
  it('is a townsperson on the map the gift names, in a design from the registry', () => {
    for (const gift of POKEMON_GIFTS) {
      const giver = WORLD_ENTITIES.find((entity) => entity.id === gift.giverId);
      expect(giver, gift.id).toBeDefined();
      expect(giver?.kind).toBe('npc');
      expect(giver?.mapId).toBe(gift.mapId);
      expect(giver?.design).toBeDefined();
      expect(getCharacterDesign(giver!.design!).kind).toBe('townsfolk');
      expect(giftGivenBy(gift.giverId)).toBe(gift);
    }
  });

  it('stands at the head of a one-tile lane, so nobody passes through her', () => {
    const giver = WORLD_ENTITIES.find((entity) => entity.id === REEDBEDS_PIKACHU.giverId)!;
    const { collision } = getWorldMap(giver.mapId);
    const open = (x: number, y: number): boolean => collision[y]?.[x] === false;
    const { x, y } = giver.position;

    expect(open(x, y)).toBe(true);
    const neighbours = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].filter(([dx, dy]) => open(x + dx, y + dy));
    const [dx, dy] = neighbours[0] ?? [0, 0];
    expect(neighbours).toHaveLength(1);
    expect(giver.facing).toBe(dy === 1 ? 'down' : dy === -1 ? 'up' : dx === 1 ? 'right' : 'left');
  });

  it('never says the same thing before and after the hand-over', () => {
    expect(REEDBEDS_PIKACHU.after).not.toEqual(REEDBEDS_PIKACHU.offer);
    expect(REEDBEDS_PIKACHU.offer.at(-1)).toContain('PIKACHU');
    expect(REEDBEDS_PIKACHU.offerPackLine).toContain('PIKACHU');
  });
});

describe('a gift does not outclass the starter choice', () => {
  const gift = createGiftPokemon(REEDBEDS_PIKACHU);
  const total = (pokemon: Pokemon): number => {
    const { hp, attack, defense, spAttack, spDefense, speed } = pokemon.stats;
    return hp + attack + defense + spAttack + spDefense + speed;
  };

  it('arrives below the level the starter is chosen at', () => {
    expect(gift.level).toBeLessThan(STARTER_LEVEL);
  });

  it('is beaten by every starter in every stat and in the sum of them', () => {
    for (const species of STARTERS) {
      const starter = new Pokemon(species, STARTER_LEVEL);
      expect(total(gift), species.name).toBeLessThan(total(starter));
      for (const stat of ['hp', 'attack', 'defense', 'spAttack', 'spDefense'] as const) {
        expect(gift.stats[stat], `${species.name} ${stat}`).toBeLessThanOrEqual(starter.stats[stat]);
      }
    }
  });

  it('brings no move a starter does not have, and no typed one before level 7', () => {
    const damaging = gift.moves.filter((move) => move.base.category !== MoveCategory.Status);
    expect(damaging.map((move) => move.base.name)).toEqual(['Tackle']);
    expect(gift.moves.map((move) => move.base.name).sort()).toEqual(['Growl', 'Tackle']);
  });

  it('is a fresh Pokemon on every hand-over', () => {
    expect(createGiftPokemon(REEDBEDS_PIKACHU)).not.toBe(createGiftPokemon(REEDBEDS_PIKACHU));
  });
});

describe('a gift is at risk in the raid and received only when banked', () => {
  const startRaid = (): RunManager => {
    const manager = new RunManager();
    manager.startRun(
      { party: [new Pokemon(CHARMANDER, STARTER_LEVEL)], items: [] },
      { mapId: 'floodplain-relay', durationMs: 60_000 },
    );
    return manager;
  };

  it('is carried like a catch, and once per raid', () => {
    const manager = startRaid();
    manager.registerGiftedPokemon(REEDBEDS_PIKACHU.id, createGiftPokemon(REEDBEDS_PIKACHU));
    manager.registerGiftedPokemon(REEDBEDS_PIKACHU.id, createGiftPokemon(REEDBEDS_PIKACHU));

    const snapshot = manager.snapshot();
    expect(snapshot.giftIds).toEqual([REEDBEDS_PIKACHU.id]);
    expect(snapshot.caughtPokemon.map((pokemon) => pokemon.base.name)).toEqual(['Pikachu']);
    expect(isGiftSpoken(REEDBEDS_PIKACHU, [], snapshot.giftIds)).toBe(true);
  });

  it('is lost with a wipe, and the giver still has it', () => {
    const manager = startRaid();
    manager.registerGiftedPokemon(REEDBEDS_PIKACHU.id, createGiftPokemon(REEDBEDS_PIKACHU));
    const result = manager.resolveWipe();

    expect(result.bankedPokemon).toEqual([]);
    expect(result.lostPokemon.map((pokemon) => pokemon.base.name)).toContain('Pikachu');
    // Nothing was banked, so nothing was written: the next raid is offered it again.
    expect(isGiftSpoken(REEDBEDS_PIKACHU, DEFAULT_RAID_PROGRESS.giftsReceived, [])).toBe(false);
  });

  it('is recorded when a raid banks it and stays recorded across reloads', () => {
    const storage = new MemoryStorage();
    const saves = savedGame(storage);
    const gift = createGiftPokemon(REEDBEDS_PIKACHU);

    expect(saves.bankRun({ pokemon: [gift], items: [], gifts: [REEDBEDS_PIKACHU.id] })).toBe(true);

    const reloaded = new SaveManager(storage).load();
    expect(reloaded?.raidProgress.giftsReceived).toEqual([REEDBEDS_PIKACHU.id]);
    expect(reloaded?.stash.listPokemon().map(({ pokemon }) => pokemon.base.name)).toContain('Pikachu');
    expect(isGiftSpoken(REEDBEDS_PIKACHU, reloaded!.raidProgress.giftsReceived, [])).toBe(true);
  });

  it('is recorded once however many raids bank it, and a plain raid changes nothing', () => {
    const storage = new MemoryStorage();
    const saves = savedGame(storage);
    saves.bankRun({ pokemon: [], items: [] });
    expect(saves.load()?.raidProgress.giftsReceived).toEqual([]);

    saves.bankRun({ pokemon: [], items: [], gifts: [REEDBEDS_PIKACHU.id] });
    saves.bankRun({ pokemon: [], items: [], gifts: [REEDBEDS_PIKACHU.id] });
    expect(saves.load()?.raidProgress.giftsReceived).toEqual([REEDBEDS_PIKACHU.id]);
  });

  it('is recorded by a raid that banks a contract too', () => {
    const storage = new MemoryStorage();
    const saves = savedGame(storage);

    saves.bankFirstContractRun({ pokemon: [], items: [], gifts: [REEDBEDS_PIKACHU.id] });
    expect(saves.load()?.raidProgress.giftsReceived).toEqual([REEDBEDS_PIKACHU.id]);
  });

  it('reads a save written before gifts as having received none', () => {
    const storage = new MemoryStorage();
    savedGame(storage);
    const raw = JSON.parse(storage.getItem(SAVE_KEY)!) as { raidProgress: Record<string, unknown> };
    delete raw.raidProgress.giftsReceived;
    storage.setItem(SAVE_KEY, JSON.stringify(raw));

    expect(new SaveManager(storage).load()?.raidProgress.giftsReceived).toEqual([]);
  });
});
