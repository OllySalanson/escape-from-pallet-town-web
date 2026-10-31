/**
 * GREYSTONE PEAKS, the high ground above The Crossing.
 *
 * The one idea: a pass climbs past quarry benches to the mouth of the
 * Greystone Caves, and the river is born in a tarn under the summit. The way
 * up from High Moor climbs through a cutting in a band of rock, past the tarn
 * where the river starts, round its head under the summit and down its far
 * side, squeezed between the water and the cliff the caves open in. Under the
 * cliff the quarry is worked in benches; a ledge off the upper bench is the
 * quick way back down. The pass goes on south to The Crossing, and a path
 * nobody signs leaves the quarry east into the pines.
 *
 * Drawn as the moor and the river taught: rock in masses against the walls,
 * never a ruled band or a scatter of boulders; the pass bent by the land;
 * places along the way rather than a pattern; and tall grass on the slopes
 * rather than lawn.
 *
 * Filled on 31 October 2026, the third ring out from Mill Square: the walk up is
 * a working mountain now. The navvies who have been widening the cutting for
 * thirty years, the ponies up for the summer, the goats that are not goats, the
 * tarn with its fisher and its shape redrawn (it was a swimming bath), the bothy
 * at the head of the pass, the lamp seller at the cave mouth, the quarry with
 * somebody actually quarrying it, the stone carts waiting on the way down, Mrs
 * Gantry's stores and a man on the shelf who is waiting to see the summit.
 *
 * The Greystone Caves open at the foot of the cliff, at the plan's spot: the
 * mouth onto their top floor, whose floors ride in Tanglewood's file
 * (`greystoneCaves.ts`).
 */
import type { MapFile, MapFileOutdoorBuildingKind } from '../../../../src/game/world/mapFile';
import { caveMouthSpots, plantCaveMouth } from '../../caves';
import type { MapcraftResult } from '../../report';
import { districtFile } from '../../stitch';
import { planLimits, startDistrict } from '../../worldPlan';
import { caveLadders, caveMouthLink, greystoneCaves } from './greystoneCaves';
import { withInside } from './insides';
import { GREYSTONE_VALE } from './plan';

