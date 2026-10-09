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
