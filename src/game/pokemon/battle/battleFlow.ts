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
    return [`A wild ${listNames(enemyNames)} appeared!`];
  }
  return [
    `${trainerName} wants to battle!`,
    // Only a double battle names what was sent out. A single battle's one foe
    // is named on the plate and in every line of the log that follows, and an
    // extra press before every trainer fight in the game is not worth saying it
    // twice.
    ...(enemyNames.length > 1 ? [`${trainerName} sent out ${listNames(enemyNames)}!`] : []),
    `Go, ${listNames(playerNames)}!`,
  ];
}

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
    `A wild ${enemyName.toUpperCase()} appeared!`,
    `${playerName.toUpperCase()} is stronger. This fight is yours to win.`,
    "FIGHT shows each move's POWER and type matchup.",
    'Every hit reports the HP it cost you.',
  ];
}
