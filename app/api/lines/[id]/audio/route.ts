import { json, route } from '@/lib/auth';
import { db } from '@/lib/db';
import { HttpError } from '@/lib/errors';
import { audioHash, ownAudioHash, synthesize } from '@/lib/inworld';
import { assertAiVoices } from '@/lib/settings';
import { spokenOf } from '@/lib/store';

export const maxDuration = 60;

type P = { id: string };

/** A recording the user makes of one line: a few megabytes are plenty for a speech. */
const MAX_OWN_BYTES = 3 * 1024 * 1024;

async function loadLine(id: string, userId: string) {
  const sql = await db();
  const [line] = await sql`
    select l.text, l.spoken_text, l.audio_hash, l.audio is not null as has_audio,
           l.audio_timings, l.audio_source, c.voice_id
    from lines l join characters c on c.id = l.character_id
    join scripts s on s.id = l.script_id
    where l.id = ${id} and s.user_id = ${userId}`;
  return { sql, line };
}

/** Creates the AI recording for one line (or re-creates it with { force: true }). */
export const POST = route<P>(async (req, { id }, userId) => {
  const { force } = await req.json().catch(() => ({ force: false }));
  const { sql, line } = await loadLine(id, userId);
  if (!line) return json({ error: 'not found' }, 404);
  const spoken = spokenOf(line as never);
  const hash = audioHash(spoken, line.voice_id);
  if (!spoken) {
    // Nothing is said in this line (only a stage direction).
    await sql`update lines set audio = null, audio_timings = null, audio_hash = null, audio_mime = null, audio_source = null where id = ${id}`;
    return json({ has_audio: false, fresh: false, source: null, hash, timings: null });
  }
  await assertAiVoices();
  if (!line.voice_id) return json({ error: 'This character has no voice selected' }, 400);
  if (!force && line.has_audio && line.audio_source !== 'own' && line.audio_hash === hash)
    return json({ has_audio: true, fresh: true, source: 'ai', hash, timings: line.audio_timings });
  const { audio, timings } = await synthesize(spoken, line.voice_id);
  await sql`update lines set audio = ${audio}, audio_timings = ${sql.json(timings)}, audio_hash = ${hash},
            audio_mime = 'audio/mpeg', audio_source = 'ai' where id = ${id}`;
  return json({ has_audio: true, fresh: true, source: 'ai', hash, timings });
});

/** Stores a recording the user made of this line with their own voice (multipart: file, timings). */
export const PUT = route<P>(async (req, { id }, userId) => {
  const { sql, line } = await loadLine(id, userId);
  if (!line) return json({ error: 'not found' }, 404);
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File) || !file.size) return json({ error: 'file is required' }, 400);
  if (file.size > MAX_OWN_BYTES) throw new HttpError(413, 'file_too_large', 'The recording is too long.');
  const mime = (file.type || '').split(';')[0];
  if (!/^audio\/(webm|mp4|mpeg|ogg|wav|x-m4a|aac)$/.test(mime)) return json({ error: 'not an audio recording' }, 400);

  let timings: number[][] | null = null;
  try {
    const parsed = JSON.parse(String(form.get('timings') ?? 'null'));
    if (Array.isArray(parsed) && parsed.length <= 5000 && parsed.every((t) => Array.isArray(t) && t.length === 2 && t.every((n) => typeof n === 'number' && isFinite(n))))
      timings = parsed;
  } catch {}

  const hash = ownAudioHash(spokenOf(line as never));
  await sql`update lines set audio = ${Buffer.from(await file.arrayBuffer())}, audio_timings = ${timings ? sql.json(timings) : null},
            audio_hash = ${hash}, audio_mime = ${mime}, audio_source = 'own' where id = ${id}`;
  return json({ has_audio: true, fresh: true, source: 'own', hash, timings });
});

export const GET = route<P>(async (_req, { id }, userId) => {
  const sql = await db();
  const [row] = await sql`
    select l.audio, l.audio_mime from lines l join scripts s on s.id = l.script_id
    where l.id = ${id} and s.user_id = ${userId}`;
  if (!row?.audio) return json({ error: 'not found' }, 404);
  return new Response(new Uint8Array(row.audio), {
    headers: { 'Content-Type': row.audio_mime || 'audio/mpeg', 'Cache-Control': 'private, no-store' },
  });
});
