import { FURNITURE } from './furniture';
import { PokemonParty } from '../pokemon';
import { DEFAULT_RAID_PROGRESS, deserializeGame, serializeGame, type RestoredGame } from '../save/SaveManager';
import { Stash } from '../stash';

/**
 * What a visitor is shown of somebody's house, and how they are shown it.
 *
 * The owner's browser saves a snapshot of only what THE BOLTHOLE is drawn from
 * (`base/rooms.ts`): where the furniture stands, the furniture found on raids
 * that is in the vault, the kinds the Pokédex holds (a doll each), the badges
 * won, the places come home from, and which starter it was (the rug). Nothing
 * else of the save leaves the device - no team, no items, no money, no raid.
 *
 * It is saved in the shape of a save file, because that makes reading it a
 * solved problem: the visitor's game passes it through `deserializeGame`, the
 * loader every save goes through, which checks every field and drops whatever
 * it does not understand. A snapshot is somebody else's browser talking, so it
 * is never read any other way. The database caps its size
 * (`HOUSE_SNAPSHOT_MAX_BYTES`, the migration holds the same number).
 */

export const HOUSE_SNAPSHOT_MAX_BYTES = 12_000;

const SNAPSHOT_MAP_ID = 'floodplain-relay';

/** The snapshot of this save's house, or null if it would not fit. */
export function houseSnapshot(game: RestoredGame): Record<string, unknown> | null {
  const stash = new Stash();
  for (const definition of FURNITURE) {
    if (definition.source.kind === 'found') {
      const count = game.stash.itemCount(definition.source.itemId);
      if (count > 0) {
        stash.addItem(definition.source.itemId, count);
      }
    }
  }
  const progress = game.raidProgress;
  const saved = serializeGame({
    party: new PokemonParty([]),
    // Where the player last stood is nobody's business, and a visitor may not
    // have a map the owner made: every snapshot says the same, a shipped map's corner.
    mapId: SNAPSHOT_MAP_ID,
    position: { x: 1, y: 1 },
    stash,
    raidProgress: {
      ...DEFAULT_RAID_PROGRESS,
      defeatedBosses: [...progress.defeatedBosses],
      raidRecord: { ...progress.raidRecord },
      ...(progress.homeLayout ? { homeLayout: progress.homeLayout } : {}),
      ...(progress.pokedexOwned ? { pokedexOwned: [...progress.pokedexOwned] } : {}),
    },
    starterSpeciesId: game.starterSpeciesId,
  });
  const snapshot = JSON.parse(JSON.stringify(saved)) as Record<string, unknown>;
  return new TextEncoder().encode(JSON.stringify(snapshot)).length <= HOUSE_SNAPSHOT_MAX_BYTES ? snapshot : null;
}

/** Somebody else's house, read through the save loader; null if it does not read as one. */
export function readHouseSnapshot(snapshot: unknown): RestoredGame | null {
  try {
    return deserializeGame(snapshot);
  } catch {
    return null;
  }
}
