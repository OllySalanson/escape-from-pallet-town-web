import { describe, expect, it } from 'vitest';
import { RAIDS_TO_A_LEVEL, dayCareBody, leaveHelp, type DayCareRow } from './dayCareView';

const row = (id: string, level: number, extra: Partial<DayCareRow> = {}): DayCareRow => ({
  id,
  pokemon: { name: id.toUpperCase(), level, currentHp: 20, maxHp: 20, isFainted: false, shiny: false, heldItemId: null, base: { id: 'oddish', dexId: 43 } },
  away: false,
  partner: false,
  ...extra,
});

describe("THE DAY-CARE's screen", () => {
  it('shows two raids as a level, as a sum of pictures, and the level it comes to', () => {
    expect(RAIDS_TO_A_LEVEL).toBe(2);
    const html = dayCareBody([row('oddish', 7)], { browse: '', note: '1 at base' });
    expect(html.match(/class="dc-raid"/g)).toHaveLength(2);
    expect(html).toContain('LV7');
    expect(html).toContain('LV8');
    expect(html).toContain('Leave ODDISH');
  });

  it('stands only the one under the cursor in the pen', () => {
    const html = dayCareBody([row('oddish', 7), row('pidgey', 6)], { browse: '', note: '2 at base' });
    expect(html).toMatch(/data-shown-by="oddish">/);
    expect(html).toMatch(/data-shown-by="pidgey" hidden>/);
  });

  it('says why he will not take one, and offers no button for it', () => {
    const html = dayCareBody([row('pidgey', 6, { refusal: 'It is out on a raid.' })], { browse: '', note: '' });
    expect(html).toContain('It is out on a raid.');
    expect(html).not.toContain('data-day-care-leave="pidgey"');
    expect(leaveHelp('ODDISH')).toBe('Leave ODDISH with him. Two raids, and it is a level up.');
  });

  it('says a Pokémon at the top of the curve is fully grown rather than promising a level', () => {
    const html = dayCareBody([row('mew', 100)], { browse: '', note: '' });
    expect(html).toContain('FULLY GROWN');
    expect(html).not.toContain('LV101');
  });
});
