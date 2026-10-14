import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Scenes: { Events: { SHUTDOWN: 'shutdown' } },
    Cameras: { Scene2D: { Events: { FADE_OUT_COMPLETE: 'fadeoutcomplete' } } },
  },
}));

// The map window: 320x240 screen pixels at (100, 100), scrolled over a map
// drawn sixteen pixels a tile. Everything the scene asks of the page about
// where the map is goes through these two.
const VIEW = { left: 100, top: 100, width: 320, height: 240 };
const TILE_PX = 16;
const page = {
  mapWidth: 40,
  mapHeight: 30,
  /** The frame flashed round a tile a fault was found on. */
  flash: {
    hidden: true,
    offsetWidth: 0,
    style: {} as Record<string, string>,
    flashing: false,
    classList: {
      add: (name: string) => {
        page.flash.flashing ||= name === 'is-flashing';
      },
      remove: (name: string) => {
        page.flash.flashing &&= name !== 'is-flashing';
      },
    },
  },
  viewport: {
    scrollLeft: 0,
    scrollTop: 0,
    clientWidth: 0,
    clientHeight: VIEW.height,
    querySelector: () => null,
    addEventListener: () => undefined,
    getBoundingClientRect: () => ({
      left: VIEW.left,
      top: VIEW.top,
      right: VIEW.left + VIEW.width,
      bottom: VIEW.top + VIEW.height,
      width: VIEW.width,
      height: VIEW.height,
    }),
  },
  canvas: {
    getContext: () => null,
    addEventListener: () => undefined,
    setPointerCapture: () => undefined,
    hasPointerCapture: () => false,
    releasePointerCapture: () => undefined,
    getBoundingClientRect: () => {
      const left = VIEW.left - page.viewport.scrollLeft;
      const top = VIEW.top - page.viewport.scrollTop;
      const width = page.mapWidth * TILE_PX;
      const height = page.mapHeight * TILE_PX;
      return { left, top, width, height, right: left + width, bottom: top + height };
    },
  },
};

// Scrolling stops at the ends of the map, as a browser's does.
let scrollLeft = 0;
Object.defineProperty(page.viewport, 'scrollLeft', {
  get: () => scrollLeft,
  set: (value: number) => {
    scrollLeft = Math.max(0, Math.min(page.mapWidth * TILE_PX - VIEW.width, value));
  },
});

// The screen is DOM; the overlay keeps its markup and every button's click.
vi.mock('../ui/MenuOverlay', () => ({
  MenuOverlay: class {
    public readonly clicks = new Map<string, () => void>();
    public pointerRule = 'moves';
    public readonly root = {
      innerHTML: '',
      addEventListener: () => undefined,
      contains: () => false,
      querySelector: (selector: string) =>
        selector === '[data-viewport]'
          ? page.viewport
          : selector === 'canvas[data-map]'
            ? page.canvas
            : selector === '[data-flash]'
              ? page.flash
              : null,
      querySelectorAll: (selector: string) =>
        selector.startsWith('[data-') && selector !== '[data-field]'
          ? [
              {
                dataset: {},
                getAttribute: () => null,
                addEventListener: (_type: string, handler: () => void) =>
                  this.clicks.set(selector, handler),
              },
            ]
          : [],
    };
    public refocus(): void {}
    public moveCursor(): boolean {
      return false;
    }
  },
}));

vi.mock('../maker/mapCanvas', () => ({
  drawMap: () => undefined,
  drawPieceArt: () => undefined,
  drawSwatch: () => undefined,
  layersFor: () => ({}),
  loadMakerSheets: () => new Promise(() => undefined),
}));

import { makeInside } from '../maker/areas';
import {
  addDistrict,
  blankMap,
  buildingSize,
  groundAt,
  paintWith,
  placeSpot,
  rectangle,
  thingExists,
  type ThingRef,
} from '../maker/draft';
import { MAKER_STORAGE_KEY } from '../maker/drafts';
import type { EditHistory } from '../maker/history';
import { groundBrush } from '../maker/palette';
import { readMapFile, type MapFile, type MapFileBuildingKind } from '../world/mapFile';
import type { MapCheck } from '../world/mapFileChecks';
import sampleLaneJson from '../../maps/sample/sample-lane.json';
import { forgetMakerSession, MapMakerScene, restingTop } from './MapMakerScene';
import { setActiveSaveSlot } from '../dev/playtestMode';
import { endTry } from '../maker/tryIt';
import { activeRunManager } from '../run';
import { RunPhase } from '../run/RunManager';

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

interface MakerInternals {
  create(data?: { readonly tried?: boolean }): void;
  chooseTryLevel(level: number): void;
  refuseUnwrittenText(element: unknown): void;
  handleKey(event: KeyboardEvent): void;
  pointerDown(event: PointerEvent, canvas: unknown): void;
  pointerMove(event: PointerEvent, canvas: unknown): void;
  pointerUp(event: PointerEvent, canvas: unknown): void;
  readonly file: MapFile;
  readonly history: EditHistory<MapFile>;
  readonly overlay: { root: { innerHTML: string }; clicks: Map<string, () => void> };
  selected: ThingRef | undefined;
  tool: string;
  brushId: string;
  zoom: number;
  stroke: unknown;
}

const sampleLane = (() => {
  const reading = readMapFile(sampleLaneJson);
  if (!reading.ok) {
    throw new Error(reading.problems.join('; '));
  }
  return reading.file;
})();

const SIGN_TILES = [
  { x: 5, y: 5 },
  { x: 7, y: 5 },
  { x: 9, y: 5 },
  { x: 11, y: 5 },
];

function withSigns(): MapFile {
  return SIGN_TILES.reduce((file, tile) => {
    const outcome = placeSpot(file, 'sign', tile);
    if (!outcome.placed) {
      throw new Error(outcome.reason);
    }
    return outcome.file;
  }, blankMap());
}

