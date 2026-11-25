import { describe, expect, it, vi } from 'vitest';
import { fetchTextures, type ImageFetcher, type TextureStore } from './shinyTextureFetch';

const store = (has: string[] = []): TextureStore & { added: string[] } => {
  const keys = new Set(has);
  const added: string[] = [];
  return {
    added,
    exists: (key) => keys.has(key),
    addImage: (key) => {
      keys.add(key);
      added.push(key);
    },
  };
};

/** A fetcher whose downloads are answered by hand, the way a slow line answers them. */
const slowLine = () => {
  const waiting = new Map<string, { resolve(image: HTMLImageElement): void; reject(error: Error): void }>();
  const fetcher = vi.fn<ImageFetcher>(
    (url) => new Promise((resolve, reject) => waiting.set(url, { resolve, reject })),
  );
  const answer = (path: string, ok = true) => {
    const [url, call] = [...waiting].find(([url]) => url.endsWith(path))!;
    waiting.delete(url);
    if (ok) {
      call.resolve({} as HTMLImageElement);
    } else {
      call.reject(new Error('gone'));
    }
  };
  return { fetcher, answer };
};

describe('fetchTextures', () => {
  it('fetches only what is missing, adds it as it arrives and says it arrived', async () => {
    const textures = store(['have']);
    const line = slowLine();
    const done = fetchTextures(
      textures,
      [
        { key: 'have', path: 'assets/have.png' },
        { key: 'want', path: 'assets/want.png' },
      ],
      line.fetcher,
    );
    expect(line.fetcher).toHaveBeenCalledTimes(1);
    expect(textures.added).toEqual([]);

    line.answer('want.png');

    await expect(done).resolves.toBe(true);
    expect(textures.added).toEqual(['want']);
  });

  it('asks for nothing and says nothing arrived when every texture is there', async () => {
    const fetcher = vi.fn<ImageFetcher>();
    await expect(fetchTextures(store(['a']), [{ key: 'a', path: 'a.png' }], fetcher)).resolves.toBe(false);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('downloads a texture once however many scenes ask while it is on its way', async () => {
    const textures = store();
    const line = slowLine();
    const wanted = [{ key: 'shared', path: 'assets/shared.png' }];
    const world = fetchTextures(textures, wanted, line.fetcher);
    const battle = fetchTextures(textures, wanted, line.fetcher);
    expect(line.fetcher).toHaveBeenCalledTimes(1);

    line.answer('shared.png');

    await expect(Promise.all([world, battle])).resolves.toEqual([true, true]);
    expect(textures.added).toEqual(['shared']);
  });

  it('settles on a download that fails, and the next ask tries again', async () => {
    const textures = store();
    const line = slowLine();
    const wanted = [{ key: 'flaky', path: 'assets/flaky.png' }];
    const first = fetchTextures(textures, wanted, line.fetcher);
    line.answer('flaky.png', false);
    await expect(first).resolves.toBe(false);
    expect(textures.added).toEqual([]);

    const second = fetchTextures(textures, wanted, line.fetcher);
    expect(line.fetcher).toHaveBeenCalledTimes(2);
    line.answer('flaky.png');
    await expect(second).resolves.toBe(true);
    expect(textures.added).toEqual(['flaky']);
  });
});
