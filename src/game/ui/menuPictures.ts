import { publicAssetUrl } from '../publicAssetUrl';
import { pokemonSpritePath } from '../pokemon/pokemonSprites';
import { ICON_NAMES, iconUrl } from './icons';

/**
 * The pictures the DOM menus draw, kept loaded for the life of the page so a
 * menu's first open is drawn at once.
 *
 * The captain, 26 Nov 2026: "I've just gone into Bill's cottage and looked at
 * the menu here, and it took a while for everything to load again" - and the
 * second time, everything was there. Phaser's loader had already fetched every
 * icon at boot, but into its own textures, which an `<img>` cannot use: the
 * first `<img>` for each file went back to the browser's disk cache, and once
 * Pages' ten minutes had passed, to the network, one request a picture. Bill's
 * shelf is 187 pictures; measured on a build served as Pages serves it, 185 of
 * them were still blank as it opened and the last came 0.6s later
 * (`tools/playtest/menuSprites.mjs`, `docs/screens/menu-sprites/`).
 *
 * A browser draws an `<img>` at once when the same document already holds that
 * file loaded, and it never asks the network again for a file the document
 * holds. So each picture is loaded once here, as the game boots - straight
 * after Phaser has fetched them all, so from the cache and not the network -
 * and its `Image` kept, which is what keeps it held.
 */
const held = new Map<string, HTMLImageElement>();

/** Loads each picture once and keeps it; resolves when all of them are drawable (or have failed). */
export function keepPicturesLoaded(urls: Iterable<string>): Promise<void> {
  if (typeof Image === 'undefined') {
    return Promise.resolve();
  }
  const waits: Promise<unknown>[] = [];
  for (const url of urls) {
    const known = held.get(url);
    if (known) {
      waits.push(known.decode().catch(() => undefined));
      continue;
    }
    const image = new Image();
    image.decoding = 'async';
    image.src = url;
    held.set(url, image);
    waits.push(image.decode().catch(() => undefined));
  }
  return Promise.all(waits).then(() => undefined);
}

/** Whether a picture is held, for tests. */
export function isPictureHeld(url: string): boolean {
  return held.has(url);
}

/**
 * Every picture a menu can draw: the icons, each species as it stands in a
 * menu, and the sheets the stylesheet draws from (party icons, the player's
 * figure, the shiny star, the padlock, the battle's ground).
 */
export function menuPictureUrls(dexIds: Iterable<number>): readonly string[] {
  return [
    ...ICON_NAMES.map((name) => iconUrl(name)),
    ...[...dexIds].map((dexId) => publicAssetUrl(pokemonSpritePath('front', dexId))),
    ...['assets/pokemon-icons.png', 'assets/character.png', 'assets/battle/shiny-star.png', 'assets/battle/platform.png', 'assets/battle/field-bands.png'].map(
      (path) => publicAssetUrl(path),
    ),
  ];
}

/**
 * Resolves once every `<img>` under `root` is drawable, or after `timeoutMs`,
 * whichever is first: a screen that animates its pictures in starts the
 * animation on pictures that are there, never on blank boxes.
 */
export function whenPicturesDrawn(root: ParentNode, timeoutMs: number): Promise<void> {
  const images = [...root.querySelectorAll('img')].filter((image) => !(image.complete && image.naturalWidth > 0));
  if (images.length === 0) {
    return Promise.resolve();
  }
  return Promise.race([
    Promise.all(images.map((image) => image.decode().catch(() => undefined))).then(() => undefined),
    new Promise<void>((resolve) => setTimeout(resolve, timeoutMs)),
  ]);
}
