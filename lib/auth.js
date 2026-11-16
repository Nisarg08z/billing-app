import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { getDb } from './mongo';

export const COOKIE = 'bs_session';
export const MAX_AGE = 60 * 60 * 24 * 180; // stay signed in for 180 days
const scrypt = promisify(crypto.scrypt);

/* The password starts as APP_PASSWORD from .env.local. Once it is changed in Settings, a scrypt hash
   is kept in MongoDB (config collection, _id 'auth') and APP_PASSWORD is no longer used. */
const g = globalThis;
async function stored() {
  if (g._bsAuth && Date.now() - g._bsAuth.at < 30000) return g._bsAuth.doc;
  const db = await getDb();
  const doc = await db.collection('config').findOne({ _id: 'auth' });
  g._bsAuth = { doc, at: Date.now() };
  return doc;
}

const secret = () => process.env.AUTH_SECRET || process.env.APP_PASSWORD || '';

// The cookie is an HMAC of the current password (or its hash): changing the password signs every other phone out.
export async function sessionToken() {
  const doc = await stored();
  const basis = doc?.hash || process.env.APP_PASSWORD;
  if (!basis) return null;
  return crypto.createHmac('sha256', secret()).update('session:' + basis).digest('hex');
}

function same(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export async function passwordOk(input) {
  if (typeof input !== 'string' || !input) return false;
  const doc = await stored();
  if (doc?.hash) {
    const h = (await scrypt(input, doc.salt, 64)).toString('hex');
    return same(h, doc.hash);
  }
  const pw = process.env.APP_PASSWORD;
  return !!pw && same(input, pw);
}

export async function setPassword(next) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = (await scrypt(next, salt, 64)).toString('hex');
  const db = await getDb();
  await db.collection('config').replaceOne({ _id: 'auth' }, { salt, hash, changedAt: new Date() }, { upsert: true });
  g._bsAuth = null;
}

export async function hasPassword() {
  return !!((await stored())?.hash || process.env.APP_PASSWORD);
}

export function sessionCookie(token) {
  return `${COOKIE}=${token}; Path=/; Max-Age=${MAX_AGE}; HttpOnly; SameSite=Lax${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`;
}

export async function isAuthed() {
  const got = (await cookies()).get(COOKIE)?.value;
  if (!got) return false;
  const want = await sessionToken();
  return !!want && same(got, want);
}

// Use at the top of every API route: returns a 401 response, or null when signed in
export async function guard() {
  return (await isAuthed()) ? null : Response.json({ error: 'Not signed in' }, { status: 401 });
}
