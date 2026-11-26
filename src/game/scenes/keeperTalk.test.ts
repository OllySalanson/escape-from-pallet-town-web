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
import { BARE_BOARD_LINE, boardLines, boardPointer } from '../base/labBoard';
import { nextStepLines } from '../hub/nextStep';
import { CHARMANDER, PIDGEY, Pokemon, PokemonParty } from '../pokemon';
import { ALL_SPECIES } from '../pokemon/species';
import { Bag } from '../items';
import { FIRST_WORDS } from '../hub/firstWords';
import { healDayOf } from '../hub/recovery';
import type { BillGood } from '../hub/billTalk';
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
    player: { stop: () => undefined, setFrame: () => undefined },
    place: { room: { room: { id: 'pokemon-centre' } } },
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
    sayFavour: scene.sayFavour,
    askFavour: scene.askFavour,
    answerFavour: scene.answerFavour,
    sayFirstWords: scene.sayFirstWords,
    hearFirstWords: scene.hearFirstWords,
    oakGives: scene.oakGives,
    dressPlayer: () => undefined,
    readTheBoard: scene.readTheBoard,
    oakSaysWhatIsNext: scene.oakSaysWhatIsNext,
    offerFriendRoom: scene.offerFriendRoom,
    joyOffers: scene.joyOffers,
    freshGame: scene.freshGame,
    brockQuotes: scene.brockQuotes,
    billReadsYou: scene.billReadsYou,
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

const NOTHING_NEW: Partial<RaidProgress> = { firstWordsHeard: ['lab', 'loadout', 'center'] };

