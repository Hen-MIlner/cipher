const L = require('./_lib');
module.exports = async (req, res) => {
  const a = req.query.action;
  const b = req.body || {};
  try {
    if (a === 'me') return res.json({ user: L.getUser(req) });
    if (a === 'logout') {
      res.setHeader('Set-Cookie', 'cipher=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0');
      return res.json({ ok: true });
    }
    if (req.method !== 'POST') return res.status(405).end();
    const name = String(b.name || '').trim(), pw = String(b.password || '');
    if (!/^[\w .'-]{2,24}$/.test(name)) return res.status(400).json({ error: 'Use 2–24 letters, numbers or spaces for your name.' });
    if (pw.length < 6) return res.status(400).json({ error: 'Password needs at least 6 characters.' });
    const key = 'user:' + name.toLowerCase();
    if (a === 'signup') {
      const salt = L.crypto.randomBytes(16).toString('hex');
      const ok = await L.redis('SET', key, JSON.stringify({ name, salt, hash: L.hash(pw, salt) }), 'NX');
      if (!ok) return res.status(409).json({ error: 'That name is already taken. Try another.' });
      L.setSession(res, name, !!b.remember);
      return res.json({ user: name });
    }
    if (a === 'login') {
      const raw = await L.redis('GET', key);
      const u = raw && JSON.parse(raw);
      const h = u && L.hash(pw, u.salt);
      if (!u || !L.crypto.timingSafeEqual(Buffer.from(h), Buffer.from(u.hash))) return res.status(401).json({ error: 'Wrong name or password.' });
      L.setSession(res, u.name, !!b.remember);
      return res.json({ user: u.name });
    }
    res.status(404).end();
  } catch (e) {
    res.status(500).json({ error: 'Server error. Check your environment variables.' });
  }
};
