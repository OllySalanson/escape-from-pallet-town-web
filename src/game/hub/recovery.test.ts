import { describe, expect, it } from 'vitest';
import { CHARMANDER, PIDGEY, Pokemon } from '../pokemon';
import { PrimaryStatus } from '../pokemon/battle/status';
import { RAID_DURATION_MS } from '../run/raidClock';
import { Stash } from '../stash';
import {
  applyRecovery,
  formatRecoveryClock,
  healDayOf,
  isFreeHealDay,
  MAX_PENDING_RECOVERY_MS,
  needsRecovery,
  pokemonNeedingRecovery,
  quoteRecovery,
  raidClockAfterRecovery,
  recoveryHeldBackIds,
  RECOVERY_REVIVE_MS,
  RECOVERY_STEP_MS,
  recoveryCostMs,
  recoveryPrices,
  wardBedIds,
  type RecoveryTerms,
} from './recovery';

function faintedCharmander(): Pokemon {
  const charmander = new Pokemon(CHARMANDER, 5);
  charmander.takeDamage(charmander.maxHp);
  return charmander;
}

/** A vault whose Charmander came home fainted: the one case Nurse Joy charges for. */
function hurtStash(): { stash: Stash; charmander: Pokemon } {
  const stash = new Stash();
  const charmander = new Pokemon(CHARMANDER, 5);
  charmander.takeDamage(charmander.maxHp);
  stash.addPokemon(charmander, 'charmander-1');
  stash.addItem('potion', 3);
  return { stash, charmander };
}

describe('recovery pricing', () => {
  it('charges nothing for a Pokemon that is already fit', () => {
    const pidgey = new Pokemon(PIDGEY, 9);

    expect(recoveryCostMs(pidgey)).toBe(0);
    expect(needsRecovery(pidgey)).toBe(false);
  });

  /**
   * The overnight critic's problem 15 (25 Nov 2026): every treatment was
   * charged to the next raid's clock, so a bad raid made the next one worse.
   * A scrape and a status are FireRed's Pokémon Center's: free.
   */
  it('mends HP and cures a status for nothing, and says they need her', () => {
    const half = new Pokemon(CHARMANDER, 5);
    half.takeDamage(Math.floor(half.maxHp / 2));
    const nearlyDead = new Pokemon(CHARMANDER, 5);
    nearlyDead.takeDamage(nearlyDead.maxHp - 1);
    const poisoned = new Pokemon(CHARMANDER, 5);
    poisoned.primaryStatus = PrimaryStatus.Poison;

    for (const pokemon of [half, nearlyDead, poisoned]) {
      expect(recoveryCostMs(pokemon)).toBe(0);
      expect(needsRecovery(pokemon)).toBe(true);
    }
  });

  it('charges only to bring a Pokémon round from a faint, so a faint stays the worst outcome', () => {
    const fainted = faintedCharmander();
    const nearlyDead = new Pokemon(CHARMANDER, 5);
    nearlyDead.takeDamage(nearlyDead.maxHp - 1);

    expect(fainted.isFainted).toBe(true);
    expect(recoveryCostMs(fainted)).toBe(RECOVERY_REVIVE_MS);
    expect(recoveryCostMs(fainted)).toBeGreaterThan(recoveryCostMs(nearlyDead));
  });

  it('rounds prices up to a whole step so the lobby never shows odd seconds', () => {
    for (const level of [5, 9, 14, 23]) {
      for (const damage of [1, 3, 7]) {
        const pokemon = new Pokemon(CHARMANDER, level);
        pokemon.takeDamage(damage);
        expect(recoveryCostMs(pokemon) % RECOVERY_STEP_MS).toBe(0);
      }
    }
  });
});

