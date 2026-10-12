import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
  },
}));

/** A stand-in element: what the scene reads off the menu's markup. */
interface FakeElement {
  onclick?: () => void;
  dataset: Record<string, string>;
}

/**
 * The menu as the scene sees it: its markup, and every button the scene wires
 * by what it is for. A destroyed menu is drawn nowhere, which is what a menu
 * reused from an earlier visit would be.
 */
class FakeMenu {
  public static made: FakeMenu[] = [];
  public destroyed = false;
  public html = '';
  public readonly buttons = new Map<string, FakeElement>();
  public readonly root = {
    setAttribute: () => undefined,
    set innerHTML(value: string) {
      this.owner.html = value;
    },
    get innerHTML(): string {
      return this.owner.html;
    },
    owner: this as FakeMenu,
    querySelector: (selector: string) => this.button(selector),
    querySelectorAll: (selector: string) => (selector === '[data-play]' ? [this.button('[data-play]', { play: 'pallet-blocks' })] : []),
  };

  public readonly onKey: (event: KeyboardEvent) => void;

  public constructor(_scene: unknown, _className: string, onKey: (event: KeyboardEvent) => void) {
    this.onKey = onKey;
    FakeMenu.made.push(this);
  }

  public destroy(): void {
    this.destroyed = true;
  }

  public focus(): void {}
  public refocus(): void {}
  public moveCursor(): boolean {
    return false;
  }

  private button(selector: string, dataset: Record<string, string> = {}): FakeElement | null {
    if (selector.includes('shown-by') || selector === '[data-name-form]') {
      return null;
    }
    if (!this.buttons.has(selector)) {
      this.buttons.set(selector, { dataset });
    }
    return this.buttons.get(selector)!;
  }
}

vi.mock('../ui/MenuOverlay', () => ({ MenuOverlay: FakeMenu }));
vi.mock('../console/remoteScores', () => ({
  palletTownBoards: {
    load: () => Promise.resolve([{ name: 'BROCK', score: 900, mine: false }]),
    post: () => Promise.resolve(),
  },
}));

const { ConsoleScene } = await import('./ConsoleScene');

/** The scene with the parts of Phaser it asks for, and a house it pauses. */
function consoleScene() {
  const scene = new ConsoleScene();
  const state = { active: false, housePaused: true, resumed: 0 };
  const shutdown: (() => void)[] = [];
  Object.assign(scene as unknown as Record<string, unknown>, {
    events: { once: (_event: string, run: () => void) => shutdown.push(run) },
    scene: {
      isActive: () => state.active,
      isPaused: () => state.housePaused,
      stop: () => {
        state.active = false;
        // Phaser shuts a stopped scene down, and the menu goes with it.
        shutdown.splice(0).forEach((run) => run());
        FakeMenu.made.forEach((menu) => menu.destroy());
      },
      resume: () => {
        state.housePaused = false;
        state.resumed += 1;
      },
    },
  });
  const open = () => {
    state.active = true;
    state.housePaused = true;
    scene.init({ pausedBase: true });
  };
  return { scene, state, open };
}

const escape = { key: 'Escape', ctrlKey: false, metaKey: false, altKey: false, preventDefault: () => undefined } as unknown as KeyboardEvent;

describe('the console in the player\'s room', () => {
  beforeEach(() => {
    FakeMenu.made = [];
  });

  it('opens the GAMES menu over the paused house, listing Pallet Blocks', () => {
    const { open } = consoleScene();
    open();
    expect(FakeMenu.made).toHaveLength(1);
    expect(FakeMenu.made[0].html).toContain('PALLET BLOCKS');
    expect(FakeMenu.made[0].html).toContain('data-play="pallet-blocks"');
  });

  it('goes back to the house on Escape, resuming it', () => {
    const { open, state } = consoleScene();
    open();
    FakeMenu.made[0].onKey(escape);
    expect(state.active).toBe(false);
    expect(state.resumed).toBe(1);
  });

  it('draws a fresh menu every time the console is sat down at again', () => {
    const { open } = consoleScene();
    open();
    FakeMenu.made[0].onKey(escape);
    open();
    expect(FakeMenu.made).toHaveLength(2);
    expect(FakeMenu.made[1].destroyed).toBe(false);
    expect(FakeMenu.made[1].html).toContain('PALLET BLOCKS');
  });

  it('asks for a name before a first game, rather than starting one nameless', () => {
    const { open } = consoleScene();
    open();
    FakeMenu.made[0].buttons.get('[data-play]')!.onclick!();
    expect(FakeMenu.made[0].html).toContain('data-name-form');
  });
});
