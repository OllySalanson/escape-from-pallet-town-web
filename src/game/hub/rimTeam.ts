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
 * 'Squirtle Lv 12 at 16/21 HP comes. Psyduck and Pidgey stay home: pick who
 * comes at THE BENCH.' `home` is everyone else at base fit to go.
 */
export function rimTeamLine(
  team: readonly RimTeamMember[],
  home: readonly RimTeamMember[],
  fainted: readonly RimTeamMember[] = [],
): string {
  const comes = `${listed(team.map(coming))} ${team.length === 1 ? 'comes' : 'come'}.`;
  const twice = namesSeenTwice([...team, ...home, ...fainted]);
  return [comes, homeLine(home, twice), faintedLine(fainted, twice)].filter((line) => line !== '').join(' ');
}

/**
 * Names more than one Pokémon on this screen answers to. Two of a kind left
 * 'Pidgey Lv 6 ... come. Pidgey stays home', which reads as the screen
 * contradicting itself (break-it test, 23 Nov 2026); one staying home is then
 * named with its level too, as the one coming already is.
 */
export function namesSeenTwice(members: readonly Pick<RimTeamMember, 'name'>[]): ReadonlySet<string> {
  const seen = new Set<string>();
  const twice = new Set<string>();
  for (const { name } of members) {
    (seen.has(name) ? twice : seen).add(name);
  }
  return twice;
}

/**
 * One Pokémon as the rest of the jump screen names it: with its level when
 * another on the screen shares its name. The Safe line read 'Pidgey' under
 * 'Pidgey Lv 6 comes. Pidgey Lv 4 stays home', and said neither which one the
 * locker keeps nor which a wipe would lose (scenario loop, 23 Nov 2026).
 */
export function rimNameOf(member: Pick<RimTeamMember, 'name' | 'level'>, twice: ReadonlySet<string>): string {
  return twice.has(member.name) ? `${member.name} Lv ${member.level}` : member.name;
}

function namedOf(members: readonly RimTeamMember[], twice: ReadonlySet<string> = new Set()): string {
  const named = members
    .slice(0, HOME_NAMED)
    .map((member) => rimNameOf(member, twice));
  const rest = members.length - named.length;
  return rest > 0 ? `${named.join(', ')} and ${rest} more` : listed(named);
}

// What to do about it, not only who decides: "THE BENCH chooses" left an AI
// friend with a new Meowth asking what the bench was and how to change it
// (AI playtest, 23 Nov 2026).
function homeLine(home: readonly RimTeamMember[], twice: ReadonlySet<string>): string {
  return home.length === 0 ? '' : `${namedOf(home, twice)} ${home.length === 1 ? 'stays' : 'stay'} home: pick who comes at THE BENCH.`;
}

/**
 * A fainted Pokémon cannot go, and the bench drops it without a word: a player
 * who put Bulbasaur on the bench read 'Charmander Lv 5 comes.' and nothing
 * about why Bulbasaur did not (scenario loop, 22 Nov 2026).
 */
function faintedLine(fainted: readonly RimTeamMember[], twice: ReadonlySet<string>): string {
  if (fainted.length === 0) {
    return '';
  }
  return fainted.length === 1
    ? `${namedOf(fainted, twice)} has fainted and stays home: Nurse Joy can revive it.`
    : `${namedOf(fainted, twice)} have fainted and stay home: Nurse Joy can revive them.`;
}
