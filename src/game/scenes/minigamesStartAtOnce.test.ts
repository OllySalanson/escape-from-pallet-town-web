import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The harbour audit of 27 Nov 2026, fault 3: SPACE at a cabinet opened a form
 * - a search box, a red list of who could not play, a pay table - and not a
 * game. Every harbour game now opens straight onto its own start line with a
 * player already chosen, and counts itself into play with no further press.
 *
 * Each game's real scene is driven here, as `BaseScene` opens it, over a
 * stand-in for Phaser that draws nothing: whatever the scene asks of the
 * canvas answers, and nothing is ever asked of a DOM screen.
 */

/** Anything at all, which answers anything: every Phaser drawing call lands here and draws nothing. */
function anything(): never {
  const target = function () {};
  const proxy: unknown = new Proxy(target, {
    get(_target, key) {
      if (key === Symbol.iterator) return function* () {};
      if (key === Symbol.toPrimitive) return () => 0;
      if (key === 'then') return undefined;
      return proxy;
    },
    apply: () => proxy,
    construct: () => proxy as object,
  });
  return proxy as never;
}

vi.mock('phaser', () => {
  class Scene {}
  class Vector2 {
    public readonly x: number;
    public readonly y: number;
    public constructor(x = 0, y = 0) {
      this.x = x;
      this.y = y;
    }
  }
  return {
    default: {
      Scene,
      Scenes: { Events: { SHUTDOWN: 'shutdown', RESUME: 'resume' } },
      Math: { Vector2 },
      Display: { Color: { HexStringToColor: () => ({ color: 0 }) } },
    },
  };
});
vi.mock('../audio/AudioManager', () => ({ audioManager: { play: () => undefined } }));
const overlays = vi.hoisted(() => ({ made: 0 }));
vi.mock('../ui/MenuOverlay', () => ({
  MenuOverlay: class {
    public constructor() {
      overlays.made += 1;
    }
  },
}));

const { SaveManager } = await import('../save/SaveManager');
const { Bag } = await import('../items');
const { PokemonParty, Pokemon } = await import('../pokemon');
const { getSpeciesById } = await import('../pokemon/species');
const { createStartingStash, getStarterSpecies, Stash } = await import('../stash');
const { HOUSE_JUMPER, HOUSE_PICKER } = await import('../minigames/houseLoans');
const { GameCornerScene } = await import('./GameCornerScene');
const { BerryPickingScene } = await import('./BerryPickingScene');
const { FieldCourseScene } = await import('./FieldCourseScene');
const { DigScene } = await import('./DigScene');
const { DerbyScene } = await import('./DerbyScene');
const { FishingDerbyScene } = await import('./FishingDerbyScene');

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

type Vault = InstanceType<typeof Stash>;

const mon = (species: string, level: number): InstanceType<typeof Pokemon> => new Pokemon(getSpeciesById(species)!, level);

/** The three saves the audit was played on. */
const SAVES = {
  // A new game, its partner just taken off Oak's table.
  fresh: () => createStartingStash(getStarterSpecies('squirtle')),
  // Sam, just home from the first raid (`after-first-raid.json`).
  sam: () => createStartingStash(getStarterSpecies('charmander')),
  // Jo, ten raids in, the partner an IVYSAUR that cannot jump (`midgame-rich.json`).
  jo: () => {
    const stash = new Stash();
    stash.addPokemon(mon('ivysaur', 17), 'bulbasaur-1');
    stash.addPokemon(mon('diglett', 3), 'diglett-1');
    stash.adoptPartner('bulbasaur-1');
    return stash;
  },
} satisfies Readonly<Record<string, () => Vault>>;

interface Driven {
  readonly phaseKind: string;
  update(time: number, delta: number): void;
  init(data: unknown): void;
  create(): void;
}

/** A scene as the game would run it, over a canvas that draws nothing; its key handler is handed back to press with. */
function open(scene: Driven): { press: (key: string) => void; stopped: () => boolean } {
  let keydown: ((event: KeyboardEvent) => void) | undefined;
  let stopped = false;
  Object.assign(scene, {
    add: anything(),
    make: anything(),
    tweens: anything(),
    sys: anything(),
    game: { canvas: undefined, loop: { frame: 0 } },
    scale: { width: 320, height: 240 },
    time: { now: 0, delayedCall: () => undefined },
    textures: { exists: () => true, get: () => anything() },
    cameras: { main: anything(), add: () => anything(), remove: () => undefined },
    events: { once: () => undefined, on: () => undefined },
    input: {
      on: () => undefined,
      keyboard: {
        on: (name: string, handler: (event: KeyboardEvent) => void) => {
          if (name === 'keydown') keydown = handler;
        },
      },
    },
    scene: {
      key: 'game',
      isActive: () => !stopped,
      isPaused: () => true,
      stop: () => {
        stopped = true;
      },
      resume: () => undefined,
      setVisible: () => undefined,
    },
  });
  scene.init({ pausedBase: true, mode: 'jump' });
  scene.create();
  return {
    press: (key) => keydown?.({ key, repeat: false, preventDefault: () => undefined } as unknown as KeyboardEvent),
    stopped: () => stopped,
  };
}

