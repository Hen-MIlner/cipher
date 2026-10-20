const L = require('./_lib');
const GROQ = 'https://api.groq.com/openai/v1/chat/completions';
const DEEPSEEK = 'https://api.deepseek.com/chat/completions';
// Add or rename models here. "id" is what the dropdown sends, "model" is the provider's name for it.
const MODELS = {
  'llama-3.3-70b': { label: 'Llama 3.3 70B (Groq)', url: GROQ, key: 'GROQ_API_KEY', model: 'llama-3.3-70b-versatile' },
  'llama-3.1-8b': { label: 'Llama 3.1 8B – fast (Groq)', url: GROQ, key: 'GROQ_API_KEY', model: 'llama-3.1-8b-instant' },
  'deepseek-chat': { label: 'DeepSeek Chat', url: DEEPSEEK, key: 'DEEPSEEK_API_KEY', model: 'deepseek-chat' },
  'deepseek-reasoner': { label: 'DeepSeek Reasoner – slower, thinks first', url: DEEPSEEK, key: 'DEEPSEEK_API_KEY', model: 'deepseek-reasoner' }
};
const MODES = {
  study: ' Study mode: teach step by step, check understanding, and ask one short question at the end.',
  code: ' Code mode: give working code in fenced blocks with a brief explanation.'
};
module.exports = async (req, res) => {
  const user = L.getUser(req);
  if (process.env.REQUIRE_LOGIN === 'true' && !user) return res.status(401).json({ error: 'Please sign in.' });
  if (req.method === 'GET') {
    const models = Object.entries(MODELS).filter(([, m]) => process.env[m.key]).map(([id, m]) => ({ id, label: m.label }));
    return res.json({ models });
  }
  if (req.method !== 'POST') return res.status(405).end();
  const { messages = [], mode = '', model = '' } = req.body || {};
  const m = MODELS[model];
  if (!m || !process.env[m.key]) return res.status(400).json({ error: 'That model is not available.' });
  const system = `You are Cipher, a sharp, friendly AI assistant. If asked who you are, you are Cipher. Never name another model or company as your maker. Keep answers clear and concise. ${user ? "The user's name is " + user + '.' : ''}` + (MODES[mode] || '');
  try {
    const r = await fetch(m.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env[m.key] },
      body: JSON.stringify({ model: m.model, stream: true, messages: [{ role: 'system', content: system }, ...messages.slice(-30)] })
    });
    if (!r.ok) return res.status(502).json({ error: 'The model is unavailable right now.' });
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    for await (const chunk of r.body) res.write(chunk);
    res.end();
  } catch (e) {
    if (!res.headersSent) res.status(500).json({ error: 'Something went wrong.' });
    else res.end();
  }
};
