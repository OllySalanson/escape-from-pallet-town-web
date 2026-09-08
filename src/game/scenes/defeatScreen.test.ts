import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Drives the real ExtractionScene through a lost raid's defeat sequence.
 *
 * The sequence sits between a defeat and the accounting the player needs, so the
 * things worth proving are the ones that could trap somebody: that a defeat
 * reaches it, that any key ends it from the very first frame, that the result
 * screen is still what the player is left holding, and that a second defeat on
 * the same reused scene object plays rather than inheriting the first one's
 * finished state.
 */

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown', DESTROY: 'destroy' } },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'camerafadeoutcomplete' } } },
  },
}));

vi.mock('../audio/AudioManager', () => ({
  audioManager: { playFaint: vi.fn(), playConfirm: vi.fn() },
}));

const overlayRoots: FakeRoot[] = [];
vi.mock('../ui/MenuOverlay', () => ({
  MenuOverlay: class {
    public readonly root = new FakeRoot();
    public constructor() {
      overlayRoots.push(this.root);
    }
    public focus(): void {}
    public destroy(): void {}
  },
  hpBar: () => '',
  pokemonAvatar: () => '',
}));

import { Bag } from '../items';
import { BULBASAUR, CHARMANDER, Pokemon } from '../pokemon';
import { RunManager } from '../run/RunManager';
import { buildExtractionReport, type ExtractionReport } from '../run/extractionReport';
import { ExtractionScene } from './ExtractionScene';

/**
 * Just enough DOM for the scene's own reads. The project runs its tests without
 * a browser environment, so the alternative to this is not testing the beats.
 */
class FakeElement {
  public dataset: Record<string, string> = {};
  public textContent = '';
  public disabled = false;
  public onclick: (() => void) | undefined;
  public onpointerdown: (() => void) | undefined;
  public readonly offsetWidth = 0;
  public parentElement: FakeElement | undefined;
  public readonly classes = new Set<string>();
  public readonly classList = {
    add: (name: string) => this.classes.add(name),
    remove: (name: string) => this.classes.delete(name),
  };
  private readonly children = new Map<string, FakeElement>();

  public child(selector: string): FakeElement {
    const existing = this.children.get(selector);
    if (existing) {
      return existing;
    }
    const created = new FakeElement();
    created.parentElement = this;
    this.children.set(selector, created);
    return created;
  }

  public querySelector(selector: string): FakeElement | null {
    return this.children.get(selector) ?? null;
  }
}

class FakeRoot {
  public html = '';
  public readonly stage = new FakeElement();
  public readonly continueButton = new FakeElement();

  public constructor() {
    this.stage.child('[data-defeat-headline]');
    this.stage.child('[data-defeat-detail]');
  }

  public set innerHTML(value: string) {
    this.html = value;
    // A fresh render is a fresh stage, exactly as it is in the browser.
    this.stage.dataset = {};
  }

  public get innerHTML(): string {
    return this.html;
  }

  public setAttribute(): void {}

  public querySelector(selector: string): FakeElement | null {
    if (selector === '[data-defeat]') {
      return this.html.includes('data-defeat ') ? this.stage : null;
    }
    if (selector === '[data-continue]') {
      return this.html.includes('data-continue') ? this.continueButton : null;
    }
    return null;
  }
}

interface Timer {
  readonly at: number;
  readonly callback: () => void;
  cancelled: boolean;
  remove(): void;
}

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

let keyListeners: ((event: KeyboardEvent) => void)[] = [];
let storage: MemoryStorage;

beforeEach(() => {
  keyListeners = [];
  storage = new MemoryStorage();
  overlayRoots.length = 0;
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      addEventListener: (type: string, listener: (event: KeyboardEvent) => void) => {
        if (type === 'keydown') {
          keyListeners.push(listener);
        }
      },
      removeEventListener: (_type: string, listener: (event: KeyboardEvent) => void) => {
        keyListeners = keyListeners.filter((entry) => entry !== listener);
      },
      localStorage: storage,
    },
  });
});

afterEach(() => {
  Reflect.deleteProperty(globalThis, 'window');
});

