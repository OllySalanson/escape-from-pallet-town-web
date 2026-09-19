import { Move } from './Move';
import type { MoveBase } from './MoveBase';
import type { PokemonBase, PokemonStats } from './PokemonBase';
import { evolutionOnLevel, evolvesInto } from './evolution';
import type { PrimaryStatus } from './battle/status';

export type CombatStats = PokemonStats;

const MAX_LEVEL = 100;
/** Two comparable wins should normally earn an early level without a single win skipping several. */
export const DEFEAT_EXPERIENCE_MULTIPLIER = 0.5;

/**
 * Medium-slow-free total experience curve. A Pokemon at level N has N³ XP.
 */
export const experienceForLevel = (level: number): number => {
  const normalizedLevel = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return normalizedLevel ** 3;
};

/**
 * A defeated Pokemon awards half of its level-cubed total experience.
 */
export const experienceAwardForDefeat = (defeatedLevel: number): number =>
  Math.floor(experienceForLevel(defeatedLevel) * DEFEAT_EXPERIENCE_MULTIPLIER);

export const computePokemonStats = (baseStats: PokemonStats, level: number): CombatStats => ({
  // Ported from Pokemon.cs in the Unity project.
  hp: Math.floor((baseStats.hp * level) / 100) + level + 10,
  attack: Math.floor((baseStats.attack * level) / 100) + 5,
  defense: Math.floor((baseStats.defense * level) / 100) + 5,
  spAttack: Math.floor((baseStats.spAttack * level) / 100) + 5,
  spDefense: Math.floor((baseStats.spDefense * level) / 100) + 5,
  speed: Math.floor((baseStats.speed * level) / 100) + 5,
});

/** One species becoming another, in the words the screen needs to announce it. */
export interface SpeciesEvolution {
  readonly from: PokemonBase;
  readonly to: PokemonBase;
  /** The level it happened at, for a level evolution; absent for a stone. */
  readonly level?: number;
}

export interface ExperienceResult {
  readonly awarded: number;
  readonly levelsGained: readonly number[];
  readonly learnedMoves: readonly MoveBase[];
  /**
   * Evolutions crossed on the way, in order. A level-up evolution is the level
   * arriving rather than a separate event, so it is reported beside the level
   * it came with and never on its own.
   */
  readonly evolutions: readonly SpeciesEvolution[];
}

export class Pokemon {
  private static readonly MAX_MOVE_COUNT = 4;

  /**
   * Mutable, and only ever written by `evolveInto`. A Pokemon's species is the
   * one thing about it that can change without the Pokemon being a different
   * Pokemon, and everything derived from it - stats, the learnset the next
   * level reads, the sprite the battle draws, the name the save stores - is
   * read through here rather than copied, so an evolution changes all of them
   * at once and nothing can be left behind at the old species.
   */
  public base: PokemonBase;
  public level: number;
  public experience: number;
  public stats: CombatStats;
  public moves: Move[];

  public currentHp: number;
  public primaryStatus: PrimaryStatus | null = null;

  public constructor(base: PokemonBase, level: number) {
    if (level < 1 || level > MAX_LEVEL) {
      throw new Error(`Pokemon level must be between 1 and ${MAX_LEVEL}.`);
    }

    this.base = base;
    this.level = level;
    this.experience = experienceForLevel(level);
    this.stats = computePokemonStats(base.baseStats, level);
    this.currentHp = this.stats.hp;
    this.moves = this.initializeMoves();
  }

  public get maxHp(): number {
    return this.stats.hp;
  }

  public get isFainted(): boolean {
    return this.currentHp === 0;
  }

  public takeDamage(amount: number): number {
    const sanitizedDamage = Math.max(0, Math.floor(amount));
    const previousHp = this.currentHp;
    this.currentHp = Math.max(0, this.currentHp - sanitizedDamage);
    return previousHp - this.currentHp;
  }

