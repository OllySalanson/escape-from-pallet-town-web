import { readFile } from 'node:fs/promises';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { publicAssetUrl } from '../publicAssetUrl';
import { ICON_NAMES, iconUrl } from './icons';
import { isPictureHeld, keepPicturesLoaded, menuPictureUrls } from './menuPictures';

/** An `Image` that records what it was asked to load and decodes at once. */
class FakeImage {
  static made: string[] = [];
  decoding = '';
  private url = '';
  set src(url: string) {
    this.url = url;
    FakeImage.made.push(url);
  }
  get src(): string {
    return this.url;
  }
  decode(): Promise<void> {
    return this.url.includes('missing') ? Promise.reject(new Error('gone')) : Promise.resolve();
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeImage.made = [];
});

describe('the pictures the menus draw, held from boot', () => {
  it('loads each picture once and keeps it, however often it is asked for', async () => {
    vi.stubGlobal('Image', FakeImage);
    await keepPicturesLoaded(['a/one.png', 'a/two.png']);
    await keepPicturesLoaded(['a/one.png', 'a/three.png']);
    expect(FakeImage.made).toEqual(['a/one.png', 'a/two.png', 'a/three.png']);
    expect(isPictureHeld('a/two.png')).toBe(true);
  });

  it('never fails boot over a picture that will not load', async () => {
    vi.stubGlobal('Image', FakeImage);
    await expect(keepPicturesLoaded(['a/missing.png'])).resolves.toBeUndefined();
  });

  it('holds every icon and each species as a menu stands it', () => {
    const urls = menuPictureUrls([1, 25]);
    for (const name of ICON_NAMES) expect(urls).toContain(iconUrl(name));
    expect(urls).toContain(publicAssetUrl('assets/pokemon/front/25.png'));
  });

  it('holds every picture the stylesheet draws from', async () => {
    const css = await readFile(new URL('../../style.css', import.meta.url), 'utf8');
    const drawn = [...css.matchAll(/url\('\/(assets\/[^']+\.png)'\)/g)].map((match) => publicAssetUrl(match[1]));
    expect(drawn.length).toBeGreaterThan(0);
    const urls = menuPictureUrls([]);
    for (const url of drawn) expect(urls, `${url} is drawn by a menu and not held`).toContain(url);
  });
});
