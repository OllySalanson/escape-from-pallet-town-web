import { type PieceKind, type Rotation } from './pieces';
export declare const BOARD_WIDTH = 10;
/** Rows the player sees. */
export declare const VISIBLE_ROWS = 20;
/** Rows above the visible field that pieces may still occupy. */
export declare const BUFFER_ROWS = 20;
export declare const BOARD_HEIGHT: number;
/** A filled cell remembers which piece filled it; `G` is a plain grey block. */
export type CellValue = PieceKind | 'G' | null;
/**
 * The well. Row 0 is the top of the hidden buffer; the visible field is rows
 * `BUFFER_ROWS` to `BOARD_HEIGHT - 1`, top to bottom.
 */
export declare class Board {
    private readonly rows;
    constructor();
    /**
     * A board from a picture of its bottom rows, one string per row, top first:
     * `.` is empty and any other letter is a filled cell (a piece letter keeps its
     * colour; anything else is grey).
     */
    static fromRows(picture: readonly string[]): Board;
    get(x: number, y: number): CellValue;
    /** Whether a cell is a wall, the floor, or filled. Above the buffer is open sky. */
    isBlocked(x: number, y: number): boolean;
    /** Whether a piece placed with its box's top-left at (x, y) overlaps anything. */
    collides(kind: PieceKind, rotation: Rotation, x: number, y: number): boolean;
    /** Writes a piece into the board. */
    place(kind: PieceKind, rotation: Rotation, x: number, y: number): void;
    /** Every completely filled row, top to bottom. */
    fullRows(): number[];
    /** Removes the given rows and lets everything above fall into their place. */
    removeRows(rows: readonly number[]): void;
    isEmpty(): boolean;
    /** Turns every filled cell in a row grey, for the game-over curtain. */
    greyRow(y: number): void;
    /** The board as strings, top to bottom, for tests and debugging. */
    toRows(fromRow?: number): string[];
}
