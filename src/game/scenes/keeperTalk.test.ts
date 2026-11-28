import { describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Math: { Vector2: class { public x = 0; public y = 0; } },
    Geom: { Rectangle: class { public static Contains = () => true; } },
    Input: { Keyboard: { KeyCodes: {}, JustDown: () => false }, Events: {} },
    Scenes: { Events: { SHUTDOWN: 'shutdown', UPDATE: 'update' } },
    Scale: { Events: { RESIZE: 'resize' } },
    BlendModes: { ADD: 1 },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
    GameObjects: { Container: class {}, Sprite: class {}, Rectangle: class {}, Text: class {} },
  },
}));

import { BaseScene } from './BaseScene';
import { raidHeartbeat } from '../run/raidInFlight';
import { roomNamed } from '../base/rooms';
import { retireMapsForTests, RETIRED_MAPS } from '../world/mapRoster';
import { BARE_BOARD_LINE, boardLines } from '../base/labBoard';
import { CHARMANDER, PIDGEY, Pokemon, PokemonParty } from '../pokemon';
import { ALL_SPECIES } from '../pokemon/species';
import { Bag } from '../items';
import { FIRST_WORDS } from '../hub/firstWords';
import { KEEPER_GREETINGS, OAK_POKEDEX_QUESTION } from '../hub/keeperGreetings';
import { SEE_THE_LIST_QUESTION, type BillGood } from '../hub/billTalk';
import { healDayOf } from '../hub/recovery';
import { DEFAULT_RAID_PROGRESS, SaveManager, type RaidProgress, type StorageLike } from '../save/SaveManager';
import { createStartingStash, type Stash } from '../stash';

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

function saved(raidProgress: Partial<RaidProgress> = {}, dress: (stash: Stash) => void = () => undefined): SaveManager {
  const manager = new SaveManager(new MemoryStorage());
  const stash = createStartingStash(CHARMANDER);
  dress(stash);
  manager.save({
    party: new PokemonParty(),
    mapId: 'pallet-town',
    position: { x: 6, y: 8 },
    bag: new Bag(),
    stash,
    raidProgress: { ...DEFAULT_RAID_PROGRESS, ...raidProgress },
  });
  return manager;
}

/**
 * The real talk, on a stand-in of the room: what is said goes on a list and its
 * `then` runs at once, as if each box were read, and a question is answered by
 * `answers` in turn.
 */
function room(manager: SaveManager, answers: readonly boolean[] = []) {
  const said: string[] = [];
  const asked: string[] = [];
  const opened: unknown[] = [];
  const went: { readonly said?: readonly string[]; readonly room?: string }[] = [];
  const left = [...answers];
  const scene = BaseScene.prototype as unknown as Record<string, unknown>;
  const stand = {
    saveManager: manager,
    savedGame: manager.load()!,
    currentTile: { x: 7, y: 8 },
    facing: 'up',
    visit: null,
    player: { stop: () => undefined, setFrame: () => undefined },
    place: { room: { room: roomNamed('pokemon-centre') } },
    showHint: () => undefined,
    clearKeeperMark: () => undefined,
    openScreen: (_room: unknown, screen: string) => opened.push(screen),
    openHub: (payload: unknown) => opened.push(payload),
    goTo: (data: { said?: readonly string[]; room?: string }) => went.push(data),
    say: (lines: readonly string[], _about: unknown, then?: () => void) => {
      said.push(...lines);
      then?.();
    },
    askInBox: (question: string, answer: (yes: boolean) => void) => {
      asked.push(question);
      answer(left.shift() ?? false);
    },
    favourHere: scene.favourHere,
    sayFavourIfAny: scene.sayFavourIfAny,
    oweFavour: scene.oweFavour,
    sayFavour: scene.sayFavour,
    askFavour: scene.askFavour,
    answerFavour: scene.answerFavour,
    sayFirstWords: scene.sayFirstWords,
    hearFirstWords: scene.hearFirstWords,
    oakAsksAfterThePokedex: scene.oakAsksAfterThePokedex,
    oakGives: scene.oakGives,
    dressPlayer: () => undefined,
    readTheBoard: scene.readTheBoard,
    joyOffers: scene.joyOffers,
    freshGame: scene.freshGame,
    openWorkshop: scene.openWorkshop,
    billOffersHisList: scene.billOffersHisList,
    billNames: scene.billNames,
    billStrikes: scene.billStrikes,
    // The vale's rumours are their own test's (`world/secrets.test.ts`).
    hearRumour: () => undefined,
  };
  const speak = (id: string, screen: string): void => {
    (scene.speakToKeeper as (this: typeof stand, entered: unknown, screen: string) => void).call(stand, roomNamed(id as never)!, screen);
  };
  const dayCare = (): void => {
    (scene.speakToDayCareMan as (this: typeof stand, at: unknown) => void).call(stand, { x: 45, y: 11 });
  };
  return { said, asked, opened, went, speak, dayCare, stand };
}

