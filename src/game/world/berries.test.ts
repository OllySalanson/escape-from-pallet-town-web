import { describe, expect, it } from 'vitest';
import { berryTreeLines } from './berries';

describe('a berry tree', () => {
  it('is "an ORAN BERRY tree" and "a SITRUS BERRY tree", never "a ORAN"', () => {
    expect(berryTreeLines('oran', false)[0]).toBe("It's an ORAN BERRY tree. It is heavy with berries.");
    expect(berryTreeLines('sitrus', false)[0]).toBe("It's a SITRUS BERRY tree. It is heavy with berries.");
  });
});
