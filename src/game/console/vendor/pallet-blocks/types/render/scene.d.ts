import { type Game } from '../core/game';
import { type PieceKind } from '../core/pieces';
import type { Banner } from '../app/callouts';
import type { ScoreEntry } from '../app/highScores';
import { type Screen } from '../app/screens';
import type { PixelFont } from './pixelFont';
/** The game's own resolution. It is drawn at this size and scaled up by whole pixels. */
export declare const SCREEN_WIDTH = 256;
export declare const SCREEN_HEIGHT = 208;
/** How long a callout stays up. */
export declare const CALLOUT_MS = 1800;
export interface Callout {
    readonly lines: readonly string[];
    readonly points: number;
    readonly atMs: number;
}
/** A banner, and when it went up. */
export interface ShownBanner extends Banner {
    readonly atMs: number;
}
export interface DropTrail {
    readonly columns: readonly {
        readonly x: number;
        readonly fromY: number;
        readonly toY: number;
    }[];
    readonly kind: PieceKind;
    readonly atMs: number;
}
export interface LockFlash {
    readonly cells: readonly (readonly [number, number])[];
    readonly atMs: number;
}
/** Everything the renderer needs to draw one frame. */
export interface SceneState {
    readonly screen: Screen;
    readonly game: Game | null;
    readonly nowMs: number;
    readonly muted: boolean;
    readonly playerName: string | null;
    readonly titleItems: readonly string[];
    readonly best: number;
    readonly table: readonly ScoreEntry[];
    readonly tableTitle: string;
    /** Row of `table` to pick out, or -1. */
    readonly highlight: number;
    readonly callout: Callout | null;
    readonly banner: ShownBanner | null;
    readonly trail: DropTrail | null;
    readonly flash: LockFlash | null;
}
export declare class SceneRenderer {
    private readonly ctx;
    private readonly font;
    constructor(ctx: CanvasRenderingContext2D, font: PixelFont);
    draw(state: SceneState): void;
    private backdrop;
    private titleBar;
    private helpBar;
    private playfield;
    private stats;
    private callout;
    private well;
    /** A big moment across the middle of the well: lettering only, so the stack shows through around it. */
    private banner;
    private curtainRows;
    /** A cleared row wipes out from the middle, flashing as it goes. */
    private clearingCell;
    private dropTrail;
    /** One 8x8 block: lit top-left edge, shaded bottom-right edge, a glint in the corner. */
    private block;
    /** Where the piece will land: its outline, in its own colour. */
    private ghost;
    /** A piece centred in a slot of a side window, as it looks when it spawns. */
    private previewPiece;
    private pauseMenu;
    private nameEntry;
    private results;
    private titleScreen;
    /** Pieces drifting down behind the title, in the backdrop's own blues. */
    private fallingDecor;
    private menu;
    /** The menu cursor: a solid right-pointing triangle, three pixels by five, drawn rather than typed. */
    private cursor;
    /** A window: a one-pixel frame with its corner pixels left clear, over a cream fill. */
    private window;
    private heading;
    private divider;
    /** Darkens everything drawn so far, for a window that sits over the game. */
    private shade;
    private text;
}
/** Scores with thin separators, as the handheld games print money. */
export declare function formatScore(score: number): string;
/** Minutes and seconds. */
export declare function formatTime(ms: number): string;
