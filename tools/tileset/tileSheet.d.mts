// Types for `tileSheet.mjs`, which tests read the game's own sheets with.
/** A decoded image: straight RGBA bytes, row major. */
export interface PngImage {
  readonly width: number;
  readonly height: number;
  readonly data: Buffer;
}
export declare const TILE_SIZE: number;
export declare function readPng(path: string | URL): PngImage;
export declare function writePng(path: string | URL, image: PngImage): void;
export declare function tileBytes(sheet: PngImage, index: number): Buffer;
export declare function tileHash(bytes: Buffer): string;
export declare function tileCount(sheet: PngImage): number;
