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
  return `Level ${pokemon.level} \u00b7 ${healthLine(pokemon)}`;
}

/**
 * The same line without the level, for a place that already prints it beside
 * the name: the dossier heads its pane `BULBASAUR Lv 5`, and saying `Level 5`
 * again on the line under it was the one fact the pane told you twice.
 */
export function healthLine(pokemon: Omit<PokemonCondition, 'level'>): string {
  const flags = [
    ...(pokemon.isFainted ? ['fainted'] : []),
    ...(pokemon.primaryStatus === null ? [] : [pokemon.primaryStatus]),
  ];
  return `${pokemon.currentHp}/${pokemon.maxHp} HP${flags.length ? ` \u00b7 ${flags.join(' \u00b7 ')}` : ''}`;
}

/** One Pokemon at base, as the team's condition line reads it. */
export interface TeamMember {
  readonly name: string;
  readonly isFainted: boolean;
  /** Anything the Pokemon Center would change: HP, a status, a faint. */
  readonly needsTreatment: boolean;
}

/**
 * What the base says of the whole team, or null when everyone is fit.
 *
 * A faint is not a scratch: a fainted Pokemon cannot be deployed, and a team
 * that is nothing but fainted cannot raid at all until the Center revives one.
 * Counting a faint as "hurt" told a player who had just wiped that their
 * partner was a little worn, and the first they heard otherwise was a CHOOSE
 * DROP-IN that would not press.
 */
export function teamConditionLine(team: readonly TeamMember[]): string | null {
  const fainted = team.filter((member) => member.isFainted);
  const hurt = team.filter((member) => !member.isFainted && member.needsTreatment).length;
  if (team.length > 0 && fainted.length === team.length) {
    return fainted.length === 1
      ? `${fainted[0].name} has fainted, so nobody can raid`
      : `All ${fainted.length} Pokémon have fainted, so nobody can raid`;
  }
  if (fainted.length === 0) {
    return hurt === 0 ? null : `${hurt} Pokémon came home hurt`;
  }
  return `${fainted.length} Pokémon fainted${hurt > 0 ? ` and ${hurt} came home hurt` : ''}`;
}