function storeDraft(file: MapFile): void {
  localStorage.setItem(
    MAKER_STORAGE_KEY,
    JSON.stringify({
      version: 1,
      current: 'draft-1',
      drafts: [{ key: 'draft-1', file, updatedAt: 1 }],
    }),
  );
}

/**
 * What each scene opened in a test does on its way out. They are run before the
 * test's stand-in page is taken away, as Phaser runs them when a scene stops:
 * left running, a scene's own autosave timer fired into the next test's gap,
 * found no storage and drew a screen with no document to draw it in.
 */
let shutdowns: (() => void)[] = [];

function openMaker(): { scene: MakerInternals; start: ReturnType<typeof vi.fn> } {
  const start = vi.fn();
  const scene = Object.create(MapMakerScene.prototype) as MakerInternals;
  Object.assign(scene as unknown as Record<string, unknown>, {
    scene: { start, isActive: () => true },
    events: {
      once: (event: string, handler: () => void) => {
        if (event === 'shutdown') {
          shutdowns.push(handler);
        }
      },
    },
    cameras: { main: { fadeOut: () => undefined, once: () => undefined } },
    store: { drafts: [] },
    tool: 'brush',
    zoom: 16,
    panel: 'map',
    sending: { step: 'checking' },
    sent: { step: 'loading' },
    review: { step: 'checking' },
    rendering: false,
    pendingBlock: false,
  });
  scene.create();
  return { scene, start };
}

/** Comes back into the maker on the same scene, as a TRY IT or the title does. */
function reopen(scene: MakerInternals, data?: { readonly tried?: boolean }): void {
  scene.create(data);
}

const key = (name: string, extra: Partial<KeyboardEvent> = {}): KeyboardEvent =>
  ({
    key: name,
    ctrlKey: false,
    metaKey: false,
    altKey: false,
    shiftKey: false,
    preventDefault: () => undefined,
    ...extra,
  }) as KeyboardEvent;

/** A pointer event over tile (x, y) of the map as it is scrolled now. */
function at(x: number, y: number, extra: Partial<PointerEvent> = {}): PointerEvent {
  const box = page.canvas.getBoundingClientRect();
  return {
    button: 0,
    pointerId: 1,
    clientX: box.left + x * TILE_PX + TILE_PX / 2,
    clientY: box.top + y * TILE_PX + TILE_PX / 2,
    preventDefault: () => undefined,
    ...extra,
  } as PointerEvent;
}

function choose(scene: MakerInternals, x: number, y: number): void {
  scene.tool = 'select';
  scene.pointerDown(at(x, y), page.canvas);
  scene.pointerUp(at(x, y), page.canvas);
}

class Element {}

beforeEach(() => {
  vi.stubGlobal('localStorage', new MemoryStorage());
  vi.stubGlobal('window', {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  });
  vi.stubGlobal('document', {
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    activeElement: null,
    visibilityState: 'visible',
  });
  vi.stubGlobal('HTMLElement', Element);
  vi.stubGlobal('HTMLInputElement', Element);
  vi.stubGlobal('HTMLTextAreaElement', Element);
  vi.stubGlobal('HTMLSelectElement', Element);
  forgetMakerSession();
  scrollLeft = 0;
  page.viewport.scrollTop = 0;
});

