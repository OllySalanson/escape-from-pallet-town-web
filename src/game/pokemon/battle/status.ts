import { PokemonType } from '../PokemonType';

export const PrimaryStatus = {
  Poison: 'poison',
  Burn: 'burn',
  Paralysis: 'paralysis',
  Sleep: 'sleep',
  Freeze: 'freeze',
} as const;

export type PrimaryStatus = (typeof PrimaryStatus)[keyof typeof PrimaryStatus];

/**
 * Anything a move can inflict that the engine tracks on a combatant. It lives
 * here rather than in the engine because a move now *declares* what it inflicts
 * (`MoveEffects.status`) instead of being matched by name against a table of
 * four strings inside `applyMove`.
 */
export type StatusName = PrimaryStatus | 'confusion';

export const statusAbbreviation = (status: PrimaryStatus | null, confusionTurns: number): string | null => {
  if (status) {
    return {
      [PrimaryStatus.Poison]: 'PSN',
      [PrimaryStatus.Burn]: 'BRN',
      [PrimaryStatus.Paralysis]: 'PAR',
      [PrimaryStatus.Sleep]: 'SLP',
      [PrimaryStatus.Freeze]: 'FRZ',
    }[status];
  }

  return confusionTurns > 0 ? 'CNF' : null;
};

/**
 * The types generation III makes immune to a status, whatever inflicts it.
 *
 * Read off FireRed's `SetMoveEffect` (pret/pokefirered `battle_script_commands.c`
 * at 037335f): a Fire type cannot be burned, a Poison or Steel type cannot be
 * poisoned, an Ice type cannot be frozen. Sleep, paralysis and confusion have
 * no type that refuses them in generation III - an Electric type *can* be
 * paralysed, which is generation VI.
 *
 * This is separate from the type chart: Thunder Wave fails on a Ground type
 * because the *move* cannot touch it, and that is still asked of the chart.
 */
const IMMUNE_TYPES: Readonly<Partial<Record<StatusName, readonly PokemonType[]>>> = {
  [PrimaryStatus.Burn]: [PokemonType.Fire],
  [PrimaryStatus.Poison]: [PokemonType.Poison, PokemonType.Steel],
  [PrimaryStatus.Freeze]: [PokemonType.Ice],
};

export const typeRefusesStatus = (status: StatusName, types: readonly PokemonType[]): boolean =>
  (IMMUNE_TYPES[status] ?? []).some((immune) => types.includes(immune));
