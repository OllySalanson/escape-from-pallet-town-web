// What a stranger can do to the game's Supabase project, asked from outside.
//
//   node tools/supabase/anonymousProbe.mjs [--send]
//
// Signs in as a fresh anonymous visitor - exactly what every player's browser
// is - and tries every door that must stay shut: reading the review tables and
// the feedback inbox, listing or downloading anyone's files, uploading into
// someone else's folder or a type the bucket does not take, claiming another
// player's file in a message, blocking a maker, calling the API with no
// session at all. Each must be refused. With --send it also sends one real
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

const signUp = await call('/auth/v1/signup', { method: 'POST', body: {} });
if (!signUp.json?.access_token) {
  console.log(`cannot sign in anonymously: ${signUp.status} ${JSON.stringify(signUp.json)}`);
  process.exit(2);
}
const token = signUp.json.access_token;
const me = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString()).sub;
const someone = '00000000-0000-4000-8000-000000000000';
const message = (tag, extra = {}) => ({ tag, message: 'anonymous probe', context: {}, actions: [], save: null, picture_path: null, voice_paths: [], voice_ms: 0, written_at: new Date().toISOString(), ...extra });

for (const table of ['feedback', 'map_submissions', 'admins', 'blocked_makers']) {
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

const list = await call('/storage/v1/object/list/feedback', { method: 'POST', token, body: { prefix: '' } });
check(Array.isArray(list.json) ? list.json.length === 0 : list.status >= 400, `lists no feedback files (${list.status})`);
const foreign = await call(`/storage/v1/object/feedback/${someone}/FB-AAAA/picture.png`, { method: 'POST', token, body: 'x', type: 'image/png' });
check(foreign.status >= 400, `cannot upload into someone else's folder (${foreign.status})`);
const html = await call(`/storage/v1/object/feedback/${me}/FB-AAAA/page.html`, { method: 'POST', token, body: '<b>', type: 'text/html' });
check(html.status >= 400, `cannot upload a type the bucket does not take (${html.status})`);
const claim = await call('/rest/v1/rpc/submit_feedback', { method: 'POST', token, body: message('FB-AAAA', { picture_path: `${someone}/FB-AAAA/picture.png` }) });
check(claim.status >= 400, `cannot claim a file it did not upload (${claim.status})`);
const empty = await call('/rest/v1/rpc/submit_feedback', { method: 'POST', token, body: message('FB-AAAB', { message: '' }) });
check(empty.status >= 400, `cannot send a message with nothing in it (${empty.status})`);
const nobody = await call('/rest/v1/rpc/submit_feedback', { method: 'POST', body: message('FB-AAAC') });
check(nobody.status >= 400, `cannot send without a session (${nobody.status})`);

if (send) {
  // A one-pixel PNG, and the two calls the game makes.
  const pixel = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGNgYGD4DwABBAEAwS2OUAAAAABJRU5ErkJggg==', 'base64');
  const tag = 'FB-PRBF';
  const upload = await call(`/storage/v1/object/feedback/${me}/${tag}/picture.png`, { method: 'POST', token, body: pixel, type: 'image/png' });
  check(upload.status === 200, `can upload a picture into its own folder (${upload.status})`);
  const sent = await call('/rest/v1/rpc/submit_feedback', { method: 'POST', token, body: message(tag, { message: 'anonymous probe: delete me', picture_path: `${me}/${tag}/picture.png` }) });
  check(sent.json === tag, `can send a message with that picture (${JSON.stringify(sent.json)})`);
  const again = await call('/rest/v1/rpc/submit_feedback', { method: 'POST', token, body: message(tag, { message: 'anonymous probe: delete me', picture_path: `${me}/${tag}/picture.png` }) });
  check(again.json === tag, 'sending the same message again is answered, not stored twice');
}

console.log(failures.length ? `\n${failures.length} door(s) open` : '\nevery door shut');
process.exit(failures.length ? 1 : 0);
