export type TextAlign = 'left' | 'center' | 'right';
export interface TextStyle {
    /** One colour, or one per row band of the cap height, top to bottom. */
    readonly color: string | readonly string[];
    readonly align?: TextAlign;
    /** Whole-pixel magnification of the one-bit glyphs. */
    readonly scale?: number;
    /** A colour stamped one pixel down and right first, as the handheld games do. */
    readonly shadow?: string;
    /** A colour stamped one pixel all round first. */
    readonly outline?: string;
    /** A colour stamped `depth` pixels below the outline, for lettering that stands up. */
    readonly depth?: {
        readonly color: string;
        readonly px: number;
    };
}
/**
 * Loads the face from the bundle. Never rejects: if the font cannot load, the
 * game still runs and draws in the browser's monospace.
 */
export declare function loadGameFont(): Promise<boolean>;
/**
 * Orange Kid as a bitmap font: every glyph rasterised once, cut to one bit and
 * cached, then stamped ink-tight with a one-pixel gap. A letter is therefore
 * the same shape in every colour and everywhere it appears.
 */
export declare class PixelFont {
    /** Cap height in pixels at scale 1: what a line of capitals stands on. */
    readonly capHeight: number;
    /** Line height at scale 1, including room for descenders. */
    readonly lineHeight: number;
    private readonly glyphs;
    private readonly tinted;
    private readonly scratch;
    constructor();
    /** Width of a line of text at the given scale. */
    measure(text: string, scale?: number): number;
    /**
     * Draws text with the top of its capitals at `y`. Everything is in whole
     * pixels; fractional positions are floored.
     */
    draw(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, style: TextStyle): void;
    private stamp;
    private tint;
    private glyph;
    private rasterise;
}