const NOTHING_NEW: Partial<RaidProgress> = { firstWordsHeard: ['lab'] };

describe('Professor Oak, from the mat', () => {
  it('greets and asks after the Pokédex, the same on every visit, and never reads the board out: nothing opens', () => {
    const manager = saved();
    const first = room(manager, [false]);
    first.speak('oaks-lab', 'lab');

    expect(first.said).toEqual([KEEPER_GREETINGS.lab]);
    expect(first.asked).toEqual([OAK_POKEDEX_QUESTION]);
    expect(first.opened).toEqual([]);
    expect(first.said).not.toContain(BARE_BOARD_LINE);
    // Nothing of his is heard once and never again.
    expect(manager.load()!.raidProgress.firstWordsHeard ?? []).toEqual([]);

    const again = room(manager, [false]);
    again.speak('oaks-lab', 'lab');
    expect(again.said).toEqual(first.said);
    expect(again.asked).toEqual(first.asked);
  });

  /**
   * The critic heard thirteen boxes of job, favours and rumours every time he
   * spoke to Oak (problem 8): the board is read off the wall, and the next job
   * is on the result screen's card (`hub/nextStep.ts`).
   */
  it('says nothing of the board, the next job or who is hurt', () => {
    retireMapsForTests(RETIRED_MAPS);
    try {
      const manager = saved({ ...NOTHING_NEW, raidRecord: { 'greystone-vale': { deployed: 1, extracted: 1, wiped: 0 } } }, (stash) => {
        stash.listPokemon()[0].pokemon.takeDamage(5);
      });
      const game = manager.load()!;
      const oak = room(manager, [false]);
      oak.speak('oaks-lab', 'lab');

      expect(oak.said).toEqual([KEEPER_GREETINGS.lab]);
      for (const line of boardLines(game)) {
        expect(oak.said).not.toContain(line);
      }
    } finally {
      retireMapsForTests([]);
    }
  });

  it('on YES with nothing due, counts the kinds and names the next milestone', () => {
    const oak = room(saved(NOTHING_NEW), [true]);
    oak.speak('oaks-lab', 'lab');
    expect(oak.said).toEqual([
      KEEPER_GREETINGS.lab,
      'Let me take a look… 1 kind of Pokémon caught!',
      'When you have 10 kinds of Pokémon, come back and see me.',
    ]);
  });

  it('asks his favour after his question is answered, never before it', () => {
    // His parcel lies on Greystone Vale, which is the map a save is offered.
    retireMapsForTests(RETIRED_MAPS);
    try {
      // A favour is asked once a job has been banked (`mayAskAFavour`).
      const manager = saved({ raidRecord: { 'greystone-vale': { deployed: 1, extracted: 1, wiped: 0 } }, standingContractsBanked: 1 });
      const oak = room(manager, [false, true]);
      oak.speak('oaks-lab', 'lab');

      expect(oak.asked[0]).toBe(OAK_POKEDEX_QUESTION);
      expect(oak.asked).toHaveLength(2);
      expect(oak.said[0]).toBe(KEEPER_GREETINGS.lab);
      expect(oak.said.findIndex((line) => line.includes('Before you go!'))).toBe(1);
    } finally {
      retireMapsForTests([]);
    }
  });
});

