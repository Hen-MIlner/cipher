# Cipher

A sign-in-protected AI chat app for Vercel. Static front end + serverless API.

## Deploy
1. Push this folder to a GitHub repo, then import it in Vercel (Add New → Project).
2. In the Vercel project, open **Storage** (or the Marketplace) and add **Upstash Redis**. This sets the Redis env vars for you.
3. Add these under **Settings → Environment Variables**:
   - `AUTH_SECRET` – any long random string
   - `LLM_API_KEY` – your model API key (default provider is Groq)
   - optional: `LLM_MODEL`, `LLM_BASE_URL` (any OpenAI-compatible chat endpoint)
4. Redeploy. Every push to `main` now deploys automatically.

Passwords are hashed with scrypt. Sessions are signed HttpOnly cookies; "Remember me" keeps you signed in for 30 days.
