/**
 * What is drawn over what on the overworld, decided once.
 *
 * The rule is about who the picture is for. A caption explains the map, so it
 * belongs over the art it explains and under everyone standing on it: captions
 * used to sit at depth 3-5 against a player at 2.007, which meant standing on
 * the Floodplain ranger station hid the character completely under the caption
 * naming it. So: scenery and markers, then captions, then every figure - the
 * player, an NPC, and above all the hunter, none of which may ever be covered
 * by writing.
 *
 * Each band carries a `tileY / 1000` offset, so within a band the southern
 * object is drawn in front - the same y-sort every figure on the map already
 * uses. Maps are tens of tiles tall, not hundreds, so an offset never reaches
 * the next band; `depths.test.ts` pins that.
 */

/** Tall grass and the detail layer: still terrain, but over the ground. */
export const TERRAIN_DEPTH = 1;

/** A trainer's watched lane, shaded under everything that stands on it. */
export const WATCH_SHADING_DEPTH = 1.5;

/** Map art: exits, caches, landmarks, contract stops, signs. */
export const MARKER_BAND = 1.6;

/** Captions. Over the art they explain, under every figure on the map. */
export const CAPTION_BAND = 1.8;

/** Figures: the player, townsfolk, trainers, the hunter. */
export const FIGURE_BAND = 2;

/** Sorts an object within its band by the tile row it stands on. */
export const atRow = (band: number, tileY: number): number => band + tileY / 1000;
