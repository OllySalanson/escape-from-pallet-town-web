// The way into a raid is shared by every driver, and the stepped ones pause the
// game loop so that time moves only when they ask for it. `walkIntoBase` used to
// wait between moves with a real-time sleep, which moves a paused game by
// nothing: the room behind Oak's Lab's door never finished coming in, and
// tour.mjs, gridtour.mjs, whyHidden.mjs, interior.mjs and `raid.mjs --stepped`
// all failed on an untouched map with "never saw the oaks-lab".
//
// The base here is a stand-in with the same shape the walk reads off the real
// `BaseScene` (`doors`, `collision`, `room`, `leaving`, ...), and like the real
// one it only changes when frames are stepped.
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { walkIntoBase } from './deploy.mjs';

/** Frames are 100ms, as the drivers' own `stepFrames` hands them. */
const FRAME_MS = 100;
/** How long a doorway takes to open onto its room, in game time. */
const ROOM_ARRIVES_MS = 300;

function pausedBase() {
  const clock = { ms: 0 };
  let pending = null;
  let roomAt = null;
  let hubAt = null;
  let hubActive = false;
  const base = {
    scene: { key: 'base' },
    sys: { isActive: () => !hubActive },
    ready: true,
    leaving: false,
    room: null,
    currentTile: { x: 2, y: 3 },
    doors: [{ id: 'oaks-lab', tiles: [{ x: 2, y: 1 }] }],
    // A yard five tiles square with a wall along the top but for the door.
    collision: Array.from({ length: 5 }, (_, y) => Array.from({ length: 5 }, (_, x) => y === 0 || (y === 1 && x !== 2))),
    isBlocked(tile) {
      return this.collision[tile.y]?.[tile.x] !== false;
    },
  };
  const step = () => {
    clock.ms += FRAME_MS;
    if (roomAt !== null && clock.ms >= roomAt) {
      roomAt = null;
      base.leaving = false;
      base.room = { id: 'oaks-lab', mat: { x: 2, y: 4 } };
      base.currentTile = { ...base.room.mat };
    }
    if (hubAt !== null && clock.ms >= hubAt) {
      hubActive = true;
    }
    const key = pending;
    pending = null;
    if (!key || base.leaving) {
      return;
    }
    if (key === 'Space') {
      const mat = base.room?.mat;
      if (mat && base.currentTile.x === mat.x && base.currentTile.y === mat.y) {
        hubAt = clock.ms + FRAME_MS;
      }
      return;
    }
    const [dx, dy] = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0] }[key];
    const next = { x: base.currentTile.x + dx, y: base.currentTile.y + dy };
    if (base.room || base.isBlocked(next)) {
      return;
    }
    base.currentTile = next;
    if (base.doors[0].tiles.some((t) => t.x === next.x && t.y === next.y)) {
      base.leaving = true;
      roomAt = clock.ms + ROOM_ARRIVES_MS;
    }
  };
  const game = {
    loopPaused: true,
    scene: {
      getScene: (key) => (key === 'base' ? base : undefined),
      getScenes: () => [hubActive ? { scene: { key: 'hub' } } : base],
    },
  };
  // The drivers' own three, as tour.mjs writes them: time moves only in `wait`.
  const wait = async (ms) => {
    for (let i = 0; i < Math.max(1, Math.ceil(ms / FRAME_MS)); i += 1) step();
  };
  const press = async (code) => {
    pending = code;
    await wait(60);
  };
  const until = async (expression, what) => {
    for (let i = 0; i < 100; i += 1) {
      if ((0, eval)(expression)) return;
      await wait(FRAME_MS);
    }
    throw new Error(`never saw ${what}`);
  };
  const page = { evaluate: async (expression) => (0, eval)(expression) };
  return { game, page, press, until, wait };
}

describe('walking into the base under a paused loop', () => {
  let hadWindow;
  beforeEach(() => {
    hadWindow = 'window' in globalThis;
    if (!hadWindow) globalThis.window = globalThis;
  });
  afterEach(() => {
    delete globalThis.window.__escapeFromPalletTownGame__;
    if (!hadWindow) delete globalThis.window;
  });

  it("reaches the keeper's screen when the driver's own wait steps the game", async () => {
    const { game, page, press, until, wait } = pausedBase();
    globalThis.window.__escapeFromPalletTownGame__ = game;
    await walkIntoBase(page, 'oaks-lab', { press, until, wait, settleMs: 0 });
    expect(game.scene.getScenes(true).map((s) => s.scene.key)).toEqual(['hub']);
  });

  it('refuses a paused loop it was not handed a wait for', async () => {
    const { game, page, press, until } = pausedBase();
    globalThis.window.__escapeFromPalletTownGame__ = game;
    await expect(walkIntoBase(page, 'oaks-lab', { press, until, settleMs: 0 })).rejects.toThrow(/paused/);
  });
});
