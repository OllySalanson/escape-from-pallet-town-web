import { publicAssetUrl } from '../publicAssetUrl';
import type { ChartSheet } from '../world/chart';
import type { TileSource } from '../world/tileset/catalogue';

/**
 * The pixels of every sheet a map is drawn from, for THE MAP to shrink
 * (`world/chart.ts`). Read through an image and a canvas of the browser's own
 * rather than out of Phaser's texture manager, because the harbour has never
 * loaded the raid's sheets - and the browser has them cached from the raid
 * whenever it has.
 */
const loaded = new Map<string, Promise<ImageData>>();

function sheetPixels(path: string): Promise<ImageData> {
  const held = loaded.get(path);
  if (held) {
    return held;
  }
  const reading = new Promise<ImageData>((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = image.naturalWidth;
      canvas.height = image.naturalHeight;
      const context = canvas.getContext('2d', { willReadFrequently: true });
      if (!context) {
        reject(new Error('No 2D canvas to read a sheet with.'));
        return;
      }
      context.drawImage(image, 0, 0);
      resolve(context.getImageData(0, 0, canvas.width, canvas.height));
    };
    image.onerror = () => reject(new Error(`Could not load ${path}.`));
    image.src = publicAssetUrl(path);
  });
  // A failed read is not kept, so the next opening tries again.
  reading.catch(() => loaded.delete(path));
  loaded.set(path, reading);
  return reading;
}

/** Every sheet a place draws from, as THE MAP reads them. */
export async function chartSheetsFor(sources: readonly TileSource[]): Promise<ChartSheet[]> {
  return Promise.all(
    sources.map(async (source) => {
      const pixels = await sheetPixels(source.imagePath);
      return {
        firstIndex: source.firstIndex,
        columns: source.columns,
        rows: source.rows,
        width: pixels.width,
        data: pixels.data,
      };
    }),
  );
}
