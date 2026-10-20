const L = require('./_lib');
const MODES = {
  study: ' Study mode: teach step by step, check understanding, and ask one short question at the end.',
  code: ' Code mode: give working code in fenced blocks with a brief explanation.'
};
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).end();
  const user = L.getUser(req);
  if (!user) return res.status(401).json({ error: 'Please sign in.' });
  const { messages = [], mode = '' } = req.body || {};
  const system = `You are Cipher, a sharp, friendly AI assistant. If asked who you are, you are Cipher. Never name another model or company as your maker. Keep answers clear and concise. The user's name is ${user}.` + (MODES[mode] || '');
  try {
    const r = await fetch(process.env.LLM_BASE_URL || 'https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + process.env.LLM_API_KEY },
      body: JSON.stringify({
        model: process.env.LLM_MODEL || 'llama-3.3-70b-versatile',
        stream: true,
        messages: [{ role: 'system', content: system }, ...messages.slice(-30)]
      })
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
