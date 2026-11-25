import { battleCaps, withArticle } from './battleItems';

/**
 * `names` is everybody the side is sending out, in slot order: one in a single
 * battle and two in a double, joined with "and" exactly as the tutorial's own
 * send-out line joins them.
 */
export function battleOpeningMessages(
  trainerName: string | undefined,
  playerNames: readonly string[],
  enemyNames: readonly string[],
): string[] {
  if (!trainerName) {
    // FireRed's sText_WildPkmnAppeared, which has no article.
    return [`Wild ${listNames(enemyNames)} appeared!`];
  }
  return [
    trainerChallengeLine(trainerName),
    // Only a double battle names what was sent out. A single battle's one foe
    // is named on the plate and in every line of the log that follows, and an
    // extra press before every trainer fight in the game is not worth saying it
    // twice.
    ...(enemyNames.length > 1 ? [`${trainerName} sent out ${listNames(enemyNames)}!`] : []),
    sendOutLine(playerNames),
  ];
}

/**
 * FireRed's sText_GoPkmn ("Go! X!") and sText_GoTwoPkmn ("Go! X and Y!"):
 * what the player says sending a Pokemon out, at the opening or on a switch.
 */
export const sendOutLine = (names: readonly string[]): string => `Go! ${listNames(names)}!`;

/**
 * FireRed's sText_PkmnComeBack ("X, come back!"): what the player says calling
 * a Pokemon back on a switch.
 */
export const withdrawLine = (name: string): string => `${name.toUpperCase()}, come back!`;

/** FireRed's sText_Trainer1WantsToBattle: "X would like to battle!". */
export const trainerChallengeLine = (trainerName: string): string =>
  `${trainerName} would like to battle!`;

const listNames = (names: readonly string[]): string =>
  names.map((name) => name.toUpperCase()).join(' and ');

/**
 * The authored opening fight explains the screen once. It is appended to the
 * ordinary encounter narration so the teaching fight still reads as a battle.
 */
export function teachingBattleMessages(playerName: string, enemyName: string): string[] {
  // Each line is kept short enough to fit the two text lines the battle
  // dialogue box can show without spilling past its frame.
  return [
    `Wild ${enemyName.toUpperCase()} appeared!`,
    `${playerName.toUpperCase()} is stronger. This fight is yours to win.`,
    "FIGHT shows each move's POWER and type matchup.",
    'Every hit reports the HP it cost you.',
  ];
}

/**
 * The first raid's catch (`world/firstCatch.ts`) explains itself on the way in:
 * what a ball is for and when to throw it. Short enough for two text lines a box.
 */
export function catchLessonOpening(enemyName: string): string[] {
  return [
    `Wild ${enemyName.toUpperCase()} appeared!`,
    'Wear it down with FIGHT, then throw a BALL to keep it.',
    "FIGHT shows each move's POWER and type matchup.",
  ];
}

/**
 * At or under this share of its HP the first raid's Pidgey is weak enough to
 * throw at. It was a half, and a starter's next Scratch knocks out a Lv 2
 * Pidgey from just under a half: the line came one blow too late (the critic's
 * second pass, 25 Nov 2026). One Scratch, 5 to 7, takes it under this from full.
 */
export const CATCH_LESSON_SHARE = 2 / 3;

/**
 * Said once in the first raid's catch, the first turn that leaves the wild one
 * at or under `CATCH_LESSON_SHARE` of its HP and still up: the moment a ball holds, and the one rule a
 * newcomer has to know, said while it is true (the overnight critic: teach the
 * real rule, never rig the fight).
 */
export function catchLessonMessage(facts: {
  readonly enemyHp: number;
  readonly enemyMaxHp: number;
  readonly fightGoesOn: boolean;
}): string | null {
  if (!facts.fightGoesOn || facts.enemyHp <= 0 || facts.enemyHp > facts.enemyMaxHp * CATCH_LESSON_SHARE) {
    return null;
  }
  return "It's weak! Throw a BALL now. Knock it out and it's gone.";
}

/**
 * The teaching fight's last lesson, said once, after the first turn that left
 * the player's Pokemon hurt and still standing with medicine in the pack. The
 * opening lines teach FIGHT; nothing taught ITEM, and the toll on the road
 * just past this fight is beaten by drinking a Potion in the yellow, so a
 * newcomer lost to it with Potions unused (playtest 47, finding 1). Said when
 * it is true rather than up front, because a lesson about being hurt read
 * before the first hit is a lesson about nothing.
 */
export function itemLessonMessage(facts: {
  readonly currentHp: number;
  readonly maxHp: number;
  readonly fightGoesOn: boolean;
  /** The first medicine the ITEM list offers, or undefined with none packed. */
  readonly medicine: string | undefined;
}): string | null {
  if (!facts.fightGoesOn || !facts.medicine || facts.currentHp <= 0 || facts.currentHp >= facts.maxHp) {
    return null;
  }
  return `Hurt? ITEM drinks ${withArticle(battleCaps(facts.medicine))}. It costs your turn.`;
}
