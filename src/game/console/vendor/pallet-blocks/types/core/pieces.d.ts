/**
 * The seven pieces, their four rotation states, and the wall kicks tried when a
 * rotation does not fit where it is.
 *
 * Coordinates are `[x, y]` with x to the right and y DOWN, the way the board is
 * stored and drawn. Each piece lives in a square box (3x3, or 4x4 for the I) and
 * rotates about the box's centre, which is the "super rotation" convention most
 * modern falling-block games share. The kick offsets below are written in the
 * same y-down space; the published tables are y-up, so their y signs are flipped.
 */
export type PieceKind = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';
export declare const PIECE_KINDS: readonly PieceKind[];
/** 0 = spawn, 1 = turned clockwise once (R), 2 = upside down, 3 = turned counter-clockwise once (L). */
export type Rotation = 0 | 1 | 2 | 3;
export type Cell = readonly [x: number, y: number];
/** The side of each piece's box. */
export declare const BOX_SIZE: Readonly<Record<PieceKind, number>>;
/** `SHAPES[kind][rotation]` is the piece's cells inside its box. */
export declare const SHAPES: Readonly<Record<PieceKind, readonly (readonly Cell[])[]>>;
export declare function shapeOf(kind: PieceKind, rotation: Rotation): readonly Cell[];
export declare const rotateBy: (rotation: Rotation, turns: 1 | -1) => Rotation;
/** The offsets to try, in order, when turning `kind` from one state to the next. */
export declare function kicksFor(kind: PieceKind, from: Rotation, to: Rotation): readonly Cell[];
