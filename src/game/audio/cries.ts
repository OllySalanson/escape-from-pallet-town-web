import { publicAssetUrl } from '../publicAssetUrl';

/**
 * A Pokemon's cry is FireRed/LeafGreen's own sample of that species, cut from
 * pret/pokefirered by `scripts/fetch-frlg-cries.mjs` into
 * `public/assets/cries/<dexId>.wav`: mono 8-bit at the GBA's 10512 Hz, so all
 * 151 together are a megabyte and a half. Where it came from and on what
 * standing is `public/assets/ASSET_PROVENANCE.md`.
 *
 * Which cry is heard when is `battleSounds.ts`; how it is heard - one at a
 * time, after the ball's pop or the fanfare it follows - is
 * `AudioManager.play()`. What lives here is only the sample's address and the
 * two numbers FireRed plays one with.
 */

/** Kanto's original 151, which is the whole of this game's roster. */
export const CRY_SPECIES_COUNT = 151;

/** FireRed's pitch for a cry played as recorded: key 60, in its key-times-256 units. */
export const CRY_SAMPLE_PITCH = 15360;

/**
 * The gain a cry is played at, before the master volume. The samples run to
 * within a few steps of full scale, where a tone effect's voices peak at a
 * fifth of it at most (`soundEffects.test.ts`), so a cry is brought down to sit
 * level with the loudest of them rather than a dozen decibels over everything.
 */
export const CRY_GAIN = 0.2;

export function hasCry(dexId: number): boolean {
  return Number.isInteger(dexId) && dexId >= 1 && dexId <= CRY_SPECIES_COUNT;
}

export function cryUrl(dexId: number): string {
  return publicAssetUrl(`assets/cries/${dexId}.wav`);
}

/**
 * How fast a sample is played for a FireRed pitch. FireRed's units are a key
 * times 256, so 256 is a semitone: a faint's 14440 is 920 under the recorded
 * pitch, three and a half semitones down, which plays the sample at 0.81 of its
 * speed - lower, and longer by the same share.
 */
export function cryPlaybackRate(pitch: number): number {
  return 2 ** ((pitch - CRY_SAMPLE_PITCH) / 256 / 12);
}
