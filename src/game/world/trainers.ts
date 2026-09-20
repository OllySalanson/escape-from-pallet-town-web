import type { HeldItemId } from '../items';
import { Pokemon } from '../pokemon';
import { BUTTERFREE, JIGGLYPUFF, PIDGEY, PIKACHU, SQUIRTLE, getSpeciesById } from '../pokemon/species';
import type { TrainerBattle } from '../pokemon/battle/battleEngine';
import type { Direction, GridPosition } from '../movement/gridMovement';
import type { CastCharacterDesignId } from './characterDesigns';
import type { TrainerWatch } from './trainerSight';
import type { WorldMapId } from '../worldMap';

export interface RunTrainerEncounter extends TrainerWatch {
  readonly mapId: WorldMapId;
  readonly position: GridPosition;
  readonly facing: Direction;
  /** Authored checkpoints retain their readable position across seeded runs. */
  readonly fixedPosition?: boolean;
  /**
   * How far ahead this trainer challenges on sight. Omitted is the old
   * behaviour - the player has to walk up and speak to them - which is still
   * what the three ordinary trainers outside the Floodplain route do. See
   * `trainerSight.ts` for why a watch and a body are not the same thing.
   */
  readonly sightRange?: number;
  /**
   * The character design this trainer is drawn from. Omitted is the shared
   * sheet under the amber trainer tint - see `characterPresentation.ts`.
   */
  readonly design?: CastCharacterDesignId;
  /**
   * Set on a boss: the trainer holding a gate shut. Beating one is recorded for
   * good in `raidProgress.defeatedBosses` under this id, every `MapGate` naming
   * it opens in that same raid, and the boss is not there on any later one - so
   * unlike every other trainer, a boss may stand in the lane it guards. The id
   * is what the save keeps, so it must never be reused for a different door.
   */
  readonly bossId?: string;
  /**
   * The gear this boss is carrying, handed to the player's pack the first time
   * they beat them.
   *
   * Only a boss may carry gear, and that is the whole of where gear comes from.
   * A boss is the one fight in the game that is already once per save - a beaten
   * one is dropped by `withoutDefeatedBosses` and what is left is the open gate -
   * so gear stays finite without a second list to keep it so. Everything else
   * that hands the player items repeats: field loot is drawn fresh every raid,
   * the standing board deals for as long as the player keeps banking, and the
   * wipe restock refills the kit. Gear that any of those produced would stop
   * being a decision by the fifth raid.
   *
   * It drops into the raid's own pack, not into the vault: the piece has to be
   * carried out past whatever is left of the clock and the hunter, and a wipe on
   * the way home loses it for good. That is the point of it - and it is why the
   * gate opens on the win rather than on the extraction, so a raid lost carrying
   * the gear still bought the door.
   */
  readonly carries?: HeldItemId;
  readonly introLines: readonly string[];
  readonly trainer: TrainerBattle;
}

/** The trainers who hold gates, in authored order. */
export const bossEncounters = (
  trainers: readonly RunTrainerEncounter[],
): readonly (RunTrainerEncounter & { readonly bossId: string })[] =>
  trainers.filter(
    (trainer): trainer is RunTrainerEncounter & { readonly bossId: string } =>
      trainer.bossId !== undefined,
  );

/**
 * A raid's trainers without the bosses already beaten. A boss is beaten once,
 * for good: what is left where they stood is the open gate, which the map
 * captions as open.
 */
export const withoutDefeatedBosses = (
  trainers: readonly RunTrainerEncounter[],
  defeatedBosses: readonly string[],
): readonly RunTrainerEncounter[] =>
  trainers.filter(
    (trainer) => trainer.bossId === undefined || !defeatedBosses.includes(trainer.bossId),
  );

/**
 * What the bosses just beaten were carrying, and the line that says so.
 *
 * Read from the trainers the raid actually generated, so a boss whose gear is
 * retired stops paying out without anything else changing, and returned as a
 * list rather than added anywhere: the gear belongs in the raid's own pack, and
 * only `WorldScene` holds that.
 */
