const crypto = require('crypto');
const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOK = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const SECRET = process.env.AUTH_SECRET || '';

async function redis(...cmd) {
  const r = await fetch(URL_, { method: 'POST', headers: { Authorization: 'Bearer ' + TOK }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
const mac = (s) => crypto.createHmac('sha256', SECRET).update(s).digest('base64url');
function sign(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return body + '.' + mac(body);
}
function getUser(req) {
  const m = (req.headers.cookie || '').match(/cipher=([^;]+)/);
  if (!m || !SECRET) return null;
  const [body, sig] = m[1].split('.');
  const good = mac(body || '');
  if (!sig || sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  const p = JSON.parse(Buffer.from(body, 'base64url').toString());
  return p.exp > Date.now() ? p.u : null;
}
function setSession(res, name, remember) {
  const ms = remember ? 30 * 864e5 : 864e5;
  const tok = sign({ u: name, exp: Date.now() + ms });
  res.setHeader('Set-Cookie', `cipher=${tok}; HttpOnly; Secure; SameSite=Lax; Path=/${remember ? '; Max-Age=' + ms / 1000 : ''}`);
}
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 64).toString('hex');
module.exports = { redis, getUser, setSession, hash, crypto };
