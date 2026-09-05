import { Move } from './Move';
import type { PokemonBase, PokemonStats } from './PokemonBase';

export type CombatStats = PokemonStats;

export class Pokemon {
  private static readonly MAX_MOVE_COUNT = 4;

  public readonly base: PokemonBase;
  public readonly level: number;
  public readonly stats: CombatStats;
  public readonly moves: Move[];

  public currentHp: number;

  public constructor(base: PokemonBase, level: number) {
    if (level < 1) {
      throw new Error('Pokemon level must be at least 1.');
    }

    this.base = base;
    this.level = level;
    this.stats = this.computeStats(base.baseStats, level);
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

  private initializeMoves(): Move[] {
    return this.base.learnset
      .filter((entry) => entry.level <= this.level)
      .sort((left, right) => left.level - right.level)
      .slice(-Pokemon.MAX_MOVE_COUNT)
      .map((entry) => new Move(entry.move));
  }

  private computeStats(baseStats: PokemonStats, level: number): CombatStats {
    /**
     * Simplified Gen-style formulas:
     * HP has a unique additive term so it scales differently from battle stats.
     * Other stats share one formula and are intentionally lower at matching levels.
     */
    return {
      hp: Math.floor((2 * baseStats.hp * level) / 100) + level + 10,
      attack: Math.floor((2 * baseStats.attack * level) / 100) + 5,
      defense: Math.floor((2 * baseStats.defense * level) / 100) + 5,
      spAttack: Math.floor((2 * baseStats.spAttack * level) / 100) + 5,
      spDefense: Math.floor((2 * baseStats.spDefense * level) / 100) + 5,
      speed: Math.floor((2 * baseStats.speed * level) / 100) + 5,
    };
  }
}
