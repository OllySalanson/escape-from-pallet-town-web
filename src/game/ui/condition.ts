/**
 * One line of condition for a Pokemon, wherever it is read.
 *
 * HP and status survive a raid now (#75), so what the in-raid party screen says
 * is what the stash will hold after it. The lobby and the party screen
 * therefore say it the same way rather than each inventing a phrasing.
 *
 * Kept clear of Phaser so it can be tested as the copy it is.
 */
export interface PokemonCondition {
  readonly level: number;
  readonly currentHp: number;
  readonly maxHp: number;
  readonly isFainted: boolean;
  readonly primaryStatus: string | null;
}

export function conditionLine(pokemon: PokemonCondition): string {
  const flags = [
    ...(pokemon.isFainted ? ['fainted'] : []),
    ...(pokemon.primaryStatus === null ? [] : [pokemon.primaryStatus]),
  ];
  return `Level ${pokemon.level} \u00b7 ${pokemon.currentHp}/${pokemon.maxHp} HP${flags.length ? ` \u00b7 ${flags.join(' \u00b7 ')}` : ''}`;
}
