import { json, route } from '@/lib/auth';
import { db } from '@/lib/db';
import { audioHash, synthesize } from '@/lib/inworld';
import { spokenOf } from '@/lib/store';

export const maxDuration = 300;

type P = { id: string };

/**
 * Creates the recording for one line (or re-creates it with { force: true }).
 * { improve: true } also checks the Hebrew pronunciation and corrects mispronounced words (slow).
 */
export const POST = route<P>(async (req, { id }) => {
  const { force, improve } = await req.json().catch(() => ({ force: false, improve: false }));
  const sql = await db();
  const [line] = await sql`
    select l.text, l.spoken_text, l.audio_hash, l.audio is not null as has_audio,
           l.audio_timings, l.audio_improved, l.script_id, l.idx, c.voice_id, c.name, c.gender
    from lines l join characters c on c.id = l.character_id where l.id = ${id}`;
  if (!line) return json({ error: 'not found' }, 404);
  const spoken = spokenOf(line as never);
  const hash = audioHash(spoken, line.voice_id);
  if (!spoken) {
    await sql`update lines set audio = null, audio_timings = null, audio_hash = null where id = ${id}`;
    return json({ has_audio: false, fresh: false, improved: false, hash, timings: null });
  }
  if (!line.voice_id) return json({ error: 'This character has no voice selected' }, 400);
  const custom = !!(line.spoken_text || '').trim();
  if (!force && line.has_audio && line.audio_hash === hash && (!improve || line.audio_improved))
    return json({ has_audio: true, fresh: true, improved: line.audio_improved, hash, timings: line.audio_timings, fixes: [] });
  // A pronunciation written by the user is spoken as is; otherwise Hebrew is checked automatically.
  let context: string | undefined;
  if (improve && !custom) {
    const cast = await sql`select name, gender from characters where script_id = ${line.script_id} order by idx`;
    const before = await sql`
      select c.name, l.text from lines l join characters c on c.id = l.character_id
      where l.script_id = ${line.script_id} and l.idx < ${line.idx} order by l.idx desc limit 3`;
    context = [
      `Characters: ${cast.map((c) => `${c.name} (${c.gender})`).join(', ')}`,
      `Speaker of this line: ${line.name} (${line.gender})`,
      `Previous lines:\n${before.reverse().map((b) => `${b.name}: ${b.text}`).join('\n') || '(scene start)'}`,
    ].join('\n');
  }
  const { audio, timings, fixes, checked } = await synthesize(spoken, line.voice_id, context);
  await sql`update lines set audio = ${audio}, audio_timings = ${sql.json(timings)},
            audio_hash = ${hash}, audio_improved = ${checked || custom} where id = ${id}`;
  return json({ has_audio: true, fresh: true, improved: checked || custom, hash, timings, fixes });
});

export const GET = route<P>(async (_req, { id }) => {
  const sql = await db();
  const [row] = await sql`select audio from lines where id = ${id}`;
  if (!row?.audio) return json({ error: 'not found' }, 404);
  return new Response(new Uint8Array(row.audio), {
    headers: { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'private, no-store' },
  });
});
