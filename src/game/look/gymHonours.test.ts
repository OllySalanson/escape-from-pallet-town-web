import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { HARBOUR_BOTS } from '../base/harbourBots';
import { encodeHarbourMove, readHarbourMove } from '../harbour/harbourProtocol';
import { encodeRaidMove, readRaidMove } from '../raidRoom/raidProtocol';
import { decodePng } from '../testing/pngPixels';
import { valeGyms } from '../world/valeQuarters';
import { composeLook, PIECE_HEIGHT, PIECE_WIDTH, type Pixels } from './composeLook';
import {
  GYM_HONOURS,
  honourArts,
  honourOf,
  honoursEarned,
  honoursWorn,
  readHonours,
  type HonourId,
} from './gymHonours';
import { STARTER_LOOK, type DressedLook } from './look';
import { WHOLE_LOOKS } from './wardrobe';
import { BODY_PLACES, browDrop, dressIn, packArt, REFERENCE_FACE_ROW, type FigurePixels, type WornPackBody } from './wornPack';

const asset = (name: string): URL => new URL(`../../../public/assets/${name}`, import.meta.url);

async function sheet(name: string): Promise<Pixels> {
  const png = decodePng(await readFile(asset(name)));
  const data = new Uint8ClampedArray(png.width * png.height * 4);
  for (let y = 0; y < png.height; y += 1) {
    for (let x = 0; x < png.width; x += 1) {
      data.set(png.at(x, y), (y * png.width + x) * 4);
    }
  }
  return { width: png.width, height: png.height, data };
}

function cropped(source: Pixels, width: number, height: number): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    out.set(source.data.subarray(y * source.width * 4, (y * source.width + width) * 4), y * width * 4);
  }
  return out;
}

interface Body {
  readonly name: string;
  readonly body: WornPackBody;
  readonly figure: FigurePixels;
  /** The first row of the face, standing and facing down, and how many rows of it hold the eyes. */
  readonly face: number;
}

/** Every body an honour is ever worn on: the classic figure, the rider, and FireRed looks, hats and hair both. */
async function bodies(): Promise<readonly Body[]> {
  const atlas = await sheet('wearables.png');
  const looks: readonly [string, DressedLook][] = [
    ['starter', STARTER_LOOK],
    ...WHOLE_LOOKS.map((entry): [string, DressedLook] => [entry.id, entry.look]),
  ];
  return [
    { name: 'classic', body: 'classic', figure: { width: PIECE_WIDTH, under: cropped(await sheet('character.png'), PIECE_WIDTH, PIECE_HEIGHT) }, face: 12 },
    { name: 'rider', body: 'rider', figure: { width: 128, under: cropped(await sheet('player-bike.png'), 128, 128) }, face: 15 },
    ...looks.map(([name, look]): Body => {
      const { under, head } = composeLook(atlas, look, 'layers');
      return { name, body: 'firered', figure: { width: PIECE_WIDTH, under, head }, face: REFERENCE_FACE_ROW + browDrop(head, PIECE_WIDTH) + 1 };
    }),
  ];
}

const bare = (each: Body): Uint8ClampedArray => dressIn(each.figure, each.body, []);

/** How many pixels of one frame differ. */
function changedIn(a: Uint8ClampedArray, b: Uint8ClampedArray, each: Body, row: number, column: number): number {
  const { frameWidth, frameHeight } = BODY_PLACES[each.body];
  let count = 0;
  for (let y = 0; y < frameHeight; y += 1) {
    for (let x = 0; x < frameWidth; x += 1) {
      const at = ((row * frameHeight + y) * each.figure.width + column * frameWidth + x) * 4;
      if ([0, 1, 2, 3].some((c) => a[at + c] !== b[at + c])) count += 1;
    }
  }
  return count;
}

describe('GYM HONOURS', () => {
  it('gives every gym in the vale an honour of its own, and nothing else one', () => {
    const gyms = valeGyms().map((gym) => gym.bossId);
    expect(gyms.map((bossId) => honourOf(bossId)?.id)).not.toContain(undefined);
    expect(GYM_HONOURS.map((honour) => honour.bossId)).toEqual(gyms);
    expect(new Set(GYM_HONOURS.map((honour) => honour.id)).size).toBe(GYM_HONOURS.length);
  });

  it('is drawn in rows sixteen wide, in its own colours and the outline, for every facing', () => {
    for (const honour of GYM_HONOURS) {
      for (const facing of ['down', 'side', 'up'] as const) {
        expect(honour.art.parts[facing].length, `${honour.id} ${facing}`).toBeGreaterThan(0);
        for (const part of honour.art.parts[facing]) {
          for (const row of part.rows) {
            expect(row).toHaveLength(16);
            for (const key of row) {
              expect(key === '.' || key === 'o' || Object.hasOwn(honour.art.colours, key), `"${key}" in ${row}`).toBe(true);
            }
          }
        }
      }
    }
  });

  it('is worn for a leader beaten, and not once it is taken off', () => {
    const both = ['vale-gym-misty', 'vale-gym-koga', 'overlook-warden'];
    expect(honoursEarned([])).toEqual([]);
    expect(honoursEarned(['vale-gym-koga', 'vale-gym-misty'])).toEqual(['cascade', 'soul']);
    expect(honoursWorn({ defeatedBosses: both })).toEqual(['cascade', 'soul']);
    expect(honoursWorn({ defeatedBosses: both, honoursHidden: ['cascade'] })).toEqual(['soul']);
    // A hidden honour not yet won is still not worn, and a later win does not undo the choice.
    expect(honoursWorn({ defeatedBosses: ['vale-gym-misty'], honoursHidden: ['soul'] })).toEqual(['cascade']);
  });
});