describe('recovery charges', () => {
  it('never books more raid time than the cap, so a worn party is always treatable', () => {
    const stash = new Stash();
    for (let index = 0; index < 6; index += 1) {
      const pokemon = new Pokemon(CHARMANDER, 5);
      pokemon.takeDamage(pokemon.maxHp);
      stash.addPokemon(pokemon, `charmander-${index + 1}`);
    }
    const ids = stash.listPokemon().map((stored) => stored.id);

    const outcome = applyRecovery(stash, 0, ids);

    expect(outcome.recoveredIds).toEqual(ids);
    expect(outcome.pendingRecoveryMs).toBe(MAX_PENDING_RECOVERY_MS);
    expect(outcome.chargedMs).toBe(MAX_PENDING_RECOVERY_MS);
    expect(stash.listPokemon().every((stored) => !needsRecovery(stored.pokemon))).toBe(true);
  });

  it('heals free past the cap within one visit, but not on the next while the debt is still at the cap', () => {
    // The looper of the six-character playtest: raids too short to settle the
    // debt leave it at the cap, and every heal after that used to be free.
    const { stash } = hurtStash();
    const fit = new Pokemon(PIDGEY, 6);
    stash.addPokemon(fit, 'pidgey-1');

    expect(recoveryHeldBackIds(stash, MAX_PENDING_RECOVERY_MS, ['charmander-1'])).toEqual(['charmander-1']);
    expect(quoteRecovery(stash, MAX_PENDING_RECOVERY_MS, ['charmander-1'])).toBe(0);
    const outcome = applyRecovery(stash, MAX_PENDING_RECOVERY_MS, ['charmander-1']);

    expect(outcome).toMatchObject({ recoveredIds: [], heldBackIds: ['charmander-1'], chargedMs: 0 });
    expect(needsRecovery(stash.listPokemon()[0].pokemon)).toBe(true);
    // A debt one step short of the cap still treats, and anything past it is the batch's reward.
    expect(applyRecovery(stash, MAX_PENDING_RECOVERY_MS - RECOVERY_STEP_MS, ['charmander-1']).recoveredIds).toEqual(['charmander-1']);
  });

  it('still heals at the cap when nobody at base could raid without it', () => {
    const stash = new Stash();
    const fainted = new Pokemon(CHARMANDER, 5);
    fainted.takeDamage(fainted.maxHp);
    stash.addPokemon(fainted, 'charmander-1');

    expect(applyRecovery(stash, MAX_PENDING_RECOVERY_MS, ['charmander-1'])).toMatchObject({
      recoveredIds: ['charmander-1'],
      heldBackIds: [],
    });
  });

  it('quotes exactly what it goes on to charge', () => {
    const { stash } = hurtStash();
    const poisoned = new Pokemon(PIDGEY, 6);
    poisoned.primaryStatus = PrimaryStatus.Poison;
    stash.addPokemon(poisoned, 'pidgey-1');
    const ids = ['charmander-1', 'pidgey-1'];

    const quoted = quoteRecovery(stash, 0, ids);

    expect(quoted).toBe(RECOVERY_REVIVE_MS);
    expect(applyRecovery(stash, 0, ids).chargedMs).toBe(quoted);
  });

  it('skips a Pokemon that needs nothing rather than charging for it', () => {
    const { stash } = hurtStash();
    stash.addPokemon(new Pokemon(PIDGEY, 6), 'pidgey-1');

    const outcome = applyRecovery(stash, 0, ['charmander-1', 'pidgey-1', 'nobody']);

    expect(outcome.recoveredIds).toEqual(['charmander-1']);
    expect(applyRecovery(stash, outcome.pendingRecoveryMs, ['charmander-1'])).toMatchObject({
      recoveredIds: [],
      chargedMs: 0,
      pendingRecoveryMs: outcome.pendingRecoveryMs,
    });
  });

  it('restores HP and status without creating or consuming anything else', () => {
    const { stash, charmander } = hurtStash();
    charmander.primaryStatus = PrimaryStatus.Poison;

    const outcome = applyRecovery(stash, 0, ['charmander-1']);

    expect(charmander.currentHp).toBe(charmander.maxHp);
    expect(charmander.primaryStatus).toBeNull();
    expect(outcome.chargedMs).toBeGreaterThan(0);
    // The price is raid time, so the vault's stock is untouched in both directions.
    expect(stash.listItems()).toEqual({ potion: 3 });
    expect(stash.listPokemon()).toHaveLength(1);
  });

  it('lists only the Pokemon a recovery would actually change', () => {
    const { stash } = hurtStash();
    stash.addPokemon(new Pokemon(PIDGEY, 6), 'pidgey-1');

    expect(pokemonNeedingRecovery(stash).map((stored) => stored.id)).toEqual(['charmander-1']);

    applyRecovery(stash, 0, ['charmander-1']);
    expect(pokemonNeedingRecovery(stash)).toEqual([]);
  });
});

