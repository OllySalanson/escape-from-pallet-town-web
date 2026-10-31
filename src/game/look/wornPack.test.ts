import { readFile } from 'node:fs/promises';
import { describe, expect, it } from 'vitest';
import { PACK_IDS } from '../items/packs';
import type { PackItemId } from '../items/items';
import { HARBOUR_BOTS } from '../base/harbourBots';
import { encodeHarbourMove, readHarbourMove } from '../harbour/harbourProtocol';
import { decodePng } from '../testing/pngPixels';
import { BIKE_TEXTURE } from '../world/bicycle';
import { SHARED_CHARACTER_TEXTURE } from '../world/characterPresentation';
import { composeLook, PIECE_HEIGHT, PIECE_WIDTH, type Pixels } from './composeLook';
import { STARTER_LOOK } from './look';
import { bikeTexture, lookHeadDrop, lookTexture } from './lookTexture';
import { WEARABLES } from './wearables';
import {
  BODY_PLACES,
  dressInPack,
  PACK_COLOURS,
  stepShift,
  WORN_PACK_ART,
  type FigurePixels,
  type WornPackBody,
} from './wornPack';

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
  readonly body: WornPackBody;
  readonly figure: FigurePixels;
  /** The figure with nothing on its back. */
  readonly bare: Uint8ClampedArray;
}

async function bodies(): Promise<readonly Body[]> {
  const atlas = await sheet('wearables.png');
  const { under, head } = composeLook(atlas, STARTER_LOOK, 'layers');
  const classic = cropped(await sheet('character.png'), PIECE_WIDTH, PIECE_HEIGHT);
  const rider = cropped(await sheet('player-bike.png'), 128, 128);
  return [
    { body: 'firered', figure: { width: PIECE_WIDTH, under, head }, bare: composeLook(atlas, STARTER_LOOK) },
    { body: 'classic', figure: { width: PIECE_WIDTH, under: classic }, bare: classic },
    { body: 'rider', figure: { width: 128, under: rider }, bare: rider },
  ];
}

const FACINGS = ['down', 'right', 'up', 'left'] as const;
const ROW_OF = { down: 0, right: 1, up: 2, left: 3 } as const;

/** The pixels of one frame that the pack changed, as "x,y". */
function changed(
  dressed: Uint8ClampedArray,
  bare: Uint8ClampedArray,
  { body, figure }: Body,
  row: number,
  column: number,
): Set<string> {
  const { frameWidth, frameHeight } = BODY_PLACES[body];
  const out = new Set<string>();
  for (let y = 0; y < frameHeight; y += 1) {
    for (let x = 0; x < frameWidth; x += 1) {
      const at = ((row * frameHeight + y) * figure.width + column * frameWidth + x) * 4;
      if ([0, 1, 2, 3].some((c) => dressed[at + c] !== bare[at + c])) {
        out.add(`${x},${y}`);
      }
    }
  }
  return out;
}

function allPackPixels(pack: PackItemId): readonly { readonly layer: string; readonly x: number; readonly y: number }[] {
  return Object.values(WORN_PACK_ART[pack]).flatMap((parts) =>
    parts.flatMap((part) =>
      part.rows.flatMap((row, y) =>
        [...row].flatMap((key, x) => (key === '.' ? [] : [{ layer: part.layer, x, y: part.y + y }])),
      ),
    ),
  );
}

describe('the drawings', () => {
  it.each(PACK_IDS)('%s is drawn in rows sixteen wide, in its own colours and the figure\'s outline', (pack) => {
    for (const parts of Object.values(WORN_PACK_ART[pack])) {
      for (const part of parts) {
        for (const row of part.rows) {
          expect(row).toHaveLength(16);
          for (const key of row) {
            expect(key === '.' || key === 'o' || Object.hasOwn(PACK_COLOURS, key), `"${key}" in ${row}`).toBe(true);
          }
        }
      }
    }
  });

  it('every pack has a drawing for every facing', () => {
    for (const pack of PACK_IDS) {
      for (const facing of ['down', 'side', 'up'] as const) {
        expect(WORN_PACK_ART[pack][facing].length).toBeGreaterThan(0);
      }
    }
  });

  it('only the Hauler frame rises over the head', () => {
    const tallest = (pack: PackItemId) => Math.min(...allPackPixels(pack).map(({ y }) => y));
    for (const pack of PACK_IDS.filter((id) => id !== 'hauler-frame')) {
      expect(tallest(pack)).toBeGreaterThan(9);
    }
    expect(tallest('hauler-frame')).toBeLessThan(9);
  });

  it('nothing but a frame that tall passes in front of the head', () => {
    for (const pack of PACK_IDS) {
      const over = allPackPixels(pack).filter(({ layer }) => layer === 'over');
      expect(over.length > 0).toBe(pack === 'hauler-frame');
    }
  });
});

