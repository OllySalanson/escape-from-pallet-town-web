import type { PokemonType } from './PokemonType';
import type { StatBoost } from './battle/statStages';

export const MoveCategory = {
  Physical: 'Physical',
  Special: 'Special',
  Status: 'Status',
} as const;

export type MoveCategory = (typeof MoveCategory)[keyof typeof MoveCategory];

export interface MoveBaseInit {
  readonly name: string;
  /**
   * A short, player-facing summary of what the move does. Unity's MoveBase
   * carries the same field; every asset there left it blank, so the text is
   * authored here for the battle move guidance panel.
   */
  readonly description?: string;
  readonly type: PokemonType;
  readonly power: number;
  readonly accuracy: number;
  readonly pp: number;
  readonly category: MoveCategory;
  readonly boosts?: readonly StatBoost[];
}

export class MoveBase {
  public readonly name: string;
  public readonly description: string;
  public readonly type: PokemonType;
  public readonly power: number;
  public readonly accuracy: number;
  public readonly pp: number;
  public readonly category: MoveCategory;
  public readonly boosts: readonly StatBoost[];

  public constructor(init: MoveBaseInit) {
    this.name = init.name;
    this.description = init.description ?? '';
    this.type = init.type;
    this.power = init.power;
    this.accuracy = init.accuracy;
    this.pp = init.pp;
    this.category = init.category;
    this.boosts = init.boosts ?? [];
  }
}