export function bossGearDropped(
  trainers: readonly RunTrainerEncounter[],
  bossIds: readonly string[],
): readonly { readonly bossId: string; readonly name: string; readonly itemId: HeldItemId }[] {
  return bossEncounters(trainers)
    .filter((boss) => bossIds.includes(boss.bossId) && boss.carries !== undefined)
    .map((boss) => ({
      bossId: boss.bossId,
      name: boss.trainer.name,
      itemId: boss.carries as HeldItemId,
    }));
}

const createTrainer = (
  id: string,
  name: string,
  party: readonly Pokemon[],
  defeatText: string,
  /** Two puts a pair on the field at once - see `TrainerBattle.unitCount`. */
  unitCount = 1,
): TrainerBattle => ({ id, name, party, defeatText, unitCount });

/**
 * These encounters are created for each WorldScene so defeated trainers and
 * battle-only Pokemon state never leak between raids.
 */
export const createRunTrainerEncounters = (): readonly RunTrainerEncounter[] => [
  {
    // The price of the fast road. The shore road narrows to one tile between
    // thicket, and Maya looks straight up it - but from the tile *below* its
    // mouth, off the road, which runs east and west across in front of her. In
    // the narrows she would be a locked door; here the road is open and quick,
    // and what it costs is walking the four tiles she can see. The reeds leave
    // the road a row above the narrows and come back to it round underneath
    // her, never crossing her line, so they are a real way round. The tile at
    // 22,21 is one step outside her watch: the player reads her, and the price,
    // from a junction they can still turn round at.
    mapId: 'floodplain-relay',
    position: { x: 22, y: 26 },
    facing: 'up',
    fixedPosition: true,
    sightRange: 4,
    design: 'beauty',
    introLines: [
      'MAYA HAS THE ROAD IN SIGHT.',
      'The reeds go around. The road goes through me.',
    ],
    trainer: createTrainer(
      'floodplain-checkpoint-maya',
      'RAIDER MAYA',
      // The toll on the first road a new player walks, and the only authored
      // fight a fresh level-5 starter can be standing in front of ten steps
      // into its first raid. It is priced to be **paid**, not to be a door:
      // Maya holds no gate, carries no `bossId` and stands up again on every
      // later raid, so "come back stronger" buys nothing here that is not
      // bought again next time. What the road is worth is measured - from the
      // lost kit it is two steps and nine tall-grass steps shorter than the
      // reeds to the South Gate, and forty steps shorter to anything east - so
      // the price has to be a raid's supplies, not a raid.
      //
      // Two level-7s were a wall, not a toll. A level-5 starter has 16-17 HP
      // against their 38 and won 0% of the time with the whole pack open, 0% at
      // level 6, and at level 10 with nothing packed it was still 10% for the
      // Fire starter and 24% for the Grass one against 100% for the Water one -
      // which is a starter lottery on the first road of the game.
      //
      // Pidgey 3 and Pikachu 4 is the same two species at the level the reeds
      // around them hold, measured over the real engine at the level a player
      // actually arrives at, in the rain this place has (`trainerMeasure.ts`,
      // 800 trials, Potions drunk out of the pack exactly as `battleItems.ts`
      // charges them - a turn each). At level 5 on full HP with the loadout's
      // three Potions a starter wins 87/92/85%
      // (Charmander/Squirtle/Bulbasaur), spending 2.2 of the three and walking
      // away on about half to two thirds of its health; with two Potions
      // 74/80/67%; walking in at 60% health 67/76/66%; with an empty pack
      // 9/4/2%. By level 6 it is 96/96/94% and by level 7 one Potion is the
      // whole price. So the fight is decided by the condition you arrive in and
      // the supplies you are willing to spend on it - both of them things a
      // player chooses - and not by the 6.25% critical roll that decided it when
      // one hit was a third of the bar.
      //
      // It is fought in rain, because THE REEDBEDS is one of the three rain
      // districts (`districts.ts`), and that is measured too: rain is inert
      // while nobody has a typed move, and from level 7 it halves the Fire
      // starter's Ember, so bare the road comes free for a Charmander a level
      // after the other two. `floodplainCheckpoint.test.ts` reads the weather
      // off her own tile rather than naming it.
      //
      // Pidgey leads and Pikachu anchors, which is the other half of the tuning.
      // Pikachu is the only one of the two carrying Growl, and the enemy picks
      // uniformly at random among its moves, so leading with it drops the
      // player's Attack early and keeps it down for the whole fight - the same
      // party in the other order wins 38/40/33%. The Pidgey is the teaching
      // fight's own Pidgey at its own level: the opening battle is one of them,
      // and the checkpoint is that Pidgey with something behind it.
      [new Pokemon(PIDGEY, 3), new Pokemon(PIKACHU, 4)],
      'The checkpoint is open. Move before the hunter closes in.',
    ),
  },
  // The Floodplain's three doors, and who holds each. One fight opens two: the
  // door in front of the player, and a second somewhere they have already been,
  // so beating a boss is also finding out how the map was joined up all along.
  {
    // Holds the towered bridge off Market Isle, which is the only way east.
    // Beating him also lowers the chain on the orchard ford, so the way back
    // from the east bank is a wade to the square rather than the walk round.
    mapId: 'floodplain-relay',
    position: { x: 33, y: 33 },
    facing: 'down',
    fixedPosition: true,
    sightRange: 1,
    bossId: 'floodplain-toll-keeper',
    // The first door, so the first piece: a Quick Claw is the gentlest of the
    // four to read - you either went first or you did not - and it changes a
    // fight without changing how much of it you survive.
    carries: 'quick-claw',
    design: 'sailor',
    introLines: [
      'TOLLMAN BRIGGS HOLDS THE BRIDGE.',
      'Everything east of this river pays me first. So do you.',
    ],
    trainer: createTrainer(
      'floodplain-toll-keeper-briggs',
      'TOLLMAN BRIGGS',
      [new Pokemon(PIDGEY, 8), new Pokemon(SQUIRTLE, 9)],
      'Bridge is yours, and the ford with it. Mind the mill - the race is not mine to open.',
    ),
  },
  {
    // Holds the gatehouse that stands in the mill race, which is the keep's
    // moat. He has the sluice shut, so the river is up: beating him drops it,
    // and the old causeway between the keep and the Landing comes out of the
    // water. The tower the player has looked at since their first step turns
    // out to be next door.
    mapId: 'floodplain-relay',
    position: { x: 47, y: 22 },
    facing: 'down',
    fixedPosition: true,
    sightRange: 1,
    bossId: 'floodplain-sluice-keeper',
    // The hardest of the three doors, and the piece that most changes a long
    // raid: Leftovers is HP the recovery bay would otherwise charge raid time
    // for.
    carries: 'leftovers',
    design: 'hiker',
    introLines: [
      'SLUICE KEEPER DANE HOLDS THE GATEHOUSE.',
      'I keep the water high and the keep dry. Nobody walks in.',
    ],
    trainer: createTrainer(
      'floodplain-sluice-keeper-dane',
      'SLUICE KEEPER DANE',
      [new Pokemon(SQUIRTLE, 10), new Pokemon(JIGGLYPUFF, 10), new Pokemon(PIKACHU, 12)],
      'Gate is open. I am letting the sluice go too - watch the river by the Landing.',
    ),
  },
  {
    // Holds the gap in the orchard's back fence, with the vault behind it.
    // Beating her also unbars the causeway from the vault to the South Gate
    // road, so what is carried out of the vault has a short way home.
    //
    // **The one double battle in the game, and this is why it is here.**
    // A double battle is two decisions a turn instead of one, and in a raid
    // measured in the player's patience that has to be bought. Every other
    // authored fight is the wrong place for it: Maya and the three route
    // trainers are *tolls*, paid on a route you can walk round, and a toll that
    // takes twice the thinking is a toll nobody pays twice; Briggs is the first
    // door in the game and is met by whoever walks east first. Holt is the last
    // door in walking order on the vast map - she is behind Briggs, so no fresh
    // save can meet her - she is the top of the measured ladder already, and
    // what is behind her fence is the vault, which is the largest permanent
    // thing this map hands out. A fight worth two decisions a turn is a fight
    // you only have once, with the biggest door behind it.
    //
    // Three things were measured rather than argued
    // (`tools/trainers/report.mts`, 300 seeded fights):
    //
    //  - **It costs nothing to a player who brought one Pokemon.** A double
    //    battle needs two able Pokemon a side and the engine refuses the second
    //    slot when the player has nobody for it, so a lone Charmander, Squirtle
    //    or Bulbasaur fights exactly the fight it fought before - 24%, 12%, 0%,
    //    unmoved to the point.
    //  - **It is harder for the player who brought a team**, which is who
    //    actually reaches it: a Charmander 12 with a Pidgey 10 goes from 73% to
    //    48%, which puts the last door level with Dane instead of a third
    //    easier than him. A party of three barely notices (78% to 77%), because
    //    depth is the answer to two at once, and that is the lesson the door is
    //    there to teach.
    //  - **It is shorter, not longer.** The party is the same three Pokemon and
    //    both of yours swing every turn, so the same fight takes 3.8 turns
    //    instead of 8.8 and puts 25 lines of log on screen instead of 33. What
    //    doubles is the decisions, not the reading - which is the only version
    //    of this mechanic a five-minute raid can afford.
    mapId: 'floodplain-relay',
    position: { x: 53, y: 44 },
    facing: 'up',
    fixedPosition: true,
    sightRange: 1,
    bossId: 'floodplain-orchard-warden',
    // The warden keeps what is buried past her rows, and what she keeps is the
    // one piece that answers a raid ending: a Focus Band is a Pokemon that does
    // not come home in the ledger.
    carries: 'focus-band',
    design: 'straw-hat',
    introLines: [
      'WARDEN HOLT HOLDS THE ORCHARD FENCE.',
      'The rows are mine and so is what is buried past them.',
      'And I do not work these rows on my own. Both of mine, at once.',
    ],
    trainer: createTrainer(
      'floodplain-orchard-warden-holt',
      'WARDEN HOLT',
      [new Pokemon(BUTTERFREE, 11), new Pokemon(PIDGEY, 11), new Pokemon(JIGGLYPUFF, 12)],
      'Go on through. The causeway out the far side is unbarred - it lands you on the gate road.',
      2,
    ),
  },
  {
    // The bridge is the direct line from the allotments to the South Gate, and
    // Lee stands in the gap in the fence at its foot: the fast crossing has a
    // toll, the fords either side of it do not, and the three land you in
    // different thirds of the south.
    mapId: 'pallet-town',
    position: { x: 13, y: 31 },
    facing: 'up',
    fixedPosition: true,
    introLines: ['HEY, RUNNER!', 'This is the quick way over. Quick costs.', 'Let me see your team!'],
    // Lee is the first authored trainer a new player meets. A Bulbasaur here
    // made the fight a starter lottery at level 7 - 9% for Bulbasaur against
    // 95% for Charmander - because Grass is resisted by the whole early roster.
    // A Squirtle gives every starter a real matchup to read.
    trainer: createTrainer(
      'grass-scout-lee',
      'SCOUT LEE',
      [new Pokemon(PIDGEY, 5), new Pokemon(SQUIRTLE, 6)],
      'Nice footwork. The route is yours... for now.',
    ),
  },
  {
    // Pallet's one boss. The far bank of the millpond is the mill's own ground
    // and Vance keeps it: he stands on the pond lane with the towpath gate at
    // his shoulder, watching the single tile in front of it, so the lane east
    // is free and stepping up to the hurdle is the decision to fight. Beating
    // him opens the foot of the towpath as well, and the town turns out to be a
    // ring - square to South Gate without crossing the leat at all.
    //
    // A miller in flour-white, and the only figure in the game drawn from that
    // sheet: the survey caught two trainers being read as each other because
    // they shared a sheet and a job title, so a new boss gets a design and a
    // trade nobody else has.
    mapId: 'pallet-town',
    position: { x: 28, y: 12 },
    facing: 'left',
    fixedPosition: true,
    sightRange: 1,
    bossId: 'pallet-mill-keeper',
    design: 'heavy-man',
    introLines: [
      'MILLER VANCE HOLDS THE TOWPATH.',
      'Everything this side of the water turns my wheel. Walk on.',
    ],
    trainer: createTrainer(
      'pallet-mill-keeper-vance',
      'MILLER VANCE',
      // Measured over the real engine against Wren's, because Pallet and Route
      // 1 unlock together and their bosses are the same rung: seven party
      // builds from a fresh starter to three at twelve, best damaging move
      // every turn, no items. Vance wins 51% of them to Wren's 50%. The first
      // try - Squirtle 10, Pidgey 11, Butterfree 12 - was harder than the
      // Floodplain's last boss on the gentlest map in the game, which is what
      // measuring rather than guessing caught. The mill's own, and the one
      // party in the game with no Pidgey and no Pikachu in it.
      [new Pokemon(JIGGLYPUFF, 9), new Pokemon(SQUIRTLE, 9), new Pokemon(BUTTERFREE, 11)],
      'Towpath is yours, head and foot. Mind the stair - it is a long drop and a short way home.',
    ),
  },
  {
    // The third way across the braid is a gap one tile wide below the middle
    // field's south door, and June stands in it: she holds the crossing and the
    // door together, and the roads still go round her. She was a second RAIDER MAYA with the
    // checkpoint's own Pikachu and Pidgey, and a player who beats Maya on the
    // Floodplain and meets her again one map over reads it as a bug. The lead
    // is a Jigglypuff because no other trainer fields one and, at level 7, it
    // fights with the same Tackle and Growl the Pikachu did - a different
    // fight to look at, at the price the route was already measured against.
    mapId: 'route-1',
    position: { x: 16, y: 19 },
    facing: 'down',
    fixedPosition: true,
    design: 'lass',
    introLines: ['NO ONE loots Route 1 for free!', 'My partner is ready!'],
    trainer: createTrainer(
      'route-lass-june',
      'LASS JUNE',
      [new Pokemon(JIGGLYPUFF, 7), new Pokemon(PIDGEY, 7)],
      'You earned your way past me. Keep moving!',
    ),
  },
  {
    // The first boss. Wren stands in the spur off the east road with the
    // Overlook Gate at their back, and watches only the spur tile in front of
    // them: the road itself stays free, and stepping off it towards the gate is
    // the decision to fight. The party is longer and higher than anything else
    // on the route, which is what makes the door worth coming back for.
    mapId: 'route-1',
    position: { x: 25, y: 7 },
    facing: 'left',
    fixedPosition: true,
    sightRange: 1,
    bossId: 'overlook-warden',
    // The only door off the Floodplain, and the only piece with a price on it.
    // A Life Orb is carried by a player who has already decided a shorter fight
    // is worth the HP, which is exactly who walks up to Wren's fence.
    carries: 'life-orb',
    introLines: [
      'WARDEN WREN HOLDS THE OVERLOOK GATE.',
      'Nobody has seen the far side of this fence. Earn it.',
    ],
    trainer: createTrainer(
      'overlook-warden-wren',
      'WARDEN WREN',
      [new Pokemon(PIDGEY, 9), new Pokemon(JIGGLYPUFF, 9), new Pokemon(PIKACHU, 11)],
      'The gate is yours. It stays open - I am done holding it.',
    ),
  },
  {
    // The drove between the steading's two paddocks is the third way south -
    // parallel to both roads and shorter than either from the orchard - and a
    // thorn narrows it to one tile where Nell stands. She is the same kind of
    // price LASS JUNE is at the other end of the map: a locked door with a way
    // round, and the way round is the orchard's own south lane, which is
    // twenty-two steps longer (`route1.test.ts`). Spoken to rather than
    // watched, because the narrows is hers and a watch would charge for a step
    // the player had no way to read before taking it.
    mapId: 'route-1',
    position: { x: 48, y: 26 },
    facing: 'up',
    fixedPosition: true,
    design: 'woman',
    introLines: ['This is a WORKING drove.', 'Nobody walks it for nothing.'],
    trainer: createTrainer(
      'route-orchardist-nell',
      'ORCHARDIST NELL',
      [new Pokemon(getSpeciesById('oddish')!, 7), new Pokemon(getSpeciesById('meowth')!, 8)],
      'Go on then. Mind the gates on your way down.',
    ),
  },
  {
    // The toll on the east road, and the one watch on this map. Gil stands on
    // the ford itself and watches the tile beside him, so the crossing is two
    // tiles wide and he covers both of them - which is a wall only if the map
    // has one road. It has two: the whole west road, the plank bridge and the
    // drove are the way round, and they are the longer way. That is what makes
    // him a toll rather than a door.
    mapId: 'route-1',
    position: { x: 28, y: 44 },
    facing: 'right',
    fixedPosition: true,
    sightRange: 1,
    design: 'bald-man',
    introLines: ['FORD TOLL. Beasts and people both.', 'Or take the bridge, three minutes back the way you came.'],
    trainer: createTrainer(
      'route-drover-gil',
      'DROVER GIL',
      [new Pokemon(getSpeciesById('spearow')!, 7), new Pokemon(getSpeciesById('rattata')!, 8)],
      'Paid in full. Watch the bank, it gives.',
    ),
  },
  {
    // In the burn, a step off the kiln. The clearing has four ways out of it,
    // so he is passable and being caught here is never forced.
    mapId: 'route-1',
    position: { x: 50, y: 57 },
    facing: 'down',
    fixedPosition: true,
    design: 'old-man',
    introLines: ['You came a long way for a cold kiln.', 'Earn the road out.'],
    trainer: createTrainer(
      'route-collier-osk',
      'COLLIER OSK',
      [new Pokemon(getSpeciesById('vulpix')!, 7), new Pokemon(getSpeciesById('diglett')!, 8)],
      'Road out is east, in the rock. Draw the kiln first or it stays shut.',
    ),
  },
  {
    // Ivy stands in the middle of a three-trail hub, so she is passable: her
    // clearing has other ways out and being caught here is never forced. She
    // was WARDEN IVY in the shared sheet's orange, which is exactly what Route
    // 1's Warden Wren is - and a stranger who had met Wren spent his tour of
    // the forest looking for the door Ivy was holding. She holds none: the
    // warden of WARDEN'S CUT is whoever felled it and keeps the cache at East
    // Rise. Ivy is a bug catcher, dressed as one and called one.
    mapId: 'viridian-forest',
    position: { x: 18, y: 18 },
    facing: 'down',
    fixedPosition: true,
    design: 'bug-catcher',
    introLines: ['THE FOREST KEEPS WHAT IT TAKES.', 'Turn back or face my bugs!'],
    trainer: createTrainer(
      'forest-warden-ivy',
      'BUG CATCHER IVY',
      [new Pokemon(PIDGEY, 9), new Pokemon(BUTTERFREE, 10)],
      'The coastal trail is clear. Do not waste your second chance.',
    ),
  },
  {
    // Viridian's one boss. The rock the fire tower is built against runs east
    // along the top of the wood, and Pell keeps the whole of it: he stands on
    // the nub at the tower's foot - the one step of ground in this forest that
    // went nowhere - with the ridge gate beside him, watching only the tile
    // below. The trail east past the tower is free; turning up towards the gate
    // is the decision. Beating him joins the tower to the stair it lights.
    //
    // Not another warden and not another bug catcher: the forest already has
    // Ivy, and Route 1's Wren is a warden. A lookout in a climber's cap, drawn
    // from a sheet nothing else in the game uses.
    mapId: 'viridian-forest',
    position: { x: 18, y: 4 },
    facing: 'down',
    fixedPosition: true,
    sightRange: 1,
    bossId: 'forest-ridge-keeper',
    design: 'cooltrainer',
    introLines: [
      'LOOKOUT PELL HOLDS THE RIDGE.',
      'Nobody walks the top of this wood but me. Prove otherwise.',
    ],
    trainer: createTrainer(
      'forest-ridge-keeper-pell',
      'LOOKOUT PELL',
      // A rung above Vance and Wren and below the Floodplain's sluice keeper,
      // measured the same way: 56% of those seven builds lost, against Wren's
      // 50%. Viridian is the map that prices everything in fights, so its boss
      // is the harder of the two small-map doors. No second Flying type on
      // purpose - Pidgey and Butterfree together take a Bulbasaur to nil, and
      // a fight only one starter can win is the lottery Scout Lee's Squirtle
      // exists to avoid.
      [new Pokemon(PIDGEY, 9), new Pokemon(PIKACHU, 11), new Pokemon(JIGGLYPUFF, 12)],
      'Ridge is open, both ends. Light the tower and you are ten steps from the stair, not half a map.',
    ),
  },
  {
    // The toll on the long drive. She stands at the east end of the dog-leg,
    // off the lane with the road running across in front of her, so the watch
    // prices the fast ground rather than shutting it - the way round is the
    // whole west of the map, which is exactly what the drive is worth.
    mapId: 'viridian-forest',
    position: { x: 59, y: 52 },
    facing: 'left',
    fixedPosition: true,
    sightRange: 4,
    design: 'lass',
    introLines: [
      'CARTER DILL WORKS THE DRIVE.',
      'Nobody uses my road for nothing. Battle is the toll.',
    ],
    trainer: createTrainer(
      'forest-drive-carter-dill',
      'CARTER DILL',
      [new Pokemon(getSpeciesById('spearow')!, 9), new Pokemon(getSpeciesById('meowth')!, 9)],
      'Road is yours today. Mind the kilns - the collier is not so friendly.',
    ),
  },
  {
    // Spoken to, not watched: she stands in the middle of the blowdown, which
    // is a knot of ways round rather than a lane, so being caught here is never
    // forced. The forest's other passable trainer is Ivy, on the other side of
    // the map and half its levels below.
    mapId: 'viridian-forest',
    position: { x: 40, y: 34 },
    facing: 'down',
    fixedPosition: true,
    design: 'youngster',
    introLines: [
      'FORAGER NELL IS WORKING THE FALLEN TIMBER.',
      'Everything good in this wood is under a log. Mine first.',
    ],
    trainer: createTrainer(
      'forest-blowdown-forager-nell',
      'FORAGER NELL',
      [new Pokemon(getSpeciesById('paras')!, 9), new Pokemon(getSpeciesById('venonat')!, 10)],
      'Take the logs slowly. The quarryman does not take anything slowly.',
    ),
  },
  {
    // Viridian's second boss, and the deepest door on the map. Mott stands in
    // the lane above the quarry mouth with the gate below him: there is no
    // watch, because a boss who is the door does not need one - you walk up to
    // him or you do not go in.
    //
    // Not another lookout and not another warden: a quarryman in a hiker's
    // hat, and the only trainer in the game who fields rock.
    mapId: 'viridian-forest',
    position: { x: 37, y: 50 },
    facing: 'down',
    fixedPosition: true,
    bossId: 'forest-quarry-keeper',
    design: 'hiker',
    introLines: [
      'QUARRYMAN MOTT HOLDS THE QUARRY GATE.',
      'Nothing comes out of my hole that I did not carry out. Try it.',
    ],
    trainer: createTrainer(
      'forest-quarry-keeper-mott',
      'QUARRYMAN MOTT',
      // Measured over the real engine like every other door
      // (`tools/trainers/report.mts`): 63% over the four reference parties,
      // which puts him between Lookout Pell and the Floodplain's sluice keeper
      // - the deepest door on this map and the harder of its two.
      //
      // Rock and Ground alone is a lottery in the wrong direction: Geodude is
      // four times over to both Water and Grass, and a party of three of them
      // measured 48/100/100 against the three starters. The Zubat is what
      // flattens it - Poison and Flying quarters a Grass move and is neutral to
      // Water - and it is what lives in an adit. Machop is the anchor, and the
      // level it is pitched at is the whole fight: at 13 it learns its way to a
      // 51% door and at 12 it is a 63% one.
      [
        new Pokemon(getSpeciesById('geodude')!, 12),
        new Pokemon(getSpeciesById('zubat')!, 13),
        new Pokemon(getSpeciesById('machop')!, 12),
      ],
      'Gate is open, and so is the stair down the west face. The adit at the back takes you home.',
    ),
  },
];
