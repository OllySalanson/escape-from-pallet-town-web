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
  drawSwatch: () => undefined,
  layersFor: () => ({}),
  loadMakerSheets: () => new Promise(() => undefined),
}));

import { makeInside } from '../maker/areas';
import { blankMap, groundAt, placeSpot, thingExists, type ThingRef } from '../maker/draft';
import { MAKER_STORAGE_KEY } from '../maker/drafts';
import type { EditHistory } from '../maker/history';
import { groundBrush } from '../maker/palette';
import { readMapFile, type MapFile } from '../world/mapFile';
import sampleLaneJson from '../../maps/sample/sample-lane.json';
import { forgetMakerSession, MapMakerScene } from './MapMakerScene';

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

function openMaker(): { scene: MakerInternals; start: ReturnType<typeof vi.fn> } {
  const start = vi.fn();
  const scene = Object.create(MapMakerScene.prototype) as MakerInternals;
  Object.assign(scene as unknown as Record<string, unknown>, {
    scene: { start, isActive: () => true },
    events: { once: () => undefined },
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
    storeDraft(blankMap());
    const { scene } = openMaker();
    scene.brushId = 'tall-grass';
    scene.pointerDown(at(5, 5), page.canvas);
    scene.pointerMove(at(9, 5), page.canvas);

    scene.handleKey(key('Escape'));
    scene.pointerMove(at(12, 5), page.canvas);
    scene.pointerUp(at(12, 5), page.canvas);

    expect(scene.file).toEqual(blankMap());
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

