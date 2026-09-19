import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import type { AbilityEffectKind } from './AbilityBase';
import { ABILITIES, ABILITIES_BY_ID } from './abilities';
import { MOVE_CATALOGUE } from './moveCatalogue';
import { MoveFlag } from './MoveBase';
import { SPECIES_BY_ID } from './species';
import { eventToMessage } from '../scenes/battlePresentation';
import { battleEventSound } from '../audio/battleSounds';
import type { BattleEvent } from './battle/battleEngine';

/**
 * Generation III canon, held against the source it was taken from.
 *
 * `tools/abilities/frlg-abilities.json` is a committed PokeAPI snapshot of what
 * the 151 carry in FireRed and LeafGreen, and `frlg-move-flags.json` is the
 * contact, sound, bite and punch flags of every move this game ships. Both were
 * harvested by the scripts beside them; these are what stop the two drifting
 * from the game.
 */
const snapshot = <T>(name: string): T =>
  JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'tools', 'abilities', name), 'utf8')) as T;

interface AbilitySnapshot {
  readonly species: readonly { readonly dexId: number; readonly name: string; readonly abilities: readonly string[] }[];
  readonly abilities: readonly { readonly name: string; readonly carriers: number; readonly generation: string }[];
}

const FRLG = snapshot<AbilitySnapshot>('frlg-abilities.json');
const MOVE_FLAGS = snapshot<readonly { readonly name: string; readonly flags: readonly string[] }[]>(
  'frlg-move-flags.json',
);

describe('generation III abilities', () => {
  it('ships nothing the 151 do not carry, and nothing from a later generation', () => {
    const carried = new Map(FRLG.abilities.map((ability) => [ability.name, ability]));
    for (const ability of ABILITIES) {
      const source = carried.get(ability.id);
      expect(source, `${ability.id} is not carried by any of the 151`).toBeDefined();
      expect(source!.generation, ability.id).toBe('generation-iii');
    }
  });

  it('gives every shipped species the ability its own dex entry gives it', () => {
    const bySpecies = new Map(FRLG.species.map((row) => [row.name, row.abilities]));
    for (const base of Object.values(SPECIES_BY_ID)) {
      const canon = bySpecies.get(base.id);
      expect(canon, `${base.id} is not one of the 151`).toBeDefined();
      if (base.abilityId === null) {
        // A species is allowed no ability only where every ability it could
        // have is one this engine cannot express - which is what
        // `tools/abilities/coverage.mjs` lists, with the reason.
        for (const name of canon!) {
          expect(ABILITIES_BY_ID[name], `${base.id} could carry ${name}, which is shipped`).toBeUndefined();
        }
        continue;
      }
      // Generation III gives a Pokemon **one of** its species' slots and a save
      // records nothing about which, so every member of a species plays the
      // same: the first slot this engine can express. Eight of the 151 play
      // their second because their first is one of the ten abilities that have
      // no hook - a Psyduck with Cloud Nine is a Psyduck canon allows, and it
      // is a better answer than a Psyduck with nothing.
      expect(canon, base.id).toContain(base.abilityId);
      const skipped = canon!.slice(0, canon!.indexOf(base.abilityId));
      for (const name of skipped) {
        expect(ABILITIES_BY_ID[name], `${base.id} skipped ${name}, which is shipped`).toBeUndefined();
      }
    }
  });

  it('flags every move in the catalogue the way its own entry flags it', () => {
    // The snapshot covers every move the 151 learn by levelling plus the six
    // the machines teach, which is a superset of the catalogue: a move the
    // engine cannot express has a row here and no `MoveBase`.
    const flags = new Map(MOVE_FLAGS.map((row) => [row.name, row.flags]));
    for (const [identifier, move] of Object.entries(MOVE_CATALOGUE)) {
      const row = flags.get(identifier);
      expect(row, `${identifier} has no row in the flag snapshot`).toBeDefined();
      expect([...move.flags].sort(), identifier).toEqual([...row!].sort());
    }
  });

  it('keeps a contact flag on every move an ability could answer', () => {
    // Static and the three like it read `MoveFlag.Contact` and nothing else, so
    // a physical move shipped without the flag is an ability quietly not
    // working - which is exactly how the older half of the catalogue shipped.
    const contact = new Set(
      MOVE_FLAGS.filter((row) => row.flags.includes('contact')).map((row) => row.name),
    );
    expect(contact.size).toBeGreaterThan(12);
    const shipped = Object.entries(MOVE_CATALOGUE).filter(([, move]) =>
      move.flags.includes(MoveFlag.Contact),
    );
    expect(shipped.map(([identifier]) => identifier).sort()).toEqual(
      Object.keys(MOVE_CATALOGUE).filter((identifier) => contact.has(identifier)).sort(),
    );
  });
});

describe('an ability is visible', () => {
  /**
   * Everything an ability can do has to arrive as a line the player reads,
   * because an ability is never shown in a menu and watching it happen is the
   * only way to learn what one does. A kind with no line is an ability that
   * works and cannot be learned.
   */
  const KINDS: readonly AbilityEffectKind[] = [
    'powered-up',
    'sharpened',
    'shrugged-off',
    'hardened',
    'absorbed',
    'blocked-status',
    'blocked-boost',
    'blocked-secondaries',
    'no-recoil',
    'shed',
    'cured-on-switch',
    'reflected',
    'contact',
    'sent-out',
    'quickened',
    'hidden',
    'weathered-out',
  ];

  it('has a line and a sound for every kind of thing an ability does', () => {
    for (const effect of KINDS) {
      const event: BattleEvent = {
        type: 'ability',
        user: 'player',
        name: 'Subject',
        ability: 'TEST ABILITY',
        effect,
        status: 'burn',
        stat: 'attack',
        amount: 3,
      };
      const line = eventToMessage(event);
      expect(line, effect).toContain('TEST ABILITY');
      expect(line, effect).not.toContain('did something');
      expect(battleEventSound(event), effect).not.toBeNull();
    }
  });

  it('names the ability that every hook in the catalogue belongs to', () => {
    // Each kind is reachable, so none of the wording above is dead.
    expect(ABILITIES.some((ability) => ability.modifyAttack)).toBe(true);
    expect(ABILITIES.some((ability) => ability.absorbsMoveType)).toBe(true);
    expect(ABILITIES.some((ability) => ability.onDamagingHit)).toBe(true);
    expect(ABILITIES.some((ability) => ability.onSendOut)).toBe(true);
    expect(ABILITIES.some((ability) => ability.preventsEscape)).toBe(true);
    expect(ABILITIES.some((ability) => ability.modifySpeed)).toBe(true);
    expect(ABILITIES.some((ability) => ability.suppressesWeather)).toBe(true);
  });
});