describe('a pack on a figure', () => {
  it('shows in every frame the walk is drawn from, on every body, in every facing', async () => {
    for (const each of await bodies()) {
      for (const pack of PACK_IDS) {
        const dressed = dressInPack(each.figure, each.body, pack);
        for (const facing of FACINGS) {
          for (let column = 0; column < 4; column += 1) {
            expect(
              changed(dressed, each.bare, each, ROW_OF[facing], column).size,
              `${pack} on ${each.body}, ${facing}, column ${column}`,
            ).toBeGreaterThan(0);
          }
        }
      }
    }
  });

  it('tells the four packs apart from every side, on every body', async () => {
    for (const each of await bodies()) {
      for (const facing of FACINGS) {
        const seen = PACK_IDS.map((pack) => {
          const dressed = dressInPack(each.figure, each.body, pack);
          const { frameWidth, frameHeight } = BODY_PLACES[each.body];
          const top = ROW_OF[facing] * frameHeight;
          return Array.from({ length: frameHeight }, (_, y) =>
            Array.from({ length: frameWidth }, (_, x) =>
              dressed.subarray(((top + y) * each.figure.width + x) * 4, ((top + y) * each.figure.width + x) * 4 + 4).join(),
            ).join(' '),
          ).join('\n');
        });
        expect(new Set(seen).size, `${each.body} facing ${facing}`).toBe(PACK_IDS.length);
      }
    }
  });

  it('never covers a face', async () => {
    const face = { firered: 16, classic: 13, rider: 14 } as const;
    for (const each of await bodies()) {
      const { frameWidth } = BODY_PLACES[each.body];
      const chinRow = face[each.body];
      for (const pack of PACK_IDS) {
        const dressed = dressInPack(each.figure, each.body, pack);
        for (let column = 0; column < 4; column += 1) {
          for (let x = 0; x < frameWidth; x += 1) {
            const bare = (chinRow * each.figure.width + column * frameWidth + x) * 4;
            if (each.bare[bare + 3] !== 255) continue;
            expect([...dressed.subarray(bare, bare + 4)], `${pack} on ${each.body}, x ${x}`).toEqual([
              ...each.bare.subarray(bare, bare + 4),
            ]);
          }
        }
      }
    }
  });

  it('moves as far as the figure wearing it does on a step', async () => {
    // The foot of the pack, because a strap at the top of it stays on the figure.
    const rowsOf = (pixels: Set<string>): number => Math.max(...[...pixels].map((at) => Number(at.split(',')[1])));
    for (const each of await bodies()) {
      const head = each.figure.head ?? each.figure.under;
      const dressed = dressInPack(each.figure, each.body, 'raid-pack');
      for (const facing of FACINGS) {
        const row = ROW_OF[facing];
        for (const column of [1, 3]) {
          const [, dy] = stepShift(head, each.figure.width, each.body, row, column);
          const stands = rowsOf(changed(dressed, each.bare, each, row, 0));
          const steps = rowsOf(changed(dressed, each.bare, each, row, column));
          // Where the figure dips the pack dips with it; where it does not, a pack lifts a pixel.
          if (BODY_PLACES[each.body].bounces) {
            expect(steps - stands, `${each.body}, ${facing}, column ${column}`).toBe(dy === 0 ? -1 : dy);
          } else {
            expect(dy, `${each.body} does not dip`).toBe(0);
          }
        }
      }
    }
  });

  it('a figure\'s step is read off its own frames', async () => {
    const [firered, classic, rider] = await bodies();
    const down = (body: Body, column: number) =>
      stepShift(body.figure.head ?? body.figure.under, body.figure.width, body.body, 0, column);
    const right = (body: Body, column: number) =>
      stepShift(body.figure.head ?? body.figure.under, body.figure.width, body.body, 1, column);
    expect(down(firered, 1)).toEqual([0, 0]);
    expect(right(firered, 1)).toEqual([0, 1]);
    expect(down(classic, 1)).toEqual([0, 1]);
    expect(right(rider, 1)).toEqual([1, 0]);
    expect(right(rider, 3)).toEqual([-1, 0]);
  });

  it('faces the other way as one drawing mirrored', async () => {
    // Against no figure at all, so only the pack is being compared.
    for (const { body } of await bodies()) {
      const { frameWidth, frameHeight } = BODY_PLACES[body];
      const width = frameWidth * 4;
      const nothing: FigurePixels = { width, under: new Uint8ClampedArray(width * frameHeight * 4 * 4), head: new Uint8ClampedArray(width * frameHeight * 4 * 4) };
      for (const pack of PACK_IDS) {
        const dressed = dressInPack(nothing, body, pack);
        for (let y = 0; y < frameHeight; y += 1) {
          for (let x = 0; x < frameWidth; x += 1) {
            const right = dressed.subarray(((frameHeight + y) * width + x) * 4, ((frameHeight + y) * width + x) * 4 + 4);
            const leftAt = ((frameHeight * 3 + y) * width + (frameWidth - 1 - x)) * 4;
            expect([...right]).toEqual([...dressed.subarray(leftAt, leftAt + 4)]);
          }
        }
      }
    }
  });

  it('stands in front of the figure from behind, and behind it from in front', async () => {
    const firered = (await bodies())[0];
    const dressed = dressInPack(firered.figure, firered.body, 'raid-pack');
    const pixel = (row: number, x: number, y: number) =>
      [...dressed.subarray(((row * 32 + y) * PIECE_WIDTH + x) * 4, ((row * 32 + y) * PIECE_WIDTH + x) * 4 + 3)];
    const bare = (row: number, x: number, y: number) =>
      [...firered.bare.subarray(((row * 32 + y) * PIECE_WIDTH + x) * 4, ((row * 32 + y) * PIECE_WIDTH + x) * 4 + 3)];
    // The middle of the back, facing away: canvas. The side of the waist, facing the camera: the figure.
    expect(pixel(2, 8, 23)).not.toEqual(bare(2, 8, 23));
    expect(pixel(0, 3, 24)).toEqual(bare(0, 3, 24));
    // The head is over a pack on the back: the back of it has not moved.
    expect(pixel(2, 8, 17)).toEqual(bare(2, 8, 17));
  });

  it('is outlined in the figure\'s own black', async () => {
    const [firered, classic] = await bodies();
    // The pack's lower corner, facing away, where it is wider than the shoulders.
    const corner = (dressed: Uint8ClampedArray, row: number) =>
      [...dressed.subarray(((2 * 32 + row) * PIECE_WIDTH + 2) * 4, ((2 * 32 + row) * PIECE_WIDTH + 2) * 4 + 3)];
    expect(corner(dressInPack(firered.figure, firered.body, 'raid-pack'), 23)).toEqual([0, 0, 0]);
    // The classic figure's own outline is a shade off black, and its back is three rows higher.
    expect(corner(dressInPack(classic.figure, classic.body, 'raid-pack'), 20)).toEqual([23, 23, 23]);
  });

  it('keeps the classic figure\'s shadow on the ground, under the pack', async () => {
    const classic = (await bodies())[1];
    const dressed = dressInPack(classic.figure, classic.body, 'ranger-pack');
    for (let at = 3; at < dressed.length; at += 4) {
      // A soft pixel in the dressed sheet is only ever a soft pixel of the bare one.
      if (dressed[at] > 0 && dressed[at] < 255) {
        expect(classic.bare[at]).toBe(dressed[at]);
      }
    }
  });

  it('paints out the bag the Bicycle\'s rider already has, so nobody carries two', async () => {
    const rider = (await bodies())[2];
    const yellow = [0xff, 0xde, 0x5a];
    const dressed = dressInPack(rider.figure, rider.body, 'satchel');
    for (let at = 0; at < dressed.length; at += 4) {
      if (dressed[at + 3]) {
        expect([dressed[at], dressed[at + 1], dressed[at + 2]]).not.toEqual(yellow);
      }
    }
  });

  it('leaves every head the boutique sells whole from the front, whatever it is worn with', async () => {
    const atlas = await sheet('wearables.png');
    for (const wearable of WEARABLES.filter(({ kind }) => kind === 'hat' || kind === 'hair')) {
      const { under, head } = composeLook(atlas, { ...STARTER_LOOK, head: wearable.id }, 'layers');
      for (const pack of PACK_IDS) {
        const dressed = dressInPack({ width: PIECE_WIDTH, under, head }, 'firered', pack);
        for (let at = 0; at < 32 * PIECE_WIDTH * 4; at += 4) {
          if (head[at + 3]) {
            expect([...dressed.subarray(at, at + 3)], `${pack} with ${wearable.id}`).toEqual([...head.subarray(at, at + 3)]);
          }
        }
      }
    }
  });
});

