import { describe, expect, it } from 'vitest';
import { partTag, partTags, shopCardPane } from './shopCard';

describe("the card on the right of Bill's and Brock's", () => {
  it('answers for one card at a time, by id', () => {
    const shown = shopCardPane({ id: 'potion', shown: true, head: { title: 'Potion', tone: 'gold' } });
    const hidden = shopCardPane({ id: 'potion', shown: false, head: { title: 'Potion', tone: 'gold' } });
    expect(shown).toContain('data-shown-by="potion">');
    expect(hidden).toContain('data-shown-by="potion" hidden');
  });

  it('draws its key as the key and its words, and nothing else when there is no key to press', () => {
    expect(shopCardPane({ id: 'a', shown: true, head: { title: 'A', tone: 'gold' }, go: { key: 'ENTER', label: 'Buy one' } })).toContain(
      '<span class="shop-key">ENTER</span><span>Buy one</span>',
    );
    expect(shopCardPane({ id: 'a', shown: true, head: { title: 'A', tone: 'ink' } })).not.toContain('shop-go');
  });
});

describe('a part tag', () => {
  it('is green when there is enough and grey with a drawn cross when not', () => {
    expect(partTag('<i></i>', 3, 3)).toBe('<span class="part-tag"><i></i><small>×3</small></span>');
    expect(partTag('<i></i>', 3, 2)).toBe('<span class="part-tag is-short"><span class="cost-mark" aria-hidden="true"></span><i></i><small>×3</small></span>');
  });

  it('says ALL HERE only when every part is covered', () => {
    expect(partTags([{ icon: '', quantity: 1, held: 1 }, { icon: '', quantity: 2, held: 5 }])).toContain('All here');
    expect(partTags([{ icon: '', quantity: 1, held: 1 }, { icon: '', quantity: 2, held: 1 }])).not.toContain('All here');
  });

  it('shows what holds a deal back in place of ALL HERE, never both', () => {
    const tags = partTags([{ icon: '', quantity: 1, held: 1 }], undefined, '<b>LOCK</b>');
    expect(tags).toContain('<b>LOCK</b>');
    expect(tags).not.toContain('All here');
  });
});
