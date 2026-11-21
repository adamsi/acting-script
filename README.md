# Acting Tools

A mobile-first, Hebrew-first (English switchable) set of tools for actors. After signing in
there are two tools:

- **לימוד טקסט (Learn a script)** — upload a scene, choose who you are, and the app speaks every
  other character with a fitting voice, stops on your lines and continues when you tap.
- **טבלה בשיטת צ׳באק (Chubbuck worksheet)** — upload a scene, confirm the text, and download a
  Word file: a framed box of general questions (overall objective, substitution, scene objective,
  obstacles, moment before, given circumstances, place and fourth wall) and a table with one row
  per speech and the columns text / actions / obstacles / doings / inner dialogue. Nothing from
  this tool is stored.

## How script learning works

1. **Upload** a PDF / `.docx` / `.txt`. OpenAI extracts the title, characters (with gender) and every line in order. Stage directions stay in `(parentheses)` — shown, never spoken.
2. **Confirm** the characters (name, gender, voice with preview), choose **who you are**, then confirm the lines. Nothing is saved before you confirm.
3. Recordings for the other characters are generated with **Inworld TTS** and stored in the database, including word timings. They are created once; Play never re-creates them.
4. **Play**: the current line is shown zoomed in, words are highlighted as they are spoken, upcoming lines are listed below. On your line the app waits for a tap / Enter / Space.

Extras: start from any line, continue where you stopped, memorize mode (hides your lines),
speech speed, replay last cue, pause, change who you are, edit lines, re-record a line or all
lines, open the original file.

### Hebrew pronunciation

Unvocalized Hebrew is ambiguous and the TTS engine guesses some words wrong (and ignores nikud).
Inworld reports the phonemes it actually spoke, so **Improve Hebrew pronunciation** on the scene
page sends each recorded line's phonemes, with scene context, to OpenAI, which returns only the
mispronounced words in IPA; those words are re-spoken from inline `/IPA/`, which the engine
pronounces literally. It takes a few minutes per scene. A line can also be fixed by hand in
Settings: write a phonetic spelling or `/IPA/` in the line's pronunciation field and re-record.

## Stack

Next.js (App Router) — frontend and API routes in one project, deployable to Vercel as is.
Postgres (Supabase) stores scripts, the original file and the recordings. Tables are created
automatically on first request.

## Accounts and limits

Users register and sign in with [Clerk](https://clerk.com). Every scene belongs to the user who
created it; nobody else can read, change or play it.

| Limit | Value |
| --- | --- |
| New scenes per user | 20 per calendar month (UTC). Deleting a scene does not give one back. |
| Upload size | 4MB |
| Script length | 30 pages for PDF; about 54,000 characters for Word / text files. Longer scripts are rejected before any analysis. |

## Environment variables

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → API keys. |
| `CLERK_SECRET_KEY` | Clerk Dashboard → API keys. |
| `DB_URL` | Supabase **Transaction pooler** connection string (port 6543). The direct `db.<ref>.supabase.co:5432` string is IPv6-only and does not work on Vercel. |
| `OPENAI_API_KEY` | Used to analyze uploaded scripts and to check Hebrew pronunciation. |
| `INWORLD_API_KEY` | The Base64 "Basic" key from the Inworld portal. |
| `OPENAI_MODEL` | Optional, default `gpt-5.4`. |
| `INWORLD_MODEL` | Optional, default `inworld-tts-1.5-max`. |
| `PRONUNCIATION_EFFORT` | Optional, OpenAI reasoning effort for the pronunciation check, default `medium`. |
| `CLERK_JWT_KEY` | Optional. Clerk's JWKS public key, to verify sessions without a network request. |

## Deploy on Vercel

1. vercel.com → **Add New → Project** → import this repository (framework is detected as Next.js; no settings to change).
2. Add the environment variables above and press **Deploy**.
3. Open the site, register, and upload a scene.

Clerk development keys (`pk_test_…`) work on a `*.vercel.app` address but are for testing only.
A Clerk production instance needs a domain you own.

## Local development

```bash
cp .env.example .env.local   # fill in the values
npm install
npm run dev
npm test
```