afterEach(() => {
  const leaving = shutdowns;
  shutdowns = [];
  leaving.forEach((shutdown) => shutdown());
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe('taking a thing off the map', () => {
  it.each([
    ['Delete', (scene: MakerInternals) => scene.handleKey(key('Delete'))],
    ['Backspace', (scene: MakerInternals) => scene.handleKey(key('Backspace'))],
    [
      'the REMOVE button',
      (scene: MakerInternals) => scene.overlay.clicks.get('[data-remove-selected]')!(),
    ],
  ])('with %s leaves nothing chosen, never the next thing along', (_name, remove) => {
    storeDraft(withSigns());
    const { scene } = openMaker();
    choose(scene, 7, 5);
    expect(scene.selected).toEqual({ kind: 'sign', index: 1 });

    remove(scene);

    expect(scene.file.signs).toHaveLength(3);
    expect(scene.selected).toBeUndefined();
    // A second press removes nothing the maker did not choose.
    remove(scene);
    expect(scene.file.signs).toHaveLength(3);
  });

  it.each([
    ['Delete', (scene: MakerInternals) => scene.handleKey(key('Delete'))],
    [
      'the REMOVE button',
      (scene: MakerInternals) => scene.overlay.clicks.get('[data-remove-selected]')!(),
    ],
  ])('the last of a kind with %s and the screen keeps working', (_name, remove) => {
    storeDraft(withSigns());
    const { scene } = openMaker();
    choose(scene, 11, 5);

    expect(() => remove(scene)).not.toThrow();

    expect(scene.file.signs).toHaveLength(3);
    expect(scene.selected).toBeUndefined();
    // The screen answers the next click: the tool changes and the screen is drawn.
    expect(() => scene.handleKey(key('b'))).not.toThrow();
    expect(scene.tool).toBe('brush');
  });

  it('with the remove tool clears a choice its removal would have moved on', () => {
    storeDraft(withSigns());
    const { scene } = openMaker();
    choose(scene, 11, 5);
    scene.tool = 'erase';

    scene.pointerDown(at(5, 5), page.canvas);

    expect(scene.file.signs).toHaveLength(3);
    expect(scene.selected).toBeUndefined();
  });

  it('with the remove tool says which district a click on plain ground took away (playtest 39 B3)', () => {
    const outcome = addDistrict(withSigns(), { x: 2, y: 8 }, { x: 25, y: 22 });
    if (!outcome.placed) {
      throw new Error(outcome.reason);
    }
    storeDraft(outcome.file);
    const { scene } = openMaker();
    scene.tool = 'erase';

    // Bare grass inside the district: nothing is drawn there to show it went.
    scene.pointerDown(at(10, 15), page.canvas);

    expect(scene.file.districts ?? []).toHaveLength(0);
    expect(scene.overlay.root.innerHTML).toContain('District 1 is gone. Undo brings it back.');
  });

  it('undoing a placement drops a choice of what is no longer there', () => {
    storeDraft(withSigns());
    const { scene } = openMaker();
    scene.tool = 'place';
    (scene as unknown as { place: { kind: string } }).place = { kind: 'sign' };
    scene.pointerDown(at(13, 5), page.canvas);
    expect(scene.selected).toEqual({ kind: 'sign', index: 4 });

    expect(() => scene.handleKey(key('z', { ctrlKey: true }))).not.toThrow();

    expect(scene.file.signs).toHaveLength(4);
    expect(scene.selected).toBeUndefined();
  });

  it('thingExists knows a choice that has run off the end of its list', () => {
    const file = withSigns();
    expect(thingExists(file, { kind: 'sign', index: 3 })).toBe(true);
    expect(thingExists(file, { kind: 'sign', index: 4 })).toBe(false);
    expect(thingExists(file, { kind: 'building', index: 0 })).toBe(false);
  });
});

describe('Escape', () => {
  it('drops a stroke half drawn and stays in the maker', () => {
    storeDraft(blankMap());
    const { scene, start } = openMaker();
    scene.brushId = 'tall-grass';
    scene.tool = 'rect';
    scene.pointerDown(at(5, 5), page.canvas);
    scene.pointerMove(at(9, 8), page.canvas);

    scene.handleKey(key('Escape'));
    scene.pointerUp(at(9, 8), page.canvas);

    expect(start).not.toHaveBeenCalled();
    expect(scene.history.canUndo).toBe(false);
    expect(groundAt(scene.file, { x: 7, y: 6 })).toBe(groundAt(blankMap(), { x: 7, y: 6 }));
  });

  it('drops a brush stroke without painting it', () => {
    const blank = blankMap();
    storeDraft(blank);
    const { scene } = openMaker();
    scene.brushId = 'tall-grass';
    scene.pointerDown(at(5, 5), page.canvas);
    scene.pointerMove(at(9, 5), page.canvas);

    scene.handleKey(key('Escape'));
    scene.pointerMove(at(12, 5), page.canvas);
    scene.pointerUp(at(12, 5), page.canvas);

    expect(scene.file).toEqual(blank);
    expect(scene.history.canUndo).toBe(false);
  });

  it('with nothing in progress does not leave, and nothing is lost', () => {
    storeDraft(withSigns());
    const { scene, start } = openMaker();
    choose(scene, 7, 5);
    scene.handleKey(key('Delete'));

    scene.handleKey(key('Escape'));
    scene.handleKey(key('Escape'));

    expect(start).not.toHaveBeenCalled();
    expect(scene.history.canUndo).toBe(true);
  });

  it('is not taught as the way out', () => {
    storeDraft(blankMap());
    const { scene } = openMaker();
    expect(scene.overlay.root.innerHTML).toContain('ESC cancel');
    expect(scene.overlay.root.innerHTML).not.toContain('ESC back');
  });
});

describe('a mouse tool that says so', () => {
  it('tells the maker drawing needs a mouse, and names the keys it has', () => {
    storeDraft(blankMap());
    const { scene } = openMaker();
    expect(scene.overlay.root.innerHTML).toContain(
      'Drawing needs a mouse or trackpad. Keys pick a tool: B R F I V X.',
    );
  });

  it('keeps every key it names, and undo and zoom, working', () => {
    storeDraft(withSigns());
    const { scene } = openMaker();
    for (const [name, tool] of [
      ['b', 'brush'],
      ['r', 'rect'],
      ['f', 'fill'],
      ['i', 'pick'],
      ['v', 'select'],
      ['x', 'erase'],
      ['B', 'brush'],
    ] as const) {
      scene.handleKey(key(name));
      expect(scene.tool, name).toBe(tool);
    }

    choose(scene, 7, 5);
    scene.handleKey(key('Delete'));
    expect(scene.file.signs).toHaveLength(SIGN_TILES.length - 1);
    scene.handleKey(key('z', { ctrlKey: true }));
    expect(scene.file.signs).toHaveLength(SIGN_TILES.length);
    scene.handleKey(key('y', { ctrlKey: true }));
    expect(scene.file.signs).toHaveLength(SIGN_TILES.length - 1);

    scene.handleKey(key('-'));
    expect(scene.zoom).toBe(8);
    scene.handleKey(key('='));
    expect(scene.zoom).toBe(16);
  });
});

describe('undo and zoom across the session', () => {
  it('survive a trip to the title', () => {
    storeDraft(withSigns());
    const { scene, start } = openMaker();
    choose(scene, 7, 5);
    scene.handleKey(key('Delete'));
    scene.handleKey(key('-'));
    const zoom = scene.zoom;
    scrollLeft = 48;

    scene.overlay.clicks.get('[data-back]')!();
    expect(start).toHaveBeenCalledWith('title');
    scrollLeft = 0;
    reopen(scene);

    expect(scene.zoom).toBe(zoom);
    expect(scrollLeft).toBe(48);
    expect(scene.history.canUndo).toBe(true);
    scene.handleKey(key('z', { ctrlKey: true }));
    expect(scene.file.signs).toHaveLength(4);
  });

  it('survive coming back from a try', () => {
    storeDraft(sampleLane);
    const { scene } = openMaker();
    scene.brushId = 'tall-grass';
    scene.pointerDown(at(20, 4), page.canvas);
    scene.pointerUp(at(20, 4), page.canvas);
    scene.handleKey(key('='));
    const zoom = scene.zoom;
    const fadeOut = vi.fn();
    (scene as unknown as { cameras: unknown }).cameras = {
      main: { fadeOut, once: () => undefined },
    };

    scene.overlay.clicks.get('[data-try]')!();
    expect(fadeOut).toHaveBeenCalled();
    reopen(scene, { tried: true });

    expect(scene.zoom).toBe(zoom);
    expect(scene.history.canUndo).toBe(true);
    scene.handleKey(key('z', { ctrlKey: true }));
    expect(groundAt(scene.file, { x: 20, y: 4 })).toBe('.');
  });

  it('start afresh when the stored draft is not the one the history ends on', () => {
    storeDraft(withSigns());
    const { scene } = openMaker();
    choose(scene, 7, 5);
    scene.handleKey(key('Delete'));
    scene.overlay.clicks.get('[data-back]')!();

    // Changed somewhere else - another tab, a file opened over it.
    storeDraft(blankMap());
    reopen(scene);

    expect(scene.history.canUndo).toBe(false);
    expect(scene.file.signs ?? []).toHaveLength(0);
  });
});

describe('a new map', () => {
  it('is signed with the name the maker last signed a map with', () => {
    storeDraft({ ...withSigns(), maker: 'Olly' });
    const { scene } = openMaker();

    scene.overlay.clicks.get('[data-new]')!();

    expect(scene.file.signs ?? []).toHaveLength(0);
    expect(scene.file.maker).toBe('Olly');
    const stored = JSON.parse(localStorage.getItem(MAKER_STORAGE_KEY)!) as {
      drafts: { file: MapFile }[];
    };
    expect(stored.drafts.map((draft) => draft.file.maker)).toEqual(['Olly', 'Olly']);
  });

  it('replaces a map nobody has touched rather than piling up blanks', () => {
    storeDraft({ ...blankMap(), maker: 'Olly' });
    const { scene } = openMaker();

    scene.overlay.clicks.get('[data-new]')!();
    scene.overlay.clicks.get('[data-new]')!();

    const stored = JSON.parse(localStorage.getItem(MAKER_STORAGE_KEY)!) as {
      drafts: { file: MapFile }[];
    };
    expect(stored.drafts).toHaveLength(1);
    expect(stored.drafts[0].file.maker).toBe('Olly');
  });

  it('keeps a map that has been drawn on', () => {
    storeDraft(withSigns());
    const { scene } = openMaker();

    scene.overlay.clicks.get('[data-new]')!();
    scene.overlay.clicks.get('[data-new]')!();

    const stored = JSON.parse(localStorage.getItem(MAKER_STORAGE_KEY)!) as {
      drafts: { file: MapFile }[];
    };
    expect(stored.drafts).toHaveLength(2);
    expect(stored.drafts[1].file.signs ?? []).not.toHaveLength(0);
  });

  it('is unsigned when no map has been signed yet', () => {
    const { scene } = openMaker();

    scene.overlay.clicks.get('[data-new]')!();

    expect(scene.file.maker).toBe('');
  });
});

describe('a stroke dragged past the edge of the map window', () => {
  const grass = groundAt(blankMap(), { x: 10, y: 7 });
  const tallGrass = groundBrush('tall-grass')!.letterFor(grass ?? '.');
  const lastSeenColumn = (): number => Math.floor((scrollLeft + VIEW.width - 1) / TILE_PX);

  it('paints only what is in view, and scrolls the window on to show more', () => {
    vi.useFakeTimers();
    storeDraft(blankMap());
    const { scene } = openMaker();
    scene.brushId = 'tall-grass';
    scene.pointerDown(at(15, 7), page.canvas);
    // 250 screen pixels past the window's right edge.
    const past = { clientX: VIEW.left + VIEW.width + 250, clientY: at(15, 7).clientY };
    scene.pointerMove({ ...at(15, 7), ...past }, page.canvas);

    expect((scene.stroke as { last: { x: number } }).last.x).toBe(lastSeenColumn());

    vi.advanceTimersByTime(300);
    expect(scrollLeft).toBeGreaterThan(0);
    const reached = (scene.stroke as { last: { x: number } }).last.x;
    expect(reached).toBe(lastSeenColumn());
    expect(reached).toBeGreaterThan(19);

    scene.pointerUp({ ...at(15, 7), ...past }, page.canvas);
    const scrolled = scrollLeft;
    vi.advanceTimersByTime(300);
    // Letting go stops the scrolling.
    expect(scrollLeft).toBe(scrolled);
    for (let x = 15; x <= reached; x += 1) {
      expect(groundAt(scene.file, { x, y: 7 })).toBe(tallGrass);
    }
    expect(groundAt(scene.file, { x: reached + 1, y: 7 })).toBe(grass);
  });

  it('scrolls no further than the map goes', () => {
    vi.useFakeTimers();
    storeDraft(blankMap());
    const { scene } = openMaker();
    scene.brushId = 'tall-grass';
    scene.pointerDown(at(15, 7), page.canvas);
    scene.pointerMove({ ...at(15, 7), clientX: VIEW.left + VIEW.width + 400 }, page.canvas);

    vi.advanceTimersByTime(10_000);
    scene.pointerUp(at(15, 7), page.canvas);

    expect(scrollLeft).toBe(page.mapWidth * TILE_PX - VIEW.width);
    expect(groundAt(scene.file, { x: page.mapWidth - 2, y: 7 })).toBe(
      groundBrush('tall-grass')!.letterFor(
        groundAt(blankMap(), { x: page.mapWidth - 2, y: 7 }) ?? '.',
      ),
    );
  });
});

describe('drawing past the edge of the map', () => {
  it('grows the map to hold what was drawn, and undo takes it back', () => {
    storeDraft(blankMap());
    const { scene } = openMaker();
    scene.brushId = 'sand';
    scene.pointerDown(at(-1, 7), page.canvas);
    scene.pointerUp(at(-1, 7), page.canvas);
    // West two tiles at a time: the tile drawn and a whole tree of wood past it.
    expect([scene.file.width, scene.file.height]).toEqual([44, 30]);
    expect(scene.file.ground[7].slice(0, 5)).toBe('TTTdT');
    expect(scene.overlay.root.innerHTML).toContain('The map grew to 44x30.');
    scene.handleKey(key('z', { ctrlKey: true }));
    expect([scene.file.width, scene.file.height]).toEqual([40, 30]);
  });

  it('does nothing past the edge with a tool that cannot grow it', () => {
    storeDraft(blankMap());
    const { scene } = openMaker();
    scene.tool = 'fill';
    scene.pointerDown(at(-1, 7), page.canvas);
    expect(scene.file.width).toBe(40);
    expect(scene.history.canUndo).toBe(false);
  });
});

describe('drafts that no longer fit in the browser', () => {
  it('says so once, rather than losing the map without a word', () => {
    vi.useFakeTimers();
    storeDraft(blankMap());
    const { scene } = openMaker();
    const storage = localStorage as unknown as { setItem: (key: string, value: string) => void };
    storage.setItem = () => {
      throw new Error('QuotaExceededError');
    };
    scene.brushId = 'sand';
    scene.pointerDown(at(5, 5), page.canvas);
    scene.pointerUp(at(5, 5), page.canvas);
    vi.advanceTimersByTime(1_000);
    expect(scene.overlay.root.innerHTML).toContain('could not be saved');
  });
});

describe('placing things in one place of a map with several', () => {
  it('puts what is placed inside a room in that room, and leaves everything else where it was', () => {
    const made = makeInside(sampleLane, 0);
    if (!made.made) {
      throw new Error(made.reason);
    }
    storeDraft(made.file);
    const { scene } = openMaker();
    const internals = scene as unknown as {
      showArea(area: string | undefined): void;
      place: { kind: string };
    };
    internals.place = { kind: 'person' };
    internals.showArea(made.area);
    const room = made.file.areas![0];
    const size = { width: page.mapWidth, height: page.mapHeight };
    page.mapWidth = room.width;
    page.mapHeight = room.height;
    try {
      scene.tool = 'place';
      internals.place = { kind: 'person' };
      scene.pointerDown(at(6, 6), page.canvas);
      scene.pointerUp(at(6, 6), page.canvas);
    } finally {
      page.mapWidth = size.width;
      page.mapHeight = size.height;
    }
    expect(scene.file.people?.filter((person) => person.area === made.area)).toEqual([
      expect.objectContaining({ x: 6, y: 6 }),
    ]);
    expect(scene.file.people?.filter((person) => person.area === undefined)).toEqual(
      sampleLane.people ?? [],
    );
  });
});

describe('where the right-hand column comes to rest', () => {
  /** A column 200 high, scrolled to `top`, holding rows at these heights down it. */
  function column(top: number, rows: readonly number[], height: number) {
    const box = (y: number, h: number) => ({ top: y - top, bottom: y - top + h }) as DOMRect;
    const side = {
      scrollTop: top,
      clientHeight: 200,
      scrollHeight: height,
      getBoundingClientRect: () => box(top, 200),
      querySelectorAll: () =>
        rows.map((y) => ({ getBoundingClientRect: () => box(y, 20) })) as unknown as NodeListOf<HTMLElement>,
    };
    return { side: side as unknown as HTMLElement, at: box };
  }

  it('puts a pane at its top when it can scroll that far', () => {
    const { side, at } = column(0, [0, 24, 48, 300], 600);
    expect(restingTop(side, at(300, 120))).toBe(300);
  });

  it('rests on the top of a whole row, never through one, when the column is at its end', () => {
    // The pane's top is past the furthest the column scrolls (340); the last
    // row starting before that and still leaving the pane whole is at 312.
    const { side, at } = column(0, [0, 240, 264, 288, 312, 380], 540);
    expect(restingTop(side, at(380, 130))).toBe(312);
    const shortColumn = column(0, [0, 240, 264, 288, 312, 380], 520);
    expect(restingTop(shortColumn.side, shortColumn.at(380, 130))).toBe(312);
  });
});


describe('planting nature along a drag', () => {
  type Planted = { readonly x: number; readonly y: number; readonly kind: string };

  function plantWith(scene: MakerInternals, building: string): void {
    (scene as unknown as { place: unknown }).place = { kind: 'building', building };
    scene.tool = 'place';
  }

  function drag(scene: MakerInternals, tiles: readonly (readonly [number, number])[]): void {
    const [first, ...rest] = tiles;
    scene.pointerDown(at(first[0], first[1]), page.canvas);
    for (const [x, y] of rest) {
      scene.pointerMove(at(x, y), page.canvas);
    }
    const [x, y] = tiles[tiles.length - 1];
    scene.pointerUp(at(x, y), page.canvas);
  }

  function overlaps(a: Planted, b: Planted): boolean {
    const one = buildingSize(a.kind as MapFileBuildingKind);
    const two = buildingSize(b.kind as MapFileBuildingKind);
    return a.x < b.x + two.width && b.x < a.x + one.width && a.y < b.y + two.height && b.y < a.y + one.height;
  }

  function noneOverlap(planted: readonly Planted[]): boolean {
    return planted.every((one, index) => planted.slice(index + 1).every((other) => !overlaps(one, other)));
  }

  it('plants a row spaced by the piece itself, and one undo takes the whole stroke back', () => {
    storeDraft(blankMap());
    const { scene } = openMaker();
    plantWith(scene, 'tree');
    const { width } = buildingSize('tree');
    // A drag across one tile at a time, as a pointer moving slowly does.
    drag(
      scene,
      Array.from({ length: 4 * width + 1 }, (_, step) => [2 + step, 6] as const),
    );

    expect(scene.file.buildings.map((tree) => [tree.x, tree.y])).toEqual(
      Array.from({ length: 5 }, (_, index) => [2 + index * width, 6]),
    );
    expect(noneOverlap(scene.file.buildings)).toBe(true);
    expect(scene.selected).toEqual({ kind: 'building', index: 4 });

    scene.handleKey(key('z', { ctrlKey: true }));
    expect(scene.file.buildings).toEqual([]);
    expect(scene.history.canUndo).toBe(false);
  });

  it('leaves no gap on a quick drag, and nothing overlaps on a diagonal one', () => {
    storeDraft(blankMap());
    const { scene } = openMaker();
    plantWith(scene, 'rock');
    const { width } = buildingSize('rock');
    // The pointer jumps the whole way in one move.
    drag(scene, [
      [3, 3],
      [3 + 3 * width, 3],
    ]);
    expect(scene.file.buildings).toHaveLength(4);

    plantWith(scene, 'pine');
    drag(scene, [
      [3, 8],
      [20, 20],
    ]);
    const pines = scene.file.buildings.filter((piece) => piece.kind === 'pine');
    expect(pines.length).toBeGreaterThan(2);
    expect(noneOverlap(scene.file.buildings)).toBe(true);
  });

  it('plants around what already stands there rather than over it', () => {
    storeDraft(blankMap());
    const { scene } = openMaker();
    plantWith(scene, 'house');
    drag(scene, [[10, 4]]);
    plantWith(scene, 'small-tree');
    drag(
      scene,
      Array.from({ length: 20 }, (_, step) => [2 + step, 5] as const),
    );
    expect(scene.file.buildings[0]).toEqual(expect.objectContaining({ kind: 'house' }));
    expect(scene.file.buildings.length).toBeGreaterThan(2);
    expect(noneOverlap(scene.file.buildings)).toBe(true);
  });

  it('grows the map for a piece begun past its edge, and undo takes it back', () => {
    storeDraft(blankMap());
    const { scene } = openMaker();
    plantWith(scene, 'tree');
    drag(scene, [[-1, 10]]);
    expect(scene.file.width).toBeGreaterThan(40);
    expect(scene.file.buildings).toHaveLength(1);

    scene.handleKey(key('z', { ctrlKey: true }));
    expect([scene.file.width, scene.file.buildings]).toEqual([40, []]);
  });

  it('still plants one piece for one click', () => {
    storeDraft(blankMap());
    const { scene } = openMaker();
    plantWith(scene, 'tall-bush');
    drag(scene, [[5, 5]]);
    expect(scene.file.buildings).toEqual([{ x: 5, y: 5, kind: 'tall-bush' }]);
  });

  it('says why when not one piece would go', () => {
    storeDraft(blankMap());
    const { scene } = openMaker();
    plantWith(scene, 'tree');
    drag(scene, [[5, 5]]);
    drag(scene, [[5, 5]]);
    expect(scene.file.buildings).toHaveLength(1);
    expect(scene.overlay.root.innerHTML).toContain('The tree is in the way.');
  });

  it('is dropped whole by Escape', () => {
    const blank = blankMap();
    storeDraft(blank);
    const { scene } = openMaker();
    plantWith(scene, 'stump');
    scene.pointerDown(at(4, 4), page.canvas);
    scene.pointerMove(at(12, 4), page.canvas);
    scene.handleKey(key('Escape'));
    scene.pointerUp(at(12, 4), page.canvas);
    expect(scene.file).toEqual(blank);
    expect(scene.history.canUndo).toBe(false);
  });

  it.each(['planter', 'crate', 'barrel', 'market-stall', 'gravestone'])(
    'plants a row of %s too',
    (building) => {
      storeDraft(blankMap());
      const { scene } = openMaker();
      plantWith(scene, building);
      const { width } = buildingSize(building as MapFileBuildingKind);
      drag(
        scene,
        Array.from({ length: 3 * width + 1 }, (_, step) => [2 + step, 9] as const),
      );
      expect(scene.file.buildings.map((piece) => piece.x)).toEqual([2, 2 + width, 2 + 2 * width, 2 + 3 * width]);
      expect(noneOverlap(scene.file.buildings)).toBe(true);
      scene.handleKey(key('z', { ctrlKey: true }));
      expect(scene.file.buildings).toEqual([]);
    },
  );

  it.each(['house', 'cave-mouth', 'museum', 'sign'])('plants a %s once, however far it is dragged', (building) => {
    // A cave mouth is cut into the foot of a rock face.
    const rock = { id: 'rock', label: 'Rock', help: '', letterFor: () => 'C', swatch: 'C' };
    storeDraft(
      building === 'cave-mouth'
        ? paintWith(blankMap(), rectangle({ x: 3, y: 6 }, { x: 5, y: 8 }), rock)
        : blankMap(),
    );
    const { scene } = openMaker();
    plantWith(scene, building);
    drag(
      scene,
      Array.from({ length: 16 }, (_, step) => [4 + step, 8] as const),
    );
    expect(scene.file.buildings).toEqual([{ x: 4, y: 8, kind: building }]);
  });
});

describe('the level a try is played at', () => {
  // A try starts the game's one run; an earlier test's try left it running.
  beforeEach(() => {
    if (activeRunManager.phase === RunPhase.InRun) {
      activeRunManager.resolveEscape();
    }
  });

  /** The party the try deployed. */
  const triedTeam = (): readonly [string, number][] => {
    setActiveSaveSlot('normal');
    endTry();
    return (activeRunManager.snapshot().loadout?.party ?? []).map((pokemon) => [
      pokemon.base.name,
      pokemon.level,
    ]);
  };

  it('starts on the one that suits the map, and fields the three starters at it', () => {
    storeDraft(sampleLane);
    const { scene } = openMaker();
    expect(scene.overlay.root.innerHTML).toContain('<option value="6" selected>Lv 6 · suits it</option>');
    scene.overlay.clicks.get('[data-try]')!();
    expect(triedTeam()).toEqual([
      ['Charmander', 6],
      ['Squirtle', 6],
      ['Bulbasaur', 6],
    ]);
  });

  it('is the maker\'s to choose, kept for the draft across a try', () => {
    storeDraft(sampleLane);
    const { scene } = openMaker();
    scene.chooseTryLevel(36);
    scene.overlay.clicks.get('[data-try]')!();
    expect(triedTeam()).toEqual([
      ['Charizard', 36],
      ['Blastoise', 36],
      ['Venusaur', 36],
    ]);
    reopen(scene, { tried: true });
    expect(scene.overlay.root.innerHTML).toContain('<option value="36" selected>Lv 36</option>');
  });
});

describe('typing what a map cannot hold', () => {
  it('takes it out as it is typed and leaves the caret where it was', () => {
    storeDraft(sampleLane);
    const { scene } = openMaker();
    const field = Object.assign(new Element(), {
      value: 'Bug 🐛 Café|Lane',
      selectionStart: 'Bug 🐛 Café'.length,
      setSelectionRange(start: number, end: number) {
        this.caret = [start, end];
      },
      caret: [0, 0] as [number, number],
    });
    scene.refuseUnwrittenText(field);
    expect(field.value).toBe('Bug  Café|Lane');
    expect(field.caret).toEqual(['Bug  Café'.length, 'Bug  Café'.length]);
    const clean = Object.assign(new Element(), { value: 'Café Élan', selectionStart: 3, setSelectionRange: vi.fn() });
    scene.refuseUnwrittenText(clean);
    expect(clean.value).toBe('Café Élan');
    expect(clean.setSelectionRange).not.toHaveBeenCalled();
  });
});

describe('deleting a draft', () => {
  it('keeps asking "Sure?" once pressed, however often the screen is drawn again', () => {
    localStorage.setItem(
      MAKER_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        current: 'draft-1',
        drafts: [
          { key: 'draft-1', file: blankMap(), updatedAt: 1 },
          { key: 'draft-2', file: { ...blankMap(), name: 'Keep Me' }, updatedAt: 2 },
        ],
      }),
    );
    const { scene } = openMaker();
    const internals = scene as unknown as {
      openPanel(panel: string): void;
      deleteDraft(button: HTMLElement, key: string): void;
    };
    internals.openPanel('drafts');
    internals.deleteDraft({ textContent: 'Delete', dataset: {} } as unknown as HTMLElement, 'draft-2');
    // A tool key draws the screen again while the Delete is waiting on its
    // second press. The button must still say what that press does: drawn as
    // a plain Delete, one press of it took the draft for good.
    scene.handleKey(key('r'));
    expect(scene.overlay.root.innerHTML).toMatch(/data-delete-draft="draft-2"[^>]*>Sure\?</);
  });

  it('asks in a word that fits the button and names the draft the next press takes (playtest 39 A7)', () => {
    localStorage.setItem(
      MAKER_STORAGE_KEY,
      JSON.stringify({
        version: 1,
        current: 'draft-1',
        drafts: [
          { key: 'draft-1', file: blankMap(), updatedAt: 1 },
          { key: 'draft-2', file: { ...blankMap(), name: 'Brook Lane' }, updatedAt: 2 },
        ],
      }),
    );
    const { scene } = openMaker();
    const internals = scene as unknown as {
      openPanel(panel: string): void;
      deleteDraft(button: HTMLElement, key: string): void;
    };
    internals.openPanel('drafts');
    expect(scene.overlay.root.innerHTML).toMatch(
      /data-delete-draft="draft-2" data-help="Deletes Brook Lane from this browser\. It cannot be undone\.">Delete</,
    );
    // The button as the screen holds it: pressed once, it is told in place.
    const button = { textContent: 'Delete', dataset: {} as DOMStringMap } as unknown as HTMLElement;
    internals.deleteDraft(button, 'draft-2');
    // "Delete for good" ran out of the button the size of "Delete" and was
    // read as "DELETE F": the armed word is no longer than the one it replaces.
    expect(button.textContent).toBe('Sure?');
    expect(button.textContent.length).toBeLessThanOrEqual('Delete'.length);
    const armed = 'Press again to delete Brook Lane for good. Anything else keeps it.';
    expect(button.dataset.help).toBe(armed);
    // Drawn again while it waits, it still asks and still names the draft.
    scene.handleKey(key('r'));
    expect(scene.overlay.root.innerHTML).toContain(`data-delete-draft="draft-2" data-help="${armed}">Sure?<`);
    internals.deleteDraft(button, 'draft-2');
    expect(scene.overlay.root.innerHTML).not.toContain('data-delete-draft="draft-2"');
    expect(scene.overlay.root.innerHTML).toContain('Brook Lane deleted.');
  });
});

