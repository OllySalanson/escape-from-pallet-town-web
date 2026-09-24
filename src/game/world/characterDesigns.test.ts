import { readFile, readdir } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import type { Direction } from '../movement/gridMovement';
import {
  CHARACTER_FEET_PIXEL_Y,
  CHARACTER_FRAME_HEIGHT,
  CHARACTER_FRAME_WIDTH,
  getIdleFrame,
  getWalkFrames,
} from '../playerFrames';
import { decodePng, type PngPixels } from '../testing/pngPixels';
import {
  CHARACTER_DESIGN_IDS,
  CHARACTER_DESIGN_SHEET_COLUMNS,
  characterDesignAssetPath,
  characterDesignTextureKey,
  getCharacterDesign,
  type CharacterDesignId,
} from './characterDesigns';

const PUBLIC_ROOT = new URL('../../../public/', import.meta.url);
const DIRECTIONS: readonly Direction[] = ['down', 'right', 'up', 'left'];
const SHEET_ROWS = DIRECTIONS.length;
/** The orange and green the source sheet backs its cells with. */
const SOURCE_BACKINGS = ['255,127,39', '34,177,76'];

const loadSheet = async (design: CharacterDesignId): Promise<PngPixels> =>
  decodePng(await readFile(new URL(characterDesignAssetPath(design), PUBLIC_ROOT)));

interface FrameBounds {
  readonly top: number;
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly ink: string;
}

/** The opaque extent of one frame, and its pixels as a comparable string. */
function frameBounds(sheet: PngPixels, frame: number): FrameBounds | null {
  const originX = (frame % CHARACTER_DESIGN_SHEET_COLUMNS) * CHARACTER_FRAME_WIDTH;
  const originY = Math.floor(frame / CHARACTER_DESIGN_SHEET_COLUMNS) * CHARACTER_FRAME_HEIGHT;
  const rows: number[] = [];
  const columns: number[] = [];
  const ink: string[] = [];
  for (let y = 0; y < CHARACTER_FRAME_HEIGHT; y += 1) {
    for (let x = 0; x < CHARACTER_FRAME_WIDTH; x += 1) {
      const pixel = sheet.at(originX + x, originY + y);
      if (pixel[3] > 0) {
        rows.push(y);
        columns.push(x);
        ink.push(`${x},${y}:${pixel.join(',')}`);
      }
    }
  }
  if (rows.length === 0) {
    return null;
  }
  return {
    top: Math.min(...rows),
    bottom: Math.max(...rows),
    left: Math.min(...columns),
    right: Math.max(...columns),
    ink: ink.join(' '),
  };
}

describe('the character design registry', () => {
  it('names every sheet on disk and ships a sheet for every name', async () => {
    const entries = await readdir(new URL('assets/characters/', PUBLIC_ROOT));

    expect(entries.sort()).toEqual(CHARACTER_DESIGN_IDS.map((id) => `${id}.png`).sort());
  });

  it('gives every design a texture key of its own, clear of the shared sheet', () => {
    const keys = CHARACTER_DESIGN_IDS.map(characterDesignTextureKey);

    expect(new Set(keys).size).toBe(CHARACTER_DESIGN_IDS.length);
    expect(keys).not.toContain('character');
  });

  it('offers townsfolk of several kinds, trainer classes and a second protagonist', () => {
    const count = (kind: string) =>
      CHARACTER_DESIGN_IDS.filter((id) => getCharacterDesign(id).kind === kind).length;

    expect(count('townsfolk')).toBeGreaterThanOrEqual(4);
    expect(count('trainer')).toBeGreaterThanOrEqual(4);
    expect(count('protagonist')).toBeGreaterThanOrEqual(1);
  });

  it('casts the four people the base is made of and the five hunters, each by name', () => {
    const named = CHARACTER_DESIGN_IDS.filter((id) => getCharacterDesign(id).kind === 'named');

    expect(named.sort()).toEqual([
      'bill',
      'blue',
      'brock',
      'koga',
      'lt-surge',
      'misty',
      'nurse-joy',
      'prof-oak',
      'sabrina',
    ]);
    for (const id of named) {
      // A class of person is described by what they look like; one of these is
      // described by who they are, and the screens print that name.
      expect(getCharacterDesign(id).description, id).toMatch(/^[A-Z]/);
    }
  });
});

