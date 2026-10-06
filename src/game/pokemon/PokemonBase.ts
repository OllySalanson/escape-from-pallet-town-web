import type { PokemonType } from './PokemonType';
import type { MoveBase } from './MoveBase';
import type { GrowthRate } from './generated/speciesCatalogue';

export interface PokemonStats {
  readonly hp: number;
  readonly attack: number;
  readonly defense: number;
  readonly spAttack: number;
  readonly spDefense: number;
  readonly speed: number;
}

export interface LearnableMove {
  readonly level: number;
  readonly move: MoveBase;
}

export interface PokemonBaseInit {
  readonly id: string;
  readonly dexId?: number;
  readonly name: string;
  /**
   * The species' ability, by its id in `abilities.ts`, or null where this
   * species' generation III ability is one the engine cannot express yet -
   * which `node tools/abilities/coverage.mjs` names with the reason.
   *
   * A generation III Pokemon is born into one of its species' one or two
   * ability slots and nothing in a save records which, so this is the first
   * slot and every member of a species plays the same. Ability slots are a
   * thing to give a Pokemon rather than a species, and that is the change that
   * would make the second slot real.
   */
  readonly abilityId?: string | null;
  readonly primaryType: PokemonType;
  readonly secondaryType?: PokemonType;
  readonly baseStats: PokemonStats;
  readonly learnset: readonly LearnableMove[];
  /**
   * Generation III's own capture rate, out of 255, and the modern experience
   * yield and growth curve. The capture rate is what a throw is decided by
   * (`catchOdds`, FireRed's formula); the yield and curve are imported and
   * not yet spent - every species climbs the one level-cubed curve in
   * `experienceForLevel`.
   */
  readonly catchRate?: number;
  readonly expYield?: number;
  readonly growthRate?: GrowthRate;
}

export class PokemonBase {
  public readonly id: string;
  public readonly dexId: number;
  public readonly name: string;
  public readonly abilityId: string | null;
  public readonly primaryType: PokemonType;
  public readonly secondaryType?: PokemonType;
  public readonly baseStats: PokemonStats;
  public readonly learnset: readonly LearnableMove[];
  public readonly catchRate: number;
  public readonly expYield: number;
  public readonly growthRate: GrowthRate;

  public constructor(init: PokemonBaseInit) {
    this.id = init.id;
    this.dexId = init.dexId ?? 0;
    this.name = init.name;
    this.abilityId = init.abilityId ?? null;
    this.primaryType = init.primaryType;
    this.secondaryType = init.secondaryType;
    this.baseStats = init.baseStats;
    this.learnset = init.learnset;
    // 255 is "caught by anything", which is what a species with no imported
    // rate should be: the one place this could bite is a test fixture.
    this.catchRate = init.catchRate ?? 255;
    this.expYield = init.expYield ?? 0;
    this.growthRate = init.growthRate ?? 'medium';
  }
}
