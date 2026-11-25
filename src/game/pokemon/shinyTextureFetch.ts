import { publicAssetUrl } from '../publicAssetUrl';

/** The part of Phaser's texture manager a fetch needs: textures are the game's, not a scene's. */
export interface TextureStore {
  exists(key: string): boolean;
  addImage(key: string, source: HTMLImageElement): unknown;
}

/** Fetches one picture; rejects when it cannot. */
export type ImageFetcher = (url: string) => Promise<HTMLImageElement>;

const fetchImage: ImageFetcher = (url) =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Could not load ${url}`));
    image.src = url;
  });

/** One download per texture, shared by every scene that asks while it is on its way. */
const onTheirWay = new Map<string, Promise<boolean>>();

/**
 * Fetches a shiny's colours in the background and adds them to the game's
 * textures as they arrive, resolving true once any arrived that were not there.
 *
 * Never a scene's `preload`: Phaser holds a scene's `create` until its loader
 * is done, and a battle with nothing drawn yet is a black screen. A fight
 * fielding a shiny waited on these downloads before its first frame - two
 * seconds on a slow line, and the captain saw five (25 Nov 2026) - so the
 * world asks for them when the raid starts, a wild shiny's as it is rolled,
 * and the battle draws at once in the ordinary colours if they are still on
 * their way (`BattleScene.spriteTexture`), recolouring when they come.
 *
 * A texture that will not load is not retried by this ask; the next one tries
 * again, and the Pokemon is drawn in its ordinary colours meanwhile.
 */
export function fetchTextures(
  textures: TextureStore,
  wanted: readonly { readonly key: string; readonly path: string }[],
  fetcher: ImageFetcher = fetchImage,
): Promise<boolean> {
  const loads = wanted
    .filter(({ key }) => !textures.exists(key))
    .map(({ key, path }) => {
      let load = onTheirWay.get(key);
      if (!load) {
        load = fetcher(publicAssetUrl(path))
          .then((image) => {
            if (!textures.exists(key)) {
              textures.addImage(key, image);
            }
            return true;
          })
          .catch(() => false)
          .finally(() => onTheirWay.delete(key));
        onTheirWay.set(key, load);
      }
      return load;
    });
  return Promise.all(loads).then((arrived) => arrived.some(Boolean));
}