/** Frames of test mode's 100 ms until the scene is playing, or a ceiling of ten seconds. */
function countIn(scene: Driven): number {
  let frames = 0;
  while (scene.phaseKind !== 'playing' && scene.phaseKind !== 'running' && frames < 100) {
    scene.update(frames * 100, 100);
    frames += 1;
  }
  return frames;
}

const GAMES = [
  { name: 'POKéMON JUMP', make: () => new GameCornerScene(), player: (scene: unknown) => (scene as { teamIds: readonly string[] }).teamIds[0] },
  { name: 'BERRY PICKING', make: () => new BerryPickingScene(), player: (scene: unknown) => (scene as { playerId?: string }).playerId },
  { name: 'THE FIELD-MOVE COURSE', make: () => new FieldCourseScene(), player: (scene: unknown) => (scene as { teamIds: readonly string[] }).teamIds[0] },
  { name: 'THE DIG', make: () => new DigScene(), player: (scene: unknown) => (scene as { playerId?: string }).playerId },
  { name: 'PROMENADE DERBY', make: () => new DerbyScene(), player: (scene: unknown) => (scene as { playerId?: string }).playerId },
  { name: 'FISHING DERBY', make: () => new FishingDerbyScene(), player: (scene: unknown) => (scene as { playerId?: string }).playerId },
] as const;

/** Who each game starts on, for each save: the partner where it can play, else the house's loan. */
const EXPECTED: Readonly<Record<(typeof GAMES)[number]['name'], Readonly<Record<keyof typeof SAVES, string>>>> = {
  'POKéMON JUMP': { fresh: 'squirtle-1', sam: 'charmander-1', jo: HOUSE_JUMPER.id },
  'BERRY PICKING': { fresh: HOUSE_PICKER.id, sam: HOUSE_PICKER.id, jo: HOUSE_PICKER.id },
  'THE FIELD-MOVE COURSE': { fresh: 'squirtle-1', sam: 'charmander-1', jo: 'bulbasaur-1' },
  'THE DIG': { fresh: 'squirtle-1', sam: 'charmander-1', jo: 'bulbasaur-1' },
  'PROMENADE DERBY': { fresh: 'squirtle-1', sam: 'charmander-1', jo: 'bulbasaur-1' },
  'FISHING DERBY': { fresh: 'squirtle-1', sam: 'charmander-1', jo: 'bulbasaur-1' },
};

describe('every harbour game is one press from playing', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
    vi.stubGlobal('window', { localStorage: storage });
    overlays.made = 0;
  });

  const seat = (vault: Vault): void => {
    const saved = new SaveManager(storage).save({ party: new PokemonParty([]), mapId: 'pallet-town', position: { x: 6, y: 8 }, bag: new Bag(), stash: vault });
    expect(saved).toBe(true);
  };

  for (const game of GAMES) {
    for (const save of Object.keys(SAVES) as (keyof typeof SAVES)[]) {
      it(`${game.name} opens on its start line with a player chosen, and counts into play unpressed (${save})`, () => {
        seat(SAVES[save]());
        const scene = game.make() as unknown as Driven;
        const driven = open(scene);
        expect(driven.stopped()).toBe(false);
        expect(scene.phaseKind).toBe('ready');
        expect(game.player(scene)).toBe(EXPECTED[game.name][save]);
        // Never a form: no DOM screen is made on the way to play.
        const frames = countIn(scene);
        expect(['playing', 'running']).toContain(scene.phaseKind);
        // READY and the count, under four seconds of play time.
        expect(frames).toBeLessThanOrEqual(40);
        expect(overlays.made).toBe(0);
      });
    }
  }

  it('changes who plays with one press of RIGHT on the start line, and back with LEFT', () => {
    seat(SAVES.sam());
    const scene = new GameCornerScene() as unknown as Driven & { teamIds: readonly string[] };
    const driven = open(scene);
    expect(scene.teamIds[0]).toBe('charmander-1');
    driven.press('ArrowRight');
    expect(scene.phaseKind).toBe('ready');
    expect(scene.teamIds[0]).toBe(HOUSE_JUMPER.id);
    driven.press('ArrowLeft');
    expect(scene.teamIds[0]).toBe('charmander-1');
  });

  it('shows a game ended over its field, and plays again on SPACE once the result has been seen', () => {
    seat(SAVES.sam());
    const scene = new DigScene() as unknown as Driven & { playerId?: string };
    const driven = open(scene);
    countIn(scene);
    driven.press('Escape');
    expect(scene.phaseKind).toBe('result');
    // The press still going at the end does not start the next game over the result.
    driven.press(' ');
    expect(scene.phaseKind).toBe('result');
    for (let frame = 0; frame < 16; frame += 1) scene.update(frame * 100, 100);
    driven.press(' ');
    expect(scene.phaseKind).toBe('ready');
    expect(scene.playerId).toBe('charmander-1');
    expect(overlays.made).toBe(0);
  });

  it('leaves from the start line on ESC, having written nothing', () => {
    seat(SAVES.jo());
    const before = storage.getItem('escape-from-pallet-town.save.v1');
    const scene = new DigScene() as unknown as Driven;
    const driven = open(scene);
    driven.press('Escape');
    expect(driven.stopped()).toBe(true);
    expect(storage.getItem('escape-from-pallet-town.save.v1')).toBe(before);
  });
});