describe('the Pokédex: Professor Oak rewards each milestone in his lab, once', () => {
  const withKinds = (kinds: number, progress: Partial<RaidProgress> = NOTHING_NEW): SaveManager =>
    saved(progress, (stash) => {
      for (const species of ALL_SPECIES.slice(0, kinds)) {
        stash.addPokemon(new Pokemon(species, 5));
      }
    });

  it('hands over the reward for ten kinds in his own words on YES, into the vault before he says so', () => {
    const manager = withKinds(10);
    const balls = manager.load()!.stash.itemCount('great-ball');
    const oak = room(manager, [true]);
    oak.speak('oaks-lab', 'lab');

    const words = oak.said.join(' ');
    expect(oak.said[0]).toBe(KEEPER_GREETINGS.lab);
    expect(words).toContain('kinds of Pokémon caught!');
    expect(words).toContain('It looks as if you’re getting on the right track!');
    expect(words).toContain('Here, take 5 Great Balls.');
    expect(words).toContain('When you have 25 kinds of Pokémon, come back and see me.');
    const after = manager.load()!;
    expect(after.stash.itemCount('great-ball')).toBe(balls + 5);
    expect(after.raidProgress.pokedexRewards).toEqual([10]);
  });

  it('keeps a reward due on NOT NOW, and pays it the next time he is asked', () => {
    const manager = withKinds(10);
    room(manager, [false]).speak('oaks-lab', 'lab');
    expect(manager.load()!.raidProgress.pokedexRewards).toBeUndefined();
    room(manager, [true]).speak('oaks-lab', 'lab');
    expect(manager.load()!.raidProgress.pokedexRewards).toEqual([10]);
  });

  it('never gives the same milestone twice, and gives nothing short of one', () => {
    const manager = withKinds(10);
    room(manager, [true]).speak('oaks-lab', 'lab');
    const balls = manager.load()!.stash.itemCount('great-ball');
    const again = room(manager, [true]);
    again.speak('oaks-lab', 'lab');
    expect(again.said.join(' ')).not.toContain('Here, take');
    expect(manager.load()!.stash.itemCount('great-ball')).toBe(balls);

    const short = withKinds(8);
    const none = room(short, [true]);
    none.speak('oaks-lab', 'lab');
    expect(none.said.join(' ')).not.toContain('Here, take');
    expect(short.load()!.raidProgress.pokedexRewards).toBeUndefined();
  });

  it('gives two milestones crossed at once one after the other, counting only the once', () => {
    const manager = withKinds(26);
    const oak = room(manager, [true]);
    oak.speak('oaks-lab', 'lab');

    const words = oak.said.join(' ');
    expect(words.match(/Let me take a look/g)).toHaveLength(1);
    expect(words).toContain('And that’s not all!');
    expect(words).toContain('5 Super Potions and 5 Great Balls');
    expect(manager.load()!.raidProgress.pokedexRewards).toEqual([10, 25]);
  });
});

