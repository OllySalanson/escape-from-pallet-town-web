/**
 * What THE BOLTHOLE shows by the player's own clock.
 *
 * The rest of the house is the save; this is the day the player is playing on.
 * The front-room window is the harbour in daylight, going orange at dusk and
 * dark with the stars out at night, and through the year the house is dressed
 * for it: a jack-o'-lantern by the door all October, a little tree in the
 * corner all December. None of it does anything and none of it is stored - a
 * room is rebuilt every time it is walked into, from whatever the clock says
 * then, which is the whole of the mechanism.
 *
 * Read off the browser's own local time, because the point is that it is the
 * player's evening, not the server's.
 */

export type WindowLight = 'day' | 'dusk' | 'night';

/** Daylight from seven until six, dusk either side of it, and night from nine until five. */
export function windowLight(now: Date): WindowLight {
  const hour = now.getHours();
  if (hour >= 7 && hour < 18) {
    return 'day';
  }
  if (hour >= 21 || hour < 5) {
    return 'night';
  }
  return 'dusk';
}

export type HouseSeason = 'october' | 'december' | null;

export function houseSeason(now: Date): HouseSeason {
  switch (now.getMonth()) {
    case 9:
      return 'october';
    case 11:
      return 'december';
    default:
      return null;
  }
}

/** What the window says when it is faced. */
export function windowLines(now: Date): readonly string[] {
  switch (windowLight(now)) {
    case 'day':
      return ['The harbour in the sun. Somebody is tying a boat up at the jetty.'];
    case 'dusk':
      return ['The sun is low over the harbour, and the sea has gone the colour of a Charmander.'];
    case 'night':
      return ['Stars over the harbour. Every light out there on the water is somebody else\'s raid.'];
  }
}