describe('the texture a figure is drawn from', () => {
  const fakeScene = (known: (key: string) => boolean) =>
    ({ textures: { exists: known } }) as unknown as Parameters<typeof lookTexture>[0];

  it('is the plain sheet with nothing on its back, and with something that is no pack', () => {
    const scene = fakeScene(() => true);
    expect(lookTexture(scene, null)).toBe(SHARED_CHARACTER_TEXTURE);
    expect(lookTexture(scene, null, null)).toBe(SHARED_CHARACTER_TEXTURE);
    expect(lookTexture(scene, null, 'potion')).toBe(SHARED_CHARACTER_TEXTURE);
    expect(lookTexture(scene, STARTER_LOOK, 'not-a-pack')).toBe(lookTexture(scene, STARTER_LOOK));
    expect(bikeTexture(scene)).toBe(BIKE_TEXTURE);
    expect(bikeTexture(scene, 'potion')).toBe(BIKE_TEXTURE);
  });

  it('is a sheet of its own for each look and pack', () => {
    const scene = fakeScene(() => true);
    const textures = PACK_IDS.flatMap((pack) => [lookTexture(scene, null, pack), lookTexture(scene, STARTER_LOOK, pack), bikeTexture(scene, pack)]);
    expect(new Set(textures).size).toBe(PACK_IDS.length * 3);
  });

  it('falls back on the classic figure where nothing can be composed', () => {
    const scene = fakeScene(() => false);
    expect(lookTexture(scene, null, 'hauler-frame')).toBe(SHARED_CHARACTER_TEXTURE);
    expect(bikeTexture(scene, 'hauler-frame')).toBe(BIKE_TEXTURE);
  });

  it('keeps the head mark on the head, whatever rises over it', () => {
    const scene = fakeScene(() => true);
    expect(lookHeadDrop(lookTexture(scene, null, 'hauler-frame'))).toBe(0);
  });
});

