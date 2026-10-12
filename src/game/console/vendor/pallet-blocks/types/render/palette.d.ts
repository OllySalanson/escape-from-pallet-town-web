import type { CellValue } from '../core/board';
/**
 * Colours, sampled from Escape from Pallet Town's pixel UI so the game sits on
 * its console as if it were one of its own screens: cream windows with a
 * one-pixel near-black frame, dark ink, and a banded slate-blue backdrop.
 */
export declare const INK = "#202020";
export declare const INK_SOFT = "#5d5c47";
export declare const FRAME = "#171717";
export declare const CREAM = "#ebeac5";
export declare const CREAM_LIT = "#f8f7dd";
export declare const CREAM_DIM = "#d3d2a9";
export declare const BACKDROP = "#183c52";
export declare const BACKDROP_BAND = "#1c455e";
export declare const BAR = "#0b1220";
export declare const BAR_TEXT = "#ebeac5";
export declare const BAR_MUTED = "#9cafc7";
export declare const TEAL = "#55d6be";
export declare const GOLD = "#f0c454";
export declare const GOLD_WASH = "#f2e5ab";
export declare const RED = "#b0201c";
export declare const SHADOW = "rgba(11, 18, 32, 0.55)";
/** Around the screen when the space it is given is not its shape: darker than the bars, so they read as part of it. */
export declare const LETTERBOX = "#05080f";
/** The well the pieces fall into. */
export declare const WELL = "#0b1220";
export declare const WELL_GRID = "#152238";
/** The title lettering, top row to bottom, and the rim and depth drawn around it. */
export declare const TITLE_FILL: readonly ["#fffbe6", "#ffe58a", "#ffd04a", "#f4a933"];
export declare const TITLE_RIM = "#2c5aa0";
export declare const TITLE_DEPTH = "#1c3768";
export interface BlockTones {
    readonly light: string;
    readonly base: string;
    readonly dark: string;
}
/**
 * Each piece is dressed in one of the creature types the console's own game is
 * about. The assignment deliberately differs from the familiar colours of other
 * falling-block games.
 */
export declare const BLOCK_TONES: Readonly<Record<Exclude<CellValue, null>, BlockTones>>;
