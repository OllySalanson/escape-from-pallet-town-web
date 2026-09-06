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
    this.primaryType = init.primaryType;
    this.secondaryType = init.secondaryType;
    this.baseStats = init.baseStats;
    this.learnset = init.learnset;
    this.frontSprite = init.frontSprite;
    this.backSprite = init.backSprite;
  }
}
