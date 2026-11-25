import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { describe, expect, it } from 'vitest';

/**
 * index.html's boot guard: a page from before a publish names bundles the
 * publish deleted, and was left saying LOADING THE GAME… black on white for
 * good (25 Nov 2026). The guard is the page's own inline script, so it is run
 * here as the page runs it, against a stand-in document; the real thing is
 * played by tools/playtest/stalePage.mjs.
 */
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const guard = /<script>\s*(\(function \(\) \{[\s\S]*?\}\)\(\);)\s*<\/script>/.exec(html)?.[1];

class FakeElement {
  textContent = '';
  className = '';
  type = '';
  rel = '';
  children: FakeElement[] = [];
  attributes: Record<string, string> = {};
  listeners: Record<string, () => void> = {};
  replacedWith: FakeElement | null = null;
  focused = false;
  setAttribute(name: string, value: string) {
    this.attributes[name] = value;
  }
  append(...children: FakeElement[]) {
    this.children.push(...children);
  }
  addEventListener(type: string, listener: () => void) {
    this.listeners[type] = listener;
  }
  replaceWith(other: FakeElement) {
    this.replacedWith = other;
  }
  focus() {
    this.focused = true;
  }
}
class FakeScript extends FakeElement {}
class FakeLink extends FakeElement {}

interface PageOptions {
  /** What the tab's session already remembers, as sessionStorage would. */
  remembered?: string | null;
  storageThrows?: boolean;
  mounted?: boolean;
  parsing?: boolean;
  now?: number;
}

function loadPage({ remembered = null, storageThrows = false, mounted = false, parsing = false, now = 1_000_000 }: PageOptions = {}) {
  let errorListener: ((event: { target: unknown }) => void) | undefined;
  const windowListeners: Record<string, () => void> = {};
  const documentListeners: Record<string, () => void> = {};
  const stored = new Map<string, string>(remembered === null ? [] : [['escape-from-pallet-town.boot-reload', remembered]]);
  const wait = new FakeElement();
  const page = {
    reloads: 0,
    wait,
    parsing,
    mounted,
    stored,
  };
  const context = {
    HTMLScriptElement: FakeScript,
    HTMLLinkElement: FakeLink,
    Date: { now: () => now },
    Number,
    String,
    location: { reload: () => { page.reloads += 1; } },
    sessionStorage: {
      getItem: (key: string) => {
        if (storageThrows) throw new Error('SecurityError');
        return stored.get(key) ?? null;
      },
      setItem: (key: string, value: string) => {
        if (storageThrows) throw new Error('SecurityError');
        stored.set(key, value);
      },
    },
    window: {
      addEventListener: (type: string, listener: () => void) => {
        if (type === 'error') {
          errorListener = listener;
        } else {
          windowListeners[type] = listener;
        }
      },
    },
    document: {
      get readyState() {
        return page.parsing ? 'loading' : 'interactive';
      },
      querySelector: (selector: string) => (selector === '.boot-wait' && !page.mounted && !page.parsing ? wait : null),
      createElement: () => new FakeElement(),
      addEventListener: (type: string, listener: () => void) => {
        documentListeners[type] = listener;
      },
    },
  };
  runInNewContext(guard!, context);
  return {
    ...page,
    fail: (target: unknown) => errorListener!({ target }),
    windowListeners,
    documentListeners,
    finishParsing: () => {
      page.parsing = false;
      documentListeners.DOMContentLoaded?.();
    },
    get message() {
      return wait.replacedWith;
    },
    get reloadCount() {
      return page.reloads;
    },
  };
}

const stylesheet = () => Object.assign(new FakeLink(), { rel: 'stylesheet' });

describe("index.html's boot guard", () => {
  it('stands before the build puts its script and stylesheet into the head', () => {
    expect(guard).toBeDefined();
    const head = html.slice(0, html.indexOf('</head>'));
    expect(head).toContain(guard);
    // Vite puts the bundle's tags at the end of the head, so nothing of the
    // page's own may load the game ahead of the guard.
    expect(head.indexOf(guard!)).toBeLessThan(head.lastIndexOf('</script>'));
    expect(html.slice(html.indexOf('</head>'))).toContain('<script type="module" src="/src/main.ts">');
  });

  it("reloads once when the game's own script fails, which fetches the current page", () => {
    const page = loadPage();
    page.fail(new FakeScript());
    expect(page.reloadCount).toBe(1);
    expect(page.stored.get('escape-from-pallet-town.boot-reload')).toBe('1000000');
    expect(page.message).toBeNull();
  });

  it('reloads for a missing stylesheet or preloaded chunk too, even before the body is read', () => {
    const page = loadPage({ parsing: true });
    page.fail(stylesheet());
    expect(page.reloadCount).toBe(1);
    const chunk = loadPage();
    chunk.fail(Object.assign(new FakeLink(), { rel: 'modulepreload' }));
    expect(chunk.reloadCount).toBe(1);
  });

  it('stops after one try and says so with a button, rather than reloading for ever', () => {
    const page = loadPage({ remembered: String(1_000_000 - 5_000) });
    page.fail(new FakeScript());
    expect(page.reloadCount).toBe(0);
    const box = page.message!;
    expect(box.className).toBe('boot-failed');
    expect(box.attributes.role).toBe('alert');
    const [line, button] = box.children;
    expect(line.textContent).toBe('THE GAME COULD NOT LOAD.');
    expect(button.textContent).toBe('TRY AGAIN');
    expect(button.focused).toBe(true);
    button.listeners.click();
    expect(page.reloadCount).toBe(1);
  });

  it('tries again by itself when a lost connection comes back', () => {
    const page = loadPage({ remembered: String(1_000_000 - 5_000) });
    page.fail(new FakeScript());
    expect(page.reloadCount).toBe(0);
    page.windowListeners.online();
    expect(page.reloadCount).toBe(1);
  });

  it('reloads again for a failure long after the last try: a later publish is a new stale page', () => {
    const page = loadPage({ remembered: String(1_000_000 - 61_000) });
    page.fail(new FakeScript());
    expect(page.reloadCount).toBe(1);
  });

  it('says so rather than risk a loop when the tab cannot remember that it tried', () => {
    const page = loadPage({ storageThrows: true });
    page.fail(new FakeScript());
    expect(page.reloadCount).toBe(0);
    expect(page.message?.className).toBe('boot-failed');
  });

  it('waits for the loading line to be read before it replaces it', () => {
    const page = loadPage({ parsing: true, storageThrows: true });
    page.fail(stylesheet());
    expect(page.message).toBeNull();
    page.finishParsing();
    expect(page.message?.className).toBe('boot-failed');
  });

  it('acts once for a page whose every file fails', () => {
    const page = loadPage();
    page.fail(stylesheet());
    page.fail(new FakeScript());
    expect(page.reloadCount).toBe(1);
  });

  it('leaves a game that has started alone, and ignores a missing font or picture', () => {
    const started = loadPage({ mounted: true });
    started.fail(new FakeScript());
    expect(started.reloadCount).toBe(0);
    const booting = loadPage();
    booting.fail(Object.assign(new FakeLink(), { rel: 'preload' }));
    booting.fail(new FakeElement());
    booting.fail(null);
    expect(booting.reloadCount).toBe(0);
    expect(booting.message).toBeNull();
  });
});