describe('Nurse Joy, at her counter', () => {
  /** Somebody hurt, on a save that has had today's free heal, unless it is to have it still. */
  const hurt = (progress: Partial<RaidProgress> = NOTHING_NEW, freeHealTaken = true): SaveManager => {
    const manager = saved(progress, (stash) => {
      stash.listPokemon()[0].pokemon.takeDamage(5);
    });
    if (freeHealTaken) {
      manager.save({ ...manager.load()!, freeHealDay: healDayOf(new Date()) });
    }
    return manager;
  };

  /**
   * Charmander came home fainted beside a fit Pidgey: bringing it round is the
   * one thing she charges for, and somebody can still raid without it.
   */
  const fainted = (freeHealTaken = true): SaveManager => {
    const manager = saved(NOTHING_NEW, (stash) => {
      const [first] = stash.listPokemon();
      first.pokemon.takeDamage(first.pokemon.maxHp);
      stash.addPokemon(new Pokemon(PIDGEY, 6), 'pidgey-1');
    });
    if (freeHealTaken) {
      manager.save({ ...manager.load()!, freeHealDay: healDayOf(new Date()) });
    }
    return manager;
  };

  it('greets, then asks with the price in the question: one box, every visit', () => {
    const manager = fainted();
    for (const visit of [0, 1]) {
      const joy = room(manager, [false]);
      joy.speak('pokemon-centre', 'stash');
      expect(joy.said[0], `visit ${visit}`).toBe(KEEPER_GREETINGS.stash);
      expect(joy.asked).toHaveLength(1);
      expect(joy.asked[0]).toMatch(/^Shall I heal Charmander\? It takes \d:\d\d off your next raid\.$/);
      expect(joy.said).toEqual([KEEPER_GREETINGS.stash, 'Of course. I’ll be right here.']);
      expect(joy.opened).toEqual([]);
    }
  });

  it('spends nothing on NOT NOW', () => {
    const manager = hurt();
    const joy = room(manager, [false]);
    joy.speak('pokemon-centre', 'stash');

    const after = manager.load()!;
    expect(after.pendingRecoveryMs).toBe(0);
    expect(after.stash.listPokemon()[0].pokemon.currentHp).toBeLessThan(after.stash.listPokemon()[0].pokemon.maxHp);
    expect(joy.went).toEqual([]);
  });

  it('heals everybody on YES, books the time, and comes back to the counter to say so', () => {
    const manager = fainted();
    const joy = room(manager, [true]);
    joy.speak('pokemon-centre', 'stash');

    const after = manager.load()!;
    expect(after.pendingRecoveryMs).toBeGreaterThan(0);
    for (const stored of after.stash.listPokemon()) {
      expect(stored.pokemon.currentHp).toBe(stored.pokemon.maxHp);
    }
    expect(joy.went).toHaveLength(1);
    expect(joy.went[0].room).toBe('pokemon-centre');
    expect(joy.went[0].said?.[0]).toContain('fit to raid');
  });

  it('heals free the first time each day, and the question is the one place that says what it costs', () => {
    const manager = fainted(false);
    const joy = room(manager, [true]);
    joy.speak('pokemon-centre', 'stash');
    expect(joy.asked[0]).toBe("Shall I heal Charmander? It won't cost your next raid a second.");
    expect([...joy.said, ...(joy.went[0].said ?? [])].join(' ')).not.toMatch(/free|Only a faint/);
    const after = manager.load()!;
    expect(after.pendingRecoveryMs).toBe(0);
    expect(after.freeHealDay).toBe(healDayOf(new Date()));
  });

  it('asks a fit team too, and says so on YES', () => {
    const joy = room(saved(NOTHING_NEW), [true]);
    joy.speak('pokemon-centre', 'stash');
    expect(joy.asked).toEqual(['Shall I heal your Pokémon?']);
    expect(joy.said).toEqual([KEEPER_GREETINGS.stash, 'Your Pokémon are all fit to raid.']);
    expect(joy.went).toEqual([]);
  });

  it('greets first even with everybody fainted, and then asks on YES', () => {
    const manager = saved(NOTHING_NEW, (stash) => {
      const [first] = stash.listPokemon();
      first.pokemon.takeDamage(first.pokemon.maxHp);
    });
    const joy = room(manager, [true]);
    joy.speak('pokemon-centre', 'stash');
    expect(joy.said[0]).toBe(KEEPER_GREETINGS.stash);
    expect(joy.went).toHaveLength(1);
  });
});

describe('Brock, from the mat', () => {
  const stocked = (progress: Partial<RaidProgress> = {}): SaveManager =>
    saved(progress, (stash) => stash.addItem('linen-roll', 4));

  it('greets and opens his screen on what the vault can pay for', () => {
    const brock = room(stocked());
    brock.speak('brocks-workshop', 'workshop');
    expect(brock.said).toEqual([KEEPER_GREETINGS.workshop]);
    expect(brock.opened).toEqual([expect.objectContaining({ view: 'workshop', build: 'recovery-bay-1' })]);
  });

  it('never asks a question or builds from the dialogue box: the screen is the one way to build (the owner, 26 Nov 2026)', () => {
    const manager = stocked();
    const brock = room(manager, [true, true, true]);
    brock.speak('brocks-workshop', 'workshop');
    expect(brock.asked).toEqual([]);
    const after = manager.load()!;
    expect(after.raidProgress.workshopUpgrades).toEqual([]);
    expect(after.stash.itemCount('linen-roll')).toBe(4);
    expect(brock.went).toEqual([]);
  });

  it('with nothing he can afford, still opens the screen on what is next', () => {
    const brock = room(saved());
    brock.speak('brocks-workshop', 'workshop');
    expect(brock.said).toEqual([KEEPER_GREETINGS.workshop]);
    expect(brock.opened).toEqual([expect.objectContaining({ view: 'workshop', build: 'radio-mast' })]);
  });
});

