import { describe, expect, it } from 'vitest';
import { seagallopLines } from './seagallopLog';

describe('the Seagallop\'s log, as her sailor tells it', () => {
  it('sends a newcomer to the Raid Arena', () => {
    expect(seagallopLines(undefined).join(' ')).toContain('RAID ARENA');
    expect(seagallopLines({}).join(' ')).toContain('RAID ARENA');
  });

  it('counts every raid on every map, and the ones that came home with their haul', () => {
    const lines = seagallopLines({
      'greystone-vale': { deployed: 5, extracted: 3, wiped: 2 },
      'route-1': { deployed: 1, extracted: 1, wiped: 0 },
    });
    expect(lines[0]).toContain('6 times');
    expect(lines[0]).toContain('4 times');
    expect(lines[1]).toContain('The other 2');
  });

  it('says once and twice, and has a word for a player who has lost none', () => {
    const lines = seagallopLines({ 'greystone-vale': { deployed: 2, extracted: 1, wiped: 1 } });
    expect(lines[0]).toContain('twice');
    expect(lines[0]).toContain('once');
    expect(lines[1]).toContain('The other one');
    expect(seagallopLines({ 'greystone-vale': { deployed: 3, extracted: 3, wiped: 0 } })[1]).toContain('Not lost one yet');
  });
});
