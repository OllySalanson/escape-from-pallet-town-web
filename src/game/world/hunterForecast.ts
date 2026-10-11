/**
 * What the ranger station's radio says about the hunter, once its landmark is
 * worked. Four answers, because the hunter has four states a raid can be in:
 * not here yet, here, beaten but coming back for the enrage, and beaten for
 * good. A beaten hunter is the one that was missing - it fell through to the
 * countdown, whose spawn time had long passed, and the radio told a player who
 * had just won the fight that the trail was arriving "in about 0s" (playtest
 * 45). A beaten hunter is gone for the raid except for one return, when the
 * clock runs out (`hunterAtEnrage` in `hunter.ts`), so the radio says which.
 *
 * Every rule it states is one the hunter keeps (playtest 33 found two it did
 * not): it walks when the player walks and also every few seconds they stand
 * still (`HUNTER_IDLE_STEP_MS`), so standing still does not hide anybody and
 * waiting for a timed exit does cost something; and it finds the player by
 * walking the map, not by seeing them, so there is no line of sight to break.
 *
 * And a countdown never reads nought: the arrival can wait past its delay for
 * the player to set off or for a fair tile (`hunterArrival.ts`), so a spawn
 * that is due but not yet placed is "any moment now", not "0s".
 */
export interface HunterForecastFacts {
  readonly spawned: boolean;
  readonly defeated: boolean;
  /** Whether a beaten hunter will come back when the clock runs out. */
  readonly returnsForEnrage: boolean;
  /** The hunter's name as the dialogue prints it. */
  readonly rivalName: string;
  /** How long until the spawn is due; zero or less once it is. */
  readonly msUntilSpawn: number;
}

export function hunterForecastLine(facts: HunterForecastFacts): string {
  if (facts.defeated) {
    return facts.returnsForEnrage
      ? `HUNTER FORECAST: ${facts.rivalName} is beaten, but will be back if the clock runs out.`
      : `HUNTER FORECAST: ${facts.rivalName} is beaten. Nobody else is on your trail this raid.`;
  }
  if (facts.spawned) {
    return 'HUNTER FORECAST: active in this area. It closes in as you walk, and standing still will not hide you.';
  }
  const seconds = Math.ceil(facts.msUntilSpawn / 1_000);
  return seconds > 0
    ? `HUNTER FORECAST: trail enters this area in about ${seconds}s. Waiting for a timed exit may cost you.`
    : 'HUNTER FORECAST: trail enters this area any moment now. Waiting for a timed exit may cost you.';
}
