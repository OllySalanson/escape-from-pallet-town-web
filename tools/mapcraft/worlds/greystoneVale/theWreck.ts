/**
 * THE WRECK, the east cape where the vale meets the open sea.
 *
 * The one idea: a liner has run aground on the reef off the cape, and the
 * salvage camp on the beach below the cliffs picks it over. The road from the
 * orchards runs out along the cliff top past the salvage master's house and
 * goes down a cleft in the cliffs to the beach; the camp's pier is where the
 * salvage launch puts in, a while into a raid. The reef is the only way out to
 * the wreck: a bar of sand at low water, with the cargo the sea has thrown up
 * along it. A trail comes down through the wood from the Safari Marsh.
 *
 * Drawn as the rest of the vale taught: the cliff top a framed corridor
 * between the wood and the cliff, the beach a band between the cliff and the
 * sea rather than a field of sand, rock in masses, a way down you can see from
 * either end, and FireRed's own harbour - its pier, its crates, its launch and
 * its liner - rather than another game's barrels and huts.
 */
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { SEAM_DEPTH, startDistrict } from '../../worldPlan';
import { GREYSTONE_VALE } from './plan';

export function theWreck(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'the-wreck');
  // The sea needs no wood to seal it: free the rim where the sea meets it,
  // east and south below the cliff top, and west below the beach, where it
  // runs on into the sea off the orchards.
  const rim: [number, number][] = [];
  for (let y = 34; y < p.height; y += 1) {
    for (let x = 0; x < p.width; x += 1) {
      const onRim =
        x >= p.width - SEAM_DEPTH || y >= p.height - SEAM_DEPTH || (x < SEAM_DEPTH && y >= 42);
      if (onRim && !(x >= p.width - SEAM_DEPTH && (y === 40 || y === 41))) rim.push([x, y]);
    }
  }
  p.unlock(rim);

  // -- The cliff top: a corridor between the wood and the cliff -----------------
  p.meadow(6, 16, 52, 16);
  p.wood(6, 16, 4, 6).wood(14, 16, 4, 10).wood(26, 16, 6, 4).wood(34, 16, 4, 8).wood(50, 16, 8, 4).wood(54, 20, 4, 6);
  p.bedRows([18, 18, 25], [19, 18, 25], [20, 18, 24], [21, 19, 24], [22, 20, 23]);
  p.bedRows([22, 6, 13], [23, 6, 13], [24, 6, 12], [25, 7, 11]);
  p.bedRows([18, 38, 47], [19, 38, 47], [20, 39, 46], [21, 40, 44]);
  p.bedRows([26, 18, 30], [27, 18, 31], [28, 20, 31], [29, 22, 30]);
  p.building('house', 46, 23); // the salvage master's house, above the camp
  p.flowers([45, 26], [51, 25], [51, 26]);

  // -- The cliff, in three masses, cleft where the camp road goes down ----------
  p.rock(6, 30, 18, 6).rock(28, 32, 16, 4).rock(48, 32, 4, 4).rock(52, 30, 6, 6);

  // -- The beach, a band between the cliff and the sea --------------------------
  p.block(6, 36, 52, 6, '~');
  p.block(0, 42, 64, 22, 'W').block(58, 34, 6, 8, 'W');
  p.draw(6, 36, ['WW', 'WWW', 'WW']); // the sea comes in at the cove's west end

  // -- The camp and its pier, FireRed's own harbour ------------------------------
  // The pier the salvage launch puts in at: on the flood tide it runs out to
  // Frostreef from the pier's end (The Ice Run, `plan.ts`), and the game draws
  // it moored there while it sails, so nothing stands in its water.
  p.block(50, 40, 14, 2, 'M');
  p.building('crate', 42, 37, { lot: '~' }).building('crate', 46, 37, { lot: '~' }).building('crate', 47, 38, { lot: '~' });

  // -- The reef: a bar of sand out to the wreck, the cargo thrown up along it ---
  p.block(22, 42, 6, 3, '~').block(24, 45, 8, 3, '~');
  p.building('ss-anne', 24, 48, { lot: 'W' }); // the wreck, aground on the reef
  p.building('rock', 23, 44, { lot: '~' }).building('rock', 30, 45, { lot: '~' });

  // -- Roads, drawn last so nothing cuts them -----------------------------------
  p.road([[0, 30], [12, 30], [12, 28], [32, 28], [32, 24], [44, 24], [44, 35]]); // along the cliff top, round the beds, and down the camp cleft
  p.road([[48, 27], [48, 26]]); // the house door
  p.trail([[20, 0], [20, 17]]); // down through the wood from the Safari Marsh

  const file = districtFile(GREYSTONE_VALE, 'the-wreck', p, {
    dropIns: [{ x: 43, y: 37, name: 'Salvage Camp', description: 'The salvage camp on the beach under the east cape, with the wreck out on the reef.' }],
    itemSpots: [{ x: 27, y: 45 }, { x: 31, y: 46 }, { x: 10, y: 37, hidden: true }],
    extra: {
      signs: [
        { x: 22, y: 27, lines: ['THE WRECK', 'The liner went onto the reef in the last storm. The camp is below the cliff.'] },
        { x: 28, y: 21, lines: ['THE CAPE', 'The wreck is out on the reef, past the camp. The pier is east.'] },
        { x: 54, y: 40, lines: ['THE ICE RUN', 'The launch runs out to Frostreef on the flood tide.', 'It sails from 2:00 until 4:00.'] },
      ],
      people: [
        { x: 12, y: 38, name: 'Beachcomber', look: 'fisherman', facing: 'right', lines: ['The bar to the wreck only shows at low water.', "Whatever the sea throws up on it is anybody's."] },
        { x: 55, y: 27, name: 'Salvager\'s Wife', look: 'woman', facing: 'left', lines: ['Ned has been out on that wreck since the tide turned.', 'If you see him, tell him his tea is cold.'] },
      ],
      trainers: [
        { x: 37, y: 40, name: 'Salvager Ned', team: 'raider', look: 'worker', facing: 'left', sight: 0, lines: ['This camp has first pick of the wreck!', 'You want a share, you earn it.'] },
      ],
      landmarks: [{ x: 56, y: 39, name: 'Salvage Pier', kind: 'jetty' }],
      // The cape's own: a Fearow over the north glade, a Bellsprout in the
      // west one, a Staryu washed up on the bar by the wreck.
      pokemon: [
        { x: 40, y: 17, species: 'fearow', level: 13 },
        { x: 11, y: 18, species: 'bellsprout' },
        { x: 26, y: 46, species: 'staryu', level: 11 },
      ],
    },
  });
  return { file, notes: p.notes };
}
