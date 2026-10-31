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
import { roomNamed } from '../base/rooms';
import { retireMapsForTests, RETIRED_MAPS } from '../world/mapRoster';
import { boardLines } from '../base/labBoard';
import { CHARMANDER, PIDGEY, Pokemon, PokemonParty } from '../pokemon';
import { ALL_SPECIES } from '../pokemon/species';
import { Bag } from '../items';
import { FIRST_WORDS } from '../hub/firstWords';
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
    readTheBoard: scene.readTheBoard,
    joyOffers: scene.joyOffers,
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
  it('tells a newcomer what a raid is in the room, once, and then reads the board: nothing opens', () => {
    const manager = saved();
    const first = room(manager, [false]);
    first.speak('oaks-lab', 'lab');

    expect(first.opened).toEqual([]);
    for (const line of FIRST_WORDS.lab.lines.slice(1)) {
      expect(first.said).toContain(line);
    }
    const game = manager.load()!;
    expect(game.raidProgress.firstWordsHeard).toEqual(['lab']);
    expect(first.said.join(' ')).toContain(boardLines(game)[0]);

    const again = room(manager, [false]);
    again.speak('oaks-lab', 'lab');
    expect(again.said).not.toContain(FIRST_WORDS.lab.lines[1]);
    expect(again.said.join(' ')).toContain(boardLines(game)[0]);
  });

  it('says who is hurt and what the clock has lost before he reads the board', () => {
    const manager = saved(NOTHING_NEW, (stash) => {
      stash.listPokemon()[0].pokemon.takeDamage(5);
    });
    const game = manager.load()!;
    manager.save({ ...game, pendingRecoveryMs: 100_000 });
    const oak = room(manager);
    oak.speak('oaks-lab', 'lab');

    expect(oak.said[0]).toContain('came home hurt. NURSE JOY is across the yard.');
    expect(oak.said[1]).toBe('Your next raid runs 3:20: 1:40 went on recovery.');
  });

  it('asks his favour after his first words and before the board', () => {
    // His parcel lies on Greystone Vale, which is the map a save is offered.
    retireMapsForTests(RETIRED_MAPS);
    try {
      const manager = saved();
      const oak = room(manager, [true]);
      oak.speak('oaks-lab', 'lab');

      expect(oak.asked).toHaveLength(1);
      const favour = oak.said.findIndex((line) => line.includes('Before you go!'));
      expect(favour).toBeGreaterThan(oak.said.indexOf(FIRST_WORDS.lab.lines[3]));
      expect(favour).toBeLessThan(oak.said.indexOf(boardLines(manager.load()!)[0]));
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
  const hurt = (progress: Partial<RaidProgress> = NOTHING_NEW): SaveManager =>
    saved(progress, (stash) => {
      stash.listPokemon()[0].pokemon.takeDamage(5);
    });

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
    const manager = hurt();
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

  it('asks nothing of a fit team', () => {
    const joy = room(saved(NOTHING_NEW));
    joy.speak('pokemon-centre', 'stash');
    expect(joy.asked).toEqual([]);
    expect(joy.said).toEqual(['Your Pokémon are all fit to raid.']);
  });
});

describe('the Day-Care Man, at his fence', () => {
  it('says his piece in the yard, and only then opens the short list', () => {
    const man = room(saved(NOTHING_NEW));
    man.dayCare();

    expect(man.said[0]).toContain('I run the DAY-CARE service');
    expect(man.opened).toHaveLength(1);
    expect(man.opened[0]).toMatchObject({ view: 'daycare' });
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

describe('the marshal, at the rim of the pit', () => {
  const lookDown = (manager: SaveManager) => {
    const said: (readonly string[])[] = [];
    const opened: string[] = [];
    const scene = BaseScene.prototype as unknown as Record<string, unknown>;
    const stand = {
      saveManager: manager,
      savedGame: manager.load()!,
      currentTile: { x: 40, y: 40 },
      facing: 'up',
      player: { stop: () => undefined, setFrame: () => undefined },
      place: { room: { room: { keeper: { position: { x: 30, y: 30 } } } } },
      sayFirstWords: scene.sayFirstWords,
      hearFirstWords: scene.hearFirstWords,
      say: (lines: readonly string[], _about: unknown, then: () => void) => {
        said.push(lines);
        then();
      },
      openHallPanel: (panel: string) => opened.push(panel),
    };
    (scene.lookDown as (this: typeof stand) => void).call(stand);
    return { said, opened };
  };

  it('says what is down there once, in the hall, before the panel opens over it', () => {
    const manager = saved(NOTHING_NEW);
    const first = lookDown(manager);
    expect(first.said).toEqual([FIRST_WORDS.check.lines]);
    expect(first.opened).toEqual(['rim']);
    expect(manager.load()!.raidProgress.firstWordsHeard).toContain('check');

    const again = lookDown(manager);
    expect(again.said).toEqual([]);
    expect(again.opened).toEqual(['rim']);
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
