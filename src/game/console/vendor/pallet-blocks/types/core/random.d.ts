/** A random source in [0, 1), so tests and replays can supply a seeded one. */
export type Random = () => number;
/**
 * mulberry32: a small, fast, well-distributed 32-bit generator. Seeded games are
 * repeatable, which is what makes the rules testable end to end.
 */
export declare function seededRandom(seed: number): Random;
