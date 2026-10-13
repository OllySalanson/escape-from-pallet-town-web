// What a stranger can do to the game's Supabase project, asked from outside.
//
//   node tools/supabase/anonymousProbe.mjs [--send]
//
// Asks first what a visitor with no session can do, then that signing up
// without a passed bot check is refused. Then it signs in as a fresh anonymous
// visitor - exactly what every player's browser is, with a token from a bot
// check passed by hand in `TURNSTILE_TOKEN` once the project asks for one -
// and tries every door that must stay shut: reading the review tables and
// the feedback inbox, listing or downloading anyone's files, uploading into
// someone else's folder, under a name it was not given or a type the bucket
// does not take, asking the collector's questions, claiming another
// player's file in a message, blocking a maker, writing a console score or
// posting one the game would refuse, calling the API with no session at all.
// Each must be refused. With --send it also sends one real
// message with a one-pixel picture through the same two calls the game makes,
// which must be accepted.
//
// Against the real project it is read-only: a player cannot take back what
// they sent, so every --send there was a test row in the owner's inbox (the
// security review, L6). --send runs only against a stand-in (`SUPABASE_URL`,
// e.g. `supabase start`); the sending half on the real project is checked
// inside a transaction that is rolled back instead - see the feedback
// hardening PR. Each run still signs in one anonymous visitor.
//
// Every write asks for the rows it changed back (`return=representation`), so
// "changed nothing" is an empty list rather than an ambiguous 204.
//
// Exit code 1 is a door that opened. It needs nothing but the public URL and
// key the game itself ships (`src/game/maker/submitConfig.ts`).
import { readFileSync } from 'node:fs';

const config = readFileSync(new URL('../../src/game/maker/submitConfig.ts', import.meta.url), 'utf8');
const PRODUCTION = /SUBMISSIONS_URL = '([^']+)'/.exec(config)[1];
const URL_ = process.env.SUPABASE_URL ?? PRODUCTION;
const KEY = process.env.SUPABASE_ANON_KEY ?? /SUBMISSIONS_PUBLISHABLE_KEY = '([^']+)'/.exec(config)[1];
const send = process.argv.includes('--send');
if (send && URL_ === PRODUCTION) {
  console.log('--send writes a row nobody can take back: run it against a stand-in (SUPABASE_URL=...), never the real project.');
  process.exit(2);
}

const failures = [];
const check = (ok, what) => {
  console.log(`${ok ? 'ok  ' : 'OPEN'} ${what}`);
  if (!ok) failures.push(what);
};

async function call(path, { method = 'GET', token, body, type = 'application/json' } = {}) {
  const response = await fetch(`${URL_}${path}`, {
    method,
    headers: { apikey: KEY, prefer: 'return=representation', ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'content-type': type } : {}) },
    body: body === undefined ? undefined : type === 'application/json' ? JSON.stringify(body) : body,
  });
  const text = await response.text();
  let json;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: response.status, json };
}

const someone = '00000000-0000-4000-8000-000000000000';
const message = (tag, extra = {}) => ({ tag, message: 'anonymous probe', context: {}, actions: [], save: null, picture_path: null, voice_paths: [], voice_ms: 0, written_at: new Date().toISOString(), ...extra });
const score = (extra = {}) => ({ game: 'pallet-blocks', player_name: 'PROBE', score: 100, lines: 1, level: 1, duration_ms: 60000, ...extra });

