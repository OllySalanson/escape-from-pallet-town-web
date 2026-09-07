import { describe, expect, it } from 'vitest';
import { CHARMANDER, PIDGEY, Pokemon } from '../pokemon';
import { PrimaryStatus } from '../pokemon/battle/status';
import { Stash } from '../stash';
import {
  applyRecovery,
  formatRecoveryClock,
  MAX_PENDING_RECOVERY_MS,
  needsRecovery,
  pokemonNeedingRecovery,
  quoteRecovery,
  raidClockAfterRecovery,
  RECOVERY_FULL_BAR_MS,
  RECOVERY_REVIVE_MS,
  RECOVERY_STATUS_MS,
  RECOVERY_STEP_MS,
  recoveryCostMs,
} from './recovery';

function hurtStash(): { stash: Stash; charmander: Pokemon } {
  const stash = new Stash();
  const charmander = new Pokemon(CHARMANDER, 5);
  charmander.takeDamage(charmander.maxHp - 3);
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

  it('scales with the share of the health bar it has to put back', () => {
    const full = new Pokemon(CHARMANDER, 5);
    const half = new Pokemon(CHARMANDER, 5);
    half.takeDamage(Math.floor(half.maxHp / 2));
    const scratched = new Pokemon(CHARMANDER, 5);
    scratched.takeDamage(1);

    expect(recoveryCostMs(full)).toBe(0);
    expect(recoveryCostMs(half)).toBeGreaterThan(recoveryCostMs(scratched));
    expect(recoveryCostMs(half)).toBeLessThan(RECOVERY_FULL_BAR_MS);
    // A scratch is cheap enough to be worth fixing, never free.
    expect(recoveryCostMs(scratched)).toBe(RECOVERY_STEP_MS);
  });

  it('charges a revive surcharge on top of a full bar, so a faint stays the worst outcome', () => {
    const fainted = new Pokemon(CHARMANDER, 5);
    fainted.takeDamage(fainted.maxHp);
    const nearlyDead = new Pokemon(CHARMANDER, 5);
    nearlyDead.takeDamage(nearlyDead.maxHp - 1);

    expect(fainted.isFainted).toBe(true);
    expect(recoveryCostMs(fainted)).toBe(RECOVERY_FULL_BAR_MS + RECOVERY_REVIVE_MS);
    expect(recoveryCostMs(fainted) - recoveryCostMs(nearlyDead)).toBeGreaterThanOrEqual(
      RECOVERY_REVIVE_MS,
    );
  });

  it('adds a flat charge for a status that would otherwise persist between raids', () => {
    const poisoned = new Pokemon(CHARMANDER, 5);
    poisoned.primaryStatus = PrimaryStatus.Poison;

    expect(recoveryCostMs(poisoned)).toBe(RECOVERY_STATUS_MS);
    expect(needsRecovery(poisoned)).toBe(true);
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

  it('quotes exactly what it goes on to charge', () => {
    const { stash } = hurtStash();
    const poisoned = new Pokemon(PIDGEY, 6);
    poisoned.primaryStatus = PrimaryStatus.Poison;
    stash.addPokemon(poisoned, 'pidgey-1');
    const ids = ['charmander-1', 'pidgey-1'];

    const quoted = quoteRecovery(stash, 0, ids);

    expect(quoted).toBeGreaterThan(0);
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
    expect(raidClockAfterRecovery(1_080_000, 0)).toBe(1_080_000);
    expect(raidClockAfterRecovery(1_080_000, 240_000)).toBe(840_000);
    expect(raidClockAfterRecovery(60_000, MAX_PENDING_RECOVERY_MS)).toBe(0);
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
