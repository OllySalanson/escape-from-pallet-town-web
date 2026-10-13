import { type Game } from '../core/game';
import { type PieceKind } from '../core/pieces';
import type { Banner } from '../app/callouts';
import type { ScoreEntry } from '../app/highScores';
import { type Screen } from '../app/screens';
import type { PixelFont } from './pixelFont';
/** The game's own resolution. It is drawn at this size and scaled up by whole pixels. */
export declare const SCREEN_WIDTH = 256;
export declare const SCREEN_HEIGHT = 208;
/** How far below the top of the field a board row is drawn, or null for a buffer row out of sight. */
export declare function rowOffset(boardY: number): number | null;
/**
 * The top board row drawn on a screen. The results window covers the top of
 * the well but not the strip above it, so there the buffer row is left out
 * rather than poke out above the window as a stub.
 */
export declare function topRowShown(screen: Screen): number;
/**
 * Whether the pieces are on show: the stack, the falling piece, HOLD and the
 * NEXT queue. They are all hidden while paused, so a pause is not a free look
 * at the board or a free moment to plan the queue.
 */
export declare function piecesShown(screen: Screen): boolean;
/** How long a callout stays up. */
export declare const CALLOUT_MS = 1800;
/**
 * How much of the well's dark is laid over a piece `progress` (0 to 1) through
 * its lock delay: none while it has time, more as the lock comes, so a player
 * sliding a piece along the stack can see how long is left.
 */
export declare function lockShade(progress: number): number;
/** How far the held piece is pushed sideways `elapsedMs` after a refused hold. */
export declare function holdShakeOffset(elapsedMs: number): number;
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
    /** The clock callouts, banners, flashes and trails are timed by; it stands still while paused. */
    readonly effectsMs: number;
    readonly muted: boolean;
    /** Whether the game has keyboard focus. Without it, keys go to the host page. */
    readonly focused: boolean;
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
    /** When hold was last pressed for a piece that had already used it, or null. */
    readonly holdRefusedAtMs: number | null;
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
export declare const FOCUS_HINT = "CLICK HERE TO PLAY";
/** The name entry box: room for the widest name (ten Ws, 79px) and its caret, with space either side. */
export declare const NAME_FIELD_WIDTH = 98;
/**
 * Where a name being typed and its caret go. The two are centred together, so
 * a long name keeps as much room after the caret as before its first letter.
 */
export declare function nameLine(centre: number, textWidth: number): {
    textX: number;
    caretX: number;
};
/** A name cut short, with a dot to say so, when it would run into its score. */
export declare function fitName(name: string, maxWidth: number, measure: (text: string) => number): string;
/** How many rows of the table the title screen shows. */
export declare const TITLE_ROWS = 6;
/**
 * Where a title table row's rank, name and score go: the rank right-aligned
 * in a narrow column, the name after it, and the score right-aligned, with the
 * name given only the room left before the score.
 */
export declare function titleRowColumns(box: {
    readonly x: number;
    readonly width: number;
}, scoreWidth: number): {
    rankRight: number;
    nameX: number;
    nameWidth: number;
    scoreRight: number;
};
/** How many rows of the table the GAME OVER window has room for. */
export declare const RESULT_ROWS = 6;
export interface TableRow {
    readonly entry: ScoreEntry;
    /** The place in the table, from 1. */
    readonly rank: number;
    readonly mine: boolean;
}
/**
 * The rows of a table to show: the top ones, but when the player's own entry
 * (`highlight`, -1 for none) ranks below them, it takes the last row, so a
 * player who has just made the table always sees where.
 */
export declare function tableRows(table: readonly ScoreEntry[], highlight: number, count: number): TableRow[];
/**
 * The BEST box. While a game is on, its score counts as soon as it passes the
 * best. Once the results are up, the score has been saved or skipped, so the
 * box shows the top of the table the player can see, not a score Esc threw away.
 */
export declare function bestShown(screen: Screen, best: number, score: number): number;
/** Minutes and seconds. */
export declare function formatTime(ms: number): string;
/** What the help bar says. Without focus no key reaches the game, so it says how to get it back. */
export declare function helpFor(screen: Screen, nowMs: number, focused: boolean): string;