  public heal(amount?: number): number {
    const previousHp = this.currentHp;

    if (amount === undefined) {
      this.currentHp = this.maxHp;
      return this.currentHp - previousHp;
    }

    const sanitizedHeal = Math.max(0, Math.floor(amount));
    this.currentHp = Math.min(this.maxHp, this.currentHp + sanitizedHeal);
    return this.currentHp - previousHp;
  }

  public gainExperience(amount: number): ExperienceResult {
    const awarded = Math.max(0, Math.floor(amount));
    this.experience += awarded;
    const levelsGained: number[] = [];
    const learnedMoves: MoveBase[] = [];
    const evolutions: SpeciesEvolution[] = [];

    while (this.level < MAX_LEVEL && this.experience >= experienceForLevel(this.level + 1)) {
      const previousMaxHp = this.maxHp;
      this.level += 1;
      this.stats = computePokemonStats(this.base.baseStats, this.level);
      // A level carries its own HP with it, but it is not a revive: a Pokemon
      // that is down stays down until something heals it, or a party member
      // levelling from the bench of a trainer battle would stand back up.
      this.currentHp = this.isFainted
        ? 0
        : Math.min(this.maxHp, this.currentHp + this.maxHp - previousMaxHp);
      levelsGained.push(this.level);
      // The species changes before the moves are learned, because the level
      // that evolves a Pokemon is also the first level read off the new
      // learnset - and a loop, because a settlement replayed over a long raid
      // can cross two thresholds of the same line in one call.
      const evolved = this.evolveOnLevel();
      if (evolved) {
        evolutions.push(evolved);
      }
      learnedMoves.push(...this.learnMovesAtLevel(this.level));
    }

    return { awarded, levelsGained, learnedMoves, evolutions };
  }

  /**
   * Turns this Pokemon into another species, keeping everything that is its own
   * rather than its species': its level, its experience, its moves, its status,
   * and the damage it has taken.
   *
   * The new maximum HP is granted exactly as a level grants it - the difference
   * is added to the current count rather than the count being refilled - so
   * evolving is never a heal, and a fainted Pokemon stays fainted, because
   * evolving is not a revive either.
   *
   * It refuses to run backwards or sideways: only a species this one actually
   * evolves into is accepted, so a replayed settlement or a stale payload can
   * never demote a Pokemon or hand it somebody else's line.
   */
  public evolveInto(species: PokemonBase): SpeciesEvolution | null {
    if (species === this.base || !evolvesInto(this.base.id, species.id)) {
      return null;
    }
    const from = this.base;
    const previousMaxHp = this.maxHp;
    this.base = species;
    this.stats = computePokemonStats(species.baseStats, this.level);
    this.currentHp = this.isFainted
      ? 0
      : Math.min(this.maxHp, this.currentHp + this.maxHp - previousMaxHp);
    return { from, to: species };
  }

  private evolveOnLevel(): SpeciesEvolution | null {
    const species = evolutionOnLevel(this.base.id, this.level);
    if (!species) {
      return null;
    }
    const evolution = this.evolveInto(species);
    return evolution ? { ...evolution, level: this.level } : null;
  }

  private initializeMoves(): Move[] {
    return this.base.learnset
      .filter((entry) => entry.level <= this.level)
      .sort((left, right) => left.level - right.level)
      .slice(-Pokemon.MAX_MOVE_COUNT)
      .map((entry) => new Move(entry.move));
  }

  private learnMovesAtLevel(level: number): MoveBase[] {
    const learned: MoveBase[] = [];
    for (const entry of this.base.learnset.filter((learnable) => learnable.level === level)) {
      if (this.moves.some((move) => move.base === entry.move)) {
        continue;
      }

      // When full, replace the oldest move. This matches initial move setup, which keeps the latest four.
      if (this.moves.length === Pokemon.MAX_MOVE_COUNT) {
        this.moves.shift();
      }
      this.moves.push(new Move(entry.move));
      learned.push(entry.move);
    }
    return learned;
  }
}
