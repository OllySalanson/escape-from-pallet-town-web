import type { MapRaidRecord } from '../save/SaveManager';

/**
 * The SEAGALLOP's sailor keeps count. She is the islands ferry now (crates, fish
 * and visitors), since every raid jumps in from the RAID ARENA's rim, but he ran
 * raiders across the bay once and still counts how many times this player has
 * jumped in and how many of those they got out with their haul, read off the
 * raid record the save already keeps (`raidProgress.raidRecord`, every map's
 * count). Nothing new is stored.
 */
export function seagallopLines(record: Readonly<Record<string, MapRaidRecord>> | undefined): readonly string[] {
  const all = Object.values(record ?? {});
  const out = all.reduce((total, map) => total + map.deployed, 0);
  const home = all.reduce((total, map) => total + map.extracted, 0);
  if (out === 0) {
    return [
      'Ahoy! The SEAGALLOP\'s the islands ferry. Crates, fish and visitors.',
      'No raiders, not since the RAID ARENA. You lot jump in over there now.',
      'I still keep count, mind. Come back and tell me how it went.',
    ];
  }
  const times = (n: number): string => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
  const lines = [`Ahoy! I keep count. You've jumped in ${times(out)}, and got out with your haul ${times(home)}.`];
  const lost = Math.max(0, out - home);
  lines.push(
    lost === 0
      ? 'Not lost one yet. Don\'t let it go to your head.'
      : `The other ${lost === 1 ? 'one' : lost}, you came back with nothing. It happens. Kit up and go again.`,
  );
  return lines;
}
