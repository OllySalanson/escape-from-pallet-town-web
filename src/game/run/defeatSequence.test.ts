import { describe, expect, it } from 'vitest';

import { Bag } from '../items';
import { BULBASAUR, CHARMANDER, Pokemon, SQUIRTLE } from '../pokemon';
import { RunManager, type ItemStack } from './RunManager';
import { buildDefeatSequence } from './defeatSequence';
import { buildExtractionReport, type ExtractionReport } from './extractionReport';
import { buildWipeSettlement } from './raidSettlement';

const DURATION_MS = 300_000;

interface WipeOptions {
  readonly secureIndex?: number;
  readonly securedItems?: readonly ItemStack[];
  readonly lastStandIndex?: number;
  readonly cause?: 'defeated' | 'timer';
}

/**
 * A lost raid built through the real RunManager, so the sequence is always
 * reading a report the game could actually have produced.
 */
function wipedReport(
  party: readonly Pokemon[],
  items: readonly ItemStack[] = [],
  options: WipeOptions = {},
): ExtractionReport {
  const manager = new RunManager();
  const secureSlot = {
    ...(options.secureIndex === undefined ? {} : { pokemon: party[options.secureIndex] }),
    ...(options.securedItems ? { items: options.securedItems } : {}),
  };
  manager.startRun({ party, items }, { mapId: 'floodplain-relay', durationMs: DURATION_MS }, secureSlot);
  manager.tick(60_000);
  for (const member of party) {
    member.takeDamage(member.maxHp);
  }
  const result = manager.resolveWipe(secureSlot);
  // The pack as the raid went down with it: nothing here is ever drunk, so it
  // is the loadout, and the loss divides the way the two wipe scenes divide it.
  const carriedOut = new Bag(
    Object.fromEntries(items.map(({ itemId, quantity }) => [itemId, quantity])),
  ).toJSON();
  const wipe = buildWipeSettlement(secureSlot.items ?? [], carriedOut);
  return buildExtractionReport({
    outcome: 'WIPED',
    cause: options.cause ?? 'defeated',
    snapshot: manager.snapshot(),
    durationMs: DURATION_MS,
    lost: { pokemon: result.lostPokemon, items: wipe.destroyedItems },
    carriedOut,
    ...(options.lastStandIndex === undefined ? {} : { lastStand: party[options.lastStandIndex] }),
    saved: true,
  });
}

