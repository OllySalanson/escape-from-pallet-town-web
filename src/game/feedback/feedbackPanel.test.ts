import { describe, expect, it } from 'vitest';
import { allLines, commitBar, countLine, outcomeMarkup, panelMarkup, type PanelView } from './feedbackPanel';
import { MAX_FEEDBACK_TEXT } from './feedbackNote';

const view: PanelView = {
  pictureUrl: 'blob:picture',
  includePicture: true,
  includeSave: true,
  hasSave: true,
  seeAll: false,
  details: [{ label: 'Map', value: 'Route <1>' }],
  actions: [{ at: 12.5, what: 'Pressed <b>Use</b> Potion' }],
};

describe('the feedback panel', () => {
  it('will not take more than the limit, and counts toward it', () => {
    expect(panelMarkup(view)).toContain(`maxlength="${MAX_FEEDBACK_TEXT}"`);
    expect(countLine(1940)).toBe('1,940 / 2,000');
  });

  it('shows the picture, the save and everything else before anything is sent', () => {
    const markup = panelMarkup(view);
    expect(markup).toContain('src="blob:picture"');
    expect(markup).toContain('data-save aria-pressed="true"');
    expect(markup).toContain('data-see-all aria-expanded="false"');
    expect(markup).toContain('your last 1 moves');
  });

  it('says plainly when there is no picture or no save, rather than offering one', () => {
    const markup = panelMarkup({ ...view, pictureUrl: null, hasSave: false });
    expect(markup).not.toContain('data-picture');
    expect(markup).not.toContain('data-save');
    expect(markup).toContain('None this time');
    expect(markup).toContain('No save yet');
  });

  it('writes what the game logged as text, never as markup', () => {
    const lines = allLines({ ...view, seeAll: true });
    expect(lines).toContain('Pressed &lt;b&gt;Use&lt;/b&gt; Potion');
    expect(lines).toContain('Route &lt;1&gt;');
    expect(lines).toContain('Never sent');
    expect(allLines(view)).toContain('hidden');
  });

  it('asks before scrapping words, with the cursor on the safe answer last', () => {
    const bar = commitBar('scrapping');
    expect(bar.indexOf('data-scrap')).toBeLessThan(bar.indexOf('data-keep'));
  });

  it('ends on the tag, whatever became of the message, because the tag is what a player quotes back', () => {
    for (const outcome of ['sent', 'queued', 'held'] as const) {
      expect(outcomeMarkup(outcome, 'FB-7K2Q')).toContain('<span class="feedback-tag">FB-7K2Q</span>');
    }
    expect(outcomeMarkup('sent', 'FB-7K2Q')).toContain('Message extracted.');
  });
});
