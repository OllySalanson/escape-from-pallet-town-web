/**
 * The arithmetic behind turning an outline font into a one-bit pixel font,
 * kept apart from the canvas so it is testable without one.
 *
 * Orange Kid is a pixel *style* outline font rather than a bitmap: its stems
 * are about 78 units of a 1000-unit em and on no regular grid, so drawn with
 * `fillText` every letter arrives as a grey-edged smear. Each glyph is instead
 * rasterised alone, at whichever sub-pixel nudge leaves it least grey, and cut
 * to one-bit coverage. (Escape from Pallet Town does the same in its
 * `pixelText.ts`; this is a smaller cut of that idea.)
 */
/**
 * Coverage, of 255, a pixel needs to count as ink: a shade under half a stem,
 * so a stem inks exactly one column wherever it falls.
 */
export declare function inkThreshold(fontSizePx: number): number;
/** How far a pixel's coverage is from being either ink or paper. */
export declare function greyness(coverage: number): number;
/** Total greyness of an alpha channel, read from RGBA data. */
export declare function totalGreyness(rgba: Uint8ClampedArray): number;
export interface InkBox {
    readonly left: number;
    readonly top: number;
    readonly right: number;
    readonly bottom: number;
}
/** Cuts RGBA data to a one-bit mask and finds the box around the ink, or null if blank. */
export declare function cutMask(rgba: Uint8ClampedArray, width: number, height: number, threshold: number): {
    mask: Uint8Array;
    box: InkBox | null;
};
