import { isHeldItemId, type HeldItemId } from '../items/items';
import { Move } from './Move';
import type { MoveBase } from './MoveBase';
import type { PokemonBase, PokemonStats } from './PokemonBase';
import { evolutionFamily, evolutionOnLevel, evolvesInto } from './evolution';
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
  /** Moves learned into a free slot, with nothing given up. */
  readonly learnedMoves: readonly MoveBase[];
  /**
   * Evolutions crossed on the way, in order. A level-up evolution is the level
   * arriving rather than a separate event, so it is reported beside the level
   * it came with and never on its own.
   */
  readonly evolutions: readonly SpeciesEvolution[];
  /**
   * Moves the Pokemon is ready to learn but has no room for. They are queued on
   * `Pokemon.pendingMoves` and nothing is forgotten until the player chooses.
   */
  readonly movesToChoose: readonly MoveBase[];
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
  /**
   * Moves the Pokemon has reached the level for while its four slots were full.
   * A level-up never deletes a move: it queues the new one here, and
   * `resolvePendingMove` is the only thing that forgets or declines.
   */
  public pendingMoves: MoveBase[] = [];

  public currentHp: number;
  public primaryStatus: PrimaryStatus | null = null;
  /**
   * The one piece of gear this Pokemon is carrying, or null for an empty slot.
   *
   * One item, never two: `giveHeldItem` returns whatever was already there, so
   * the caller has to put it somewhere rather than the slot silently swallowing
   * it. It is persisted (`SavedPokemon.heldItemId`) and it travels home from a
   * raid on `RaidCondition`, so a Pokemon holds the same thing after a save, a
   * battle, a faint and a swap - and loses it only with the Pokemon itself, on a
   * wipe outside the secure slot.
   */
  public heldItemId: HeldItemId | null = null;

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

  /**
   * Puts gear in the slot and hands back whatever it displaced, so a give is
   * always a swap the caller has to account for. An unknown id is refused
   * rather than stored: a save holding an item this build no longer ships must
   * leave the slot empty, not holding a name nothing can price.
   */
  public giveHeldItem(heldItemId: string | null): HeldItemId | null {
    const displaced = this.heldItemId;
    this.heldItemId = isHeldItemId(heldItemId) ? heldItemId : null;
    return displaced;
  }

  /** Empties the slot and hands back what was in it. */
  public takeHeldItem(): HeldItemId | null {
    return this.giveHeldItem(null);
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
    const movesToChoose: MoveBase[] = [];

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
      const atThisLevel = this.learnMovesAtLevel(this.level);
      learnedMoves.push(...atThisLevel.learned);
      movesToChoose.push(...atThisLevel.queued);
    }

    return { awarded, levelsGained, learnedMoves, evolutions, movesToChoose };
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

  /**
   * Sets the moveset and the queue from move names, resolved through this
   * species' whole evolution line (a Bulbasaur-taught move outlives becoming an
   * Ivysaur, as in the save loader). Names it cannot resolve are ignored, an
   * empty moveset is refused, and a move already known is never queued, so
   * corrupt input can only ever be a no-op. Moves that stay keep their PP; new
   * ones start full.
   */
  public restoreMoveset(names: readonly string[], pendingNames: readonly string[]): void {
    const byName = new Map(
      [this.base, ...evolutionFamily(this.base.id)].flatMap((member) =>
        member.learnset.map((entry) => [entry.move.name, entry.move] as const),
      ),
    );
    const known: MoveBase[] = [];
    for (const name of names) {
      const move = byName.get(name);
      if (move && !known.includes(move) && known.length < Pokemon.MAX_MOVE_COUNT) {
        known.push(move);
      }
    }
    if (known.length === 0) {
      return;
    }
    this.moves = known.map(
      (base) => this.moves.find((existing) => existing.base === base) ?? new Move(base),
    );
    this.pendingMoves = [];
    for (const name of pendingNames) {
      const move = byName.get(name);
      if (move && !known.includes(move) && !this.pendingMoves.includes(move)) {
        this.pendingMoves.push(move);
      }
    }
  }

  public get hasFreeMoveSlot(): boolean {
    return this.moves.length < Pokemon.MAX_MOVE_COUNT;
  }

  /**
   * Settles a queued move: `forgetIndex` names the slot it takes, and `null`
   * declines it. Returns what was given up (nothing on a decline), or
   * `undefined` if the move was not queued or the slot does not exist, in which
   * case nothing changes. The new move starts with full PP; every other move
   * keeps its own.
   */
  public resolvePendingMove(
    move: MoveBase,
    forgetIndex: number | null,
  ): { readonly forgotten: MoveBase | null } | undefined {
    const queued = this.pendingMoves.indexOf(move);
    if (queued < 0) {
      return undefined;
    }
    if (forgetIndex === null) {
      this.pendingMoves.splice(queued, 1);
      return { forgotten: null };
    }
    if (!Number.isInteger(forgetIndex) || forgetIndex < 0 || forgetIndex >= this.moves.length) {
      return undefined;
    }
    this.pendingMoves.splice(queued, 1);
    const forgotten = this.moves[forgetIndex].base;
    this.moves[forgetIndex] = new Move(move);
    return { forgotten };
  }

  private initializeMoves(): Move[] {
    return this.base.learnset
      .filter((entry) => entry.level <= this.level)
      .sort((left, right) => left.level - right.level)
      .slice(-Pokemon.MAX_MOVE_COUNT)
      .map((entry) => new Move(entry.move));
  }

  private learnMovesAtLevel(level: number): {
    readonly learned: MoveBase[];
    readonly queued: MoveBase[];
  } {
    const learned: MoveBase[] = [];
    const queued: MoveBase[] = [];
    for (const entry of this.base.learnset.filter((learnable) => learnable.level === level)) {
      if (
        this.moves.some((move) => move.base === entry.move) ||
        this.pendingMoves.includes(entry.move)
      ) {
        continue;
      }

      // A full moveset never loses a move silently: the new one waits for the
      // player's choice (see `resolvePendingMove`).
      if (this.hasFreeMoveSlot) {
        this.moves.push(new Move(entry.move));
        learned.push(entry.move);
      } else {
        this.pendingMoves.push(entry.move);
        queued.push(entry.move);
      }
    }
    return { learned, queued };
  }
}
