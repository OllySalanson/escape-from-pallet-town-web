import type { WindowLight } from './homeClock';

/**
 * The S.S. Anne's captain's spyglass: a reason to walk to the end of the long
 * pier, something to do after dark, and a secret or two.
 *
 * Spoken to on the pier, the captain lends his glass, and what is out there
 * depends on the hour by the player's own clock (`homeClock.ts`). By day it is
 * the sea and the ships; at dusk the far coast; and after dark the lights of
 * Greystone Vale's far places - the ones a raid has to work hardest to reach -
 * one a look, each with the one thing a player needs to know about getting
 * there. Every hint is true of the vale as it is planned
 * (`tools/mapcraft/worlds/greystoneVale/plan.ts`, each far place's `reach`), so
 * the glass is a way to learn the vale, not a riddle. Nothing is stored: the
 * looks go round in order for as long as the page is open.
 */

export interface SpyglassSight {
  /** The far place it shows, as the vale's plan names it, for the test that holds the hint to the plan. */
  readonly place?: string;
  readonly line: string;
}

export const SPYGLASS_SIGHTS: Readonly<Record<WindowLight, readonly SpyglassSight[]>> = {
  day: [
    { line: 'Past the harbour mouth the sea is empty, all the way to the grey coast of GREYSTONE VALE.' },
    { line: 'The SEAGALLOP\'s wake, white across the bay. Somebody is coming home.' },
    { line: 'Every porthole on the S.S. ANNE, polished. Come back after dark - the far places show their lights then.' },
  ],
  dusk: [
    { line: 'The sun going down behind GREYSTONE VALE. Every raid goes out there.' },
    { line: 'The first lights coming on along the far coast. Wait for full dark, and they will tell you more.' },
  ],
  night: [
    {
      place: 'STORMCROWN',
      line: 'Lightning on the peaks: STORMCROWN. No road goes up it - only the deepest floor of the Greystone Caves, and a climb.',
    },
    {
      place: 'THE MOOR CHAPEL',
      line: 'A light in the fog west of the moor: THE MOOR CHAPEL. The fog only lifts after dark, along the sheep track over High Moor.',
    },
    {
      place: 'EMBER ISLE',
      line: 'A red glow past the smugglers\' cove: EMBER ISLE. Only the smugglers\' skiff goes out there.',
    },
    {
      place: 'FROSTREEF',
      line: 'Ice glinting on the outer reef: FROSTREEF. A boat goes out from the wreck\'s pier, when the tide is right.',
    },
    {
      place: 'THE LOST GARDEN',
      line: 'Moonlight on the falls by the power station. There is a cave behind that water, and a garden past it nobody has walked in years.',
    },
    {
      place: 'The Bunker',
      line: 'Lights under the power station, where there should be none. Somebody is down there, behind a door only a Card Key opens.',
    },
  ],
};

/** What the captain says, lending his glass, and the `look`th sight at this hour. */
export function spyglassLines(light: WindowLight, look: number): readonly string[] {
  const sights = SPYGLASS_SIGHTS[light];
  const sight = sights[((look % sights.length) + sights.length) % sights.length];
  const lend =
    look === 0
      ? 'The S.S. ANNE\'s captain. Here - have a look through my glass. Best at the end of the pier.'
      : 'Another look through the glass, then.';
  return [lend, sight.line];
}
