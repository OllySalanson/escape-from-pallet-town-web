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