describe('recovery against the raid clock', () => {
  it('takes booked recovery off the next raid and never below zero', () => {
    expect(raidClockAfterRecovery(RAID_DURATION_MS, 0)).toBe(RAID_DURATION_MS);
    expect(raidClockAfterRecovery(RAID_DURATION_MS, RECOVERY_REVIVE_MS)).toBe(RAID_DURATION_MS - RECOVERY_REVIVE_MS);
    expect(raidClockAfterRecovery(60_000, MAX_PENDING_RECOVERY_MS)).toBe(0);
  });

  it('always leaves a raid worth deploying into, however much was booked', () => {
    // The cap is a fifth of the clock, so the worst possible debt still leaves
    // four fifths of a raid. An absolute cap written against a longer clock
    // would hand a fully treated party a raid that enrages on frame one.
    expect(MAX_PENDING_RECOVERY_MS).toBe(Math.floor(RAID_DURATION_MS / 5));
    expect(raidClockAfterRecovery(RAID_DURATION_MS, MAX_PENDING_RECOVERY_MS)).toBeGreaterThanOrEqual(
      (RAID_DURATION_MS * 4) / 5,
    );
  });

  it('never takes more than 1:00 of the next raid, even for a whole fainted team', () => {
    // A lost raid already takes the pack; a fainted lone starter cost 1:40 of a
    // five-minute raid, and the shorter clock lost the next one too (AI playtest 5).
    expect(MAX_PENDING_RECOVERY_MS).toBe(60_000);
    const stash = new Stash();
    stash.addPokemon(faintedCharmander(), 'down-1');
    stash.addPokemon(faintedCharmander(), 'down-2');
    const outcome = applyRecovery(stash, 0, ['down-1', 'down-2']);
    expect(outcome.recoveredIds).toEqual(['down-1', 'down-2']);
    expect(outcome.chargedMs).toBe(60_000);
  });

  it("heals free once a day: today's first heal charges nothing and says it was the free one", () => {
    const stash = new Stash();
    stash.addPokemon(faintedCharmander(), 'down');
    const free: RecoveryTerms = { priceShare: 1, wardTreatments: 1, freeToday: true };
    expect(quoteRecovery(stash, 0, ['down'], free)).toBe(0);
    const outcome = applyRecovery(stash, MAX_PENDING_RECOVERY_MS, ['down'], free);
    // Not held back by a debt at the cap, and no ward bed spent on it.
    expect(outcome.recoveredIds).toEqual(['down']);
    expect(outcome.chargedMs).toBe(0);
    expect(outcome.wardTreatmentsUsed).toBe(0);
    expect(outcome.usedFreeHeal).toBe(true);
    expect(applyRecovery(new Stash(), 0, [], free).usedFreeHeal).toBe(false);
    // A day on the player's own clock.
    expect(healDayOf(new Date(2026, 10, 2, 23, 59))).toBe('2026-11-02');
    expect(isFreeHealDay('2026-11-02', new Date(2026, 10, 2, 8))).toBe(false);
    expect(isFreeHealDay('2026-11-02', new Date(2026, 10, 3, 0, 1))).toBe(true);
    expect(isFreeHealDay(undefined, new Date(2026, 10, 3))).toBe(true);
  });

  it("keeps today's free heal for a faint: mending a scratch, free any day, never spends it", () => {
    const stash = new Stash();
    const scratched = new Pokemon(PIDGEY, 6);
    scratched.takeDamage(2);
    stash.addPokemon(scratched, 'scratched');
    const free: RecoveryTerms = { priceShare: 1, wardTreatments: 0, freeToday: true };
    const outcome = applyRecovery(stash, 0, ['scratched'], free);
    expect(outcome.recoveredIds).toEqual(['scratched']);
    expect(outcome.usedFreeHeal).toBe(false);
    stash.addPokemon(faintedCharmander(), 'down');
    expect(applyRecovery(stash, 0, ['down'], free).usedFreeHeal).toBe(true);
  });

  it('prices every treatment as a whole number of quoting steps', () => {
    // A full bar has to cost exactly its listed price, not the next step up.
    expect(RECOVERY_REVIVE_MS % RECOVERY_STEP_MS).toBe(0);
    expect(RECOVERY_REVIVE_MS).toBeGreaterThan(0);
  });

  it('ignores a corrupt or negative debt rather than handing out extra time', () => {
    expect(raidClockAfterRecovery(1_080_000, -600_000)).toBe(1_080_000);
    expect(raidClockAfterRecovery(1_080_000, Number.NaN)).toBe(1_080_000);
    expect(raidClockAfterRecovery(1_080_000, MAX_PENDING_RECOVERY_MS * 4)).toBe(
      1_080_000 - MAX_PENDING_RECOVERY_MS,
    );
  });

  it('formats clocks and costs as minutes and padded seconds', () => {
    expect(formatRecoveryClock(0)).toBe('0:00');
    expect(formatRecoveryClock(45_000)).toBe('0:45');
    expect(formatRecoveryClock(1_080_000)).toBe('18:00');
    expect(formatRecoveryClock(210_000)).toBe('3:30');
  });
});

