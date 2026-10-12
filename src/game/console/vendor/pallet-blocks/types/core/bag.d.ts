import { type PieceKind } from './pieces';
import type { Random } from './random';
/**
 * The 7-bag randomiser: every run of seven pieces is one of each, shuffled.
 * No piece can be missing for more than twelve pieces, and no piece can turn up
 * more than twice in a row.
 */
export declare class Bag {
    private readonly queue;
    private readonly random;
    constructor(random: Random);
    /** The next piece, taken off the front of the queue. */
    next(): PieceKind;
    /** The upcoming pieces, without taking them. */
    peek(count: number): readonly PieceKind[];
    private fill;
}
/** Fisher-Yates, returning a new array. */
export declare function shuffle<T>(items: readonly T[], random: Random): T[];
