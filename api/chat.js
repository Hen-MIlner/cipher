// Cipher chat API. Set DEEPSEEK_API_KEY in Vercel.
// The model list is fetched live from each provider, so new models appear without code changes.
const PROVIDERS = {
  deepseek: { name: 'DeepSeek', key: 'DEEPSEEK_API_KEY', base: 'https://api.deepseek.com' }
};
const SKIP = /whisper|tts|orpheus|guard|embed|playai|transcri/i; // not chat models
const FIRST = ['deepseek:deepseek-chat']; // shown at the top // shown at the top
const FALLBACK = ['deepseek:deepseek-chat', 'deepseek:deepseek-reasoner'];
const MODES = {
  study: ' Study mode: teach step by step, check understanding, and end with one short question.',
  code: ' Code mode: give working code in fenced blocks with a brief explanation.',
  homework: ' Homework helper mode: do not just hand over the final answer. Ask what they have tried, give hints first, guide them one step at a time, and only show the full solution if they ask for it or are stuck.',
  quiz: ' Quiz mode: ask which subject and topic, then ask ONE question at a time, wait for the answer, say if it is right, explain briefly, and keep a running score.',
  essay: ' Essay feedback mode: give kind but honest feedback on structure, argument, evidence and clarity, then give 3 specific improvements. Do not rewrite the whole essay unless asked.',
  maths: ' Maths mode: solve step by step, label each step, state the final answer clearly, then check it.',
  simple: ' Explain simply: use plain words, short sentences and one real-life example, as if explaining to a 12 year old.'
};
let cache = { at: 0, list: [] };

async function listModels() {
  if (Date.now() - cache.at < 10 * 60 * 1000 && cache.list.length) return cache.list;
  let list = [];
  for (const [pid, p] of Object.entries(PROVIDERS)) {
    const key = process.env[p.key];
    if (!key) continue;
    try {
      const r = await fetch(p.base + '/models', { headers: { Authorization: 'Bearer ' + key } });
      const j = await r.json();
      for (const m of j.data || []) if (!SKIP.test(m.id)) list.push(`${pid}:${m.id}`);
    } catch (e) {}
    if (!list.some((id) => id.startsWith(pid + ':'))) list.push(...FALLBACK.filter((id) => id.startsWith(pid + ':')));
  }
  list = [...new Set(list)].sort((a, b) => {
    const fa = FIRST.indexOf(a), fb = FIRST.indexOf(b);
    return (fa < 0 ? 99 : fa) - (fb < 0 ? 99 : fb) || a.localeCompare(b);
  });
  cache = { at: Date.now(), list };
  return list;
}
const label = (id) => { const [pid, ...rest] = id.split(':'); return `${rest.join(':')} (${PROVIDERS[pid].name})`; };

module.exports = async (req, res) => {
  if (req.method === 'GET') {
    const list = await listModels();
    return res.json({ models: list.map((id) => ({ id, label: label(id) })) });
  }
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { messages = [], mode = '', model = '', name = '', agreed = false } = req.body || {};
  if (agreed !== true) return res.status(403).json({ error: 'Please accept the Terms and Privacy Policy first.' });
  const [pid, ...rest] = String(model).split(':');
  const p = PROVIDERS[pid], mid = rest.join(':');
  if (!p || !process.env[p.key] || !/^[\w./-]{1,80}$/.test(mid)) return res.status(400).json({ error: 'That model is not available. Check your API keys in Vercel.' });
  const who = String(name).replace(/[^\w .'-]/g, '').slice(0, 24);
  const system = 'You are Cipher, a sharp, friendly AI assistant. If asked who you are, you are Cipher. Never name another model or company as your maker. Keep answers clear and concise, in short paragraphs. Write maths in plain text (like x^2, sqrt(x), a/b), never LaTeX. Help the user learn, not just copy.' + (who ? ` The user's name is ${who}.` : '') + (MODES[mode] || '');
  try {
    const r = await fetch(p.base + '/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env[p.key] },
      body: JSON.stringify({ model: mid, stream: true, messages: [{ role: 'system', content: system }, ...messages.slice(-30)] })
    });
    if (!r.ok) return res.status(502).json({ error: `${p.name} returned an error (${r.status}) for "${mid}". Try a different model.` });
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    for await (const chunk of r.body) res.write(chunk);
    res.end();
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: 'Something went wrong reaching the model.' });
    else res.end();
  }
};
