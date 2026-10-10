/**
 * What the ranger station's radio says about the hunter, once its landmark is
 * worked. Three answers, because the hunter has three states a raid can be in:
 * not here yet, here, and beaten. A beaten hunter is the one that was missing -
 * it fell through to the countdown, whose spawn time had long passed, and the
 * radio told a player who had just won the fight that the trail was arriving
 * "in about 0s" (playtest 45). Beaten is final for the raid (nothing re-arms a
 * defeated hunter), so the radio says the trail is gone.
 *
 * And a countdown never reads nought: the arrival can wait past its delay for
 * the player to set off or for a fair tile (`hunterArrival.ts`), so a spawn
 * that is due but not yet placed is "any moment now", not "0s".
 */
export interface HunterForecastFacts {
  readonly spawned: boolean;
  readonly defeated: boolean;
  /** The hunter's name as the dialogue prints it. */
  readonly rivalName: string;
  /** How long until the spawn is due; zero or less once it is. */
  readonly msUntilSpawn: number;
}

export function hunterForecastLine(facts: HunterForecastFacts): string {
  if (facts.defeated) {
    return `HUNTER FORECAST: ${facts.rivalName} is beaten. Nobody else is on your trail this raid.`;
  }
  if (facts.spawned) {
    return 'HUNTER FORECAST: active in this area. Break its line of sight and keep moving.';
  }
  const seconds = Math.ceil(facts.msUntilSpawn / 1_000);
  return seconds > 0
    ? `HUNTER FORECAST: trail enters this area in about ${seconds}s. Waiting for a timed exit may cost you.`
    : 'HUNTER FORECAST: trail enters this area any moment now. Waiting for a timed exit may cost you.';
}