describe('a pack heard from another browser', () => {
  const move = { from: '123e4567-e89b-42d3-a456-426614174000', place: 'yard', path: [{ x: 3, y: 4 }], facing: 'down' } as const;

  it('crosses the wire', () => {
    expect(readHarbourMove(encodeHarbourMove({ ...move, pack: 'hauler-frame' }))?.pack).toBe('hauler-frame');
  });

  it('is nothing on their back when it is no pack, and the rest of the move still counts', () => {
    const heard = readHarbourMove({ ...encodeHarbourMove(move), b: 'potion' });
    expect(heard?.pack).toBeUndefined();
    expect(heard?.path).toEqual(move.path);
    expect(readHarbourMove({ ...encodeHarbourMove(move), b: { constructor: 1 } })?.pack).toBeUndefined();
  });

  it('is said only when there is one', () => {
    expect(encodeHarbourMove(move)).not.toHaveProperty('b');
  });
});

describe('the regulars', () => {
  it('mostly have packs, and not all of them, and not all the same', () => {
    const worn = HARBOUR_BOTS.map((bot) => bot.pack);
    expect(worn.filter(Boolean).length).toBeGreaterThan(HARBOUR_BOTS.length / 2);
    expect(worn.some((pack) => !pack)).toBe(true);
    expect(new Set(worn.filter(Boolean)).size).toBe(PACK_IDS.length);
  });
});
