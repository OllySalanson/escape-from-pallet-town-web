/**
 * What the owner's PC makes of a player's message: a folder per message, a
 * readable `message.md` in it, one line to announce what is new, and a list
 * page of everything collected. Pure - `collect.mts` does the fetching and
 * the writing - so every word is testable without a network.
 */

/** A row of `public.feedback`, as the service key reads it. */
export interface FeedbackRow {
  readonly id: string;
  readonly tag: string;
  readonly sender_uid: string;
  readonly message: string;
  readonly context: {
    readonly version?: string;
    readonly builtAt?: string;
    readonly screen?: string;
    readonly details?: readonly { readonly label: string; readonly value: string }[];
    readonly window?: string;
    readonly browser?: string;
    readonly mode?: string;
    readonly takenAt?: string;
  };
  readonly actions: readonly { readonly at: number; readonly what: string }[];
  readonly save: string | null;
  readonly picture_path: string | null;
  readonly voice_paths: readonly string[];
  readonly voice_ms: number;
  readonly written_at: string;
  readonly created_at: string;
  readonly received_at: string | null;
}

/** What a collected message's folder holds, besides `message.md`. */
export interface CollectedFiles {
  readonly picture: string | null;
  readonly voice: readonly string[];
  readonly save: string | null;
  /** What the PC heard in the clips, if it has listened yet. */
  readonly transcript: string | null;
}

/** `2026-10-10 0405 FB-5HB5`: sorts by time, names the tag. */
export function folderName(row: Pick<FeedbackRow, 'created_at' | 'tag'>): string {
  const at = row.created_at.replace('T', ' ').slice(0, 16).replace(':', '');
  return `${at} ${row.tag}`;
}

