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
import { baseGame } from './baseGames.testkit';
import { BADGES, caseBadges } from './badgeCase';

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

  it('says a faint apart from a scratch, and a team with nobody standing before the swap', () => {
    const mixed = createStartingStash(CHARMANDER);
    mixed.addPokemon(new Pokemon(PIDGEY, 4), 'pidgey-1');
    const [partner, pidgey] = mixed.listPokemon().map((stored) => stored.pokemon);
    partner.takeDamage(partner.maxHp);
    expect(doorStatusLine(doorNamed('pokemon-centre'), restore(mixed))).toBe('1 Pokémon fainted');
    pidgey.takeDamage(1);
    expect(doorStatusLine(doorNamed('pokemon-centre'), restore(mixed))).toBe('1 fainted · 1 hurt');

    // A wipe leaves the secured partner home on 0 HP and nobody else: the
    // swap would hand its replacement the same faint, so Joy is the news.
    const wiped = createStartingStash(CHARMANDER);
    const alone = wiped.listPokemon()[0].pokemon;
    alone.takeDamage(alone.maxHp);
    expect(doorStatusLine(doorNamed('pokemon-centre'), restore(wiped))).toBe('Nobody fit to raid');
  });

  /**
   * A player a wipe has left with one Pokemon has to be told the swap exists,
   * and the screen that holds it is behind a door they have no reason to open.
   * It was said on the lobby's stash card; it is said on the Center now.
   */
  it('offers the swap on the Center when a lost raid has left only a partner', () => {
    const spare = createStartingStash(CHARMANDER);
    expect(
      doorStatusLine(
        doorNamed('pokemon-centre'),
        restore(spare, { raidRecord: { 'floodplain-relay': { deployed: 1, extracted: 0, wiped: 1 } } }),
      ),
    ).toBe('Your last partner can be swapped here');
  });

  it('never tells a brand-new player the partner they just chose can be swapped (playtest 47)', () => {
    const fresh = createStartingStash(CHARMANDER);
    expect(doorStatusLine(doorNamed('pokemon-centre'), restore(fresh))).toBe('Everyone is fit');

    // Nor after raids that all came home: one Pokemon is not a loss.
    const banked = createStartingStash(CHARMANDER);
    expect(
      doorStatusLine(
        doorNamed('pokemon-centre'),
        restore(banked, { raidRecord: { 'route-1': { deployed: 3, extracted: 3, wiped: 0 } } }),
      ),
    ).toBe('Everyone is fit');
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

  it('leads Bill’s cottage with the money, because that is what the screen turns on', () => {
    const rich = createStartingStash(CHARMANDER);
    rich.addPokemon(new Pokemon(PIDGEY, 4), 'pidgey-1');
    rich.addItem('money', 1_000);
    const line = doorStatusLine(
      doorNamed('bills-cottage'),
      restore(rich, {
        firstContractExtracted: true,
        completedContracts: [FIRST_CONTRACT_ID],
        unlockedInsertions: ['floodplain-relay', 'town-square'],
        // His errand done, so the line is the counter's rather than his favour.
        errands: [{ id: 'old-amber', status: 'completed', found: 1, lossesHeard: 1 }],
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

  /** The house says from the yard how full its badge case is, once there is anything in it. */
  it("says on THE BOLTHOLE's door how many badges are in its case", () => {
    const home = doorNamed('bolthole');
    expect(doorStatusLine(home, baseGame())).toBe('Your house');
    expect(
      doorStatusLine(home, baseGame({ progress: { defeatedBosses: ['overlook-warden', 'pallet-mill-keeper'] } })),
    ).toBe(`Your house · 2 of ${caseBadges().length} badges`);
  });

  /** Once somebody has given their name at the door, the door says whose house it is. */
  it("puts the name given at THE BOLTHOLE's door on it, still inside one short line", () => {
    const home = doorNamed('bolthole');
    expect(doorStatusLine(home, baseGame(), 'OLLY')).toBe("OLLY's house");
    const everyBadge = baseGame({ progress: { defeatedBosses: BADGES.map((badge) => badge.bossId) } });
    const longest = doorStatusLine(home, everyBadge, 'WWWWWWWWWW');
    expect(longest).toBe(`WWWWWWWWWW's house · ${caseBadges().length} of ${caseBadges().length} badges`);
    expect(longest.length).toBeLessThanOrEqual(40);
  });

  it('says when a keeper has a favour to ask, a thing to take, or a loss to hear about', () => {
    const opened = { completedContracts: [FIRST_CONTRACT_ID], unlockedInsertions: ['floodplain-relay', 'greystone-vale'] };
    const workshop = doorNamed('brocks-workshop');
    expect(doorStatusLine(workshop, baseGame({ progress: opened }))).toBe('Brock wants a favour');
    const asked = { ...opened, errands: [{ id: 'brocks-crate', status: 'started' as const, found: 0, lossesHeard: 0 }] };
    // In hand and not found: the room's usual line.
    expect(doorStatusLine(workshop, baseGame({ progress: asked }))).toMatch(/built/);
    const lost = { ...opened, errands: [{ id: 'brocks-crate', status: 'started' as const, found: 1, lossesHeard: 0 }] };
    expect(doorStatusLine(workshop, baseGame({ progress: lost }))).toBe('Brock wants a word');
    const home = baseGame({ progress: lost });
    home.stash.addItem('brocks-crate', 1);
    expect(doorStatusLine(workshop, home)).toBe("Brock's crate to hand over");
    // Nothing asked on a map nobody can drop into yet.
    expect(doorStatusLine(workshop, baseGame())).toMatch(/built/);
  });
});
