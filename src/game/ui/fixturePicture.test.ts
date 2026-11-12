import { describe, expect, it } from 'vitest';
import { BASE_TILESET } from '../base/baseTileset';
import { WORKSHOP_UPGRADES } from '../hub/workshop';
import { fixtureArt, sourceOfTile } from './fixturePicture';

describe("what Brock's rungs build, drawn for a menu", () => {
  it('draws every rung as the props it plants in the yard', () => {
    for (const upgrade of WORKSHOP_UPGRADES) {
      const art = fixtureArt(upgrade.id);
      expect(art, upgrade.id).toBeDefined();
      expect(art!.tiles.length, upgrade.id).toBeGreaterThan(0);
      // Every tile inside the picture, on the 16-pixel grid.
      for (const tile of art!.tiles) {
        expect(tile.x % 16).toBe(0);
        expect(tile.y % 16).toBe(0);
        expect(tile.x).toBeLessThan(art!.width);
        expect(tile.y).toBeLessThan(art!.height);
      }
    }
  });

  it('is the mast as tall as it stands, and the ward as the hut with its colours beside it', () => {
    const tower = BASE_TILESET.props.tower;
    expect(fixtureArt('radio-mast')).toMatchObject({ width: tower.width * 16 });
    const ward = fixtureArt('quarantine-ward')!;
    expect(ward.width).toBe((BASE_TILESET.props.hut.width + BASE_TILESET.props.bannerPair.width) * 16);
  });

  it('finds every tile on one of the base sheets', () => {
    for (const upgrade of WORKSHOP_UPGRADES) {
      for (const tile of fixtureArt(upgrade.id)!.tiles) {
        expect(sourceOfTile(tile.tile), `${upgrade.id} tile ${tile.tile}`).toBeDefined();
      }
    }
  });
});