// Signed out: everything a visitor with no session may and may not do.
const noSlot = await call('/rest/v1/rpc/reserve_feedback_uploads', { method: 'POST', body: { tag: 'FB-AAAA', names: [`${someone}/FB-AAAA/picture.png`] } });
check(noSlot.status >= 400, `cannot be given a name without a session (${noSlot.status})`);
for (const [name, body] of [['unclaimed_feedback_uploads', { older_than_hours: 24 }], ['idle_anonymous_visitors', { idle_days: 30 }]]) {
  const askedSignedOut = await call(`/rest/v1/rpc/${name}`, { method: 'POST', body });
  check(askedSignedOut.status >= 400, `cannot ask ${name} signed out (${askedSignedOut.status})`);
}
// The play counts are the owner's to read; counting is open signed out, but
// only to a batch of moments the game sends - a refused batch writes nothing,
// so this asks it without counting anybody (`analytics/playCounter.ts`).
const statsSignedOut = await call('/rest/v1/rpc/play_stats', { method: 'POST', body: {} });
check(statsSignedOut.status >= 400, `cannot read play_stats signed out (${statsSignedOut.status})`);
const oddBatch = await call('/rest/v1/rpc/record_play', {
  method: 'POST',
  body: { visitor_id: '00000000-0000-4000-8000-000000000000', build: 'probe', events: [{ kind: 'probe' }], tester: true },
});
check(oddBatch.status >= 400, `cannot count a moment the game never sends (${oddBatch.status})`);
// Raid rooms are made, joined and left only signed in (`src/game/raidRoom/`).
for (const [name, body] of [['open_raid_room', { map_id: 'route-1' }], ['join_raid_room', { room_code: 'BBBB' }], ['leave_raid_room', { room_code: 'BBBB' }], ['raid_room_seed', { room_code: 'BBBB' }], ['take_raid_loot', { room_code: 'BBBB', loot_id: 'probe' }], ['raid_loot_taken', { room_code: 'BBBB' }]]) {
  const askedSignedOut = await call(`/rest/v1/rpc/${name}`, { method: 'POST', body });
  check(askedSignedOut.status >= 400, `cannot ${name} signed out (${askedSignedOut.status})`);
}
const nobody = await call('/rest/v1/rpc/submit_feedback', { method: 'POST', body: message('FB-AAAC') });
check(nobody.status >= 400, `cannot send without a session (${nobody.status})`);
// A board is read signed out too, so looking signs nobody up (the red team's
// F10) - and that is all a signed-out visitor can call.
const strangers = await call('/rest/v1/rpc/console_leaderboard', { method: 'POST', body: { game: 'pallet-blocks' } });
check(strangers.status === 200 && Array.isArray(strangers.json) && strangers.json.every((row) => row.mine === false), `can read a board signed out, owning none of it (${strangers.status})`);
const anonymousPost = await call('/rest/v1/rpc/submit_console_score', { method: 'POST', body: score() });
check(anonymousPost.status >= 400, `cannot post a score without a session (${anonymousPost.status})`);

// Signing up takes a passed bot check (the security review's H1): without
// one, the project must refuse. With the project's captcha protection on, the
// rest of the probe needs a token from a check passed by hand -
// `TURNSTILE_TOKEN=...` - or it stops here, every signed-in door unasked.
const unchecked = await call('/auth/v1/signup', { method: 'POST', body: {} });
const asksForCheck = !unchecked.json?.access_token && /captcha/i.test(JSON.stringify(unchecked.json));
check(asksForCheck, `cannot sign up without passing the bot check (${unchecked.status}${asksForCheck ? '' : ': captcha protection is off in Authentication > Attack Protection'})`);
const captchaToken = process.env.TURNSTILE_TOKEN;
const signUp = asksForCheck
  ? captchaToken
    ? await call('/auth/v1/signup', { method: 'POST', body: { gotrue_meta_security: { captcha_token: captchaToken } } })
    : undefined
  : unchecked;
if (!signUp?.json?.access_token) {
  console.log(signUp ? `cannot sign in anonymously: ${signUp.status} ${JSON.stringify(signUp.json)}` : 'no TURNSTILE_TOKEN: the signed-in doors were not asked');
  console.log(failures.length ? `\n${failures.length} door(s) open` : '\nevery door asked is shut');
  process.exit(failures.length ? 1 : signUp ? 2 : 0);
}
const token = signUp.json.access_token;
const me = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub;

