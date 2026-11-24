# Acting Tools

A mobile-first, Hebrew-first (English switchable) set of tools for actors. After signing in
there are two tools:

- **לימוד טקסט (Learn a script)** — upload a scene, choose who you are, and the app speaks every
  other character with a fitting voice, stops on your lines and continues when you tap.
- **טבלה בשיטת צ׳באק (Chubbuck worksheet)** — upload a scene, confirm the text, and download a
  Word file: a framed box of general questions (overall objective, substitution, scene objective,
  obstacles, moment before, given circumstances, place and fourth wall) and a table with one row
  per speech and the columns (right to left) obstacles / text / actions / doings / inner dialogue,
  with no horizontal lines between speeches. Worksheets are saved per user and can be downloaded
  again, edited or deleted. **No AI is used for this tool**: the file (PDF, Word, ODT, RTF, HTML or
  text) is read in the browser and the speakers are found by code from the layout (bold or styled
  names on their own line, `NAME: text`, bold name prefix, `NAME - text`, capitals). The text is
  kept exactly as written, and the check screen can fix anything the code got wrong (rename or add
  characters, change a speaker, merge, split at the cursor, add or delete a speech). The reading
  code is `lib/script/`, shared in spirit with the standalone Chubbuck Table project.

## How script learning works

1. **Upload** a PDF, Word, ODT, RTF, HTML or text file. The file is read in the browser and the
   speakers are found by code from the layout (no AI). Stage directions stay in `(parentheses)`;
   narration lines that are not in brackets (told apart by how they look: italic, or aligned
   differently from the dialogue) are put in brackets too. Whatever is in brackets is shown, never spoken.
2. **Confirm** the characters (name, gender, voice with preview), choose **who you are**, then confirm
   the lines. Gender is only filled in when the name says so ("הוא", "אמא"); otherwise the user chooses.
3. **Choose how the other characters are recorded**: AI voices (the default, **Inworld TTS**) or the
   user's own voice. With own voice, a recorder goes through the other characters' lines one by one
   (record, listen, record again, save). Recordings are stored in the database and are created once;
   Play never re-creates them.
4. **Play**: the current line is shown zoomed in, words are highlighted as they are spoken, upcoming
   lines are listed below. On your line the app waits for a tap / Enter / Space.

Extras: start from any line, continue where you stopped, memorize mode (hides your lines),
speech speed, replay last cue, pause, change who you are, switch between AI and own recordings,
edit lines, re-record a line or all lines, open the original file.

**No AI language model is used anywhere in the app.** The only paid service is Inworld (voices).
Hebrew pronunciation of a line can be fixed by hand in Settings: write a phonetic spelling or
`/IPA/` in the line's pronunciation field and re-record.

## Admin panel

`/admin` is open only to the accounts listed in `EXTENDED_LIMIT_EMAILS` (the email must be verified).
It has a switch for **AI voices (Inworld)**. When it is off no request is sent to Inworld: new scenes
can only be recorded in the user's own voice, voice pickers are hidden, and AI recordings that already
exist keep playing.

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
| Script length | 10 pages (PDF) and 4,000 words (any file, however few pages). Accounts listed in `EXTENDED_LIMIT_EMAILS` get 30 pages and 12,000 words. Longer scripts are rejected before any analysis; the word limit also applies to edited text when it is saved. |
| Saved worksheets | 100 per user |

## Environment variables

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk Dashboard → API keys. |
| `CLERK_SECRET_KEY` | Clerk Dashboard → API keys. |
| `DB_URL` | Supabase **Transaction pooler** connection string (port 6543). The direct `db.<ref>.supabase.co:5432` string is IPv6-only and does not work on Vercel. |
| `INWORLD_API_KEY` | The Base64 "Basic" key from the Inworld portal. |
| `EXTENDED_LIMIT_EMAILS` | Optional. Comma-separated emails whose accounts get the 30-page limit and the admin panel. The email must be verified in Clerk. |
| `INWORLD_MODEL` | Optional, default `inworld-tts-1.5-max`. |
| `ADAM_API_KEY` + `ADAM_API_KEY_EMAIL` | Optional. A personal Inworld key and the (verified) email of the account it belongs to: that account's AI recordings are made with this key instead of `INWORLD_API_KEY`, also when AI voices are switched off in the admin panel. |
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
