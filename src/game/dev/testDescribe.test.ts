import { describe, expect, it } from 'vitest';
import {
  DOM_TEXT_LIMIT,
  describeGame,
  describeMenu,
  pressMenuControl,
  visibleTexts,
  type DocumentLike,
  type ElementLike,
  type SceneLike,
} from './testDescribe';

// --- A tiny DOM: just what the reader asks of one. ---------------------------

interface FakeElement extends ElementLike {
  readonly children: FakeElement[];
  clicks: number;
}

const element = (
  tagName: string,
  options: {
    text?: string;
    attributes?: Record<string, string>;
    classes?: string[];
    disabled?: boolean;
    hidden?: boolean;
    children?: FakeElement[];
    matches?: string[];
  } = {},
): FakeElement => {
  const children = options.children ?? [];
  const all = (root: FakeElement): FakeElement[] => root.children.flatMap((child) => [child, ...all(child)]);
  const selectorMatches = (candidate: FakeElement, selector: string): boolean =>
    selector.split(',').some((part) => {
      const one = part.trim();
      const role = /^\[role="([a-z]+)"\]$/.exec(one);
      if (role) {
        return candidate.getAttribute('role') === role[1];
      }
      if (one.startsWith('.')) {
        return candidate.classList?.contains(one.slice(1)) === true;
      }
      if (one === 'a[href]') {
        return candidate.tagName === 'A' && candidate.getAttribute('href') !== null;
      }
      return candidate.tagName === one.toUpperCase();
    });
  const self: FakeElement = {
    tagName: tagName.toUpperCase(),
    children,
    clicks: 0,
    disabled: options.disabled,
    get innerText(): string {
      return [options.text ?? '', ...children.map((child) => child.innerText ?? '')].filter(Boolean).join(' ');
    },
    classList: { contains: (name: string) => (options.classes ?? []).includes(name) },
    getAttribute: (name: string) => options.attributes?.[name] ?? null,
    querySelector: (selector: string) => all(self).find((each) => selectorMatches(each, selector)) ?? null,
    querySelectorAll: (selector: string) => all(self).filter((each) => selectorMatches(each, selector)),
    getClientRects: () => (options.hidden ? [] : [{}]),
    click: () => {
      self.clicks += 1;
    },
  };
  return self;
};

const documentOf = (root: FakeElement, active: unknown = null): DocumentLike => ({
  activeElement: active,
  querySelectorAll: (selector: string) =>
    [root, ...root.children].filter((each) => each.classList?.contains(selector.slice(1))),
});

describe('describeMenu', () => {
  it('reads the topmost menu: its heading, its words, and every control a player can press', () => {
    const save = element('button', { text: 'SAVE' });
    const menu = element('div', {
      classes: ['menu-overlay'],
      children: [
        element('h2', { text: 'THE RIM' }),
        element('p', { text: 'Where   are you\n dropping in?' }),
        element('button', { text: 'JUMP IN', attributes: { 'aria-pressed': 'true' } }),
        element('div', { attributes: { role: 'option', 'aria-label': 'Mill Square' } }),
        element('button', { text: 'LOCKED', disabled: true }),
        element('button', { text: 'GONE', hidden: true }),
        save,
      ],
    });
    const root = element('body', { children: [menu] });
    const screen = describeMenu(documentOf(root, save));
    expect(screen?.heading).toBe('THE RIM');
    expect(screen?.text).toContain('Where are you dropping in?');
    expect(screen?.controls).toEqual([
      { label: 'JUMP IN', kind: 'button', selected: true },
      { label: 'Mill Square', kind: 'option' },
      { label: 'LOCKED', kind: 'button', disabled: true },
      { label: 'SAVE', kind: 'button', focused: true },
    ]);
  });

  it('is null with no menu on screen, and cuts a very long menu short', () => {
    const hidden = element('div', { classes: ['menu-overlay'], hidden: true });
    expect(describeMenu(documentOf(element('body', { children: [hidden] })))).toBeNull();
    const long = element('div', { classes: ['menu-overlay'], children: [element('p', { text: 'word '.repeat(500) })] });
    expect(describeMenu(documentOf(element('body', { children: [long] })))?.text.length).toBe(DOM_TEXT_LIMIT + 3);
  });
});

describe('pressMenuControl', () => {
  it('presses the exact label first, then one starting with it, never a disabled one', () => {
    const exact = element('button', { text: 'GO' });
    const longer = element('button', { text: 'GO HOME' });
    const off = element('button', { text: 'GOLD', disabled: true });
    const menu = element('div', { classes: ['menu-overlay'], children: [off, longer, exact] });
    const document = documentOf(element('body', { children: [menu] }));
    expect(pressMenuControl(document, 'go')).toBe('GO');
    expect(exact.clicks).toBe(1);
    expect(pressMenuControl(document, 'go h')).toBe('GO HOME');
    expect(pressMenuControl(document, 'gold')).toBeNull();
    expect(off.clicks).toBe(0);
  });
});

// --- Canvas text. ------------------------------------------------------------

const text = (value: string, bounds: { x: number; y: number }, extra: Record<string, unknown> = {}) => ({
  type: 'Text',
  text: value,
  visible: true,
  alpha: 1,
  getBounds: () => ({ ...bounds, width: 20, height: 10 }),
  ...extra,
});

const camera = { worldView: { x: 100, y: 100, width: 400, height: 256 }, scrollX: 100, scrollY: 100, zoom: 1 };

describe('visibleTexts', () => {
  it('reads what is drawn on screen, top to bottom, and nothing hidden or off camera', () => {
    const scene: SceneLike = {
      scene: { key: 'world' },
      cameras: { main: camera },
      children: {
        list: [
          text('FAR AWAY', { x: 900, y: 900 }),
          text('MILLBROOK', { x: 150, y: 300 }),
          text('hidden', { x: 150, y: 150 }, { visible: false }),
          text('  ', { x: 150, y: 150 }),
          { type: 'Container', visible: false, list: [text('in a hidden box', { x: 150, y: 150 })] },
          { type: 'Container', visible: true, scrollFactorX: 0, list: [text('2:41 LEFT', { x: 5, y: 5 })] },
        ],
      },
    };
    expect(visibleTexts(scene)).toEqual([
      { text: '2:41 LEFT', x: 5, y: 5 },
      { text: 'MILLBROOK', x: 50, y: 200 },
    ]);
  });
});

// --- The whole description. --------------------------------------------------

describe('describeGame', () => {
  it('puts each scene’s own words and feedback details together, and takes the first busy reason', () => {
    const world = {
      scene: { key: 'world' },
      describeForTest: () => ({ busy: 'cutscene', tile: { x: 3, y: 4 } }),
      feedbackContext: () => [{ label: 'Map', value: 'Greystone Vale' }],
    };
    const battle = { scene: { key: 'battle' }, describeForTest: () => ({ busy: null, mode: 'main' }) };
    const plain = { scene: { key: 'party' } };
    const description = describeGame({
      scenes: [world, battle, plain],
      document: null,
      saveText: JSON.stringify({ raidProgress: { firstContractExtracted: true } }),
      lastEvent: 12,
    });
    expect(description.scenes).toEqual(['world', 'battle', 'party']);
    expect(description.busy).toBe('cutscene');
    expect(description.scene.world).toEqual({ busy: 'cutscene', tile: { x: 3, y: 4 }, details: { Map: 'Greystone Vale' } });
    expect(description.scene.party).toEqual({});
    expect(description.progress?.done).toBe(1);
    expect(description.lastEvent).toBe(12);
    expect(JSON.parse(JSON.stringify(description))).toEqual(description);
  });
});
