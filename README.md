# Cipher

A study and coding assistant that runs in the browser. School modes (homework, quiz, maths, essay, explain simply), Study and Code modes, streaming replies, Markdown and code blocks with copy buttons, click-to-run HTML previews, memory you approve, chat history, a focus timer, and notes export.

Built by Henry. Powered by DeepSeek. Hosted on Vercel.

## How it works

- `index.html` is the whole front end (single file, no build step).
- `api/chat.js` is a Vercel serverless function that holds the API key, checks every request, and streams the reply back.
- `sw.js` and `manifest.json` make it installable on a phone.

## Setup

1. Push this repo to GitHub and import it in Vercel (every push to `main` deploys automatically).
2. In Vercel, open Project → Settings → Environment Variables and add `DEEPSEEK_API_KEY`.
3. Redeploy.

## Safety built in

- The API key lives only on the server and is never sent to the browser.
- The server only talks to the DeepSeek address and only accepts models it lists.
- Limits on message size, conversation length, reply length, time, requests per minute and simultaneous chats.
- Generated web pages only run when you press Preview, inside a sandboxed frame with no access to your chats or memory.
- Memory is saved only after you press Save, and you can view or delete it any time.
- Security headers (including a Content Security Policy) are set in `vercel.json`.