describe('an honour on a figure', () => {
  it('shows in every frame the walk is drawn from, on every body, in every facing', async () => {
    for (const each of await bodies()) {
      const plain = bare(each);
      for (const honour of GYM_HONOURS) {
        const dressed = dressIn(each.figure, each.body, honourArts([honour.id]));
        for (let row = 0; row < 4; row += 1) {
          for (let column = 0; column < 4; column += 1) {
            expect(changedIn(dressed, plain, each, row, column), `${honour.id} on ${each.name}, row ${row}, column ${column}`).toBeGreaterThan(3);
          }
        }
      }
    }
  });

  it("never covers the eyes, whatever the head under it", async () => {
    for (const each of await bodies()) {
      const plain = bare(each);
      const dressed = dressIn(each.figure, each.body, honourArts(GYM_HONOURS.map((honour) => honour.id)));
      const { frameWidth } = BODY_PLACES[each.body];
      for (let x = 0; x < frameWidth; x += 1) {
        const at = (each.face * each.figure.width + x) * 4;
        expect([...dressed.subarray(at, at + 4)], `${each.name}, x ${x}`).toEqual([...plain.subarray(at, at + 4)]);
      }
    }
  });

  it('stacks: a player two gyms in looks different from one, from every side', async () => {
    for (const each of await bodies()) {
      const one = dressIn(each.figure, each.body, honourArts(['cascade']));
      const two = dressIn(each.figure, each.body, honourArts(['cascade', 'soul']));
      for (let row = 0; row < 4; row += 1) {
        expect(changedIn(one, two, each, row, 0), `${each.name}, row ${row}`).toBeGreaterThan(3);
      }
    }
  });

  it("keeps the neckerchief's collar in sight over a pack's top from behind", async () => {
    const [, , starter] = await bodies();
    const packed = dressIn(starter.figure, starter.body, [packArt('raid-pack')]);
    const both = dressIn(starter.figure, starter.body, [packArt('raid-pack'), ...honourArts(['cascade'])]);
    expect(changedIn(packed, both, starter, 2, 0)).toBeGreaterThan(8);
  });
});

describe('honours heard from another browser', () => {
  it('believe only the catalogue, each once, in its own order', () => {
    expect(readHonours(['soul', 'cascade', 'soul'])).toEqual(['cascade', 'soul']);
    expect(readHonours(['crown', 7, null, 'cascade'])).toEqual(['cascade']);
    expect(readHonours('cascade')).toEqual([]);
    expect(readHonours(Array.from({ length: 50 }, () => 'cascade'))).toEqual([]);
  });

  it('cross the harbour and a raid room with a move', () => {
    const honours: readonly HonourId[] = ['cascade', 'soul'];
    const move = { from: '12345678-1234-4234-8234-123456789abc', place: 'yard' as const, path: [{ x: 3, y: 4 }], facing: 'down' as const, honours };
    const heard = readHarbourMove(JSON.parse(JSON.stringify(encodeHarbourMove(move))));
    expect(heard?.honours).toEqual(honours);
    const room = readRaidMove(JSON.parse(JSON.stringify(encodeRaidMove({ ...move, place: 'lab' }))));
    expect(room?.honours).toEqual(honours);
    // None worn says nothing on the wire.
    expect(encodeHarbourMove({ ...move, honours: [] })).not.toHaveProperty('g');
  });

  it("dress a few of the harbour's regulars, and never in more than the gyms there are", () => {
    const wearing = HARBOUR_BOTS.filter((bot) => (bot.honours ?? []).length > 0);
    expect(wearing.length).toBeGreaterThan(0);
    expect(wearing.length).toBeLessThanOrEqual(HARBOUR_BOTS.length / 4);
    for (const bot of wearing) {
      expect(readHonours(bot.honours)).toEqual(bot.honours);
    }
  });
});
