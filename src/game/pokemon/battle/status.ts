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