describe('removing an inside', () => {
  it('keeps saying "Remove for good" once pressed, however often the screen is drawn again', () => {
    const made = makeInside(sampleLane, 0);
    if (!made.made) {
      throw new Error(made.reason);
    }
    storeDraft(made.file);
    const { scene } = openMaker();
    const internals = scene as unknown as {
      showArea(area: string | undefined): void;
      pendingAreaRemoval: string | undefined;
      place: { kind: string };
    };
    internals.place = { kind: 'person' };
    internals.showArea(made.area);
    // The first press of Remove arms it; a tool key then draws the screen
    // again. Drawn as a plain Remove, the next press took the room for good.
    internals.pendingAreaRemoval = made.area;
    scene.handleKey(key('r'));
    expect(scene.overlay.root.innerHTML).toMatch(/data-remove-area="[^"]*"[^>]*>Remove for good</);
  });
});

describe('going to what the checks found', () => {
  interface Jumping {
    goToFault(check: number, fault: number): void;
    goToGroup(spec: string): void;
    checkList(): readonly MapCheck[];
  }

  /** A working map with two berry trees stood in bushes in its middle. */
  function faulty(extra: Partial<MapFile> = {}): MapFile {
    const base = { ...blankMap(), maker: 'Tester' };
    return {
      ...base,
      ground: base.ground.map((row, y) =>
        [...row].map((letter, x) => (y === 15 && (x === 20 || x === 24) ? 'T' : letter)).join(''),
      ),
      dropIns: [{ x: 4, y: 4, name: 'Gate' }],
      exits: [{ x: 35, y: 25, name: 'Out', opens: { when: 'always' } }],
      berryTrees: [
        { x: 20, y: 15, berry: 'oran' },
        { x: 24, y: 15, berry: 'pecha' },
      ],
      ...extra,
    };
  }

  const checkIndex = (scene: MakerInternals, id: string): number =>
    (scene as unknown as Jumping).checkList().findIndex((check) => check.id === id);

  it('centres the map on the tile, chooses what stands there, says what is wrong and flashes it', () => {
    vi.useFakeTimers();
    storeDraft(faulty());
    const { scene } = openMaker();
    page.viewport.clientWidth = VIEW.width;
    try {
      scene.zoom = 4;
      (scene as unknown as Jumping).goToFault(checkIndex(scene, 'standing'), 0);
      expect(scene.selected).toEqual({ kind: 'berry-tree', index: 0 });
      // Looked at close enough to see a tile, with the tile in the middle of the window.
      expect(scene.zoom).toBe(16);
      const box = page.canvas.getBoundingClientRect();
      expect(box.left + 20.5 * TILE_PX).toBeCloseTo(VIEW.left + VIEW.width / 2, 0);
      expect(box.top + 15.5 * TILE_PX).toBeCloseTo(VIEW.top + VIEW.height / 2, 0);
      expect(scene.overlay.root.innerHTML).toContain('Oran Berry tree at 20,15 stands in the trees.');
      // Flashed where it is drawn: the tile, past the room the map may grow into.
      expect(page.flash).toMatchObject({ hidden: false, flashing: true });
      expect(page.flash.style.left).toBe(`calc(var(--u) * ${(20 + 24) * 16})`);
      vi.advanceTimersByTime(1_500);
      expect(page.flash).toMatchObject({ hidden: true, flashing: false });
    } finally {
      page.viewport.clientWidth = 0;
    }
  });

  it('goes to the next tile a fault names each time it is pressed again', () => {
    storeDraft(
      faulty({
        berryTrees: [],
        ground: blankMap().ground,
        trainers: [
          {
            x: 10,
            y: 10,
            name: 'Lass',
            team: 'scout',
            look: 'lass',
            facing: 'down',
            sight: 3,
            lines: [],
          },
        ],
        dropIns: [{ x: 10, y: 13, name: 'Gate' }],
      }),
    );
    const { scene } = openMaker();
    const watch = checkIndex(scene, 'watch');
    (scene as unknown as Jumping).goToFault(watch, 0);
    expect(scene.selected).toEqual({ kind: 'trainer', index: 0 });
    expect(scene.overlay.root.innerHTML).toContain('(place 1 of 2: press it again for the next)');
    (scene as unknown as Jumping).goToFault(watch, 0);
    expect(scene.selected).toEqual({ kind: 'drop-in', index: 0 });
    expect(scene.overlay.root.innerHTML).toContain('(place 2 of 2: press it again for the next)');
    (scene as unknown as Jumping).goToFault(watch, 0);
    expect(scene.selected).toEqual({ kind: 'trainer', index: 0 });
  });

  it('steps through a run of one kind from its heading', () => {
    storeDraft(faulty());
    const { scene } = openMaker();
    const spec = `${checkIndex(scene, 'standing')}:berry trees`;
    (scene as unknown as Jumping).goToGroup(spec);
    expect(scene.selected).toEqual({ kind: 'berry-tree', index: 0 });
    expect(scene.overlay.root.innerHTML).toContain('(1 of 2: press the heading again for the next)');
    (scene as unknown as Jumping).goToGroup(spec);
    expect(scene.selected).toEqual({ kind: 'berry-tree', index: 1 });
    expect(scene.overlay.root.innerHTML).toContain('Pecha Berry tree at 24,15 stands in the trees.');
    (scene as unknown as Jumping).goToGroup(spec);
    expect(scene.selected).toEqual({ kind: 'berry-tree', index: 0 });
  });
});

