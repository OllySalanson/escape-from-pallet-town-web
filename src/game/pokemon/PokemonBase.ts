import type { PokemonType } from './PokemonType';
import type { MoveBase } from './MoveBase';

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
  readonly frontSprite: string;
  readonly backSprite: string;
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
  public readonly frontSprite: string;
  public readonly backSprite: string;

  public constructor(init: PokemonBaseInit) {
    this.id = init.id;
    this.dexId = init.dexId ?? 0;
    this.name = init.name;
    this.abilityId = init.abilityId ?? null;
    this.primaryType = init.primaryType;
    this.secondaryType = init.secondaryType;
    this.baseStats = init.baseStats;
    this.learnset = init.learnset;
    this.frontSprite = init.frontSprite;
    this.backSprite = init.backSprite;
  }
}