describe('Bill, at his cottage', () => {
  const HEARD: Partial<RaidProgress> = { traderMoneySpent: 5200 };
  const names = (stand: ReturnType<typeof room>['stand'], good: BillGood): void => {
    (BaseScene.prototype as unknown as { billNames: (this: unknown, good: BillGood, about: unknown) => void }).billNames.call(stand, good, []);
  };

  it('greets and offers the list, which is a screen only on YES', () => {
    const bill = room(saved(), [false]);
    bill.speak('bills-cottage', 'trader');
    expect(bill.said).toEqual([KEEPER_GREETINGS.trader]);
    expect(bill.asked).toEqual([SEE_THE_LIST_QUESTION]);
    expect(bill.opened).toEqual([]);

    const yes = room(saved(), [true]);
    yes.speak('bills-cottage', 'trader');
    expect(yes.opened[0]).toMatchObject({ view: 'trader', from: 'bills-cottage' });
  });

  it('never reads the player out or counts what they need for more', () => {
    for (const progress of [{}, { standingContractsBanked: 2 }, { defeatedBosses: ['vale-gym-misty'], standingContractsBanked: 3 }]) {
      const bill = room(saved(progress), [false]);
      bill.speak('bills-cottage', 'trader');
      expect(bill.said.join(' ')).not.toMatch(/know you|Bank|points|job/);
    }
  });

  it('sells a Potion on YES with no fade: he can sell another at once', () => {
    const manager = saved(HEARD, (stash) => stash.addItem('money', 500));
    const bill = room(manager, [true]);
    names(bill.stand, { kind: 'stock', itemId: 'potion' });
    const after = manager.load()!;
    expect(after.stash.itemCount('money')).toBe(380);
    // Off the ration: he sells Potions to anybody, as many as they can pay for.
    expect(after.traderRationUsed).toBe(0);
    expect(bill.went).toEqual([]);
    expect(bill.said.at(-1)).toContain('in YOUR THINGS');
  });

  it('strikes a barter on YES, and draws the room again with the thing off the shelf', () => {
    const manager = saved(HEARD, (stash) => {
      stash.addItem('parts-crate', 2);
      stash.addItem('cable-coil', 1);
    });
    const bill = room(manager, [true]);
    names(bill.stand, { kind: 'barter', barterId: 'barter-quick-claw' });
    const after = manager.load()!;
    expect(after.stash.itemCount('quick-claw')).toBe(1);
    expect(after.raidProgress.traderBarters).toEqual(['barter-quick-claw']);
    expect(bill.went).toHaveLength(1);
  });

  it('spends nothing on NOT NOW', () => {
    const manager = saved(HEARD, (stash) => stash.addItem('money', 500));
    const bill = room(manager, [false]);
    names(bill.stand, { kind: 'berth' });
    expect(manager.load()!.stash.itemCount('money')).toBe(500);
    expect(manager.load()!.traderBerthPaid).toBe(false);
  });
});

describe('the Day-Care Man, at his fence', () => {
  it('says his piece in the yard, and only then opens the short list', () => {
    const man = room(saved(NOTHING_NEW, (stash) => stash.addPokemon(new Pokemon(PIDGEY, 4), 'pidgey-1')));
    man.dayCare();

    expect(man.said[0]).toContain('I run the DAY-CARE service');
    expect(man.opened).toHaveLength(1);
    expect(man.opened[0]).toMatchObject({ view: 'daycare' });
  });

  it('turns a save with one Pokémon away in the yard, rather than offering a list with nothing on it', () => {
    const manager = saved(NOTHING_NEW);
    expect(manager.load()!.stash.listPokemon()).toHaveLength(1);
    const man = room(manager);
    man.dayCare();

    expect(man.said.join(' ')).toContain('I run the DAY-CARE service');
    expect(man.said.join(' ')).toContain('Oh? You only have one Pokémon.');
    expect(man.said.join(' ')).not.toContain('Would you like me to raise one of your Pokémon?');
    expect(man.opened).toEqual([]);
    expect(manager.load()!.stash.dayCare()).toBeNull();
  });

  it('tells somebody he is raising one for how it has grown, and gives it back on YES', () => {
    const manager = saved(NOTHING_NEW, (stash) => {
      stash.addPokemon(new Pokemon(PIDGEY, 4), 'pidgey-1');
      stash.leaveAtDayCare('pidgey-1', 0);
    });
    const game = manager.load()!;
    manager.save({
      ...game,
      raidProgress: { ...game.raidProgress, raidRecord: { 'floodplain-relay': { deployed: 4, extracted: 4, wiped: 0 } } },
    });
    const man = room(manager, [true]);
    man.dayCare();

    expect(man.asked[0]).toBe('Do you want Pidgey back?');
    expect(man.said[0]).toContain('has grown a lot');
    const after = manager.load()!;
    expect(after.stash.dayCare()).toBeNull();
    const pidgey = after.stash.listPokemon().find((stored) => stored.id === 'pidgey-1');
    expect(pidgey?.pokemon.level).toBe(6);
    expect(man.went[0].said?.join(' ')).toContain('Pidgey is Lv 6 now.');
  });

  it('keeps it on NOT NOW', () => {
    const manager = saved(NOTHING_NEW, (stash) => {
      stash.addPokemon(new Pokemon(PIDGEY, 4), 'pidgey-1');
      stash.leaveAtDayCare('pidgey-1', 0);
    });
    const man = room(manager, [false]);
    man.dayCare();
    expect(manager.load()!.stash.dayCare()).not.toBeNull();
    expect(man.went).toEqual([]);
  });
});

