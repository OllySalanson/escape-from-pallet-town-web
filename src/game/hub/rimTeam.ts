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
export function rimTeamLine(team: readonly RimTeamMember[], home: readonly RimTeamMember[]): string {
  const comes = `${listed(team.map(coming))} ${team.length === 1 ? 'comes' : 'come'}.`;
  if (home.length === 0) {
    return comes;
  }
  const named = home.slice(0, HOME_NAMED).map((member) => member.name);
  const rest = home.length - named.length;
  const who = rest > 0 ? `${named.join(', ')} and ${rest} more` : listed(named);
  return `${comes} ${who} ${home.length === 1 ? 'stays' : 'stay'} home: THE BENCH chooses.`;
}