describe('Professor Oak, from the mat', () => {
  it('tells a newcomer what a raid is in the room, once, and never reads the board out: nothing opens', () => {
    const manager = saved();
    const first = room(manager, [false]);
    first.speak('oaks-lab', 'lab');

    expect(first.opened).toEqual([]);
    for (const line of FIRST_WORDS.lab.lines.slice(1)) {
      expect(first.said).toContain(line);
    }
    const game = manager.load()!;
    expect(game.raidProgress.firstWordsHeard).toEqual(['lab']);
    expect(first.said).not.toContain(BARE_BOARD_LINE);

    const again = room(manager, [false]);
    again.speak('oaks-lab', 'lab');
    expect(again.said).not.toContain(FIRST_WORDS.lab.lines[1]);
  });

  /**
   * The critic heard thirteen boxes of job, favours and rumours every time he
   * spoke to Oak (problem 8): now Oak says the one next thing and where the
   * rest is pinned, and the board is read off the wall.
   */
  it('says the one next thing and points at his board, rather than reading it out', () => {
    retireMapsForTests(RETIRED_MAPS);
    try {
      const manager = saved({ ...NOTHING_NEW, raidRecord: { 'greystone-vale': { deployed: 1, extracted: 1, wiped: 0 } } });
      const game = manager.load()!;
      const oak = room(manager, [false]);
      oak.speak('oaks-lab', 'lab');

      expect(oak.said).toEqual([...nextStepLines(game.raidProgress), ...boardPointer(game, 1)]);
      expect(oak.said.join(' ')).toMatch(/^Next, a job: /);
      for (const line of boardLines(game)) {
        expect(oak.said).not.toContain(line);
      }
    } finally {
      retireMapsForTests([]);
    }
  });

  it('marks the end of the near jobs once, then names what is next', () => {
    retireMapsForTests(RETIRED_MAPS);
    try {
      const manager = saved({ ...NOTHING_NEW, raidRecord: { 'greystone-vale': { deployed: 4, extracted: 4, wiped: 0 } }, standingContractsBanked: 2 });
      const first = room(manager, [false]);
      first.speak('oaks-lab', 'lab');
      const done = first.said.indexOf(FIRST_WORDS.nearWork.lines[0]);
      expect(done).toBeGreaterThanOrEqual(0);
      expect(first.said.findIndex((line) => line.includes('MISTY'))).toBeGreaterThan(done);

      const again = room(manager, [false]);
      again.speak('oaks-lab', 'lab');
      expect(again.said).not.toContain(FIRST_WORDS.nearWork.lines[0]);
    } finally {
      retireMapsForTests([]);
    }
  });

  it('says who is hurt and what the clock has lost before anything else', () => {
    const manager = saved(NOTHING_NEW, (stash) => {
      stash.listPokemon()[0].pokemon.takeDamage(5);
    });
    const game = manager.load()!;
    manager.save({ ...game, pendingRecoveryMs: 45_000 });
    const oak = room(manager);
    oak.speak('oaks-lab', 'lab');

    expect(oak.said[0]).toContain('came home hurt. NURSE JOY is across the yard.');
    expect(oak.said[1]).toBe('Your next raid runs 4:15: 0:45 went on recovery.');
  });

  it('asks his favour after his first words and before what is next', () => {
    // His parcel lies on Greystone Vale, which is the map a save is offered.
    retireMapsForTests(RETIRED_MAPS);
    try {
      // A favour is asked once a job has been banked (`mayAskAFavour`).
      const manager = saved({ raidRecord: { 'greystone-vale': { deployed: 1, extracted: 1, wiped: 0 } }, standingContractsBanked: 1 });
      const oak = room(manager, [true]);
      oak.speak('oaks-lab', 'lab');

      expect(oak.asked).toHaveLength(1);
      const favour = oak.said.findIndex((line) => line.includes('Before you go!'));
      expect(favour).toBeGreaterThan(oak.said.indexOf(FIRST_WORDS.lab.lines[1]));
      expect(favour).toBeLessThan(oak.said.findIndex((line) => line.includes('is on the rail')));
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

  it('hands over the reward for ten kinds in his own words, into the vault before he says so', () => {
    const manager = withKinds(10);
    const balls = manager.load()!.stash.itemCount('great-ball');
    const oak = room(manager);
    oak.speak('oaks-lab', 'lab');

    const words = oak.said.join(' ');
    expect(words).toContain('kinds of Pokémon caught!');
    expect(words).toContain('It looks as if you’re getting on the right track!');
    expect(words).toContain('Here, take 5 Great Balls.');
    expect(words).toContain('When you have 25 kinds of Pokémon, come back and see me.');
    const after = manager.load()!;
    expect(after.stash.itemCount('great-ball')).toBe(balls + 5);
    expect(after.raidProgress.pokedexRewards).toEqual([10]);
  });

  it('never gives the same milestone twice, and says nothing short of one', () => {
    const manager = withKinds(10);
    room(manager).speak('oaks-lab', 'lab');
    const balls = manager.load()!.stash.itemCount('great-ball');
    const again = room(manager);
    again.speak('oaks-lab', 'lab');
    expect(again.said.join(' ')).not.toContain('kinds of Pokémon caught!');
    expect(manager.load()!.stash.itemCount('great-ball')).toBe(balls);

    const short = withKinds(8);
    const none = room(short);
    none.speak('oaks-lab', 'lab');
    expect(none.said.join(' ')).not.toContain('kinds of Pokémon caught!');
    expect(short.load()!.raidProgress.pokedexRewards).toBeUndefined();
  });

  it('lets Oak finish his first words before he hands anything over', () => {
    const oak = room(withKinds(10, {}), [false]);
    oak.speak('oaks-lab', 'lab');
    expect(oak.said.indexOf(FIRST_WORDS.lab.lines[3])).toBeLessThan(
      oak.said.findIndex((line) => line.includes('Here, take 5 Great Balls.')),
    );
  });

  it('gives two milestones crossed at once one after the other, greeting only the once', () => {
    const manager = withKinds(26);
    const oak = room(manager);
    oak.speak('oaks-lab', 'lab');

    const words = oak.said.join(' ');
    expect(words.match(/Good to see you/g)).toHaveLength(1);
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

  it('welcomes a newcomer, once, then says the price: moving boxes is not her job', () => {
    const manager = hurt({ firstWordsHeard: ['lab', 'loadout'] });
    const joy = room(manager, [false]);
    joy.speak('pokemon-centre', 'stash');

    expect(joy.said.slice(0, FIRST_WORDS.center.lines.length)).toEqual(FIRST_WORDS.center.lines);
    expect(joy.said.join(' ')).toContain('off your next raid');
    expect(joy.asked).toHaveLength(1);
    expect(joy.opened).toEqual([]);
    expect(manager.load()!.raidProgress.firstWordsHeard).toContain('center');
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

  it('heals free the first time each day, and says so once in the whole visit', () => {
    const manager = fainted(false);
    const joy = room(manager, [true]);
    joy.speak('pokemon-centre', 'stash');
    expect(joy.said.join(' ')).toContain('Your first heal today is free');
    // Three times in one visit read as rules text (retest, 22 Nov 2026).
    expect([...joy.said, ...(joy.went[0].said ?? [])].join(' ').match(/free/g)).toHaveLength(1);
    const after = manager.load()!;
    expect(after.pendingRecoveryMs).toBe(0);
    expect(after.freeHealDay).toBe(healDayOf(new Date()));
  });

  it("says the rule with a price: at most 1:00, and tomorrow's first free", () => {
    const joy = room(fainted(), [false]);
    joy.speak('pokemon-centre', 'stash');
    expect(joy.said.join(' ')).toContain(
      "A scratch mends free. Only a faint costs, at most 1:00 of a raid, and today's free one is used: tomorrow's first is free.",
    );
  });

  it('asks nothing of a fit team', () => {
    const joy = room(saved(NOTHING_NEW));
    joy.speak('pokemon-centre', 'stash');
    expect(joy.asked).toEqual([]);
    expect(joy.said).toEqual(['Your Pokémon are all fit to raid.']);
  });
});

describe('Brock, from the mat', () => {
  const HEARD: Partial<RaidProgress> = { firstWordsHeard: ['workshop'] };
  const stocked = (progress: Partial<RaidProgress> = HEARD): SaveManager =>
    saved(progress, (stash) => stash.addItem('linen-roll', 4));

  it('says what his chalk is once, then quotes what the vault can pay for: nothing opens', () => {
    const manager = stocked({});
    const brock = room(manager, [false]);
    brock.speak('brocks-workshop', 'workshop');
    expect(brock.said.slice(0, FIRST_WORDS.workshop.lines.length)).toEqual(FIRST_WORDS.workshop.lines);
    expect(brock.said.join(' ')).toContain('Healing machine I.');
    expect(brock.asked).toHaveLength(1);
    expect(brock.opened).toEqual([]);

    const again = room(manager, [false]);
    again.speak('brocks-workshop', 'workshop');
    expect(again.said).not.toContain(FIRST_WORDS.workshop.lines[0]);
  });

  it('spends nothing on NOT NOW', () => {
    const manager = stocked();
    const brock = room(manager, [false]);
    brock.speak('brocks-workshop', 'workshop');
    const after = manager.load()!;
    expect(after.raidProgress.workshopUpgrades).toEqual([]);
    expect(after.stash.itemCount('linen-roll')).toBe(4);
    expect(brock.went).toEqual([]);
  });

  it('builds on YES, in one write, and draws the room again to say so where he stands', () => {
    const manager = stocked();
    const brock = room(manager, [true]);
    brock.speak('brocks-workshop', 'workshop');
    const after = manager.load()!;
    expect(after.raidProgress.workshopUpgrades).toEqual(['recovery-bay-1']);
    expect(after.stash.itemCount('linen-roll')).toBe(0);
    expect(brock.went[0].said?.[0]).toBe("Healing machine I is in, and it's staying.");
  });
});

describe('Bill, at his cottage', () => {
  const HEARD: Partial<RaidProgress> = { firstWordsHeard: ['cottage'], traderMoneySpent: 5200 };
  const names = (stand: ReturnType<typeof room>['stand'], good: BillGood): void => {
    (BaseScene.prototype as unknown as { billNames: (this: unknown, good: BillGood, about: unknown) => void }).billNames.call(stand, good, []);
  };

  it('reads the player from the mat and offers the list, which is a screen only on YES', () => {
    const bill = room(saved({ firstWordsHeard: ['cottage'] }), [false]);
    bill.speak('bills-cottage', 'trader');
    expect(bill.said[0]).toContain("I don't know you");
    expect(bill.opened).toEqual([]);

    const yes = room(saved({ firstWordsHeard: ['cottage'] }), [true]);
    yes.speak('bills-cottage', 'trader');
    expect(yes.opened[0]).toMatchObject({ view: 'trader', from: 'bills-cottage' });
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
