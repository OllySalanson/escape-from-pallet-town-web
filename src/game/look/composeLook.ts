/**
 * Draws a look: its pieces laid one over another, shade for shade dyed, onto
 * one 64x128 block in the grid `../playerFrames.ts` reads (rows down, right,
 * up, left; columns idle, step, idle, step). It is pure pixels in and pixels
 * out, so what a look looks like is testable without a canvas, and it is
 * whole-pixel by construction: nothing is scaled, nothing is blended.
 */
import {
  WEARABLE_ATLAS_COLUMNS,
  WEARABLE_PIECES,
  WEARABLE_RAMPS,
} from './generated/wearablePieces';
import { wornIds, type PlayerLook } from './look';
import { RAID_RAMPS, wearableById, type DyeRamp, type WearableDye } from './wearables';

export const PIECE_WIDTH = 64;
export const PIECE_HEIGHT = 128;

export interface Pixels {
  readonly width: number;
  readonly height: number;
  readonly data: Uint8Array | Uint8ClampedArray;
}

const rampOf = (ramp: DyeRamp): readonly number[] =>
  Object.hasOwn(RAID_RAMPS, ramp)
    ? RAID_RAMPS[ramp as keyof typeof RAID_RAMPS]
    : WEARABLE_RAMPS[ramp as keyof typeof WEARABLE_RAMPS];

/** The colour swap a dye makes, as 0xrrggbb to 0xrrggbb. */
export function dyeMap(dye: WearableDye | undefined): ReadonlyMap<number, number> {
  if (!dye) {
    return new Map();
  }
  const from = rampOf(dye.from);
  const to = rampOf(dye.to);
  return new Map(from.map((shade, i) => [shade, to[i]]));
}

/** A look's pixels with its head apart from the rest, for a pack to go between them (`wornPack.ts`). */
export interface LookLayers {
  readonly under: Uint8ClampedArray;
  readonly head: Uint8ClampedArray;
}

/** The look's pixels, RGBA, 64 wide and 128 tall. The classic look has none: it is its own sheet. */
export function composeLook(atlas: Pixels, look: PlayerLook): Uint8ClampedArray;
export function composeLook(atlas: Pixels, look: PlayerLook, split: 'layers'): LookLayers;
export function composeLook(atlas: Pixels, look: PlayerLook, split?: 'layers'): Uint8ClampedArray | LookLayers {
  const under = new Uint8ClampedArray(PIECE_WIDTH * PIECE_HEIGHT * 4);
  const head = split ? new Uint8ClampedArray(PIECE_WIDTH * PIECE_HEIGHT * 4) : under;
  for (const id of wornIds(look)) {
    const wearable = wearableById(id);
    if (!wearable) continue;
    const out = look && id === look.head ? head : under;
    const { cell } = WEARABLE_PIECES[wearable.piece];
    const left = (cell % WEARABLE_ATLAS_COLUMNS) * PIECE_WIDTH;
    const top = Math.floor(cell / WEARABLE_ATLAS_COLUMNS) * PIECE_HEIGHT;
    const dye = dyeMap(wearable.dye);
    for (let y = 0; y < PIECE_HEIGHT; y += 1) {
      for (let x = 0; x < PIECE_WIDTH; x += 1) {
        const from = ((top + y) * atlas.width + left + x) * 4;
        if (atlas.data[from + 3] === 0) continue;
        const rgb = (atlas.data[from] << 16) | (atlas.data[from + 1] << 8) | atlas.data[from + 2];
        const colour = dye.get(rgb) ?? rgb;
        const to = (y * PIECE_WIDTH + x) * 4;
        out[to] = colour >> 16;
        out[to + 1] = (colour >> 8) & 255;
        out[to + 2] = colour & 255;
        out[to + 3] = 255;
      }
    }
  }
  return split ? { under, head } : under;
}