describe('what Brock changes about recovery', () => {
  const WARD: RecoveryTerms = { priceShare: 1, wardTreatments: 1 };

  function downed(level = 5): Pokemon {
    const pokemon = new Pokemon(CHARMANDER, level);
    pokemon.takeDamage(pokemon.maxHp);
    return pokemon;
  }

  it('prices a better bay as a smaller share of the raid, never as a fixed time', () => {
    for (const share of [1, 0.75, 0.5]) {
      const prices = recoveryPrices(share);
      expect(prices.reviveMs).toBe(
        Math.max(RECOVERY_STEP_MS, Math.round((RAID_DURATION_MS * 0.11 * share) / RECOVERY_STEP_MS) * RECOVERY_STEP_MS),
      );
      expect(prices.reviveMs % RECOVERY_STEP_MS).toBe(0);
    }
    expect(recoveryPrices(1)).toEqual({ reviveMs: RECOVERY_REVIVE_MS });
  });

  it('makes a revive cheaper with each bay, and never free', () => {
    const pokemon = downed();
    const full = recoveryCostMs(pokemon);
    const bayOne = recoveryCostMs(pokemon, { priceShare: 0.75, wardTreatments: 0 });
    const bayTwo = recoveryCostMs(pokemon, { priceShare: 0.5, wardTreatments: 0 });

    expect(bayOne).toBeLessThan(full);
    expect(bayTwo).toBeLessThan(bayOne);
    // Half the raid share, to the nearest quoting step.
    expect(Math.abs(bayTwo - full / 2)).toBeLessThanOrEqual(RECOVERY_STEP_MS / 2);
    // A price that rounded away would make the bay a free heal, which is the ward's offer.
    expect(recoveryPrices(0.01).reviveMs).toBe(RECOVERY_STEP_MS);
    expect(recoveryPrices(Number.NaN)).toEqual(recoveryPrices(1));
  });

  it('keeps a faint the worst outcome at every bay level', () => {
    for (const priceShare of [1, 0.75, 0.5]) {
      const terms = { priceShare, wardTreatments: 0 };
      const nearlyDown = new Pokemon(CHARMANDER, 5);
      nearlyDown.takeDamage(nearlyDown.maxHp - 1);
      expect(recoveryCostMs(downed(), terms)).toBeGreaterThan(recoveryCostMs(nearlyDown, terms));
    }
  });

  it('brings a Pokémon round in a ward bed for nothing', () => {
    expect(recoveryCostMs(downed(), WARD)).toBe(RECOVERY_REVIVE_MS);
    expect(recoveryCostMs(downed(), WARD, true)).toBe(0);
  });

  it('gives the bed to a fainted Pokémon, never to a scratch, so the listed price is the price', () => {
    const stash = new Stash();
    const scratched = new Pokemon(PIDGEY, 5);
    scratched.takeDamage(1);
    stash.addPokemon(scratched, 'scratched');
    stash.addPokemon(downed(), 'down');

    expect([...wardBedIds(pokemonNeedingRecovery(stash), WARD)]).toEqual(['down']);
    // Treating the scratch alone is free and does not take the bed...
    expect(quoteRecovery(stash, 0, ['scratched'], WARD)).toBe(0);
    const first = applyRecovery(stash, 0, ['scratched'], WARD);
    expect(first.wardTreatmentsUsed).toBe(0);
    // ...which then brings the fainted one round for nothing.
    const second = applyRecovery(stash, first.pendingRecoveryMs, ['down'], WARD);
    expect(second.wardTreatmentsUsed).toBe(1);
    expect(second.chargedMs).toBe(0);
  });

  it('charges in full once the bed for this raid is used', () => {
    const stash = new Stash();
    stash.addPokemon(downed(), 'down');
    const used: RecoveryTerms = { priceShare: 1, wardTreatments: 0 };

    expect(quoteRecovery(stash, 0, ['down'], used)).toBe(RECOVERY_REVIVE_MS);
    expect(applyRecovery(stash, 0, ['down'], used).wardTreatmentsUsed).toBe(0);
  });

  it('quotes "recover all" as exactly what it then charges, with one bed between them', () => {
    const stash = new Stash();
    stash.addPokemon(downed(), 'down-1');
    stash.addPokemon(downed(), 'down-2');
    const ids = ['down-1', 'down-2'];

    const quoted = quoteRecovery(stash, 0, ids, WARD);
    const outcome = applyRecovery(stash, 0, ids, WARD);
    expect(outcome.chargedMs).toBe(quoted);
    expect(outcome.wardTreatmentsUsed).toBe(1);
    expect(quoted).toBe(RECOVERY_REVIVE_MS);
  });
});

