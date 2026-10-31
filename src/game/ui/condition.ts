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
  // A no-break space: a figure and its unit never part across a line (the
  // result screen once left "HP" alone under a level 99's "186/186").
  return `${pokemon.currentHp}/${pokemon.maxHp}\u00a0HP${flags.length ? ` \u00b7 ${flags.join(' \u00b7 ')}` : ''}`;
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
  const hurt = team.filter((member) => !member.isFainted && member.needsTreatment);
  if (team.length > 0 && fainted.length === team.length) {
    if (fainted.length === 1) {
      return `${fainted[0].name} has fainted, so nobody can raid`;
    }
    return `${fainted.length === 2 ? 'Both' : `All ${fainted.length}`} Pokémon have fainted, so nobody can raid`;
  }
  // One Pokemon is named rather than counted: "1 Pokémon came home hurt" was
  // the line a newcomer with a lone partner read after every rough raid.
  const who = (members: readonly TeamMember[], count: string): string =>
    members.length === 1 ? members[0].name : count;
  if (fainted.length === 0) {
    return hurt.length === 0 ? null : `${who(hurt, `${hurt.length} Pokémon`)} came home hurt`;
  }
  return `${who(fainted, `${fainted.length} Pokémon`)} fainted${
    hurt.length > 0 ? ` and ${who(hurt, `${hurt.length}`)} came home hurt` : ''
  }`;
}
