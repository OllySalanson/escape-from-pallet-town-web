export function battleOpeningMessages(
  trainerName: string | undefined,
  playerName: string,
  enemyName: string,
): string[] {
  if (!trainerName) {
    return [`A wild ${enemyName.toUpperCase()} appeared!`];
  }
  return [
    `${trainerName} wants to battle!`,
    `Go, ${playerName.toUpperCase()}!`,
  ];
}

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
