export const PrimaryStatus = {
  Poison: 'poison',
  Burn: 'burn',
  Paralysis: 'paralysis',
  Sleep: 'sleep',
  Freeze: 'freeze',
} as const;

export type PrimaryStatus = (typeof PrimaryStatus)[keyof typeof PrimaryStatus];

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