describe('the defeat sequence a lost raid opens on', () => {
  it('names the Pokemon that was actually still standing, not just the last in the list', () => {
    const party = [new Pokemon(CHARMANDER, 12), new Pokemon(BULBASAUR, 9)];
    const sequence = buildDefeatSequence(
      wipedReport(party, [], { lastStandIndex: 0 }),
    );

    expect(sequence?.beats[0].headline).toBe('CHARMANDER FAINTED.');
    expect(sequence?.beats[0].detail).toContain('The last of 2');
  });

  it('draws the whole deployed party, at the levels the player raised them to', () => {
    const party = [new Pokemon(CHARMANDER, 12), new Pokemon(BULBASAUR, 9)];
    const sequence = buildDefeatSequence(wipedReport(party, [], { lastStandIndex: 0 }));

    expect(sequence?.figures.filter((figure) => figure.kind === 'pokemon')).toEqual([
      {
        kind: 'pokemon',
        label: 'Charmander',
        dexId: CHARMANDER.dexId,
        level: 12,
        fate: 'taken',
        lastStand: true,
      },
      {
        kind: 'pokemon',
        label: 'Bulbasaur',
        dexId: BULBASAUR.dexId,
        level: 9,
        fate: 'taken',
        lastStand: false,
      },
    ]);
  });

  /** The point of the whole moment: the slot's verdict has to be legible. */
  it('splits the line-up by what the secure slot held and what was taken', () => {
    const party = [new Pokemon(CHARMANDER, 12), new Pokemon(SQUIRTLE, 11)];
    const sequence = buildDefeatSequence(
      wipedReport(party, [{ itemId: 'potion', quantity: 3 }], {
        secureIndex: 1,
        securedItems: [{ itemId: 'potion', quantity: 1 }],
        lastStandIndex: 0,
      }),
    );

    expect(sequence?.figures.filter((figure) => figure.fate === 'held')).toEqual([
      expect.objectContaining({ label: 'Squirtle' }),
      expect.objectContaining({ kind: 'item', label: 'Potion', quantity: 1, itemId: 'potion' }),
    ]);
    expect(sequence?.figures.filter((figure) => figure.fate === 'taken')).toEqual([
      expect.objectContaining({ label: 'Charmander' }),
      expect.objectContaining({ kind: 'item', label: 'Potion', quantity: 2, itemId: 'potion' }),
    ]);
    expect(sequence?.beats[1].headline).toBe('THEY STRIPPED YOU.');
    expect(sequence?.beats[1].detail).toBe('Charmander and 2 Potions lifted off you and gone from your stash.');
    expect(sequence?.beats[2].headline).toBe('THE SECURE SLOT HELD.');
    expect(sequence?.beats[2].detail).toContain('Squirtle and 1 Potion came home with you.');
  });

  it('says so plainly when the slot was empty, rather than skipping the beat', () => {
    const sequence = buildDefeatSequence(wipedReport([new Pokemon(CHARMANDER, 12)]));

    expect(sequence?.beats[2].headline).toBe('THE SECURE SLOT WAS EMPTY.');
    expect(sequence?.beats[2].detail).toContain('nothing came back with you');
    expect(sequence?.beats[0].detail).toContain('The only one you brought.');
  });

  it('never claims a loss when the secure slot covered the whole deployment', () => {
    const party = [new Pokemon(CHARMANDER, 12)];
    const sequence = buildDefeatSequence(
      wipedReport(party, [{ itemId: 'potion', quantity: 2 }], {
        secureIndex: 0,
        securedItems: [{ itemId: 'potion', quantity: 2 }],
      }),
    );

    expect(sequence?.beats[1].headline).toBe('NOTHING LEFT TO TAKE.');
    expect(sequence?.figures.every((figure) => figure.fate === 'held')).toBe(true);
  });

  /**
   * Dying is common and raids are five minutes, so the tenth viewing is the one
   * that decides whether this is a feature. It has to be measurably shorter.
   */
  it('runs shorter every time after the first, and is short even the first time', () => {
    const report = wipedReport([new Pokemon(CHARMANDER, 12)]);
    const first = buildDefeatSequence(report, { pace: 'first' })!;
    const repeat = buildDefeatSequence(report, { pace: 'repeat' })!;

    expect(first.totalMs).toBeLessThanOrEqual(4500);
    expect(repeat.totalMs).toBeLessThan(first.totalMs * 0.75);
    expect(repeat.beats.map((beat) => beat.headline)).toEqual(
      first.beats.map((beat) => beat.headline),
    );
  });

  it('is not offered for a raid lost to the clock, which has no line-up on the ground', () => {
    const report = wipedReport([new Pokemon(CHARMANDER, 12)], [], { cause: 'timer' });

    expect(report.fallen).toBeUndefined();
    expect(buildDefeatSequence(report)).toBeNull();
  });

  it('is not offered for a raid that was survived', () => {
    const manager = new RunManager();
    const party = [new Pokemon(CHARMANDER, 12)];
    manager.startRun({ party, items: [] }, { mapId: 'floodplain-relay', durationMs: DURATION_MS });
    const result = manager.resolveEscape();

    const report = buildExtractionReport({
      outcome: 'ESCAPED',
      snapshot: manager.snapshot(),
      durationMs: DURATION_MS,
      banked: { pokemon: result.bankedPokemon, items: result.bankedItems },
      saved: true,
    });

    expect(buildDefeatSequence(report)).toBeNull();
  });
});
