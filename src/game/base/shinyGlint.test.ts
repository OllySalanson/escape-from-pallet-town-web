import { describe, expect, it, vi } from 'vitest';
import { TILE_SIZE } from '../worldMap';
import {
  GLINT_BURST_MS,
  GLINT_EVERY_MS,
  GLINT_ART,
  GLINT_FIRST_MS,
  GLINT_INKS,
  GLINT_LIFE_MS,
  GLINT_MOTES,
  ShinyGlints,
  glintAt,
  glintHeadStart,
} from './shinyGlint';

describe('a shiny figure’s glints', () => {
  it('are nothing most of the time, and a short burst every few seconds', () => {
    let lit = 0;
    for (let ms = GLINT_FIRST_MS; ms < GLINT_FIRST_MS + GLINT_EVERY_MS; ms += 10) {
      if (glintAt(ms).length > 0) lit += 10;
    }
    expect(lit).toBe(GLINT_BURST_MS);
    // Seen within a second of walking in, over well inside a second, and
    // quiet for most of the time between: a glint, not a strobe.
    expect(GLINT_FIRST_MS).toBeLessThanOrEqual(1_000);
    expect(GLINT_BURST_MS).toBeLessThan(1_000);
    expect(GLINT_BURST_MS / GLINT_EVERY_MS).toBeLessThan(0.25);
    expect(glintAt(0)).toEqual([]);
    expect(glintAt(GLINT_FIRST_MS - 1)).toEqual([]);
  });

  it('come out one after another, each a spark that opens into a star and closes again', () => {
    GLINT_MOTES.forEach((mote, index) => {
      const born = GLINT_FIRST_MS + mote.fromMs;
      const framesOf = (from: number, to: number): string[] => {
        const seen: string[] = [];
        for (let ms = from; ms < to; ms += 5) {
          const frame = glintAt(ms).find((each) => each.index === index)?.frame ?? 'none';
          if (seen[seen.length - 1] !== frame) seen.push(frame);
        }
        return seen;
      };
      expect(framesOf(born - 20, born + GLINT_LIFE_MS + 20)).toEqual(['none', 'spark', 'star', 'spark', 'none']);
    });
    const starts = GLINT_MOTES.map((mote) => mote.fromMs);
    expect([...starts].sort((a, b) => a - b)).toEqual(starts);
    expect(new Set(starts).size).toBe(starts.length);
  });

  it('repeat exactly, burst after burst', () => {
    for (let ms = GLINT_FIRST_MS; ms < GLINT_FIRST_MS + GLINT_EVERY_MS; ms += 35) {
      expect(glintAt(ms + GLINT_EVERY_MS * 3)).toEqual(glintAt(ms));
    }
  });

  it('stay on their own figure: no glint reaches the middle of the tile beside it', () => {
    const half = (GLINT_ART.star.length - 1) / 2;
    for (const mote of GLINT_MOTES) {
      expect(Math.abs(mote.dx) + half).toBeLessThanOrEqual(TILE_SIZE);
      expect(Math.abs(mote.dy) + half).toBeLessThanOrEqual(TILE_SIZE);
    }
    // And no two stars sit on top of each other.
    GLINT_MOTES.forEach((a, i) =>
      GLINT_MOTES.slice(i + 1).forEach((b) =>
        expect(Math.max(Math.abs(a.dx - b.dx), Math.abs(a.dy - b.dy))).toBeGreaterThanOrEqual(GLINT_ART.star.length),
      ),
    );
  });
});

describe('a yard full of shiny figures', () => {
  it('has each of the first eight - a partner, a pen, a whole garden - begin at a moment of its own', () => {
    const starts = Array.from({ length: 8 }, (_unused, place) => glintHeadStart(place));
    expect(starts[0]).toBe(0);
    const apart = starts.flatMap((a, i) =>
      starts.slice(i + 1).map((b) => {
        const gap = Math.abs(a - b);
        return Math.min(gap, GLINT_EVERY_MS - gap);
      }),
    );
    // A quarter of a second is a beat anybody can see.
    expect(Math.min(...apart)).toBeGreaterThanOrEqual(250);
    for (const start of starts) {
      expect(start).toBeGreaterThanOrEqual(0);
      expect(start).toBeLessThan(GLINT_EVERY_MS);
    }
  });
});

describe('a glint’s two pictures', () => {
  it('are square with a middle pixel, and symmetrical every way', () => {
    for (const rows of Object.values(GLINT_ART)) {
      expect(rows.length % 2).toBe(1);
      for (const row of rows) expect(row).toHaveLength(rows.length);
      const turned = rows.map((_row, y) => rows.map((row) => row[y]).join(''));
      expect(turned).toEqual([...rows]);
      expect([...rows].reverse()).toEqual([...rows]);
      expect(rows.map((row) => [...row].reverse().join(''))).toEqual([...rows]);
    }
  });

  it('have a dark rim all the way round the gold, so they read on any ground', () => {
    for (const rows of Object.values(GLINT_ART)) {
      const at = (x: number, y: number): string => rows[y]?.[x] ?? '.';
      rows.forEach((row, y) =>
        [...row].forEach((ink, x) => {
          expect(ink === '.' || ink in GLINT_INKS, `ink "${ink}"`).toBe(true);
          if (ink === 'g' || ink === 'w') {
            // Nothing bright touches the ground it is drawn on.
            for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]]) {
              expect(at(x + dx, y + dy), `${x},${y}`).not.toBe('.');
            }
          }
        }),
      );
    }
    // The rim is dark and the gold is bright: by the sum of their channels.
    const light = (colour: number): number => (colour >> 16) + ((colour >> 8) & 0xff) + (colour & 0xff);
    expect(light(GLINT_INKS.k)).toBeLessThan(200);
    expect(light(GLINT_INKS.g)).toBeGreaterThan(450);
  });
});

