/**
 * What the rail says of a team in no state to go over it.
 *
 * Going over at 1/17 HP and burned with nothing packed was two presses and no
 * word from anybody: the first hunter's first Scratch took the raid, the pack
 * and the Poké Balls (playtest report, fault 2). Nothing stops the player, as
 * nothing in FireRed stops somebody walking out of a town hurt, but FireRed's
 * player can see the party's HP and a card about to spend the raid has to say
 * it. So the rim's card names who is hurt and, when the whole team together
 * is close to done, opens with the cursor on NOT YET.
 *
 * Phaser-free, so all of it can be asked of a number.
 */

/** Below this share of their HP somebody is named on the card. */
const NAMED_BELOW_SHARE = 1 / 2;
/** Below this share of the whole team's HP, the card opens on NOT YET. */
const STOPS_BELOW_SHARE = 1 / 3;
/** How many are spelt out before the rest are counted: the card has only so many lines. */
const MOST_NAMED = 2;

export interface RailMember {
  readonly name: string;
  readonly currentHp: number;
  readonly maxHp: number;
  readonly primaryStatus: string | null;
}

export interface RailWarning {
  /** The words on the card. */
  readonly line: string;
  /** Whether the cursor should open on NOT YET rather than on JUMP IN. */
  readonly stops: boolean;
}

const STATUS_WORDS: Readonly<Record<string, string>> = {
  poison: 'poisoned',
  burn: 'burned',
  paralysis: 'paralysed',
  sleep: 'asleep',
  freeze: 'frozen',
};

function isHurt(member: RailMember): boolean {
  return member.primaryStatus !== null || member.currentHp < member.maxHp * NAMED_BELOW_SHARE;
}

function described(member: RailMember): string {
  const low = member.currentHp < member.maxHp * NAMED_BELOW_SHARE;
  const status = member.primaryStatus === null ? null : (STATUS_WORDS[member.primaryStatus] ?? member.primaryStatus);
  if (low) {
    return `${member.name} is at ${member.currentHp}/${member.maxHp}${status ? ` and ${status}` : ''}`;
  }
  return `${member.name} is ${status}`;
}

/** What the card says of this team, or null when nobody on it is in a bad way. */
export function railWarning(team: readonly RailMember[], medicinePacked: boolean): RailWarning | null {
  const standing = team.filter((member) => member.currentHp > 0);
  const hurt = standing.filter(isHurt);
  if (hurt.length === 0) {
    return null;
  }
  const named = hurt.slice(0, MOST_NAMED).map(described);
  const others = hurt.length - named.length;
  const who = [named.join(', and '), ...(others > 0 ? [`${others} more ${others === 1 ? 'is' : 'are'} hurt`] : [])].join('; ');
  const health = standing.reduce((sum, member) => sum + member.currentHp, 0);
  const whole = standing.reduce((sum, member) => sum + member.maxHp, 0);
  return {
    line: `${who}${medicinePacked ? '' : ', with no medicine packed'}. Nurse Joy can help.`,
    stops: health < whole * STOPS_BELOW_SHARE,
  };
}