describe('the character design sheets', () => {
  it('are cut to the frame grid the shared sheet is read on', async () => {
    for (const design of CHARACTER_DESIGN_IDS) {
      const sheet = await loadSheet(design);

      expect({ width: sheet.width, height: sheet.height }, design).toEqual({
        width: CHARACTER_FRAME_WIDTH * CHARACTER_DESIGN_SHEET_COLUMNS,
        height: CHARACTER_FRAME_HEIGHT * SHEET_ROWS,
      });
    }
  });

  it('draw a figure in every frame the walk and idle lookups can ask for', async () => {
    for (const design of CHARACTER_DESIGN_IDS) {
      const sheet = await loadSheet(design);
      for (const direction of DIRECTIONS) {
        const frames = [
          getIdleFrame(direction, CHARACTER_DESIGN_SHEET_COLUMNS),
          ...getWalkFrames(direction, CHARACTER_DESIGN_SHEET_COLUMNS),
        ];
        for (const frame of frames) {
          expect(frameBounds(sheet, frame), `${design} ${direction} frame ${frame}`).not.toBeNull();
        }
      }
    }
  });

  it('take a step in the walk cycle rather than sliding on the idle frame', async () => {
    for (const design of CHARACTER_DESIGN_IDS.filter((id) => getCharacterDesign(id).walks)) {
      const sheet = await loadSheet(design);
      for (const direction of DIRECTIONS) {
        const [stepA, idle, stepB] = getWalkFrames(direction, CHARACTER_DESIGN_SHEET_COLUMNS).map(
          (frame) => frameBounds(sheet, frame)!.ink,
        );

        expect(stepA, `${design} ${direction} first step`).not.toBe(idle);
        expect(stepB, `${design} ${direction} second step`).not.toBe(idle);
        expect(stepA, `${design} ${direction} steps are one frame`).not.toBe(stepB);
      }
    }
  });

  it('hold a standing figure still, because the sheet gave it no cycle to walk', async () => {
    const standing = CHARACTER_DESIGN_IDS.filter((id) => !getCharacterDesign(id).walks);
    expect(standing.length).toBeGreaterThan(0);

    for (const design of standing) {
      const sheet = await loadSheet(design);
      for (const direction of DIRECTIONS) {
        const idle = frameBounds(sheet, getIdleFrame(direction, CHARACTER_DESIGN_SHEET_COLUMNS))!;
        for (const frame of getWalkFrames(direction, CHARACTER_DESIGN_SHEET_COLUMNS)) {
          expect(frameBounds(sheet, frame)!.ink, `${design} ${direction} frame ${frame}`).toBe(
            idle.ink,
          );
        }
      }
    }
  });

  it('face four different ways, so a facing can be read off a standing figure', async () => {
    for (const design of CHARACTER_DESIGN_IDS) {
      const sheet = await loadSheet(design);
      const facings = DIRECTIONS.map(
        (direction) =>
          frameBounds(sheet, getIdleFrame(direction, CHARACTER_DESIGN_SHEET_COLUMNS))!.ink,
      );

      expect(new Set(facings).size, design).toBe(DIRECTIONS.length);
    }
  });

  it('stand on the same sole line as the shared sheet, so they sit on their tile', async () => {
    for (const design of CHARACTER_DESIGN_IDS) {
      const sheet = await loadSheet(design);
      for (const direction of ['down', 'up'] as const) {
        const idle = frameBounds(sheet, getIdleFrame(direction, CHARACTER_DESIGN_SHEET_COLUMNS))!;

        expect(idle.bottom, `${design} ${direction}`).toBe(CHARACTER_FEET_PIXEL_Y);
      }
      // No frame of any cycle reaches below it - a foot under the sole line is
      // a foot drawn on the tile to the south.
      for (let frame = 0; frame < CHARACTER_DESIGN_SHEET_COLUMNS * SHEET_ROWS; frame += 1) {
        expect(frameBounds(sheet, frame)!.bottom, `${design} frame ${frame}`).toBeLessThanOrEqual(
          CHARACTER_FEET_PIXEL_Y,
        );
      }
    }
  });

  it('record where each head starts, measured from the art', async () => {
    for (const design of CHARACTER_DESIGN_IDS) {
      const sheet = await loadSheet(design);
      const idle = frameBounds(sheet, getIdleFrame('down', CHARACTER_DESIGN_SHEET_COLUMNS))!;

      expect(getCharacterDesign(design).headPixelY, design).toBe(idle.top);
    }
  });

  it('carry nothing of the source sheet: no cell backing, no half-keyed edge', async () => {
    for (const design of CHARACTER_DESIGN_IDS) {
      const sheet = await loadSheet(design);
      const offenders: string[] = [];
      for (let y = 0; y < sheet.height; y += 1) {
        for (let x = 0; x < sheet.width; x += 1) {
          const [red, green, blue, alpha] = sheet.at(x, y);
          if (alpha !== 0 && alpha !== 255) {
            offenders.push(`${x},${y} is translucent`);
          } else if (alpha > 0 && SOURCE_BACKINGS.includes(`${red},${green},${blue}`)) {
            offenders.push(`${x},${y} is cell backing`);
          }
        }
      }

      expect(offenders, design).toEqual([]);
    }
  });
});
