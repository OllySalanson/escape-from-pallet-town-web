import { Move } from './Move';
import type { MoveBase } from './MoveBase';
import type { PokemonBase, PokemonStats } from './PokemonBase';
import type { PrimaryStatus } from './battle/status';

export type CombatStats = PokemonStats;

const MAX_LEVEL = 100;

/**
 * Medium-slow-free total experience curve. A Pokemon at level N has N³ XP.
 */
export const experienceForLevel = (level: number): number => {
  const normalizedLevel = Math.max(1, Math.min(MAX_LEVEL, Math.floor(level)));
  return normalizedLevel ** 3;
};

/**
 * A defeated Pokemon awards its level cubed in experience.
 */
export const experienceAwardForDefeat = (defeatedLevel: number): number =>
  experienceForLevel(defeatedLevel);

export const computePokemonStats = (baseStats: PokemonStats, level: number): CombatStats => ({
  // Ported from Pokemon.cs in the Unity project.
  hp: Math.floor((baseStats.hp * level) / 100) + level + 10,
  attack: Math.floor((baseStats.attack * level) / 100) + 5,
  defense: Math.floor((baseStats.defense * level) / 100) + 5,
  spAttack: Math.floor((baseStats.spAttack * level) / 100) + 5,
  spDefense: Math.floor((baseStats.spDefense * level) / 100) + 5,
  speed: Math.floor((baseStats.speed * level) / 100) + 5,
});

export interface ExperienceResult {
  readonly awarded: number;
  readonly levelsGained: readonly number[];
  readonly learnedMoves: readonly MoveBase[];
}

export class Pokemon {
  private static readonly MAX_MOVE_COUNT = 4;

  public readonly base: PokemonBase;
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

    while (this.level < MAX_LEVEL && this.experience >= experienceForLevel(this.level + 1)) {
      const previousMaxHp = this.maxHp;
      this.level += 1;
      this.stats = computePokemonStats(this.base.baseStats, this.level);
      this.currentHp = Math.min(this.maxHp, this.currentHp + this.maxHp - previousMaxHp);
      levelsGained.push(this.level);
      learnedMoves.push(...this.learnMovesAtLevel(this.level));
    }

    return { awarded, levelsGained, learnedMoves };
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