for (const table of ['feedback', 'map_submissions', 'admins', 'blocked_makers', 'raid_rooms', 'raid_room_members', 'raid_room_tries', 'raid_room_loot']) {
  const read = await call(`/rest/v1/${table}?select=*`, { token });
  check(read.status >= 400 || (Array.isArray(read.json) && read.json.length === 0), `reads nothing from ${table} (${read.status})`);
}
const block = await call('/rest/v1/blocked_makers', { method: 'POST', token, body: { maker_uid: me, reason: 'probe' } });
check(block.status >= 400, `cannot block a maker (${block.status})`);
const unblock = await call(`/rest/v1/blocked_makers?maker_uid=eq.${me}`, { method: 'DELETE', token });
check(unblock.status >= 400 || (Array.isArray(unblock.json) && unblock.json.length === 0), `cannot unblock anyone (${unblock.status} ${JSON.stringify(unblock.json)})`);
const admin = await call('/rest/v1/rpc/is_admin', { method: 'POST', token, body: {} });
check(admin.json === false, `is not an admin (${JSON.stringify(admin.json)})`);
const review = await call('/rest/v1/map_submissions?id=not.is.null', { method: 'PATCH', token, body: { status: 'approved' } });
check(review.status >= 400 || (Array.isArray(review.json) && review.json.length === 0), `cannot approve a map (${review.status} ${JSON.stringify(review.json)})`);
// Which published map a fix replaces is publishing's to record, never a player's.
const replaces = await call('/rest/v1/map_submissions?id=not.is.null', { method: 'PATCH', token, body: { map_file_id: 'sample-lane' } });
check(replaces.status >= 400 || (Array.isArray(replaces.json) && replaces.json.length === 0), `cannot say which map a submission replaces (${replaces.status} ${JSON.stringify(replaces.json)})`);
// Nor send a map as the next version of one that is not theirs: refused before
// anything is written, so this stays read-only.
const tiny = { format: 1, id: 'probe', name: 'Probe', maker: 'Probe', width: 20, height: 16, ground: Array.from({ length: 16 }, () => '.'.repeat(20)), buildings: [], dropIns: [], exits: [], itemSpots: [], wildlife: 'meadow' };
const hijack = await call('/rest/v1/rpc/submit_map', { method: 'POST', token, body: { map: tiny, maker_name: 'Probe', resubmits: 'AAAAAAAAAA' } });
check(hijack.status >= 400, `cannot send a map as the update of one it did not send (${hijack.status} ${JSON.stringify(hijack.json)})`);

// A fresh player has no house, so it can neither make a room nor try a code:
// both are refused before anything is written, so this stays read-only.
for (const [name, body] of [['open_raid_room', { map_id: 'route-1' }], ['join_raid_room', { room_code: 'BBBB' }]]) {
  const unnamed = await call(`/rest/v1/rpc/${name}`, { method: 'POST', token, body });
  check(unnamed.status >= 400, `cannot ${name} without a named house (${unnamed.status} ${JSON.stringify(unnamed.json)})`);
}

const list = await call('/storage/v1/object/list/feedback', { method: 'POST', token, body: { prefix: '' } });
check(Array.isArray(list.json) ? list.json.length === 0 : list.status >= 400, `lists no feedback files (${list.status})`);
const foreign = await call(`/storage/v1/object/feedback/${someone}/FB-AAAA/picture.png`, { method: 'POST', token, body: 'x', type: 'image/png' });
check(foreign.status >= 400, `cannot upload into someone else's folder (${foreign.status})`);
const html = await call(`/storage/v1/object/feedback/${me}/FB-AAAA/page.html`, { method: 'POST', token, body: '<b>', type: 'text/html' });
check(html.status >= 400, `cannot upload a type the bucket does not take (${html.status})`);
// A file goes in only under a name the database handed out (the red team's F7).
const unasked = await call(`/storage/v1/object/feedback/${me}/FB-AAAA/picture.png`, { method: 'POST', token, body: 'x', type: 'image/png' });
check(unasked.status >= 400, `cannot upload a file it was not given the name for (${unasked.status})`);
const otherSlot = await call('/rest/v1/rpc/reserve_feedback_uploads', { method: 'POST', token, body: { tag: 'FB-AAAA', names: [`${someone}/FB-AAAA/picture.png`] } });
check(otherSlot.status >= 400, `cannot be given a name in someone else's folder (${otherSlot.status})`);
const oddSlot = await call('/rest/v1/rpc/reserve_feedback_uploads', { method: 'POST', token, body: { tag: 'FB-AAAA', names: [`${me}/FB-AAAA/page.html`] } });
check(oddSlot.status >= 400, `cannot be given a name the game never uses (${oddSlot.status})`);
// The collector's two questions are the service key's alone.
for (const [name, body] of [['unclaimed_feedback_uploads', { older_than_hours: 24 }], ['idle_anonymous_visitors', { idle_days: 30 }]]) {
  const asked = await call(`/rest/v1/rpc/${name}`, { method: 'POST', token, body });
  check(asked.status >= 400, `cannot ask ${name} (${asked.status})`);
}
const claim = await call('/rest/v1/rpc/submit_feedback', { method: 'POST', token, body: message('FB-AAAA', { picture_path: `${someone}/FB-AAAA/picture.png` }) });
check(claim.status >= 400, `cannot claim a file it did not upload (${claim.status})`);
const empty = await call('/rest/v1/rpc/submit_feedback', { method: 'POST', token, body: message('FB-AAAB', { message: '' }) });
check(empty.status >= 400, `cannot send a message with nothing in it (${empty.status})`);