function press(key: string): void {
  for (const listener of [...keyListeners]) {
    listener({ key, preventDefault: () => {} } as KeyboardEvent);
  }
}

interface Harness {
  readonly scene: ExtractionScene;
  readonly root: FakeRoot;
  readonly start: ReturnType<typeof vi.fn>;
  readonly advance: (ms: number) => void;
}

function createScene(): { scene: ExtractionScene; start: ReturnType<typeof vi.fn>; advance: (ms: number) => void } {
  const scene = Object.create(ExtractionScene.prototype) as ExtractionScene;
  const start = vi.fn();
  const timers: Timer[] = [];
  let now = 0;
  const advance = (ms: number): void => {
    const until = now + ms;
    for (;;) {
      const due = timers
        .filter((timer) => !timer.cancelled && timer.at <= until)
        .sort((a, b) => a.at - b.at)[0];
      if (!due) {
        break;
      }
      due.cancelled = true;
      now = due.at;
      due.callback();
    }
    now = until;
  };

  Object.assign(scene as unknown as Record<string, unknown>, {
    cameras: {
      main: {
        fadeIn: vi.fn(),
        fadeOut: vi.fn(),
        // Fades resolve immediately so a hand-off is observable rather than
        // stranded in a callback nothing ever fires.
        once: (_event: string, callback: () => void) => callback(),
      },
    },
    scene: { start, manager: { keys: { hub: {}, extraction: {} } } },
    events: { once: vi.fn() },
    time: {
      delayedCall: (delayMs: number, callback: () => void): Timer => {
        const timer: Timer = {
          at: now + delayMs,
          callback,
          cancelled: false,
          remove: () => {
            timer.cancelled = true;
          },
        };
        timers.push(timer);
        return timer;
      },
    },
  });
  return { scene, start, advance };
}

const DURATION_MS = 300_000;

function defeatReport(secureSecond = true): ExtractionReport {
  const party = [new Pokemon(CHARMANDER, 12), new Pokemon(BULBASAUR, 9)];
  const manager = new RunManager();
  const secureSlot = secureSecond ? { pokemon: party[1] } : {};
  manager.startRun(
    { party, items: [{ itemId: 'potion', quantity: 2 }] },
    { mapId: 'floodplain-relay', durationMs: DURATION_MS },
    secureSlot,
  );
  manager.tick(90_000);
  for (const member of party) {
    member.takeDamage(member.maxHp);
  }
  const result = manager.resolveWipe(secureSlot);
  return buildExtractionReport({
    outcome: 'WIPED',
    cause: 'defeated',
    snapshot: manager.snapshot(),
    durationMs: DURATION_MS,
    lost: { pokemon: result.lostPokemon, items: result.lostItems },
    carriedOut: new Bag().toJSON(),
    lastStand: party[0],
    saved: true,
  });
}

function escapeReport(): ExtractionReport {
  const manager = new RunManager();
  manager.startRun(
    { party: [new Pokemon(CHARMANDER, 12)], items: [] },
    { mapId: 'floodplain-relay', durationMs: DURATION_MS },
  );
  const result = manager.resolveEscape();
  return buildExtractionReport({
    outcome: 'ESCAPED',
    snapshot: manager.snapshot(),
    durationMs: DURATION_MS,
    banked: { pokemon: result.bankedPokemon, items: result.bankedItems },
    saved: true,
  });
}

function open(report: ExtractionReport): Harness {
  const { scene, start, advance } = createScene();
  scene.init({ report });
  scene.create();
  return { scene, root: overlayRoots[overlayRoots.length - 1], start, advance };
}