export function greystonePeaks(): MapcraftResult {
  const p = startDistrict(GREYSTONE_VALE, 'greystone-peaks');

  /** A thing stood on whatever ground is there, rather than on a lot of lawn. */
  const stand = (kind: MapFileOutdoorBuildingKind, x: number, y: number, lot = p.at(x, y) ?? '.') => {
    p.building(kind, x, y, { lot });
  };

  // -- Two framed ways, the climb and the descent, with the gorge between ----------
  p.meadow(8, 4, 44, 56);

  // -- The tarn under the summit, and the gorge the river cuts from it -------------
  p.draw(19, 7, [
    '  WWWWWWWWWWWWWWW  ',
    ' WWWWWWWWWWWWWWWWW ',
    'WWWWWWWWWWWWWWWWWW ',
    'WWWWWWWWWWWWWWWWWW ',
    ' WWWWWWWWWWWWWWWW  ',
    '  WWWWWWWWWWWWWW   ',
    '    WWWWWWWWWWW    ',
  ]);
  p.rock(22, 14, 6, 10).rock(24, 24, 4, 14).rock(22, 38, 6, 8).rock(24, 46, 4, 14);
  p.rock(32, 14, 4, 8).rock(32, 22, 6, 10).rock(32, 32, 4, 14).rock(32, 46, 6, 6).rock(32, 52, 4, 8);
  p.river([[28, 12], [28, 63]], { width: 4 });

  // -- The climb: the summit's shoulder, a shelf of tall grass, the cutting ----------
  p.rock(2, 4, 8, 30).rock(10, 4, 6, 8); // the climb's west wall: the summit's cliff
  p.bed(10, 12, 6, 8, { round: false });
  p.bed(18, 14, 4, 6, { round: false });
  p.rock(10, 22, 4, 6).rock(18, 22, 6, 6); // the band, from the cliff to the gorge, cut through
  p.bed(18, 28, 6, 8, { round: false });
  p.bed(10, 28, 4, 6, { round: false });
  p.rock(8, 46, 6, 8); // an outcrop on the lower slope
  p.bed(14, 40, 8, 6, { round: false });
  p.wood(16, 52, 8, 8);
  p.meadow(6, 56, 2, 2); // a nook in the wood, where the goat track goes over the hill
  // THE HIGH PASTURE: the lawn under the outcrop fenced for the ponies that
  // summer up here, a gate at each end, so the goat track's way up goes
  // through it rather than round. Its south fence stands a row clear of the
  // wood, or the pines' tips hang over it.
  p.yard(14, 46, 10, 5, { gates: [[16, 46], [15, 50]], inner: '.' });

  // -- The cliff the caves open in, joined to the crag over the quarry ---------------
  p.rock(48, 4, 10, 6);
  p.rock(40, 8, 8, 14);
  p.block(48, 10, 10, 8, 'v'); // the upper bench, cut back into the hill
  p.building('shed', 52, 11, { lot: 'v' });
  p.building('crate-stack', 50, 14, { lot: 'v' });
  p.meadow(52, 18, 6, 6); // the bench's foot
  p.ledge(51, 57, 18); // off the upper bench, the quick way down
  p.bedRows([19, 51, 56], [20, 52, 56]);

  // -- The descent below the cave front ------------------------------------------
  p.bed(38, 26, 6, 8, { round: false });
  p.rock(48, 26, 10, 18); // the peaks' east cliff
  p.wood(38, 38, 4, 6);
  p.wood(38, 54, 6, 6).wood(48, 48, 4, 12);

  // -- The pass, drawn last so nothing cuts it ---------------------------------------
  p.road(
    [[0, 36], [14, 36], [14, 30], [16, 30], [16, 20], [16, 4], [37, 4], [37, 22], [49, 22]],
    { width: 3 },
  ); // in from High Moor, through the cutting, past the tarn, round its head, down under the cliff
  p.road([[48, 12], [48, 21]]); // up onto the upper bench
  p.road([[44, 25], [44, 46], [46, 46], [46, 62]], { width: 3 }); // on down to The Crossing
  p.trail([[52, 22], [62, 22]]); // the unsigned path east into the pines

  // -- The navvies' camp, at the foot of the cutting, where the pass was driven through ----
  p.building('hut', 9, 39);
  p.building('crate-stack', 12, 39);
  p.building('barrels', 8, 42);
  p.building('log', 11, 43);
  p.building('big-stump', 12, 41);
  p.flowers([9, 35], [14, 34]);

  // -- The ranger's post, on the lower pass, in what used to be a bed of grass ----------
  p.building('shed', 39, 46);
  p.building('barrel', 43, 47);
  p.building('sack', 38, 51);
  p.flowers([43, 50], [38, 45]);

  // -- The tarn's own: a fisher's seat, and rock showing through the cold water ---------
  stand('wet-rock', 24, 9, 'W');
  stand('wet-rock', 33, 10, 'W');
  stand('log', 18, 11);
  p.flowers([19, 8], [20, 12], [36, 8], [35, 12]);

  // -- The bothy, at the head of the pass: a roof, a bench, and the kettle ---------------
  p.building('hut', 42, 4);
  stand('bench', 45, 6);
  p.flowers([40, 6], [44, 7]);

  // -- The shelf, west of the climb, where a man is waiting for a view -------------------
  stand('bench', 11, 17);
  stand('stump', 14, 14);

  // -- The cutting: what came out of it is still lying about ---------------------------
  stand('rock', 14, 22);
  stand('rock', 14, 28);
  stand('round-boulder', 11, 28);
  stand('rock', 15, 33);
  p.flowers([19, 37], [17, 38]);

  // -- The navvies' camp, grown to what thirty years will do ---------------------------

  // -- The goat track: the nook under the outcrop -----------------------------------------
  stand('log', 10, 58);
  stand('stump', 12, 55);
  stand('big-stump', 8, 54);
  p.flowers([12, 54], [13, 57], [9, 56]);

  // -- The high pasture's hay ------------------------------------------------------------------
  stand('sack', 22, 47);
  stand('sack', 17, 49);

  // -- The cave front: a lamp seller, because somebody always forgets ---------------------------
  stand('barrels', 38, 25);
  stand('sack', 40, 25);
  p.flowers([47, 25], [38, 24]);

  // -- The stone carts, waiting for the road to clear --------------------------------------------
  stand('round-boulder', 38, 34);
  stand('crate-pair', 40, 34);
  stand('rock', 42, 35);
  stand('rock', 43, 34);

  // -- Mrs Gantry's stores: rope, tea and more rope ---------------------------------------------
  p.meadow(38, 38, 6, 6);
  p.building('grey-house', 38, 37);
  stand('barrel', 43, 39);
  stand('sack', 43, 38);
  stand('pot-plant', 42, 42);
  p.flowers([38, 43], [43, 43]);

  // -- The last bench on the way down ----------------------------------------------------------------
  stand('bench', 42, 52);
  stand('stump', 44, 55);
  p.flowers([43, 51], [44, 53]);

  // -- The quarry at work: the benches, the blocks and what lifts them ----------------------------------
  stand('rock', 48, 10);
  stand('rock', 48, 11);
  stand('round-boulder', 50, 12);
  stand('barrel', 57, 10);

  // -- The col east: a walker's cairn, on the path nobody signs ------------------------------------------
  stand('rock', 54, 21);
  stand('rock', 55, 21);
  stand('rock', 54, 20);
  p.flowers([56, 21], [60, 21]);

  // -- The way underground: the Greystone Caves open at the foot of the cliff -------
  const mouth = caveMouthSpots(p, { x: 40, y: 18, width: 8, height: 6 }).find(([x]) => x === 42);
  if (!mouth) throw new Error('the cliff has no foot for a cave mouth');
  plantCaveMouth(p, mouth);
  const cave = greystoneCaves();

  const file = districtFile(GREYSTONE_VALE, 'greystone-peaks', p, {
    // A way out of the peaks' own, in a nook at the foot of the climb: the
    // pass's planned ways on are south and east, and without this the
    // hunter's blind window would not cover the walk out of the west side
    // (`hunterFlee.test.ts`), as the woods' hidden ways out answer it there.
    exits: [{ x: 6, y: 57, name: 'Goat Track', opens: { when: 'always' } }],
    dropIns: [{ x: 56, y: 13, name: 'The Quarry', description: 'The quarry bench under the crag, beside the cliff the Greystone Caves open in.' }],
    itemSpots: [
      { x: 11, y: 13 },
      { x: 56, y: 19 },
      { x: 18, y: 47, hidden: true },
      { x: 47, y: 4, hidden: true },
      { x: 12, y: 30, hidden: true },
      { x: 51, y: 20 },
      { x: 12, y: 57 },
    ],
    extra: {
      // The quarry and the shelf stay plain GREYSTONE PEAKS: a place's own finds
      // (`filePrizes.ts`, Brock's crate) are seated in what is not named otherwise.
      districts: [
        { name: 'THE TARN', x: 16, y: 7, width: 24, height: 7, wildlife: 'field' },
        { name: 'THE BOTHY', x: 40, y: 4, width: 8, height: 4, wildlife: 'field' },
        { name: 'THE CUTTING', x: 10, y: 22, width: 12, height: 12, wildlife: 'field' },
        { name: 'THE NAVVIES’ CAMP', x: 6, y: 38, width: 10, height: 8, wildlife: 'field' },
        { name: 'THE HIGH PASTURE', x: 14, y: 46, width: 10, height: 5, wildlife: 'field' },
        { name: 'THE GOAT TRACK', x: 6, y: 52, width: 10, height: 8, wildlife: 'field' },
        { name: 'THE STONE CARTS', x: 38, y: 26, width: 6, height: 11, wildlife: 'field' },
        { name: 'GANTRY’S STORES', x: 38, y: 37, width: 6, height: 7, wildlife: 'field' },
      ],
      signs: [
        { x: 13, y: 38, lines: ['GREYSTONE PEAKS', 'The pass climbs through the cutting and round the head of the tarn.'] },
        { x: 20, y: 6, lines: ['THE TARN', 'The river starts here, under the summit.'] },
        { x: 17, y: 47, lines: ['THE HIGH PASTURE', 'Shut the gate behind you. The ponies wander.'] },
        { x: 44, y: 57, lines: ['THE PASS', 'Down: The Crossing. Up: the caves, the quarry and the tarn.'] },
        { x: 11, y: 38, lines: ['THE CUTTING', 'Driven through by hand. Do not ask whose. Falling rock: yes.'] },
        { x: 42, y: 51, lines: ['RANGER POST', 'Lost? Stay where you are. Somebody will be along. That somebody is also lost.'] },
        { x: 40, y: 7, lines: ['THE BOTHY', 'Free to all. Leave it as you found it. Please find it better than this.'] },
        { x: 43, y: 25, lines: ['GREYSTONE CAVES', 'Bring a lamp. If you have not brought a lamp, there is a woman who is very pleased to see you.'] },
        { x: 43, y: 41, lines: ['GANTRY’S STORES', 'Rope. Tea. More rope. Do not ask for anything else, she will only sell you rope.'] },
        { x: 15, y: 54, lines: ['THE GOAT TRACK', 'Over the hill and away, west of the pasture. Goats have right of way. They are not goats.'] },
        { x: 10, y: 15, lines: ['THE SUMMIT', 'Stormcrown, above you. Nobody has found a way up it from here. It only goes up from under.'] },
      ],
      people: [
        // -- The tarn and the bothy ----------------------------------------------------------
        { x: 20, y: 13, name: 'Tarn Fisher', look: 'fisherman', facing: 'up', lines: ['Coldest water in the vale. A fish that lives in this is not in the mood to be caught.', 'I have been here since before the river was. I started it, for all you know.'], calls: ['Too cold to bite.'] },
        { x: 36, y: 13, name: 'Sketcher', look: 'beauty', facing: 'left', lines: ['I am painting the tarn. It has been raining in the painting for three weeks.', 'It is not raining here. That is just how it has turned out.'], beat: { everyMs: 3900, glances: ['left', 'down'] }, calls: ['Do not move. Oh, you moved.'] },
        { x: 41, y: 4, name: 'Bothy Keeper', look: 'old-man', facing: 'down', lines: ['Nobody owns the bothy. I just happen to have been here since the war, and I do the kettle.', 'If you came up past the tarn you are halfway. Halfway to what depends on the fog.'], beat: { everyMs: 4000, glances: ['left', 'right'] }, calls: ['Kettle is on.'] },
        // -- The shelf -----------------------------------------------------------------------
        { x: 14, y: 17, name: 'Cloud Watcher', look: 'gentleman', facing: 'up', lines: ['There is a summit up there. Stormcrown. You can see it two days a year, and I have seen it once.', 'There is no way up from this side. They say the only road to it starts at the very bottom of the caves.'], beat: { everyMs: 4700, glances: ['up'] }, calls: ['It might clear in a minute.'] },
        { x: 15, y: 26, name: 'Rock Picker', look: 'hiker', facing: 'right', lines: ['It is all the same rock. People pay for it anyway. I do not tell them.', 'Further up it is the same rock again, and colder.'], beat: { everyMs: 3400, glances: ['up', 'down'] }, calls: ['Same rock. Same rock.'] },
        { x: 21, y: 16, name: 'Climber', look: 'hiker', facing: 'right', lines: ['The river is born in this tarn. Follow it down and you come to The Crossing.'] },
        { x: 14, y: 39, name: 'Ganger', look: 'heavy-man', facing: 'down', lines: ['Thirty years we have been widening this cutting. It is getting narrower.', 'Nobody can tell me why. I have stopped asking the rock.'], beat: { everyMs: 3300, roam: [[0, 1]], glances: ['right', 'down'] }, calls: ['Put your backs into it!'] },
        { x: 13, y: 44, name: 'Navvy', look: 'worker', facing: 'up', lines: ['Dig, carry, tip. Dig, carry, tip. The Machop does the carrying.', 'I have asked what I am for. They said digging. The Machop digs too.'], beat: { everyMs: 2600, glances: ['left', 'up'] }, calls: ['Tipping!'] },
        { x: 20, y: 47, name: 'Pony Girl', look: 'lass', facing: 'down', lines: ['They come up here for the summer. I come up here because they will not come down.', 'Shut the gate when you go. That one knows how to open it, but it likes to be asked.'], beat: { everyMs: 3100, glances: ['left'] }, calls: ['Easy, easy now.'] },
        // -- The cave front ----------------------------------------------------------------------
        { x: 41, y: 26, name: 'Lamp Seller', look: 'old-woman', facing: 'up', lines: ['Lamps. Two for the price of three. You would be amazed how many people go in without one.', 'You would not be amazed how many come out. Top floor down from here, and it gets worse.'], beat: { everyMs: 3300, glances: ['up', 'right'] }, calls: ['Lamps! Lovely lamps!'] },
        // -- The quarry --------------------------------------------------------------------------
        { x: 49, y: 13, name: 'Foreman', look: 'worker', facing: 'right', lines: ['Every step in Millbrook came off this bench, and every statue at The Crossing.', 'Somebody left a good crate of tools up here and has not been back. Big lad. Very serious.'], beat: { everyMs: 3200, glances: ['right', 'down'] }, calls: ['Stand clear!', 'Mind your head!'] },
        { x: 53, y: 17, name: 'Quarryman', look: 'heavy-man', facing: 'up', lines: ['You hit it till it breaks. Then there are two of it. Then you hit that.', 'Thirty years in, and there is more of it than when I started.'], beat: { everyMs: 2700, roam: [[1, 0]], glances: ['up'] }, calls: ['Clang!'] },
        // -- The stone carts ------------------------------------------------------------------------
        { x: 43, y: 37, name: 'Stone Carter', look: 'man', facing: 'right', lines: ['Going down full, coming up empty. You would think that was the easy way round.', 'That is what the last horse thought.'], beat: { everyMs: 3000, glances: ['right', 'up'] }, calls: ['Whoa! Hold her there!'] },
        { x: 39, y: 36, name: 'Carter’s Lad', look: 'boy', facing: 'left', lines: ['That Mankey up on the edge throws things at the carts. It has got a very good arm.', 'I threw one back. It kept it.'], beat: { everyMs: 1900, glances: ['left', 'up'] }, calls: ['Oi! Put that back!'] },
        // -- The goat track --------------------------------------------------------------------------
        { x: 11, y: 55, name: 'Goat Boy', look: 'little-boy', facing: 'right', lines: ['These are my goats. They are very good goats. Mum says they are Rhyhorn.', 'I have told them. They do not mind.'], beat: { everyMs: 2400, roam: [[0, 1]], glances: ['right'] }, calls: ['Here, goat! Good goat!'] },
        {
          x: 49,
          y: 45,
          name: 'Mountain Ranger',
          look: 'camper',
          facing: 'left',
          lines: ['Lost on the hill? The Goat Track leaves through the pasture, west of the gorge.', 'Everybody who comes down that pass is sure they know the way. I have a very good chair.'],
          beat: { everyMs: 3700, glances: ['up', 'down'] },
          calls: ['All right up there?'],
        },
      ],
      // The ponies in the pasture, and the Mankey troop that sits on the gorge's
      // edge watching whoever comes down the pass.
      pokemon: [
        { x: 19, y: 48, species: 'ponyta', level: 10 },
        { x: 45, y: 58, species: 'geodude', level: 8 },
        { x: 9, y: 45, species: 'machop', beat: { everyMs: 1500, roam: [[1, 0]] } },
        { x: 15, y: 38, species: 'geodude' },
        { x: 42, y: 45, species: 'spearow', beat: { everyMs: 1300, roam: [[0, -1]] } },
        { x: 40, y: 52, species: 'rattata', level: 8, beat: { everyMs: 1500, roam: [[1, 0]] } },
        { x: 21, y: 49, species: 'ponyta' },
        { x: 37, y: 34, species: 'mankey', level: 9 },
        { x: 36, y: 44, species: 'mankey' },
        { x: 34, y: 13, species: 'psyduck' },
        { x: 22, y: 13, species: 'poliwag', level: 8 },
        { x: 46, y: 5, species: 'pidgey', beat: { everyMs: 1500, roam: [[1, 0]] } },
        { x: 14, y: 25, species: 'machop', level: 9 },
        { x: 13, y: 56, species: 'rhyhorn', level: 11 },
        { x: 14, y: 57, species: 'rhyhorn', beat: { everyMs: 3000, roam: [[0, 1]] } },
        { x: 56, y: 17, species: 'machop', beat: { everyMs: 1600, roam: [[1, 0]] } },
        { x: 50, y: 11, species: 'machoke', level: 14 },
        { x: 57, y: 13, species: 'geodude', beat: { everyMs: 2800, roam: [[0, -1]] } },
        { x: 41, y: 31, species: 'sandshrew', level: 9 },
        { x: 38, y: 42, species: 'meowth', beat: { everyMs: 2100, roam: [[0, 1]] } },
      ],
      // A rowan by the head of the pass.
      berryTrees: [{ x: 45, y: 5, berry: 'oran' }],
      trainers: [
        { x: 56, y: 15, name: 'Breaker Finn', team: 'breaker', look: 'black-belt', facing: 'left', sight: 0, lines: ['This quarry is closed to visitors!', 'Unless you can break through me.'] },
        { x: 21, y: 32, name: 'Hiker Pell', team: 'drover', look: 'hiker', facing: 'left', sight: 0, lines: ['It is all uphill from here. It was all uphill from there too. Fight me while I get my breath.'] },
        { x: 57, y: 21, name: 'Walker Oona', team: 'scout', look: 'picnicker', facing: 'left', sight: 0, lines: ['This is not on any map, this path. How did you find it? Tell me after!'] },
      ],
      landmarks: [{ x: 55, y: 15, name: 'Quarry Hut', kind: 'shed' }],
      // The floors ride in Tanglewood's file too; carried here as well, so the
      // peaks pass their checks alone, the stitcher takes them once.
      areas: cave.areas,
      links: [caveMouthLink(cave, 'peaks', mouth), ...caveLadders(cave)],
    },
  });
  return { file: withInsides(file), notes: p.notes, limits: planLimits(GREYSTONE_VALE) };
}

/** The roofs on the way up, and who is under them. */
function withInsides(file: MapFile): MapFile {
  let next = withInside(file, 'peaks', 'hut', 42, 4, 'The Kettle Room', [], { itemSpots: [{ x: 5, y: 3, hidden: true }] });
  next = withInside(next, 'peaks', 'grey-house', 38, 37, 'Mrs Gantry’s Shop', [
    { x: 3, y: 3, name: 'Mrs Gantry', look: 'old-woman', facing: 'down', lines: ['Rope? I have got rope. I have got tea, if you do not want rope.', 'Everybody who goes up that pass wants rope on the way back. They never think of it on the way up.'] },
  ]);
  next = withInside(next, 'peaks', 'shed', 52, 11, 'The Quarry Hut', [
    { x: 5, y: 5, name: 'Tally Clerk', look: 'clerk', facing: 'left', lines: ['Tons out: forty thousand. Tons left: all of it.', 'I have sent the figures to Millbrook. They have asked me to stop.'] },
  ]);
  return next;
}
