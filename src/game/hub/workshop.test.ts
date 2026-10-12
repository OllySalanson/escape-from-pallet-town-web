import { describe, expect, it } from 'vitest';
import { ITEM_DEFINITIONS, isMaterial } from '../items';
import { CHARMANDER, Pokemon } from '../pokemon';
import { MINIMUM_SUPPLIES, Stash } from '../stash';
import { ICON_NAMES } from '../ui/icons';
import {
  beaconUnlockAtMs,
  checkPayment,
  hasBeacon,
  hasHunterIntel,
  WORKSHOP_UPGRADES,
  workshopOffers,
  workshopSecureItemStacks,
  workshopSecurePokemon,
  recoveryPriceShare,
  spendableSupply,
  takePayment,
  wardTreatmentsPerRaid,
  type WorkshopVault,
} from './workshop';

const EVERY_UPGRADE = WORKSHOP_UPGRADES.map((upgrade) => upgrade.id);

/**
 * A vault with nobody in it but a level-9 partner, and plenty of spare supplies:
 * the vault a player who has just wiped holds, which is the one the ladder used
 * to have nothing to build from.
 */
function vaultWith(
  items: Readonly<Record<string, number>> = {
    'poke-ball': 9,
    potion: 7,
    'super-potion': 4,
    'great-ball': 4,
    antidote: 4,
    'radio-valve': 4,
    'cable-coil': 4,
    'parts-crate': 10,
    'lamp-oil': 4,
    'mooring-rope': 6,
    'linen-roll': 8,
  },
): WorkshopVault {
  const stash = new Stash({ items });
  stash.addPokemon(new Pokemon(CHARMANDER, 9), 'partner');
  return { stash };
}

/** Every unit of material a rung costs, of every kind. */
const units = (upgrade: (typeof WORKSHOP_UPGRADES)[number]): number =>
  upgrade.cost.supplies.reduce((total, { quantity }) => total + quantity, 0);

describe('the workshop ladder', () => {
  it('names every upgrade once and gates each second rung behind a first that exists', () => {
    expect(new Set(EVERY_UPGRADE).size).toBe(WORKSHOP_UPGRADES.length);
    for (const upgrade of WORKSHOP_UPGRADES) {
      if (upgrade.requires !== undefined) {
        expect(EVERY_UPGRADE).toContain(upgrade.requires);
        expect(upgrade.requires).not.toBe(upgrade.id);
      }
    }
  });

  it('is a sink: every rung costs some supply that exists', () => {
    const itemIds = ITEM_DEFINITIONS.map((item) => item.id);
    for (const upgrade of WORKSHOP_UPGRADES) {
      expect(upgrade.cost.supplies.length).toBeGreaterThanOrEqual(1);
      for (const { itemId, quantity } of upgrade.cost.supplies) {
        expect(itemIds).toContain(itemId);
        expect(quantity).toBeGreaterThanOrEqual(1);
      }
    }
  });

  /**
   * One rung, one capability. The single exception is stated rather than
   * implied: a Pokemon takes four squares of the container, so a rung that
   * protects one more Pokemon has to bring the column to stand it in or it is
   * a promise the container cannot keep - and nothing else may pair up.
   */
  it('pays in capability or information, and every rung changes exactly one thing', () => {
    for (const upgrade of WORKSHOP_UPGRADES) {
      const effects = [
        upgrade.secureItemStack,
        upgrade.securePokemon,
        upgrade.recoveryPriceShare !== undefined,
        upgrade.wardTreatments !== undefined,
        upgrade.hunterIntel,
        upgrade.beacon,
      ].filter(Boolean);
      if (upgrade.securePokemon) {
        expect(effects).toEqual([true, true]);
        expect(upgrade.secureItemStack).toBe(true);
        continue;
      }
      expect(effects).toHaveLength(1);
    }
  });

  it('draws every rung with an icon the shared set actually holds', () => {
    for (const upgrade of WORKSHOP_UPGRADES) {
      expect(ICON_NAMES).toContain(upgrade.icon);
    }
  });

  it('costs the most for the second protected Pokemon and the least for information', () => {
    const byId = new Map(WORKSHOP_UPGRADES.map((upgrade) => [upgrade.id, upgrade]));
    const prices = WORKSHOP_UPGRADES.map(units);
    expect(units(byId.get('radio-mast')!)).toBe(Math.min(...prices));
    expect(units(byId.get('secure-locker-2')!)).toBe(Math.max(...prices));
    expect(prices.filter((price) => price === Math.max(...prices))).toHaveLength(1);
  });

  /**
   * The captain's answer to playtest 42 (option A, 2026-10-12): materials only,
   * and more of them, so the sink is no shallower for losing its Pokemon. The
   * ladder cost twenty units beside seventeen Pokemon, and every Pokemon became
   * one more unit of what its rung is about.
   */
  it('asks for materials only, and as deep a sink as it was with Pokemon in it', () => {
    expect(WORKSHOP_UPGRADES.reduce((total, upgrade) => total + units(upgrade), 0)).toBe(20 + 17);
    for (const upgrade of WORKSHOP_UPGRADES) {
      expect(Object.keys(upgrade.cost), upgrade.id).toEqual(['supplies']);
    }
  });
});