export function voiceTime(ms: number): string {
  const seconds = Math.round(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

/** The file a clip is saved as on the PC: its own name in the bucket. */
export function clipFileName(path: string): string {
  return path.split('/').pop() ?? path;
}

/** Where the player was, one line: "Raid - Floodplain Relay, THE LANDING (13, 9), RAID 5:00". */
export function whereLine(row: Pick<FeedbackRow, 'context'>): string {
  const details = row.context.details ?? [];
  const value = (label: string): string | undefined => details.find((detail) => detail.label === label)?.value;
  const place = [value('Map'), value('Place')].filter(Boolean).join(', ');
  const parts = [
    row.context.screen,
    place && `${place}${value('Tile') ? ` (${value('Tile')})` : ''}`,
    value('Raid clock'),
    value('Fight'),
    value('Room'),
    value('Base screen') && `screen ${value('Base screen')}`,
  ].filter(Boolean);
  return parts.join(' - ');
}

/**
 * What kind of message it is, never what it says: "words", "voice 0:42" or
 * both. The announcement line is read by an agent as well as by the owner, and
 * a stranger's words quoted into it would be a stranger writing into that
 * agent's instructions - so the words stay in the folder and on the list page,
 * where they are read as what they are.
 */
export function kindOf(row: Pick<FeedbackRow, 'message' | 'voice_ms'>): string {
  const words = row.message.trim().length > 0;
  const voice = row.voice_ms > 0 ? `voice ${voiceTime(row.voice_ms)}` : '';
  return [words ? 'words' : '', voice].filter(Boolean).join(' + ') || 'empty';
}

/**
 * The screens the game names (`feedbackContext.ts`'s SCREEN_NAMES). Anything
 * else in a row came from a hand-made request, not the game, and is not
 * repeated: the database checks a tag's shape but cannot check this.
 */
export const KNOWN_SCREENS = new Set([
  'Loading', 'Title screen', 'Choosing a starter', 'The Harbour', 'Base screen', 'Raid', 'Battle',
  'Raid party', 'Raid pack', 'Field guide', 'Raid result', 'Map maker', 'Test lab', 'Unknown',
]);

export function screenOf(row: Pick<FeedbackRow, 'context'>): string {
  const screen = row.context.screen ?? 'Unknown';
  return KNOWN_SCREENS.has(screen) ? screen : 'an unknown screen';
}

/** The one line a check prints when something new has come in, and nothing otherwise. */
export function announcement(
  rows: readonly Pick<FeedbackRow, 'tag' | 'message' | 'voice_ms' | 'context'>[],
): string | null {
  if (rows.length === 0) {
    return null;
  }
  const shown = rows.slice(0, 5).map((row) => `${row.tag} (${screenOf(row)}, ${kindOf(row)})`);
  const more = rows.length > 5 ? `, and ${rows.length - 5} more` : '';
  return `Pallet Town: ${rows.length} new player note${rows.length === 1 ? '' : 's'} - ${shown.join('; ')}${more}`;
}

/** The message as a person reads it, written into its folder. */
export function messageMarkdown(row: FeedbackRow, files: CollectedFiles): string {
  const lines = [
    `# ${row.tag}`,
    '',
    `Sent ${row.written_at.replace('T', ' ').slice(0, 16)} UTC, arrived ${row.created_at.replace('T', ' ').slice(0, 16)} UTC.`,
    `Where: ${whereLine(row) || 'unknown'}`,
    `Game version: ${row.context.version ?? 'unknown'}${row.context.builtAt ? ` (built ${row.context.builtAt})` : ''}${row.context.mode && row.context.mode !== 'normal' ? `, mode ${row.context.mode}` : ''}`,
    '',
    '## What they wrote',
    '',
    row.message.trim() ? row.message.trim() : '_(nothing typed)_',
    '',
  ];
  if (files.voice.length > 0) {
    lines.push(
      `## What they said (${voiceTime(row.voice_ms)}, ${files.voice.length} clip${files.voice.length === 1 ? '' : 's'}: ${files.voice.join(', ')})`,
      '',
      files.transcript?.trim() || '_(not turned into text yet)_',
      '',
    );
  }
  lines.push(
    '## Attached',
    '',
    `- Picture: ${files.picture ?? 'none'}`,
    `- Save: ${files.save ?? 'not included'}`,
    `- Window: ${row.context.window ?? 'unknown'}`,
    `- Browser: ${row.context.browser ?? 'unknown'}`,
    ...(row.context.details ?? []).map((detail) => `- ${detail.label}: ${detail.value}`),
    '',
    '## Their last moves',
    '',
    ...(row.actions.length ? row.actions.map((action) => `- ${action.at.toFixed(1)}s ${action.what}`) : ['- none recorded']),
    '',
  );
  return lines.join('\n');
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

/** One collected message, as the list page shows it. Paths are relative to the page. */
export interface ListedNote {
  readonly folder: string;
  readonly row: FeedbackRow;
  readonly files: CollectedFiles;
}

/**
 * Every collected message on one page, newest first: the picture, the words,
 * what was said, where they were, and the way into the folder. Player text is
 * always escaped - it is a stranger's typing.
 */
export function listPage(notes: readonly ListedNote[]): string {
  const sorted = [...notes].sort((a, b) => b.row.created_at.localeCompare(a.row.created_at));
  const cards = sorted
    .map(({ folder, row, files }) => {
      const base = encodeURI(folder);
      const picture = files.picture
        ? `<a href="${base}/${encodeURI(files.picture)}"><img src="${base}/${encodeURI(files.picture)}" alt="The game when they pressed FEEDBACK"></a>`
        : '<div class="nopic">no picture</div>';
      const voice = files.voice
        .map((clip) => `<audio controls preload="none" src="${base}/${encodeURI(clip)}"></audio>`)
        .join('');
      return `<article>
  ${picture}
  <div class="body">
    <h2>${escapeHtml(row.tag)} <small>${escapeHtml(row.created_at.replace('T', ' ').slice(0, 16))} UTC</small></h2>
    <p class="where">${escapeHtml(whereLine(row) || 'unknown')}</p>
    ${row.message.trim() ? `<blockquote>${escapeHtml(row.message.trim()).replaceAll('\n', '<br>')}</blockquote>` : ''}
    ${files.voice.length ? `<p class="said"><b>Said (${voiceTime(row.voice_ms)}):</b> ${files.transcript?.trim() ? escapeHtml(files.transcript.trim()) : '<i>not turned into text yet</i>'}</p>${voice}` : ''}
    <p class="links"><a href="${base}/message.md">message.md</a>${files.save ? ` &middot; <a href="${base}/${encodeURI(files.save)}">save</a>` : ''} &middot; version ${escapeHtml(row.context.version ?? '?')}</p>
  </div>
</article>`;
    })
    .join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Pallet Town feedback</title>
<style>
:root { --bg: #f4f3e6; --card: #fffef6; --ink: #202020; --soft: #5d5c47; --line: #d3d2a9; --accent: #1d6a4f; }
@media (prefers-color-scheme: dark) { :root { --bg: #11161f; --card: #1a2230; --ink: #ebeac5; --soft: #9cafc7; --line: #2c3a4f; --accent: #55d6be; } }
body { margin: 0; background: var(--bg); color: var(--ink); font: 16px/1.45 system-ui, sans-serif; }
main { max-width: 980px; margin: 0 auto; padding: 24px 16px 64px; }
h1 { font-size: 22px; margin: 0 0 4px; }
.count { color: var(--soft); margin: 0 0 20px; }
article { display: grid; grid-template-columns: 240px minmax(0, 1fr); gap: 16px; background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 14px; margin-bottom: 14px; }
img { width: 240px; image-rendering: pixelated; border-radius: 4px; display: block; }
.nopic { width: 240px; height: 150px; display: grid; place-items: center; color: var(--soft); border: 1px dashed var(--line); border-radius: 4px; }
h2 { font-size: 17px; margin: 0; } h2 small { color: var(--soft); font-weight: 400; }
.where { color: var(--soft); margin: 2px 0 8px; }
blockquote { margin: 0 0 8px; padding: 6px 10px; border-left: 3px solid var(--accent); white-space: normal; }
audio { display: block; margin: 4px 0; max-width: 100%; }
.links { font-size: 14px; color: var(--soft); margin: 8px 0 0; } a { color: var(--accent); }
@media (max-width: 640px) { article { grid-template-columns: minmax(0, 1fr); } img, .nopic { width: 100%; } }
</style>
</head>
<body>
<main>
<h1>Pallet Town feedback</h1>
<p class="count">${notes.length} message${notes.length === 1 ? '' : 's'} from players, newest first.</p>
${cards || '<p>Nothing yet.</p>'}
</main>
</body>
</html>
`;
}