describe('at the rail', () => {
  const lookDown = (manager: SaveManager, notReady?: string, answers: readonly boolean[] = []) => {
    const said: (readonly string[])[] = [];
    const asked: { question: string; options?: readonly string[] }[] = [];
    const opened: unknown[][] = [];
    const toggled: string[] = [];
    const left = [...answers];
    const scene = BaseScene.prototype as unknown as Record<string, unknown>;
    const game = manager.load()!;
    const party = game.stash.listPokemon().slice(0, 1);
    const stand = {
      saveManager: manager,
      savedGame: game,
      currentTile: { x: 40, y: 40 },
      facing: 'up',
      player: { stop: () => undefined, setFrame: () => undefined },
      place: { room: { room: { keeper: { position: { x: 30, y: 30 } } } } },
      kit: {
        game,
        flow: {
          notReady,
          party,
          riskedItems: [{ itemId: 'poke-ball', quantity: 3 }],
          securedItems: [{ itemId: 'potion', quantity: 3 }],
          togglePokemon: (id: string) => toggled.push(id),
        },
      },
      say: (lines: readonly string[], _about: unknown, then?: () => void) => {
        said.push(lines);
        then?.();
      },
      askInBox: (question: string, answer: (yes: boolean) => void, options?: { options?: readonly string[] }) => {
        asked.push({ question, options: options?.options });
        answer(left.shift() ?? true);
      },
      sayFirstWords: scene.sayFirstWords,
      hearFirstWords: scene.hearFirstWords,
      openHallPanel: (...panel: unknown[]) => opened.push(panel),
    };
    (scene.lookDown as (this: typeof stand) => void).call(stand);
    return { said, asked, opened, toggled, party };
  };

  /** The critic's problem 5: the first jump was one SPACE, with nothing said of what was packed. */
  it('asks before the first jump, saying what was packed, and goes straight over on JUMP IN', () => {
    const { said, asked, opened, party } = lookDown(saved(NOTHING_NEW));
    expect(said).toEqual([]);
    expect(asked).toEqual([
      {
        question: `${party[0].pokemon.name.toUpperCase()} off the BENCH, 3 POKÉ BALLS off the RACK, 3 POTIONS safe in the LOCKER. Jump in?`,
        options: ['JUMP IN', 'NOT YET'],
      },
    ]);
    expect(opened).toEqual([['rim', true]]);
  });

  it('stays at the rail on NOT YET', () => {
    const { opened } = lookDown(saved(NOTHING_NEW), undefined, [false]);
    expect(opened).toEqual([]);
  });

  it('shows the card when something is wrong with the raid being got ready', () => {
    const { asked, opened } = lookDown(saved(NOTHING_NEW), 'Nobody is coming.');
    expect(asked).toEqual([]);
    expect(opened).toEqual([['rim']]);
  });

  it('shows the card from the second raid on, and still says nothing over it', () => {
    const { said, opened } = lookDown(saved({ ...NOTHING_NEW, raidRecord: { 'greystone-vale': { deployed: 1, extracted: 1, wiped: 0 } } }));
    expect(said).toEqual([]);
    expect(opened).toEqual([['rim']]);
  });

  it('offers a catch waiting at base to a lone Pokemon, once, before the card', () => {
    const progress = { ...NOTHING_NEW, raidRecord: { 'greystone-vale': { deployed: 1, extracted: 1, wiped: 0 } } };
    const manager = saved(progress, (stash) => {
      stash.addPokemon(new Pokemon(PIDGEY, 3), 'pidgey-1');
    });
    const first = lookDown(manager);
    expect(first.said).toEqual([FIRST_WORDS.benchCatch.lines]);
    expect(first.asked.map(({ question }) => question)).toEqual(['Take PIDGEY along?']);
    expect(first.toggled).toEqual(['pidgey-1']);
    expect(first.opened).toEqual([['rim']]);

    const again = lookDown(manager);
    expect(again.said).toEqual([]);
    expect(again.asked).toEqual([]);
  });
});

