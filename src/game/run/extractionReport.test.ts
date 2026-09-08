import { describe, expect, it } from 'vitest';
import { BULBASAUR, CHARMANDER, PIDGEY } from '../pokemon/species';
import { Pokemon } from '../pokemon';
import { RunManager, type ItemStack, type SecureSlot } from './RunManager';
import { buildExtractionReport } from './extractionReport';
import { RAID_DURATION_MS } from './raidClock';

const RUN_CONFIG = { mapId: 'floodplain-relay', durationMs: RAID_DURATION_MS };

function startedRun(options: {
  readonly party: readonly Pokemon[];
  readonly items: readonly ItemStack[];
  readonly secure?: SecureSlot;
}): RunManager {
  const manager = new RunManager();
  manager.startRun({ party: options.party, items: options.items }, RUN_CONFIG, options.secure);
  return manager;
}

describe('extraction report after a survived raid', () => {
  it('reports exactly what was banked, and prices the risk the player actually took', () => {
    const starter = new Pokemon(BULBASAUR, 5);
    const manager = startedRun({
      party: [starter],
      items: [
        { itemId: 'potion', quantity: 3 },
        { itemId: 'poke-ball', quantity: 3 },
      ],
      secure: { pokemon: starter, items: [{ itemId: 'potion', quantity: 3 }] },
    });
    const caught = new Pokemon(PIDGEY, 4);
    manager.tick(137_000);
    manager.registerFoundItem('great-ball', 2);
    manager.registerCaughtPokemon(caught);
    manager.recoverFieldKit();
    manager.resolveEscape();

    const report = buildExtractionReport({
      outcome: 'ESCAPED',
      snapshot: manager.snapshot(),
      durationMs: RAID_DURATION_MS,
      exitLabel: 'FERRY DOCK',
      banked: {
        pokemon: [caught],
        items: [
          { itemId: 'great-ball', quantity: 2 },
          { itemId: 'super-potion', quantity: 1 },
        ],
      },
      contract: {
        description: 'Recover the lost field kit at the Floodplain Relay',
        complete: true,
        reward: 'The Pallet Town insertions are permanently unlocked.',
      },
      carriedOut: { potion: 1, 'poke-ball': 2, 'great-ball': 2 },
      saved: true,
    });

    expect(report.eyebrow).toBe('Extracted · FERRY DOCK');
    expect(report.haulTier).toBe('loaded');
    expect(report.ledgerHeading).toBe('Banked');
    expect(report.ledger.pokemon).toEqual([
      { name: 'Pidgey', dexId: 16, level: 4, currentHp: caught.maxHp, maxHp: caught.maxHp },
    ]);
    expect(report.ledger.items).toEqual([
      { itemId: 'great-ball', label: 'Great Ball', quantity: 2 },
      { itemId: 'super-potion', label: 'Super Potion', quantity: 1 },
    ]);
    // The secure slot and the exposed remainder are the pre-deployment choice,
    // read back to the player as the consequence it turned out to have.
    expect(report.secured.pokemon.map(({ name }) => name)).toEqual(['Bulbasaur']);
    expect(report.secured.items).toEqual([
      { itemId: 'potion', label: 'Potion', quantity: 3 },
    ]);
    expect(report.risked.pokemon).toEqual([]);
    expect(report.risked.items).toEqual([
      { itemId: 'poke-ball', label: 'Poke Ball', quantity: 3 },
    ]);
    expect(report.gambleVerdict).toBe(
      'A wipe would have cost you 3 Poke Balls. It did not happen this time.',
    );
    // Spent is measured against the bag, so found supplies used up still count.
    expect(report.spent).toEqual([
      { itemId: 'potion', label: 'Potion', quantity: 2 },
      { itemId: 'poke-ball', label: 'Poke Ball', quantity: 1 },
    ]);
    expect(report.clockLabel).toBe('2:17 of 5:00');
    expect(report.contract?.complete).toBe(true);
  });

  /**
   * A contract that only banks through one exit can be carried out of the wrong
   * one. The report has to say so: the raid succeeded, the contract did not, and
   * dropping the row entirely reads as though no contract had been taken.
   */
  it('reports a carried contract that this exit did not bank', () => {
    const starter = new Pokemon(CHARMANDER, 5);
    const manager = startedRun({ party: [starter], items: [] });
    manager.registerFoundItem('great-ball', 1);
    manager.resolveEscape();

    const report = buildExtractionReport({
      outcome: 'ESCAPED',
      snapshot: manager.snapshot(),
      durationMs: RAID_DURATION_MS,
      exitLabel: 'SOUTH GATE',
      banked: { pokemon: [], items: [{ itemId: 'great-ball', quantity: 1 }] },
      contract: {
        description: 'Carry the cordon ledger out of Pallet Town through the West Culvert',
        complete: false,
        reward: 'You had it, and SOUTH GATE is not WEST CULVERT.',
      },
      saved: true,
    });

    expect(report.contract).toMatchObject({ complete: false });
    // The haul is graded on what was actually banked, so an unpaid contract
    // cannot flatter the headline.
    expect(report.summary.startsWith('Contract banked')).toBe(false);
  });

  it('reads differently after a marginal raid than after a good one', () => {
    const starter = new Pokemon(CHARMANDER, 5);
    const manager = startedRun({ party: [starter], items: [{ itemId: 'potion', quantity: 3 }] });
    manager.registerFoundItem('antidote', 1);
    manager.registerHunterFlee();
    manager.registerHunterFlee();
    manager.resolveEscape();

    const report = buildExtractionReport({
      outcome: 'ESCAPED',
      snapshot: manager.snapshot(),
      durationMs: RAID_DURATION_MS,
      exitLabel: 'SOUTH GATE',
      banked: { pokemon: [], items: [{ itemId: 'antidote', quantity: 1 }] },
      carriedOut: { potion: 0, antidote: 1 },
      saved: true,
    });

    expect(report.haulTier).toBe('thin');
    expect(report.headline).toBe('You scraped out.');
    expect(report.summary).toContain('Banked 1 Antidote');
    // Nothing was protected, so every entry was exposed and the screen says so.
    expect(report.secured).toEqual({ pokemon: [], items: [] });
    expect(report.gambleVerdict).toBe(
      'A wipe would have cost you Charmander and 3 Potions. It did not happen this time.',
    );
    expect(report.pressure).toContain('2 escapes from the hunter, for 1:40 off the clock');
    expect(report.spent).toEqual([{ itemId: 'potion', label: 'Potion', quantity: 3 }]);
  });

  it('never celebrates an empty extraction', () => {
    const manager = startedRun({ party: [new Pokemon(BULBASAUR, 5)], items: [] });
    manager.resolveEscape();

    const report = buildExtractionReport({
      outcome: 'ESCAPED',
      snapshot: manager.snapshot(),
      durationMs: RAID_DURATION_MS,
      exitLabel: 'SOUTH GATE',
      banked: { pokemon: [], items: [] },
      carriedOut: {},
      saved: true,
    });

    expect(report.haulTier).toBe('empty');
    expect(report.headline).toBe('You got out clean, and empty.');
    expect(report.ledger).toEqual({ pokemon: [], items: [] });
    expect(report.ledgerEmptyText).toContain('exactly what you took in');
    expect(report.spent).toEqual([]);
  });
});