describe('what the upgrade list derives', () => {
  it('gives a base with nothing built nothing at all', () => {
    expect(workshopSecureItemStacks([])).toBe(0);
    expect(workshopSecurePokemon([])).toBe(0);
    expect(recoveryPriceShare([])).toBe(1);
    expect(wardTreatmentsPerRaid([])).toBe(0);
    expect(hasHunterIntel([])).toBe(false);
    expect(hasBeacon([])).toBe(false);
  });

  it('derives each effect from its own rung and from nothing else', () => {
    expect(workshopSecureItemStacks(['secure-locker-1'])).toBe(1);
    expect(workshopSecurePokemon(['secure-locker-1'])).toBe(0);
    expect(workshopSecurePokemon(['secure-locker-1', 'secure-locker-2'])).toBe(1);
    expect(recoveryPriceShare(['recovery-bay-1'])).toBe(0.75);
    expect(recoveryPriceShare(['recovery-bay-1', 'recovery-bay-2'])).toBe(0.5);
    expect(wardTreatmentsPerRaid(['quarantine-ward'])).toBe(1);
    expect(hasHunterIntel(['radio-mast'])).toBe(true);
    expect(hasBeacon(['beacon'])).toBe(true);
  });

  it('cannot be inflated by a repeated or unknown id', () => {
    expect(workshopSecureItemStacks(['secure-locker-1', 'secure-locker-1'])).toBe(1);
    expect(wardTreatmentsPerRaid(['quarantine-ward', 'quarantine-ward', 'golden-ward'])).toBe(1);
  });

  it('opens the beacon halfway through whatever clock the raid deploys with', () => {
    expect(beaconUnlockAtMs(300_000)).toBe(150_000);
    expect(beaconUnlockAtMs(150_000)).toBe(75_000);
    expect(beaconUnlockAtMs(-5)).toBe(0);
  });
});