// The house console's leaderboards: a player reads a board and posts a score
// through the two functions, and nothing else. Every post here is one the
// database must refuse, so the probe stays read-only against the real project.
const scores = await call('/rest/v1/console_scores?select=*', { token });
check(scores.status >= 400 || (Array.isArray(scores.json) && scores.json.length === 0), `reads no console score rows (${scores.status})`);
const forged = await call('/rest/v1/console_scores', { method: 'POST', token, body: { game: 'pallet-blocks', player_uid: me, player_name: 'PROBE', score: 1, lines: 1, level: 1, duration_ms: 5000 } });
check(forged.status >= 400, `cannot write a score into the table (${forged.status})`);
const board = await call('/rest/v1/rpc/console_leaderboard', { method: 'POST', token, body: { game: 'pallet-blocks' } });
check(board.status === 200 && Array.isArray(board.json), `can read a board (${board.status})`);
for (const [what, body] of [
  ['a game with no board', score({ game: 'not-a-game' })],
  ['a name with markup in it', score({ player_name: '<B>' })],
  ['a rude name', score({ player_name: 'SH1T' })],
  ['a rude name spelled with a space', score({ player_name: 'FU CK' })],
  ['an impossible score', score({ score: 99999999, duration_ms: 2000 })],
]) {
  const posted = await call('/rest/v1/rpc/submit_console_score', { method: 'POST', token, body });
  check(posted.status >= 400, `cannot post ${what} (${posted.status})`);
}
if (send) {
  // A one-pixel PNG, and the two calls the game makes.
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==', 'base64');
  const tag = 'FB-PRBF';
  const slot = await call('/rest/v1/rpc/reserve_feedback_uploads', { method: 'POST', token, body: { tag, names: [`${me}/${tag}/picture.png`] } });
  check(slot.status < 300, `is given the name of its own picture (${slot.status})`);
  const upload = await call(`/storage/v1/object/feedback/${me}/${tag}/picture.png`, { method: 'POST', token, body: pixel, type: 'image/png' });
  check(upload.status === 200, `can upload a picture into its own folder (${upload.status})`);
  const sent = await call('/rest/v1/rpc/submit_feedback', { method: 'POST', token, body: message(tag, { message: 'anonymous probe: delete me', picture_path: `${me}/${tag}/picture.png` }) });
  check(sent.json === tag, `can send a message with that picture (${JSON.stringify(sent.json)})`);
  const again = await call('/rest/v1/rpc/submit_feedback', { method: 'POST', token, body: message(tag, { message: 'anonymous probe: delete me', picture_path: `${me}/${tag}/picture.png` }) });
  check(again.json === tag, 'sending the same message again is answered, not stored twice');
}

console.log(failures.length ? `\n${failures.length} door(s) open` : '\nevery door shut');
process.exit(failures.length ? 1 : 0);
