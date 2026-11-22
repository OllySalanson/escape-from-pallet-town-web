/**
 * Who goes on a raid and who stays home, said on THE RAID ARENA's jump screen.
 *
 * Only the Pokémon on THE BENCH go, and the jump screen said only '1 Pokémon
 * to your 1'. A new catch stayed home with nothing said, a partner healed after
 * a wipe was left behind, and 'on the bench' reads the wrong way round to
 * anybody who plays sport. Tester 3's report (22 Nov 2026) put it third among
 * the release blockers, and asked that the screen name who comes, who stays
 * home, and anybody coming hurt. Phaser-free, so the words are tested here.
 */

export interface RimTeamMember {
  readonly name: string;
  readonly level: number;
  readonly currentHp: number;
  readonly maxHp: number;
}

/** How many of those staying home are named before the rest are counted. */
const HOME_NAMED = 3;

function listed(names: readonly string[]): string {
  return names.length <= 1 ? (names[0] ?? '') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function coming(member: RimTeamMember): string {
  const hurt = member.currentHp < member.maxHp ? ` at ${member.currentHp}/${member.maxHp} HP` : '';
  return `${member.name} Lv ${member.level}${hurt}`;
}

/**
 * 'Squirtle Lv 12 at 16/21 HP comes. Psyduck and Pidgey stay home: THE BENCH
 * chooses.' `home` is everyone else at base fit to go.
 */
export function rimTeamLine(
  team: readonly RimTeamMember[],
  home: readonly RimTeamMember[],
  fainted: readonly RimTeamMember[] = [],
): string {
  const comes = `${listed(team.map(coming))} ${team.length === 1 ? 'comes' : 'come'}.`;
  return [comes, homeLine(home), faintedLine(fainted)].filter((line) => line !== '').join(' ');
}

function namedOf(members: readonly RimTeamMember[]): string {
  const named = members.slice(0, HOME_NAMED).map((member) => member.name);
  const rest = members.length - named.length;
  return rest > 0 ? `${named.join(', ')} and ${rest} more` : listed(named);
}

function homeLine(home: readonly RimTeamMember[]): string {
  return home.length === 0 ? '' : `${namedOf(home)} ${home.length === 1 ? 'stays' : 'stay'} home: THE BENCH chooses.`;
}

/**
 * A fainted Pokémon cannot go, and the bench drops it without a word: a player
 * who put Bulbasaur on the bench read 'Charmander Lv 5 comes.' and nothing
 * about why Bulbasaur did not (scenario loop, 22 Nov 2026).
 */
function faintedLine(fainted: readonly RimTeamMember[]): string {
  if (fainted.length === 0) {
    return '';
  }
  return fainted.length === 1
    ? `${namedOf(fainted)} has fainted and stays home: Nurse Joy can revive it.`
    : `${namedOf(fainted)} have fainted and stay home: Nurse Joy can revive them.`;
}
