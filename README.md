[README.md](https://github.com/user-attachments/files/33705201/README.md)[Uploading REA# Cipher

A sign-in-protected AI chat app for Vercel. Static front end + serverless API.

## Deploy
1. Push this folder to a GitHub repo, then import it in Vercel (Add New → Project).
2. Add this under **Settings → Environment Variables** (sign-in is currently off, so no database is needed):
   - `GROQ_API_KEY` – from console.groq.com
   - `DEEPSEEK_API_KEY` – from platform.deepseek.com
   (add one or both; the model dropdown only shows models whose key is set. Edit the `MODELS` list in `api/chat.js` to add more.)
3. Redeploy. Every push to `main` now deploys automatically.

Passwords are hashed with scrypt. Sessions are signed HttpOnly cookies; "Remember me" keeps you signed in for 30 days.

## Bringing sign-in back
Set `REQUIRE_LOGIN=true` in `index.html`, add `REQUIRE_LOGIN=true`, `AUTH_SECRET` and Upstash Redis in Vercel, then redeploy. The sign-in code is still in `api/auth.js`.
DME.md…]()
