import { json, route } from '@/lib/auth';
import { db } from '@/lib/db';
import { audioHash, synthesize } from '@/lib/inworld';
import { spokenOf } from '@/lib/store';

export const maxDuration = 60;

type P = { id: string };

/** Creates the recording for one line (or re-creates it with { force: true }). */
export const POST = route<P>(async (req, { id }) => {
  const { force } = await req.json().catch(() => ({ force: false }));
  const sql = await db();
  const [line] = await sql`
    select l.text, l.spoken_text, l.audio_hash, l.audio is not null as has_audio,
           l.audio_timings, c.voice_id
    from lines l join characters c on c.id = l.character_id where l.id = ${id}`;
  if (!line) return json({ error: 'not found' }, 404);
  const spoken = spokenOf(line as never);
  const hash = audioHash(spoken, line.voice_id);
  if (!spoken) {
    await sql`update lines set audio = null, audio_timings = null, audio_hash = null where id = ${id}`;
    return json({ has_audio: false, fresh: false, hash, timings: null });
  }
  if (!line.voice_id) return json({ error: 'This character has no voice selected' }, 400);
  if (!force && line.has_audio && line.audio_hash === hash)
    return json({ has_audio: true, fresh: true, hash, timings: line.audio_timings });
  const { audio, timings } = await synthesize(spoken, line.voice_id);
  await sql`update lines set audio = ${audio}, audio_timings = ${sql.json(timings)},
            audio_hash = ${hash} where id = ${id}`;
  return json({ has_audio: true, fresh: true, hash, timings });
});

export const GET = route<P>(async (_req, { id }) => {
  const sql = await db();
  const [row] = await sql`select audio from lines where id = ${id}`;
  if (!row?.audio) return json({ error: 'not found' }, 404);
  return new Response(new Uint8Array(row.audio), {
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, no-store' },
  });
});
