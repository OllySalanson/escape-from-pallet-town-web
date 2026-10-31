import { describe, expect, it } from 'vitest';
import { getItemById } from '../items';
import { runInsertions } from '../run/runGeneration';
import { getWorldMap } from '../worldMap';
import { wayInCard, wayInCards } from './wayInCard';

const VALE = runInsertions().filter((insertion) => insertion.mapId === 'greystone-vale');
const landing = (insertion: (typeof VALE)[number]) => ({ id: insertion.id, tile: insertion.position });
const NOBODY = { surveyed: {} };

/** A save that has walked every tile of the vale. */
function walkedEverywhere() {
  const { width, height } = getWorldMap('greystone-vale');
  const bytes = new Uint8Array(Math.ceil((width * height) / 8)).fill(255);
  return { surveyed: { 'greystone-vale': { width, tiles: btoa(String.fromCharCode(...bytes)) } } };
}

describe('the card beside a way in', () => {
  it('names it and says where it is', () => {
    const [door] = VALE;
    const card = wayInCard(landing(door), NOBODY, false);
    expect(card.title).toBe(door.label.toUpperCase());
    expect(door.description.startsWith(card.lines[0].slice(0, -1))).toBe(true);
  });

  it('is small on every way in the vale has: a clause of its own words, and a line at most about what lives there', () => {
    expect(VALE.length).toBeGreaterThan(5);
    for (const walked of [NOBODY, walkedEverywhere()]) {
      for (const insertion of VALE) {
        const { lines } = wayInCard(landing(insertion), walked, false);
        expect(lines.length).toBeLessThanOrEqual(2);
        expect(lines[0].length).toBeLessThanOrEqual(58);
        expect(lines[0].endsWith('.')).toBe(true);
        expect((lines[1] ?? '').length).toBeLessThanOrEqual(58);
      }
    }
  });

  it('says nothing about what lives somewhere this save has not walked', () => {
    for (const insertion of VALE) {
      expect(wayInCard(landing(insertion), NOBODY, false).lines[1]).toBe('Not walked yet.');
    }
  });

  it('says what lives there once it has, and by night what comes out at night', () => {
    const walked = walkedEverywhere();
    const said = VALE.map((insertion) => wayInCard(landing(insertion), walked, false).lines[1] ?? '');
    expect(said.some((line) => line.startsWith('Wild: '))).toBe(true);
    const night = VALE.map((insertion) => wayInCard(landing(insertion), walked, true).lines[1] ?? '');
    expect(night.some((line) => line.startsWith('By night: '))).toBe(true);
  });

  it('never says what this raid holds', () => {
    const walked = walkedEverywhere();
    const map = getWorldMap('greystone-vale');
    const prizes = map.loot.map((loot) => getItemById(loot.itemId)?.displayName).filter((name): name is string => Boolean(name));
    for (const insertion of VALE) {
      const words = wayInCard(landing(insertion), walked, false).lines.join(' ');
      for (const prize of prizes) {
        expect(words).not.toContain(prize);
      }
    }
  });

  it('works a card out once for a look through the glass', () => {
    const cards = wayInCards(NOBODY, false);
    const [door] = VALE;
    expect(cards(landing(door))).toBe(cards(landing(door)));
  });
});
