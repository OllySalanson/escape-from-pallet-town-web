import { describe, expect, it, vi } from 'vitest';
import type Phaser from 'phaser';
import { RaidHud, type RaidHudState } from './RaidHud';
import { overlaps, type Rect } from './labelPlacement';

/**
 * A scene with just enough of Phaser for the HUD: graphics that record the
 * windows they are asked to fill, and text that reports a size for its lines.
 */
function stubScene(width: number) {
  const fills: Rect[] = [];
  const texts: { visible: boolean; lines: string[] }[] = [];
  const graphics = {
    setScrollFactor: vi.fn(() => graphics),
    setDepth: vi.fn(() => graphics),
    clear: vi.fn(() => {
      fills.length = 0;
      return graphics;
    }),
    fillStyle: vi.fn(() => graphics),
    fillRect: vi.fn((x: number, y: number, w: number, h: number) => {
      fills.push({ x, y, width: w, height: h });
      return graphics;
    }),
    destroy: vi.fn(),
  };
  const makeText = () => {
    const record = { visible: true, lines: [] as string[] };
    texts.push(record);
    const text = {
      get width() {
        return Math.max(0, ...record.lines.map((line) => line.length * 5));
      },
      get height() {
        return record.lines.length * 12;
      },
      text: '',
      setScrollFactor: vi.fn(() => text),
      setDepth: vi.fn(() => text),
      setVisible: vi.fn((visible: boolean) => {
        record.visible = visible;
        return text;
      }),
      setColor: vi.fn(() => text),
      setText: vi.fn((lines: string[]) => {
        record.lines = lines;
        return text;
      }),
      setPosition: vi.fn(() => text),
      setAlpha: vi.fn(() => text),
      getWrappedText: () => record.lines,
      destroy: vi.fn(),
    };
    return text;
  };
  const scene = {
    scale: { width },
    add: { graphics: () => graphics, text: makeText },
  };
  return { scene: scene as unknown as Phaser.Scene, fills, texts };
}

const STATE: RaidHudState = {
  clock: { label: 'RAID 4:55', tone: 'calm', pulses: false },
  objectiveLines: ['FIND LOOT'],
  hunter: { label: 'HUNTER 5 S', tone: 'closing' },
  place: 'THE LAMMAS',
  weather: 'RAIN',
  prize: null,
};

describe('RaidHud under a raised dialogue box', () => {
  // The world's box at the top of a 400-wide screen: 304 wide, centred, 8 down.
  const box: Rect = { x: 48, y: 8, width: 304, height: 80 };

  it('draws every chip when nothing is over it', () => {
    const { scene, texts } = stubScene(400);
    const hud = new RaidHud(scene);
    hud.render(STATE, 0);

    expect(texts.filter((text) => text.visible)).toHaveLength(5);
    expect(hud.occupied).toHaveLength(5);
  });

  it('draws no chip the box cuts through, rather than half of one either side of it', () => {
    // Playtest 24 P1: `▸FIND LO` / `AID 4:55` / `RAIN` stuck out past both ends
    // of the box on every trainer approach and hunter catch from below.
    const { scene, fills, texts } = stubScene(400);
    const hud = new RaidHud(scene);
    hud.render(STATE, 0, box);

    expect(fills.filter((fill) => overlaps(fill, box))).toEqual([]);
    expect(hud.occupied.filter((chip) => overlaps(chip, box))).toEqual([]);
    const shown = texts.filter((text) => text.visible).map((text) => text.lines[0]);
    // RAIN is narrow enough to sit in the corner the box leaves free, and stays.
    expect(shown).toEqual(['RAIN']);
  });

  it('puts every chip back where it was once the box has gone', () => {
    const { scene } = stubScene(400);
    const hud = new RaidHud(scene);
    hud.render(STATE, 0);
    const before = [...hud.occupied];
    hud.render(STATE, 0, box);
    hud.render(STATE, 0, null);

    expect(hud.occupied).toEqual(before);
  });

  it('keeps a chip the box does not reach', () => {
    // The box at the bottom of the screen is clear of every corner chip.
    const { scene, texts } = stubScene(400);
    const hud = new RaidHud(scene);
    hud.render(STATE, 0, { x: 48, y: 168, width: 304, height: 80 });

    expect(texts.filter((text) => text.visible)).toHaveLength(5);
  });
});

describe('RaidHud beside a side panel', () => {
  it('moves the right column over, so the clock and the hunter stay in sight', () => {
    const { scene } = stubScene(400);
    const hud = new RaidHud(scene);
    hud.render(STATE, 0, null, 155);

    expect(hud.occupied).toHaveLength(5);
    for (const chip of hud.occupied) {
      expect(chip.x + chip.width).toBeLessThanOrEqual(245);
    }
  });

  it('stands the clock under the objective when there is no room for the two side by side', () => {
    const { scene } = stubScene(400);
    const hud = new RaidHud(scene);
    const state = { ...STATE, objectiveLines: ['THE LONGEST CUE A RAID EVER SAID'] };
    hud.render(state, 0, null, 155);

    const chips = hud.occupied;
    for (const [index, chip] of chips.entries()) {
      expect(chips.slice(index + 1).filter((other) => overlaps(chip, other))).toEqual([]);
    }
  });

  it('puts the clock back in its corner once the panel has gone', () => {
    const { scene } = stubScene(400);
    const hud = new RaidHud(scene);
    hud.render(STATE, 0);
    const before = [...hud.occupied];
    hud.render(STATE, 0, null, 155);
    hud.render(STATE, 0);

    expect(hud.occupied).toEqual(before);
  });
});

describe('RaidHud clock in the last minute', () => {
  // Playtest 40 #5: the caution clock was the calm clock in a yellower fill, so
  // in greyscale the last minute looked exactly like the first four. It has to
  // say so by shape as well: a frame twice as heavy.
  const ruleCount = (fills: readonly Rect[], chip: Rect) =>
    fills.filter(
      (fill) =>
        fill.height === 1 &&
        fill.x >= chip.x &&
        fill.x + fill.width <= chip.x + chip.width &&
        fill.y >= chip.y &&
        fill.y < chip.y + chip.height,
    ).length;

  it('draws the caution clock with a frame twice as heavy as the calm one', () => {
    const calm = stubScene(400);
    const calmHud = new RaidHud(calm.scene);
    calmHud.render(STATE, 0);
    const caution = stubScene(400);
    const cautionHud = new RaidHud(caution.scene);
    cautionHud.render({ ...STATE, clock: { label: 'RAID 0:55', tone: 'caution', pulses: false } }, 0);

    // Second: the objective is seated first, so the clock can stand clear of it.
    const calmClock = calmHud.occupied[1];
    const cautionClock = cautionHud.occupied[1];
    expect(calmClock.width).toBe(cautionClock.width);
    expect(ruleCount(calm.fills, calmClock)).toBe(2);
    expect(ruleCount(caution.fills, cautionClock)).toBe(4);
  });
});
