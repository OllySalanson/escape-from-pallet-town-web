/** One line of a high-score table. */
export interface ScoreEntry {
    readonly name: string;
    readonly score: number;
    readonly lines?: number;
    readonly level?: number;
}
export declare const TABLE_SIZE = 10;
export declare const NAME_MAX_LENGTH = 10;
export declare const STORAGE_KEY = "pallet-blocks:high-scores:v1";
/** Highest score first; an older entry keeps its place over a new one with the same score. */
export declare function sortScores(entries: readonly ScoreEntry[]): ScoreEntry[];
/** Whether a score would make the table. Zero never does. */
export declare function qualifies(entries: readonly ScoreEntry[], score: number, size?: number): boolean;
/** The table with a new entry in it, and where it landed (or -1 if it did not make it). */
export declare function insertScore(entries: readonly ScoreEntry[], entry: ScoreEntry, size?: number): {
    table: ScoreEntry[];
    rank: number;
};
/**
 * A name as the game can draw it: capitals, digits and a little punctuation,
 * no more than ten characters, never blank.
 */
export declare function cleanName(raw: string, fallback?: string): string;
/** Whether a typed key may go into a name. */
export declare function isNameCharacter(key: string): boolean;
/** Reads a stored table, tolerating anything a browser might hand back. */
export declare function parseScores(raw: string | null): ScoreEntry[];
/** A table kept in the browser. Storage that is missing or refuses is treated as empty. */
export declare class LocalScores {
    private readonly key;
    constructor(key?: string);
    load(): ScoreEntry[];
    save(entries: readonly ScoreEntry[]): void;
}
