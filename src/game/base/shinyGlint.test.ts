import { describe, expect, it, vi } from 'vitest';
import { TILE_SIZE } from '../worldMap';
import { SHINY_SPARKLE_TEXTURE, SPARKLE_FRAMES } from '../ui/shinySparkle';
import {
  GLINT_BURST_MS,
  GLINT_EVERY_MS,
  GLINT_FIRST_MS,
  GLINT_LIFE_MS,
  GLINT_MOTES,
  ShinyGlints,
  glintAt,
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

  it('come out one after another, each a plus that opens into a star and closes again', () => {
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
      expect(framesOf(born - 20, born + GLINT_LIFE_MS + 20)).toEqual(['none', 'glint', 'twinkle', 'glint', 'none']);
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
    const half = Math.max(SPARKLE_FRAMES.twinkle.width, SPARKLE_FRAMES.glint.width) / 2;
    for (const mote of GLINT_MOTES) {
      expect(Math.abs(mote.dx) + half).toBeLessThanOrEqual(TILE_SIZE);
      expect(Math.abs(mote.dy) + half).toBeLessThanOrEqual(TILE_SIZE);
    }
    // And no two sit on top of each other.
    GLINT_MOTES.forEach((a, i) =>
      GLINT_MOTES.slice(i + 1).forEach((b) => expect(Math.abs(a.dx - b.dx) + Math.abs(a.dy - b.dy)).toBeGreaterThanOrEqual(8)),
    );
  });
});

/** A scene with the sparkle sheet loaded, and every image it is asked for. */
function sceneWithSheet(loaded = true) {
  const frames = new Set<string>();
  const images: ReturnType<typeof image>[] = [];
  function image() {
    const made = {
      frame: '',
      x: 0,
      y: 0,
      depth: 0,
      alpha: 1,
      visible: true,
      destroyed: false,
      setFrame: (frame: string) => ((made.frame = frame), made),
      setPosition: (x: number, y: number) => ((made.x = x), (made.y = y), made),
      setDepth: (depth: number) => ((made.depth = depth), made),
      setAlpha: (alpha: number) => ((made.alpha = alpha), made),
      setVisible: (visible: boolean) => ((made.visible = visible), made),
      setOrigin: () => made,
      destroy: () => void (made.destroyed = true),
    };
    return made;
  }
  const scene = {
    textures: {
      exists: (key: string) => loaded && key === SHINY_SPARKLE_TEXTURE,
      get: () => ({
        has: (name: string) => frames.has(name),
        add: vi.fn((name: string) => void frames.add(name)),
      }),
    },
    add: {
      image: vi.fn(() => {
        const made = image();
        images.push(made);
        return made;
      }),
    },
  };
  return { scene: scene as never, images, frames };
}

describe('ShinyGlints, drawn', () => {
  it('draws this moment’s glints round the head it is given, over the figure and as faint as it is', () => {
    const { scene, images, frames } = sceneWithSheet();
    const glints = new ShinyGlints(scene);

    glints.place(100, 50, 3, 1);
    expect(images).toHaveLength(0);

    glints.update(GLINT_FIRST_MS + GLINT_MOTES[1].fromMs + 10);
    glints.place(100, 50, 3, 0.5);

    const shown = images.filter((each) => each.visible);
    expect(shown.map((each) => [each.x, each.y, each.depth, each.alpha])).toEqual(
      glintAt(GLINT_FIRST_MS + GLINT_MOTES[1].fromMs + 10).map((mote) => [100 + mote.dx, 50 + mote.dy, 3, 0.5]),
    );
    expect(shown.length).toBeGreaterThan(0);
    expect([...frames].sort()).toEqual(Object.keys(SPARKLE_FRAMES).sort());
  });

  it('puts a glint away when its time is up, when the figure cannot be seen, and for good', () => {
    const { scene, images } = sceneWithSheet();
    const glints = new ShinyGlints(scene);
    glints.update(GLINT_FIRST_MS + 10);
    glints.place(0, 0, 1);
    expect(images.some((each) => each.visible)).toBe(true);

    glints.place(0, 0, 1, 0);
    expect(images.some((each) => each.visible)).toBe(false);

    glints.place(0, 0, 1);
    glints.hide();
    expect(images.some((each) => each.visible)).toBe(false);

    glints.place(0, 0, 1);
    glints.update(GLINT_BURST_MS);
    glints.place(0, 0, 1);
    expect(images.some((each) => each.visible)).toBe(false);

    glints.destroy();
    expect(images.every((each) => each.destroyed)).toBe(true);
  });

  it('draws nothing in a scene that never loaded the sparkle sheet', () => {
    const { scene, images } = sceneWithSheet(false);
    const glints = new ShinyGlints(scene);
    glints.update(GLINT_FIRST_MS + 10);
    expect(() => glints.place(0, 0, 1)).not.toThrow();
    expect(images).toHaveLength(0);
  });
});
