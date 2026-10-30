# Cipher

An AI chat app for Vercel. Static front end plus a serverless API, powered by DeepSeek.

## Deploy
1. Push this folder to a GitHub repo, then import it in Vercel (Add New, then Project).
2. Add this under **Settings, Environment Variables** (sign-in is currently off, so no database is needed):
   - `DEEPSEEK_API_KEY` from platform.deepseek.com
3. Redeploy. Every push to `main` now deploys automatically.

The model dropdown only shows models your key can use. To add another provider, edit `PROVIDERS` in `api/chat.js`.

## What it does
- Streaming replies with a stop button, markdown, and copyable code blocks
- Edit your messages and regenerate replies
- Live preview panel for any HTML page Cipher writes
- Memory: Cipher remembers lasting facts you tell it (stored in your browser, manage it under Memory)
- School modes, chat history, notes download, focus timer

## Bringing sign-in back
Set `REQUIRE_LOGIN=true` in `index.html`, add `REQUIRE_LOGIN=true`, `AUTH_SECRET` and Upstash Redis in Vercel, then redeploy. The sign-in code is still in `api/auth.js`.

Passwords are hashed with scrypt. Sessions are signed HttpOnly cookies; "Remember me" keeps you signed in for 30 days.