describe('the result screen on a defeat', () => {
  it('opens on the fallen party rather than straight on the ledger', () => {
    const { root } = open(defeatReport());

    expect(root.html).toContain('defeat-stage');
    expect(root.html).toContain('Charmander');
    expect(root.html).toContain('/assets/pokemon/front/4.png');
    // The gamble, drawn: one figure taken off the body, one held by the slot.
    expect(root.html).toContain('data-fate="taken"');
    expect(root.html).toContain('data-fate="held"');
    expect(root.html).not.toContain('data-continue');
  });

  it('plays its beats in order and keeps each one as it reaches the next', () => {
    const { root, advance } = open(defeatReport());
    const headline = root.stage.child('[data-defeat-headline]');

    advance(300);
    expect(root.stage.dataset.beat).toBe('fall');
    expect(headline.textContent).toBe('CHARMANDER FAINTED.');

    advance(1300);
    expect(root.stage.dataset.beat).toBe('fall taken');
    expect(headline.textContent).toBe('THEY STRIPPED YOU.');

    advance(1400);
    expect(root.stage.dataset.beat).toBe('fall taken held');
    expect(headline.textContent).toBe('THE SECURE SLOT HELD.');
  });

  it('settles onto the result screen on its own, and lets the player leave', () => {
    const { root, start, advance } = open(defeatReport());

    advance(5_000);

    expect(root.html).toContain('extraction-lost');
    expect(root.html).toContain('data-continue');
    expect(root.html).toContain('The secure slot brought Bulbasaur home.');

    advance(400);
    press('Enter');

    expect(start).toHaveBeenCalledWith('hub');
  });
});

describe('skipping the defeat sequence', () => {
  it('ends on any key from the very first frame, before a single beat has played', () => {
    const { root } = open(defeatReport());

    press('x');

    expect(root.html).toContain('data-continue');
    expect(root.html).not.toContain('defeat-stage');
  });

  it('ends on a click anywhere on the stage', () => {
    const { root } = open(defeatReport());

    root.stage.onpointerdown?.();

    expect(root.html).toContain('data-continue');
  });

  it('cancels the beats it did not play, so nothing rewrites the screen behind it', () => {
    const { root, advance } = open(defeatReport());

    advance(300);
    press(' ');
    const afterSkip = root.html;
    advance(10_000);

    expect(root.html).toBe(afterSkip);
  });

  it('is not triggered by a modifier on its own', () => {
    const { root } = open(defeatReport());

    press('Shift');

    expect(root.html).toContain('defeat-stage');
  });

  /**
   * The skip only costs the animation. The lock on the result screen's own way
   * out still stands, so a mashed key cannot carry through the ledger too.
   */
  it('still holds the way out of the result screen behind it', () => {
    const { start, advance } = open(defeatReport());

    press(' ');
    press(' ');
    expect(start).not.toHaveBeenCalled();

    advance(1_000);
    press(' ');

    expect(start).toHaveBeenCalledWith('hub');
  });
});

describe('the defeat sequence across raids', () => {
  /**
   * Phaser reuses one instance per scene key, so a second defeat is played by
   * the object that already finished the first. A sequence that never replayed
   * would be the same class of bug as the flags that froze the raid loop.
   */
  it('plays again on the same scene object after an earlier defeat has finished', () => {
    const { scene, root, advance } = open(defeatReport());
    advance(5_000);
    expect(root.html).toContain('data-continue');

    scene.init({ report: defeatReport() });
    scene.create();
    const second = overlayRoots[overlayRoots.length - 1];

    expect(second.html).toContain('defeat-stage');

    advance(300);
    expect(second.stage.dataset.beat).toBe('fall');
  });

  it('runs shorter on a second defeat than on a player\'s first ever one', () => {
    const first = open(defeatReport());
    first.advance(3_000);
    // Three seconds in, a first defeat is still playing.
    expect(first.root.html).toContain('defeat-stage');
    first.advance(2_000);
    expect(first.root.html).toContain('data-continue');
    expect(storage.getItem('escape-from-pallet-town.defeat-seen.v1')).toBe('1');

    // The same three seconds is the whole of a later one.
    const second = open(defeatReport());
    second.advance(3_000);

    expect(second.root.html).toContain('data-continue');
  });

  it('leaves an extraction untouched: a survived raid still opens on its haul', () => {
    const { root } = open(escapeReport());

    expect(root.html).not.toContain('defeat-stage');
    expect(root.html).toContain('extraction-won');
  });
});
