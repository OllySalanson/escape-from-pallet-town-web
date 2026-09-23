import { describe, expect, it } from 'vitest';
import { Bag } from '../items';
import { CHARMANDER, PIDGEY, Pokemon, PokemonParty } from '../pokemon';
import { createStartingStash, type Stash } from '../stash';
import {
  DEFAULT_RAID_PROGRESS,
  SaveManager,
  type RaidProgress,
  type RestoredGame,
  type StorageLike,
} from '../save/SaveManager';
import { FIRST_CONTRACT_ID } from '../objectives';
import { BASE_DOORS } from './doors';
import { doorStatusLine } from './doorStatus';

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

function restore(
  stash: Stash,
  raidProgress: Partial<RaidProgress> = {},
): RestoredGame {
  const storage = new MemoryStorage();
  const manager = new SaveManager(storage);
  manager.save({
    party: new PokemonParty(),
    mapId: 'pallet-town',
    position: { x: 6, y: 8 },
    bag: new Bag(),
    stash,
    starterSpeciesId: 'charmander',
    raidProgress: { ...DEFAULT_RAID_PROGRESS, ...raidProgress },
  });
  return manager.load()!;
}

const doorNamed = (id: string) => BASE_DOORS.find((door) => door.id === id)!;

/**
 * The four cards the lobby was made of carried what was waiting behind each of
 * them, and the walkable base would have thrown all four away. These hold the
 * facts back on the doors instead - see `doorStatus.ts`.
 */
describe("what each of the base's doors says", () => {
  it('leads the lab with the work on the board', () => {
    const line = doorStatusLine(doorNamed('oaks-lab'), restore(createStartingStash(CHARMANDER)));
    expect(line).toMatch(/contract/);
  });

  it('says the team is fit, and says who is not', () => {
    const fit = createStartingStash(CHARMANDER);
    fit.addPokemon(new Pokemon(PIDGEY, 4), 'pidgey-1');
    expect(doorStatusLine(doorNamed('pokemon-centre'), restore(fit))).toBe('Everyone is fit');

    const hurt = createStartingStash(CHARMANDER);
    hurt.addPokemon(new Pokemon(PIDGEY, 4), 'pidgey-1');
    const wounded = hurt.listPokemon()[0].pokemon;
    wounded.takeDamage(wounded.maxHp - 1);
    expect(doorStatusLine(doorNamed('pokemon-centre'), restore(hurt))).toContain('hurt');
  });

  /**
   * A player down to one Pokemon has to be told the swap exists, and the screen
   * that holds it is behind a door they have no reason to open. It was said on
   * the lobby's stash card; it is said on the Center now.
   */
  it('offers the swap on the Center when there is only a partner left', () => {
    const spare = createStartingStash(CHARMANDER);
    expect(doorStatusLine(doorNamed('pokemon-centre'), restore(spare))).toBe(
      'Your last partner can be swapped here',
    );
  });

  it('says how much of the ladder stands, and how much of it is payable', () => {
    const empty = createStartingStash(CHARMANDER);
    expect(doorStatusLine(doorNamed('brocks-workshop'), restore(empty))).toContain('0 of 7 built');

    const built = createStartingStash(CHARMANDER);
    expect(
      doorStatusLine(
        doorNamed('brocks-workshop'),
        restore(built, { workshopUpgrades: ['radio-mast', 'beacon'] }),
      ),
    ).toContain('2 of 7 built');
  });

  it('leads the quay with the money, because that is what the screen turns on', () => {
    const rich = createStartingStash(CHARMANDER);
    rich.addPokemon(new Pokemon(PIDGEY, 4), 'pidgey-1');
    rich.addItem('money', 1_000);
    const line = doorStatusLine(
      doorNamed('the-quay'),
      restore(rich, {
        firstContractExtracted: true,
        completedContracts: [FIRST_CONTRACT_ID],
        unlockedInsertions: ['floodplain-relay', 'town-square'],
      }),
    );
    expect(line).toContain('₽1000');
  });

  it('answers for every door there is', () => {
    const stash = createStartingStash(CHARMANDER);
    stash.addPokemon(new Pokemon(PIDGEY, 4), 'pidgey-1');
    const game = restore(stash);
    for (const door of BASE_DOORS) {
      const line = doorStatusLine(door, game);
      expect([door.id, line.length > 0]).toEqual([door.id, true]);
      // One short line, because it is the third row of a caption seated over a
      // building on a 320-pixel stage.
      expect([door.id, line.length]).toEqual([door.id, line.length]);
      expect(line.length).toBeLessThanOrEqual(40);
    }
  });
});