describe('the rim card opened just home from a raid', () => {
  // SPACE mashed through the result screen landed on the rail, opened the rim
  // card and jumped (raids bug hunt, fault 4). Every card opened before a step
  // is taken is asked to start off JUMP IN, so mashing only bumps on its first row.
  const hall = (homeOnTheRail: boolean) => {
    const launched: Record<string, unknown>[] = [];
    const scene = BaseScene.prototype as unknown as Record<string, unknown>;
    const stand = {
      kit: { flow: {} },
      arenaPanel: null as string | null,
      leaving: false,
      walkPlan: null,
      homeOnTheRail,
      place: { room: { room: { id: 'raid-arena' } } },
      standStill: () => undefined,
      scene: { launch: (_key: string, data: Record<string, unknown>) => launched.push(data) },
      currentTile: { x: 32, y: 53 },
      facing: 'right',
      controls: { run: { isDown: false } },
      stepStart: { set: () => undefined },
      stepEnd: { set: () => undefined },
      player: { play: () => undefined },
      playerTexture: 'player',
      partner: null,
    };
    const open = (view: string) => {
      stand.arenaPanel = null;
      (scene.openHallPanel as (this: typeof stand, view: string) => void).call(stand, view);
    };
    // A step off the rail, as the walk takes one.
    const step = () => (scene.beginStep as (this: typeof stand, tile: { x: number; y: number }) => void).call(stand, { x: 33, y: 53 });
    return { open, launched, step };
  };

  it('asks for the cursor off JUMP IN every time until a step is taken', () => {
    const { open, launched, step } = hall(true);
    open('rim');
    open('rim');
    step();
    open('rim');
    expect(launched.map((data) => data.justHome)).toEqual([true, true, undefined]);
  });

  it('asks nothing of a card opened after walking up to the rail', () => {
    const { open, launched } = hall(false);
    open('rim');
    expect(launched[0].justHome).toBeUndefined();
  });
});

describe('a base opened over a raid a crash left', () => {
  const opened = (pageStillThere: boolean) => {
    const restart = vi.fn();
    const asked = vi.spyOn(raidHeartbeat, 'stillLiveElsewhere').mockResolvedValue(pageStillThere);
    const scene = BaseScene.prototype as unknown as Record<string, unknown>;
    const stand = {
      saveManager: { load: () => ({ raidInFlight: { id: 'raid-1' } }) },
      visits: 0,
      leaving: false,
      sys: { isActive: () => true },
      place: { room: { room: { id: 'raid-arena' } } },
      currentTile: { x: 4, y: 5 },
      facing: 'up',
      scene: { restart },
    };
    (scene.settleOnceTheBrowserSays as (this: typeof stand) => void).call(stand);
    return { restart, asked };
  };

  // Its pulse looks live for a minute and a half, and the base left the raid
  // unsettled all that time (raids bug hunt, fault 5).
  it('opens again where the player stands once the browser says the page is gone, which settles it', async () => {
    const { restart, asked } = opened(false);
    await asked.mock.results[0].value;
    expect(restart).toHaveBeenCalledWith({ room: 'raid-arena', at: { x: 4, y: 5 }, facing: 'up' });
    asked.mockRestore();
  });

  it('leaves it to the window still playing it', async () => {
    const { restart, asked } = opened(true);
    await asked.mock.results[0].value;
    expect(restart).not.toHaveBeenCalled();
    asked.mockRestore();
  });
});

describe('a key past the talk', () => {
  it('goes straight to whatever the talk was on its way to', () => {
    const then = vi.fn();
    const scene = BaseScene.prototype as unknown as Record<string, unknown>;
    const dismiss = vi.fn();
    const stand = {
      afterSaid: then,
      spentPresses: { spendHeld: () => undefined },
      directionKeys: () => [],
      dialogBox: { dismiss },
    };
    (scene.skipTalk as (this: typeof stand) => void).call(stand);
    expect(dismiss).toHaveBeenCalled();
    expect(then).toHaveBeenCalledOnce();
    expect(stand.afterSaid).toBeNull();
  });
});
