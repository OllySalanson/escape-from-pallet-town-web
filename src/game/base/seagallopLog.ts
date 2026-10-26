import type { MapRaidRecord } from '../save/SaveManager';

/**
 * The SEAGALLOP's log, as her sailor tells it: how many times she has run this
 * player out on a raid and how many of those she brought them home with their
 * haul, read off the raid record the save already keeps
 * (`raidProgress.raidRecord`, every map's count). Nothing new is stored.
 */
export function seagallopLines(record: Readonly<Record<string, MapRaidRecord>> | undefined): readonly string[] {
  const all = Object.values(record ?? {});
  const out = all.reduce((total, map) => total + map.deployed, 0);
  const home = all.reduce((total, map) => total + map.extracted, 0);
  if (out === 0) {
    return [
      'Ahoy! The SEAGALLOP\'s fuelled and waiting.',
      'Kit up at the RAID ARENA and she\'ll run you out. She always comes back for you, too. Mostly with you on her.',
    ];
  }
  const times = (n: number): string => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
  const lines = [`Ahoy! The SEAGALLOP's run you out ${times(out)}, and brought you home with your haul ${times(home)}.`];
  const lost = Math.max(0, out - home);
  lines.push(
    lost === 0
      ? 'Not lost one yet. Don\'t let it go to your head.'
      : `The other ${lost === 1 ? 'one' : lost}, she fetched you back with nothing. It happens. Kit up and go again.`,
  );
  return lines;
}
