import { describe, expect, it } from 'vitest';
import { BULBASAUR, CHARMANDER, PIDGEY } from '../pokemon/species';
import { Pokemon, experienceForLevel } from '../pokemon';
import { RunManager, type ItemStack, type SecureSlot } from './RunManager';
import { buildExtractionReport } from './extractionReport';
import { RAID_DURATION_MS } from './raidClock';

/**
 * A container that has been grown. A Pokemon takes four squares of it by
 * evolution stage, so the 2x2 one a save starts with holds a Pokemon *or* some
 * supplies - the squares are `RunManager`'s test, and these reports are about
 * what the screen says once both are in it.
 */
const RUN_CONFIG = {
  mapId: 'floodplain-relay',
  durationMs: RAID_DURATION_MS,
  secureGrid: { width: 6, height: 2 },
};

function startedRun(options: {
  readonly party: readonly Pokemon[];
  readonly items: readonly ItemStack[];
  readonly secure?: SecureSlot;
  readonly packItemId?: string;
}): RunManager {
  const manager = new RunManager();
  manager.startRun(
    {
      party: options.party,
      items: options.items,
      ...(options.packItemId === undefined ? {} : { packItemId: options.packItemId }),
    },
    RUN_CONFIG,
    options.secure,
  );
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
      secure: { pokemon: [starter], items: [{ itemId: 'potion', quantity: 3 }] },
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
    // read back as the consequence it turned out to have: two of the three
    // secured Potions were drunk and one ball was thrown, so neither is listed
    // as having come home.
    expect(report.secured.pokemon.map(({ name }) => name)).toEqual(['Bulbasaur']);
    expect(report.secured.items).toEqual([
      { itemId: 'potion', label: 'Potion', quantity: 1 },
    ]);
    expect(report.risked.pokemon).toEqual([]);
    expect(report.risked.items).toEqual([
      { itemId: 'poke-ball', label: 'Poké Ball', quantity: 2 },
    ]);
    expect(report.gambleVerdict).toBe(
      'A wipe would have cost you 2 Poké Balls. It did not happen this time.',
    );
    // Spent is measured against the bag, so found supplies used up still count.
    expect(report.spent).toEqual([
      { itemId: 'potion', label: 'Potion', quantity: 2 },
      { itemId: 'poke-ball', label: 'Poké Ball', quantity: 1 },
    ]);
    expect(report.clockLabel).toBe('2:17 of 5:00');
    expect(report.contract?.complete).toBe(true);
  });

  /**
   * Playtest 3, B3: three secured Potions drunk and one of two balls thrown.
   * The screen listed "Potion x3 Protected" and "Poke Ball x2 Made it back"
   * above "Supplies spent: 3x Potion, 1x Poke Ball", under a footer saying
   * everything above was in the stash.
   */
  it('never lists a supply the raid spent as one that made it back', () => {
    const starter = new Pokemon(BULBASAUR, 5);
    const manager = startedRun({
      party: [starter],
      items: [
        { itemId: 'potion', quantity: 3 },
        { itemId: 'poke-ball', quantity: 2 },
      ],
      secure: { items: [{ itemId: 'potion', quantity: 3 }] },
    });
    manager.resolveEscape();

    const report = buildExtractionReport({
      outcome: 'ESCAPED',
      snapshot: manager.snapshot(),
      durationMs: RAID_DURATION_MS,
      carriedOut: { 'poke-ball': 1 },
      saved: true,
    });

    expect(report.ledgerEmptyText).toBe('Nothing new. What the raid used up is counted below.');
    expect(report.secured.items).toEqual([]);
    expect(report.securedEmptyText).toBe('Everything you protected was used up in the field.');
    expect(report.risked.items).toEqual([{ itemId: 'poke-ball', label: 'Poké Ball', quantity: 1 }]);
    expect(report.spent).toEqual([
      { itemId: 'potion', label: 'Potion', quantity: 3 },
      { itemId: 'poke-ball', label: 'Poké Ball', quantity: 1 },
    ]);
    expect(report.gambleVerdict).toBe(
      'A wipe would have cost you Bulbasaur and 1 Poké Ball. It did not happen this time.',
    );
  });

  /**
   * The ledger reconciles to the item: whatever the raid held - deployed or
   * found - is listed exactly once, as protected, carried at risk, banked or
   * spent. Found loot beyond the loadout is the banked ledger's, never also
   * "made it back".
   */
  it('lists every supply the raid held exactly once', () => {
    const starter = new Pokemon(BULBASAUR, 5);
    const manager = startedRun({
      party: [starter],
      items: [{ itemId: 'potion', quantity: 3 }],
      secure: { pokemon: [starter], items: [{ itemId: 'potion', quantity: 1 }] },
    });
    manager.registerFoundItem('potion', 2);
    manager.resolveEscape();

    // Five held, one drunk: the raid comes home one Potion up.
    const report = buildExtractionReport({
      outcome: 'ESCAPED',
      snapshot: manager.snapshot(),
      durationMs: RAID_DURATION_MS,
      banked: { pokemon: [], items: [{ itemId: 'potion', quantity: 1 }] },
      carriedOut: { potion: 4 },
      saved: true,
    });

    const quantity = (items: readonly { quantity: number }[]): number =>
      items.reduce((total, item) => total + item.quantity, 0);
    expect(quantity(report.secured.items)).toBe(1);
    expect(quantity(report.risked.items)).toBe(2);
    expect(quantity(report.ledger.items)).toBe(1);
    expect(quantity(report.spent ?? [])).toBe(1);
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
    // Nothing was protected, so every entry was exposed and the screen says so -
    // but the three Potions were drunk, and a wipe cannot take what is gone.
    expect(report.secured).toEqual({ pokemon: [], items: [] });
    expect(report.securedEmptyText).toBe('You protected nothing.');
    expect(report.gambleVerdict).toBe(
      'A wipe would have cost you Charmander. It did not happen this time.',
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
      secure: { pokemon: [partner], items: [{ itemId: 'potion', quantity: 3 }] },
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
      { itemId: 'poke-ball', label: 'Poké Ball', quantity: 3 },
    ]);
    expect(report.secured.pokemon.map(({ name }) => name)).toEqual(['Pidgey']);
    // Three Potions were secured and only one was still in the pack, so only
    // one came home. Claiming all three while the panel beside this one said
    // two were spent was the screen contradicting itself.
    expect(report.secured.items).toEqual([{ itemId: 'potion', label: 'Potion', quantity: 1 }]);
    expect(report.spent).toEqual([{ itemId: 'potion', label: 'Potion', quantity: 2 }]);
    expect(report.gambleVerdict).toBe(
      'The secure slot brought Pidgey and 1 Potion home. Bulbasaur and 3 Poké Balls did not make it.',
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
      'The secure slot was empty, so Charmander and 2 Poké Balls went with the raid.',
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

describe('what the party earned', () => {
  /** A raid that fought: one starter, one win, nothing picked up. */
  function raidThatWon(gained: number, secure?: SecureSlot): {
    manager: RunManager;
    starter: Pokemon;
  } {
    const starter = new Pokemon(BULBASAUR, 5);
    const manager = startedRun({ party: [starter], items: [], secure });
    manager.tick(90_000);
    starter.gainExperience(gained);
    return { manager, starter };
  }

  it('names the level a Pokemon came home at instead of calling the raid empty', () => {
    const { manager } = raidThatWon(experienceForLevel(7) - experienceForLevel(5));
    manager.resolveEscape();

    const report = buildExtractionReport({
      outcome: 'ESCAPED',
      snapshot: manager.snapshot(),
      durationMs: RAID_DURATION_MS,
      carriedOut: {},
      saved: true,
    });

    expect(report.progress).toEqual([
      expect.objectContaining({ name: 'Bulbasaur', fromLevel: 5, toLevel: 7 }),
    ]);
    expect(report.progressSummary).toBe('Bulbasaur at level 7 came home.');
    // The screen used to grade this "You got out clean, and empty."
    expect(report.haulTier).not.toBe('empty');
    expect(report.summary).toContain('Bulbasaur at level 7 came home.');
    // Said once, at the top of the screen: the panel below lists the rows.
  });

  it('says how close the next level is when the raid did not deliver one', () => {
    const { manager, starter } = raidThatWon(20);
    manager.resolveEscape();

    const report = buildExtractionReport({
      outcome: 'ESCAPED',
      snapshot: manager.snapshot(),
      durationMs: RAID_DURATION_MS,
      carriedOut: {},
      saved: true,
    });

    expect(report.progress[0]).toMatchObject({ fromLevel: 5, toLevel: 5, experienceGained: 20 });
    expect(report.progressSummary).toBe(
      `Nobody levelled. Bulbasaur came out ${experienceForLevel(6) - starter.experience} experience short of level 6.`,
    );
    expect(report.haulTier).toBe('thin');
    expect(report.summary).toContain('experience short of level 6.');
  });

  it('says nothing at all about a raid that taught nobody anything', () => {
    const manager = startedRun({ party: [new Pokemon(CHARMANDER, 5)], items: [] });
    manager.tick(40_000);
    manager.resolveEscape();

    const report = buildExtractionReport({
      outcome: 'ESCAPED',
      snapshot: manager.snapshot(),
      durationMs: RAID_DURATION_MS,
      carriedOut: {},
      saved: true,
    });

    expect(report.progress).toEqual([]);
    expect(report.progressSummary).toBeNull();
    expect(report.ledgerEmptyText).toBe('Nothing new. You leave with exactly what you took in.');
  });

  it('never reports a level on a Pokemon the same screen says is gone for good', () => {
    const secured = new Pokemon(CHARMANDER, 5);
    const lost = new Pokemon(BULBASAUR, 5);
    const manager = new RunManager();
    manager.startRun({ party: [secured, lost], items: [] }, RUN_CONFIG, { pokemon: [secured] });
    manager.tick(120_000);
    secured.gainExperience(experienceForLevel(7) - experienceForLevel(5));
    lost.gainExperience(experienceForLevel(8) - experienceForLevel(5));
    manager.resolveWipe();

    const report = buildExtractionReport({
      outcome: 'WIPED',
      cause: 'defeated',
      snapshot: manager.snapshot(),
      durationMs: RAID_DURATION_MS,
      lost: { pokemon: [lost], items: [] },
      saved: true,
    });

    expect(report.progress.map((entry) => entry.name)).toEqual(['Charmander']);
  });

  it('says a protected material never turned up, rather than that it was used up', () => {
    const manager = startedRun({
      party: [new Pokemon(BULBASAUR, 5)],
      items: [{ itemId: 'potion', quantity: 1 }],
      secure: { items: [{ itemId: 'radio-valve', quantity: 1 }] },
    });
    manager.resolveEscape();

    const report = buildExtractionReport({
      outcome: 'ESCAPED',
      snapshot: manager.snapshot(),
      durationMs: RAID_DURATION_MS,
      carriedOut: { potion: 1 },
      saved: true,
    });

    expect(report.securedEmptyText).toBe('None of what you protected turned up in the raid.');
  });
});

/**
 * Gear is the only thing a raid holds that is neither in the pack nor a Pokemon
 * in its own right, so it has its own lines - and, because a piece comes off a
 * boss once per save, the loss it can report is the one the screen must never
 * round off.
 */
describe('what the result screen says about gear', () => {
  it('names a piece that came out of the field and a piece that was already held', () => {
    const carrier = new Pokemon(BULBASAUR, 5);
    carrier.giveHeldItem('leftovers');
    const finder = new Pokemon(CHARMANDER, 5);
    const manager = startedRun({ party: [carrier, finder], items: [] });
    // Found in the raid and given out on the spot, so the slot changed hands
    // between deploy and extraction.
    finder.giveHeldItem('quick-claw');
    manager.tick(60_000);
    manager.resolveEscape();

    const report = buildExtractionReport({
      outcome: 'ESCAPED',
      snapshot: manager.snapshot(),
      durationMs: RAID_DURATION_MS,
      banked: { pokemon: [], items: [] },
      carriedOut: {},
      saved: true,
    });

    expect(report.gear).toEqual([
      { itemId: 'leftovers', label: 'Leftovers', holder: 'Bulbasaur', fate: 'kept' },
      { itemId: 'quick-claw', label: 'Quick Claw', holder: 'Charmander', fate: 'found' },
    ]);
    expect(report.gearSummary).toContain("Charmander's Quick Claw");
  });

  it('says a lost piece is gone, and that the way to another is a boss', () => {
    const secured = new Pokemon(BULBASAUR, 5);
    const risked = new Pokemon(CHARMANDER, 5);
    secured.giveHeldItem('focus-band');
    risked.giveHeldItem('life-orb');
    const manager = startedRun({
      party: [secured, risked],
      items: [],
      secure: { pokemon: [secured] },
    });
    manager.tick(60_000);
    manager.resolveWipe();

    const report = buildExtractionReport({
      outcome: 'WIPED',
      cause: 'defeated',
      snapshot: manager.snapshot(),
      durationMs: RAID_DURATION_MS,
      lost: { pokemon: [risked], items: [] },
      carriedOut: {},
      saved: true,
    });

    expect(report.gear).toEqual([
      { itemId: 'focus-band', label: 'Focus Band', holder: 'Bulbasaur', fate: 'kept' },
      { itemId: 'life-orb', label: 'Life Orb', holder: 'Charmander', fate: 'lost' },
    ]);
    expect(report.gearSummary).toContain("Charmander's Life Orb went down with the raid");
    expect(report.gearSummary).toContain('trainers holding the gates');
  });

  it('says nothing at all about gear when none was carried', () => {
    const manager = startedRun({ party: [new Pokemon(BULBASAUR, 5)], items: [] });
    manager.tick(1_000);
    manager.resolveEscape();

    const report = buildExtractionReport({
      outcome: 'ESCAPED',
      snapshot: manager.snapshot(),
      durationMs: RAID_DURATION_MS,
      banked: { pokemon: [], items: [] },
      carriedOut: {},
      saved: true,
    });

    expect(report.gear).toEqual([]);
    expect(report.gearSummary).toBeNull();
  });
});

/**
 * The pack is its own line because it is not part of the haul: it is the thing
 * the haul was in, and a lost raid takes it whatever the secure container held.
 */
describe('what the result screen says about the pack', () => {
  const reportWearing = (packItemId: string | undefined, outcome: 'ESCAPED' | 'WIPED') => {
    const manager = startedRun({
      party: [new Pokemon(BULBASAUR, 5)],
      items: [],
      ...(packItemId === undefined ? {} : { packItemId }),
    });
    manager.tick(60_000);
    if (outcome === 'ESCAPED') {
      manager.resolveEscape();
    } else {
      manager.resolveWipe({});
    }
    return buildExtractionReport({
      outcome,
      ...(outcome === 'WIPED' ? { cause: 'timer' as const } : {}),
      snapshot: manager.snapshot(),
      durationMs: RAID_DURATION_MS,
      carriedOut: {},
      saved: true,
    });
  };

  it('names the pack and its squares when the raid came home', () => {
    const report = reportWearing('ranger-pack', 'ESCAPED');
    expect(report.pack).toEqual({
      itemId: 'ranger-pack',
      name: 'Ranger pack',
      squares: 24,
      fate: 'kept',
    });
    expect(report.packSummary).toContain('Ranger pack came home');
  });

  it('says the pack went down with the raid, and how much of it', () => {
    const report = reportWearing('hauler-frame', 'WIPED');
    expect(report.pack).toMatchObject({ itemId: 'hauler-frame', fate: 'lost', squares: 30 });
    expect(report.packSummary).toContain('30 squares, gone');
    // And it is never in the ledger: the ledger is the haul, not the thing the
    // haul was in.
    expect(report.ledger.items.map((item) => item.itemId)).not.toContain('hauler-frame');
  });

  it('says nothing at all about a raid that named no pack', () => {
    expect(reportWearing(undefined, 'WIPED').pack).toBeNull();
    expect(reportWearing(undefined, 'WIPED').packSummary).toBeNull();
  });
});