describe('extraction report after a lost raid', () => {
  it('names the permanent losses and what the secure slot held back', () => {
    const starter = new Pokemon(BULBASAUR, 7);
    const partner = new Pokemon(PIDGEY, 5);
    const manager = startedRun({
      party: [starter, partner],
      items: [
        { itemId: 'potion', quantity: 3 },
        { itemId: 'poke-ball', quantity: 3 },
      ],
      secure: { pokemon: partner, items: [{ itemId: 'potion', quantity: 3 }] },
    });
    manager.tick(RAID_DURATION_MS);
    const result = manager.resolveWipe();

    const report = buildExtractionReport({
      outcome: 'WIPED',
      cause: 'timer',
      snapshot: manager.snapshot(),
      durationMs: RAID_DURATION_MS,
      lost: { pokemon: result.lostPokemon, items: result.lostItems },
      carriedOut: { potion: 1, 'poke-ball': 3 },
      saved: true,
    });

    expect(report.eyebrow).toBe('Raid lost');
    expect(report.headline).toBe('The clock ran out with you still inside.');
    expect(report.ledgerHeading).toBe('Gone for good');
    expect(report.ledger.pokemon.map(({ name }) => name)).toEqual(['Bulbasaur']);
    expect(report.ledger.items).toEqual([
      { itemId: 'poke-ball', label: 'Poke Ball', quantity: 3 },
    ]);
    expect(report.secured.pokemon.map(({ name }) => name)).toEqual(['Pidgey']);
    expect(report.gambleVerdict).toBe(
      'The secure slot brought Pidgey and 3 Potions home. Bulbasaur and 3 Poke Balls did not make it.',
    );
    // A loss is never graded as a haul, whatever the secure slot rescued.
    expect(report.haulTier).toBe('empty');
    expect(report.clockLabel).toBe('5:00 of 5:00');
  });

  it('distinguishes being beaten from running out of time, and says when nothing was protected', () => {
    const starter = new Pokemon(CHARMANDER, 5);
    const manager = startedRun({ party: [starter], items: [{ itemId: 'poke-ball', quantity: 2 }] });
    const result = manager.resolveWipe();

    const report = buildExtractionReport({
      outcome: 'WIPED',
      cause: 'defeated',
      snapshot: manager.snapshot(),
      durationMs: RAID_DURATION_MS,
      lost: { pokemon: result.lostPokemon, items: result.lostItems },
      saved: true,
    });

    expect(report.headline).toBe('You went down with everything on you.');
    expect(report.summary).toContain('The raid ended where you fell.');
    expect(report.summary).toContain('Nothing was protected.');
    expect(report.gambleVerdict).toBe(
      'The secure slot was empty, so Charmander and 2 Poke Balls went with the raid.',
    );
    // No bag was available to the losing scene, which is not the same claim as
    // "nothing was spent", so the screen is given nothing to print.
    expect(report.spent).toBeUndefined();
  });

  it('reports a failed save rather than promising a stash that was not written', () => {
    const manager = startedRun({ party: [new Pokemon(BULBASAUR, 5)], items: [] });
    manager.resolveEscape();

    expect(
      buildExtractionReport({
        outcome: 'ESCAPED',
        snapshot: manager.snapshot(),
        durationMs: RAID_DURATION_MS,
        banked: { pokemon: [], items: [] },
        saved: false,
      }).saved,
    ).toBe(false);
  });
});
