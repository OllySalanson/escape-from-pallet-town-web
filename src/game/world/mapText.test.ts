import { describe, expect, it } from 'vitest';
import { foldedSlug, isMapText, MAP_TEXT_EXTRA, refusedTextNote, typedMapText } from './mapText';

describe('the writing a map may use', () => {
  it('takes English, accented Latin and common punctuation', () => {
    for (const text of [
      'Mill Brook',
      'Café Élan',
      'Łódź Śródmieście',
      'Ærø Færge',
      'Straße nach Köln',
      'İstanbul Çarşı',
      'Brașov Țara',
      '¿Qué pasa? ¡Olé!',
      '“Mind the gap” – it’s… «deep»',
      'Ten past 9: £5 or €6, 20° out',
    ]) {
      expect(isMapText(text), text).toBe(true);
    }
  });

  it('refuses emoji, right-to-left scripts and everything that draws nothing', () => {
    for (const text of [
      'Bug 🐛 Lane',
      'שלום',
      'سلام',
      'Odd ‮text',
      '​',
      'Line one\nLine two',
      'Bell\u0007',
      'Tab\there',
      'Ĉu ne?',
      '日本',
      'Fish & chips',
      '<b>',
    ]) {
      expect(isMapText(text), JSON.stringify(text)).toBe(false);
    }
  });

  it('is only letters the typeface draws', () => {
    // Read off orange-kid.woff2's character map: the face has every one of these.
    expect([...MAP_TEXT_EXTRA].filter((character) => /[ĈĉĜĝĤĥĴĵŜŝſĸŉ×÷]/.test(character))).toEqual([]);
  });

  it('takes out what a field cannot hold as it is typed, whole characters at a time, and says why', () => {
    const typed = typedMapText('Bug 🐛🐛 Lane ⚡');
    expect(typed.text).toBe('Bug  Lane ');
    expect(typed.refused).toEqual(['🐛', '⚡']);
    // What went is never echoed back: an emoji is a box in the face, and a
    // right-to-left letter turns the words around it backwards.
    expect(refusedTextNote(typed.refused)).toBe(
      'Those are not used in maps. Maps use letters (accents too), digits and common punctuation - no emoji or other scripts yet, and no < > & or ".',
    );
    expect(refusedTextNote(['ש'])).toMatch(/^That is not used in maps\./);
  });

  it('keeps line breaks only in a box of lines', () => {
    expect(typedMapText('One\nTwo').text).toBe('OneTwo');
    expect(typedMapText('One\nTwo', { lines: true }).text).toBe('One\nTwo');
  });

  it('slugs a name with its accents taken off, so Café and Cafe are one place', () => {
    expect(foldedSlug('Café Élan')).toBe('cafe-elan');
    expect(foldedSlug('Straße')).toBe('strasse');
    expect(foldedSlug('Łódź')).toBe('lodz');
    expect(foldedSlug('Ærø')).toBe('aero');
    expect(foldedSlug('Old Road')).toBe('old-road');
  });
});