describe('what may be spent', () => {
  it('builds out of a vault with no Pokemon to spare, and never touches the team', () => {
    // Playtest 42: after a wipe the vault held one Pokemon, and eleven raids
    // built nothing with materials to spare. Materials are the whole price now.
    const vault = vaultWith();
    expect(workshopOffers(vault, []).filter((offer) => offer.affordable).length).toBeGreaterThan(0);

    expect(takePayment(vault, [], 'radio-mast')).toMatchObject({ ok: true });
    expect(vault.stash.listPokemon().map(({ id }) => id)).toEqual(['partner']);
    expect(vault.stash.itemCount('radio-valve')).toBe(1);
    expect(vault.stash.itemCount('mooring-rope')).toBe(5);
  });

  it('prices every rung in materials, never in the kit a wipe restocks', () => {
    for (const upgrade of WORKSHOP_UPGRADES) {
      expect(upgrade.cost.supplies.length, upgrade.id).toBeGreaterThan(0);
      for (const { itemId } of upgrade.cost.supplies) {
        expect(isMaterial(itemId), `${upgrade.id} costs ${itemId}`).toBe(true);
        expect(MINIMUM_SUPPLIES, `${upgrade.id} costs ${itemId}`).not.toHaveProperty(itemId);
      }
    }
  });

  it('is short of a material a kit-only vault does not hold, and never takes the kit', () => {
    const vault = vaultWith({ ...MINIMUM_SUPPLIES });
    expect(spendableSupply(vault, 'parts-crate')).toBe(0);
    expect(checkPayment(vault, [], 'secure-locker-1')).toMatchObject({
      ok: false,
      refusal: 'supplies-short',
    });
    const offer = workshopOffers(vault, []).find(({ upgrade }) => upgrade.id === 'secure-locker-1')!;
    expect(offer.affordable).toBe(false);
    expect(offer.suppliesShort).toEqual([{ itemId: 'parts-crate', quantity: 4 }]);
  });

  it('spends materials in full and leaves the kit exactly as it was', () => {
    const vault = vaultWith({ ...MINIMUM_SUPPLIES, 'parts-crate': 4 });
    expect(spendableSupply(vault, 'parts-crate')).toBe(4);
    takePayment(vault, [], 'secure-locker-1');
    expect(vault.stash.itemCount('parts-crate')).toBe(0);
    expect(vault.stash.supplyShortfall()).toEqual({});
    expect(vault.stash.itemCount('poke-ball')).toBe(MINIMUM_SUPPLIES['poke-ball']);
    // The restock never hands a material out: a wiped vault is refilled with the kit alone.
    vault.stash.restockMinimumSupplies();
    expect(vault.stash.itemCount('parts-crate')).toBe(0);
  });

  it('reads the kit as a capability, so a better ball or potion frees the plain one', () => {
    // Five throws and three heals are the kit, whatever tier holds them.
    const vault = vaultWith({
      'poke-ball': 5,
      'great-ball': 2,
      potion: 3,
      'super-potion': 1,
      antidote: 2,
      'parts-crate': 4,
      // A pack answers the kit's pack line, so the shortfall below is about
      // supplies alone rather than about a vault with nothing to carry in.
      'raid-pack': 1,
    });
    expect(spendableSupply(vault, 'poke-ball')).toBe(2);
    expect(spendableSupply(vault, 'potion')).toBe(1);
    // An Antidote heals nothing, so it is never part of the kit.
    expect(spendableSupply(vault, 'antidote')).toBe(2);
    expect(checkPayment(vault, [], 'secure-locker-1')).toMatchObject({ ok: true });

    takePayment(vault, [], 'secure-locker-1');
    expect(vault.stash.supplyShortfall()).toEqual({});
  });

  it('takes exactly the listed materials, and nothing on a refusal', () => {
    const short = vaultWith({ 'parts-crate': 3, 'mooring-rope': 9 });
    const before = short.stash.toJSON();
    expect(takePayment(short, ['secure-locker-1'], 'secure-locker-2')).toMatchObject({
      ok: false,
      refusal: 'supplies-short',
    });
    expect(short.stash.toJSON()).toEqual(before);

    const vault = vaultWith();
    expect(takePayment(vault, ['secure-locker-1'], 'secure-locker-2')).toMatchObject({ ok: true });
    expect(vault.stash.itemCount('parts-crate')).toBe(6);
    expect(vault.stash.itemCount('mooring-rope')).toBe(2);
    expect(vault.stash.itemCount('poke-ball')).toBe(9);
    expect(vault.stash.itemCount('potion')).toBe(7);
    expect(vault.stash.itemCount('antidote')).toBe(4);
  });

  it('builds a rung once, and a second rung only after its first', () => {
    const vault = vaultWith();
    expect(checkPayment(vault, [], 'secure-locker-2')).toMatchObject({ ok: false, refusal: 'locked' });
    expect(checkPayment(vault, ['secure-locker-1'], 'secure-locker-2')).toMatchObject({ ok: true });
    expect(checkPayment(vault, ['secure-locker-1'], 'secure-locker-1'))
      .toMatchObject({ ok: false, refusal: 'already-built' });
    expect(checkPayment(vault, [], 'gear-tier-9')).toMatchObject({ ok: false, refusal: 'unknown-upgrade' });

    const states = workshopOffers(vault, ['secure-locker-1']).map(({ upgrade, state }) => [upgrade.id, state]);
    expect(states).toContainEqual(['secure-locker-1', 'built']);
    expect(states).toContainEqual(['secure-locker-2', 'open']);
    expect(states).toContainEqual(['recovery-bay-2', 'locked']);
  });
});
