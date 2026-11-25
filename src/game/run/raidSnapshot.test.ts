import { describe, expect, it } from 'vitest';
import { Bag } from '../items/Bag';
import { Pokemon } from '../pokemon/Pokemon';
import { PokemonParty } from '../pokemon/PokemonParty';
import { getSpeciesById } from '../pokemon/species';
import { createHunterState } from '../world/hunter';
import { RunManager } from './RunManager';
import { createActiveRunSession } from './RunSession';
import { decodeRaidSnapshot, encodeRaidSnapshot, UnwritableRaidState, type RaidSnapshotGraph } from './raidSnapshot';
import { generateRunPlan } from './runGeneration';
import type { RaidCarriage } from './raidCarriage';

function species(id: string) {
  const found = getSpeciesById(id);
  if (!found) {
    throw new Error(id);
  }
  return found;
}

/** A raid deployed the way the hall deploys one, a few things into it. */
function raidUnderWay(): RaidCarriage {
  const lead = new Pokemon(species('charmander'), 9);
  const second = new Pokemon(species('pidgey'), 6);
  lead.currentHp = 11;
  lead.moves[0]?.setPp(3);
  lead.primaryStatus = 'poison';
  const manager = new RunManager();
  manager.startRun(
    { party: [lead, second], items: [{ itemId: 'potion', quantity: 2 }], packItemId: 'raid-pack' },
    { mapId: 'greystone-vale', durationMs: 300_000 },
    { pokemon: [lead] },
  );
  manager.tick(41_000);
  const plan = generateRunPlan(12345, undefined, 'greystone-vale');
  const session = createActiveRunSession(
    manager,
    { pokemon: [lead] },
    { pokemonIds: ['charmander-1'] },
    ['charmander-1', 'pidgey-2'],
    [{ itemId: 'potion', quantity: 2 }],
    [],
    plan,
    ['beacon'],
    'raid-pack',
    lead,
    undefined,
    'raid-1',
  );
  session.rng?.next();
  session.rng?.next();
  session.stepsTaken = 17;
  session.surveyed = new Set([1, 2, 3, 400]);
  session.cachesSearched = { 'cache-a': { searchedMs: 1200, taken: ['potion'] } as never };
  return {
    party: new PokemonParty([lead, second]),
    bag: new Bag({ potion: 1, 'poke-ball': 2 }),
    caughtPokemonStash: [],
    runSession: session,
    defeatedTrainerIds: ['bug-catcher-1'],
    unclaimedBossGear: [],
    collectedLootIds: ['loot-1'],
    seenPrizeIds: [],
    activatedPoiIds: [],
    hunterState: createHunterState(),
    returnLocation: { mapId: 'greystone-vale', position: { x: 10, y: 12 }, facing: 'left' },
  };
}

describe('a raid written down and read back', () => {
  it('comes back as the same raid', () => {
    const raid = raidUnderWay();
    const graph = encodeRaidSnapshot(raid);
    const text = JSON.stringify(graph);
    const back = decodeRaidSnapshot(JSON.parse(text) as RaidSnapshotGraph) as RaidCarriage;
    // Written down again, it is written exactly as it was.
    expect(JSON.stringify(encodeRaidSnapshot(back))).toBe(text);
    // The plan is the bulk of it, and is written once a raid (`writeRaidResume`).
    expect(text.length).toBeLessThan(600_000);
  });

  it('keeps one Pokemon one Pokemon wherever the raid holds it', () => {
    const back = decodeRaidSnapshot(encodeRaidSnapshot(raidUnderWay())) as RaidCarriage;
    const lead = back.party.pokemon[0];
    expect(back.runSession?.secureSlot.pokemon?.[0]).toBe(lead);
    expect(back.runSession?.partner).toBe(lead);
    expect(back.runSession?.manager.snapshot().loadout?.party[0]).toBe(lead);
    expect(lead?.currentHp).toBe(11);
    expect(lead?.moves[0]?.pp).toBe(3);
    expect(lead?.primaryStatus).toBe('poison');
  });

  it('carries the clock, the rolls and the classes it is made of', () => {
    const raid = raidUnderWay();
    const back = decodeRaidSnapshot(encodeRaidSnapshot(raid)) as RaidCarriage;
    expect(back.runSession?.manager.snapshot().elapsedMs).toBe(41_000);
    expect(back.runSession?.manager.snapshot().remainingMs).toBe(raid.runSession?.manager.snapshot().remainingMs);
    expect(back.bag).toBeInstanceOf(Bag);
    expect(back.bag.count('poke-ball')).toBe(2);
    expect(back.runSession?.surveyed).toEqual(new Set([1, 2, 3, 400]));
    // The raid's own streams carry on with the very next roll they would have made.
    const rolls = [raid.runSession?.rng?.next(), raid.runSession?.shinyRng?.next()];
    expect([back.runSession?.rng?.next(), back.runSession?.shinyRng?.next()]).toEqual(rolls);
  });

  it('refuses what it cannot write, saying where it is', () => {
    expect(() => encodeRaidSnapshot({ session: { later: () => 1 } })).toThrow(UnwritableRaidState);
    expect(() => encodeRaidSnapshot({ session: { when: new Date() } })).toThrow(/raid\.session\.when is a Date/);
    const loop: Record<string, unknown> = {};
    loop.self = loop;
    expect(() => encodeRaidSnapshot(loop)).toThrow(/refers back to itself/);
  });
});