/** A scene that remembers every graphics it is asked for and what was painted on it. */
function sceneOfGraphics() {
  const all: ReturnType<typeof graphics>[] = [];
  function graphics() {
    const made = {
      pixels: [] as [number, number, number][],
      colour: 0,
      x: 0,
      y: 0,
      depth: 0,
      alpha: 1,
      visible: true,
      destroyed: false,
      clear: () => ((made.pixels = []), made),
      fillStyle: (colour: number) => ((made.colour = colour), made),
      fillRect: (x: number, y: number) => (made.pixels.push([x, y, made.colour]), made),
      setPosition: (x: number, y: number) => ((made.x = x), (made.y = y), made),
      setDepth: (depth: number) => ((made.depth = depth), made),
      setAlpha: (alpha: number) => ((made.alpha = alpha), made),
      setVisible: (visible: boolean) => ((made.visible = visible), made),
      destroy: () => void (made.destroyed = true),
    };
    return made;
  }
  const scene = {
    add: {
      graphics: vi.fn(() => {
        const made = graphics();
        all.push(made);
        return made;
      }),
    },
  };
  return { scene: scene as never, all };
}

describe('ShinyGlints, drawn', () => {
  it('draws this moment’s glints round the head it is given, over the figure and as faint as it is', () => {
    const { scene, all } = sceneOfGraphics();
    const glints = new ShinyGlints(scene);

    glints.place(100, 50, 3, 1);
    expect(all).toHaveLength(0);

    const now = GLINT_FIRST_MS + GLINT_MOTES[1].fromMs + 10;
    glints.update(now);
    glints.place(100, 50, 3, 0.5);

    const shown = all.filter((each) => each.visible);
    expect(shown.length).toBeGreaterThan(0);
    expect(shown.map((each) => [each.x, each.y, each.depth, each.alpha])).toEqual(
      glintAt(now).map((mote) => [100 + mote.dx, 50 + mote.dy, 3, 0.5]),
    );
    expect(glints.lit).toEqual(glintAt(now).map((mote) => ({ x: 100 + mote.dx, y: 50 + mote.dy, frame: mote.frame })));
  });

  it('paints each picture pixel for pixel, its middle on the place it is put', () => {
    const { scene, all } = sceneOfGraphics();
    const glints = new ShinyGlints(scene);
    for (const [ms, frame] of [[GLINT_FIRST_MS + 10, 'spark'], [GLINT_FIRST_MS + GLINT_MOTES[1].fromMs - 5, 'star']] as const) {
      glints.update(ms - (glints as unknown as { outMs: number }).outMs);
      glints.place(0, 0, 1);
      const rows = GLINT_ART[frame];
      const half = (rows.length - 1) / 2;
      const expected = rows.flatMap((row, y) =>
        [...row].flatMap((ink, x) => (ink === '.' ? [] : [[x - half, y - half, GLINT_INKS[ink]]])),
      );
      expect(all[0].pixels).toEqual(expected);
      expect(all[0].pixels).toContainEqual([0, 0, GLINT_INKS.w]);
    }
    // One graphics a glint, painted again only when its picture changes.
    expect(all).toHaveLength(1);
  });

  it('puts a glint away when its time is up, when the figure cannot be seen, and for good', () => {
    const { scene, all } = sceneOfGraphics();
    const glints = new ShinyGlints(scene);
    glints.update(GLINT_FIRST_MS + 10);
    glints.place(0, 0, 1);
    expect(all.some((each) => each.visible)).toBe(true);

    glints.place(0, 0, 1, 0);
    expect(all.some((each) => each.visible)).toBe(false);

    glints.place(0, 0, 1);
    glints.hide();
    expect(all.some((each) => each.visible)).toBe(false);
    expect(glints.lit).toEqual([]);

    glints.place(0, 0, 1);
    glints.update(GLINT_BURST_MS);
    glints.place(0, 0, 1);
    expect(all.some((each) => each.visible)).toBe(false);

    glints.destroy();
    expect(all.every((each) => each.destroyed)).toBe(true);
  });

  it('counts the head start it is given as time already out', () => {
    const { scene } = sceneOfGraphics();
    const glints = new ShinyGlints(scene, GLINT_FIRST_MS + 10);
    glints.place(0, 0, 1);
    expect(glints.lit).toHaveLength(1);
  });
});
