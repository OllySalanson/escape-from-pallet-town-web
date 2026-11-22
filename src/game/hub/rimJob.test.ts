import { describe, expect, it } from 'vitest';
import { jobAsks } from './rimJob';

describe('what a job asks, on the rim', () => {
  it('follows the job name as a clause', () => {
    expect(jobAsks('Carry the dispatch case in Greystone Vale out through Deer Gap')).toBe(
      'carry the dispatch case in Greystone Vale out through Deer Gap',
    );
    expect(jobAsks('Read all 3 survey stakes in Greystone Vale.')).toBe('read all 3 survey stakes in Greystone Vale');
  });
});
