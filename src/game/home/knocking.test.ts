import { describe, expect, it } from 'vitest';
import {
  KNOCK_HINTS,
  KNOCK_TROUBLE,
  knockOutcomeLine,
  knockQuestion,
  knockScreenMarkup,
  notYoursLine,
  visitWelcomeLines,
  visitorThingName,
} from './knocking';

const AMY = '22222222-2222-4222-8222-222222222222';
const BOB = '33333333-3333-4333-8333-333333333333';

describe('knocking on a door', () => {
  it('lists every door in the harbour, who is in first, and starts the cursor on the first', () => {
    const markup = knockScreenMarkup({
      kind: 'houses',
      houses: [
        { id: AMY, name: 'AMY', atHome: true },
        { id: BOB, name: "O'NEIL", atHome: false },
      ],
    });
    expect(markup).toContain("AMY's house");
    expect(markup).toContain(`data-knock="${AMY}"`);
    expect(markup.indexOf(AMY)).toBeLessThan(markup.indexOf(BOB));
    expect(markup).toContain('data-cursor-start');
    expect(markup).toContain('Home');
    expect(markup).toContain('Out');
    expect(markup).toContain(KNOCK_HINTS);
    expect(markup).toContain('2 houses');
  });

  it('says plainly when there is nobody else, while it asks, while it knocks and when the harbour is not answering', () => {
    expect(knockScreenMarkup({ kind: 'houses', houses: [] })).toContain('Nobody else has a house yet');
    expect(knockScreenMarkup({ kind: 'asking' })).toContain('Asking the harbour');
    expect(knockScreenMarkup({ kind: 'knocking', name: 'AMY' })).toContain("Knocking on AMY's door");
    expect(knockScreenMarkup({ kind: 'trouble' })).toContain(KNOCK_TROUBLE);
  });

  it('says what came of a knock that was not a yes, in plain words', () => {
    expect(knockOutcomeLine('AMY', 'not-home')).toBe("AMY isn't home. Try again when they are.");
    expect(knockOutcomeLine('AMY', 'not-now')).toBe("AMY didn't let you in this time.");
    expect(knockOutcomeLine('AMY', 'gone')).toBe('Nobody came to the door.');
    expect(knockOutcomeLine('AMY', 'busy')).toMatch(/already at AMY's door/);
  });

  it('asks the owner by the knocker name, and tells a visitor whose house it is', () => {
    expect(knockQuestion('AMY')).toBe('AMY is at your door.');
    // One line of the dialogue box holds about 38 characters; the longest name is ten.
    expect(knockQuestion('WWWWWWWWWW').length).toBeLessThanOrEqual(30);
    expect(visitWelcomeLines('OLLY')[0]).toBe('OLLY lets you in.');
    expect(notYoursLine('OLLY')).toBe("That's OLLY's. Better not touch.");
    expect(visitorThingName('YOUR BED', 'OLLY')).toBe("OLLY'S BED");
    expect(visitorThingName('THE TELLY', 'OLLY')).toBe('THE TELLY');
  });
});