describe('what the maker will not do', () => {
  const house = (): MapFile => {
    const file = { ...blankMap(), maker: 'Tester' };
    return { ...file, buildings: [{ kind: 'house', x: 12, y: 10 }] };
  };

  it('refuses a berry tree on a roof, says why, and changes nothing', () => {
    storeDraft(house());
    const { scene } = openMaker();
    const before = scene.file;
    (scene as unknown as { place: unknown }).place = { kind: 'berry-tree' };
    scene.tool = 'place';
    scene.pointerDown(at(14, 11), page.canvas);
    scene.pointerUp(at(14, 11), page.canvas);
    expect(scene.file).toBe(before);
    expect(scene.history.canUndo).toBe(false);
    expect(scene.overlay.root.innerHTML).toContain('The house is in the way.');
  });

  it('paints a stroke of trees round a berry tree, says what it left, and is one step', () => {
    const start: MapFile = { ...blankMap(), berryTrees: [{ x: 10, y: 10, berry: 'oran' }] };
    storeDraft(start);
    const { scene } = openMaker();
    scene.tool = 'brush';
    scene.brushId = 'trees';
    scene.pointerDown(at(5, 10), page.canvas);
    for (let x = 6; x <= 15; x += 1) {
      scene.pointerMove(at(x, 10), page.canvas);
    }
    scene.pointerUp(at(15, 10), page.canvas);
    expect(scene.file.ground[10].slice(5, 16)).toBe('TTTTT.TTTTT');
    expect(scene.overlay.root.innerHTML).toContain(
      'Trees cannot go under the Oran Berry tree. That tile was left as it was.',
    );
    scene.handleKey(key('z', { ctrlKey: true }));
    expect(scene.file.ground).toEqual(start.ground);
  });

  it('clears a wood for a gym as one step, and one undo puts the wood back', () => {
    const base = blankMap();
    const wood: MapFile = {
      ...base,
      ground: base.ground.map((row, y) =>
        [...row].map((letter, x) => (x >= 6 && x <= 25 && y >= 6 && y <= 19 ? 'T' : letter)).join(''),
      ),
    };
    storeDraft(wood);
    const { scene } = openMaker();
    (scene as unknown as { place: unknown }).place = { kind: 'building', building: 'gym' };
    scene.tool = 'place';
    scene.pointerDown(at(11, 9), page.canvas);
    scene.pointerUp(at(11, 9), page.canvas);
    expect(scene.file.buildings).toEqual([{ x: 11, y: 9, kind: 'gym' }]);
    expect(scene.file.ground[11].slice(10, 18)).toBe('........');
    expect(scene.overlay.root.innerHTML).toMatch(/Clears \d+ trees\./);
    scene.handleKey(key('z', { ctrlKey: true }));
    expect(scene.file).toEqual(wood);
  });
});
