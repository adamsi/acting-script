import { HttpError } from './errors';
import { db } from './db';
import { audioHash } from './inworld';
import { assertWordCount, type ScriptLimits } from './limits';
import { spokenText } from './text';
import type { Character, Draft, Line, Script, ScriptSummary } from './types';

export function spokenOf(line: { text: string; spoken_text: string }): string {
  return (line.spoken_text || '').trim() || spokenText(line.text);
}

export async function listScripts(userId: string): Promise<ScriptSummary[]> {
  const sql = await db();
  const rows = await sql`
    select s.id, s.title, s.author, c.name as my_name,
           (select count(*)::int from lines l where l.script_id = s.id) as line_count
    from scripts s left join characters c on c.id = s.my_character_id
    where s.user_id = ${userId}
    order by s.updated_at desc`;
  return rows as unknown as ScriptSummary[];
}

export async function getScript(userId: string, id: string): Promise<Script | null> {
  const sql = await db();
  const [s] = await sql`
    select id, title, author, language, my_character_id, last_line_idx, original_name
    from scripts where id = ${id} and user_id = ${userId}`;
  if (!s) return null;
  const characters = (await sql`
    select id, name, gender, description, voice_id from characters
    where script_id = ${id} order by idx`) as unknown as Character[];
  const voiceOf = new Map(characters.map((c) => [c.id, c.voice_id]));
  const rows = await sql`
    select id, idx, character_id, text, spoken_text, audio is not null as has_audio,
           audio_hash, audio_timings, audio_improved
    from lines where script_id = ${id} order by idx`;
  const lines: Line[] = rows.map((r) => {
    const hash = audioHash(spokenOf(r as never), voiceOf.get(r.character_id) || '');
    return {
      id: r.id,
      idx: r.idx,
      character_id: r.character_id,
      text: r.text,
      spoken_text: r.spoken_text,
      has_audio: r.has_audio,
      fresh: r.has_audio && r.audio_hash === hash,
      improved: r.has_audio && r.audio_hash === hash && r.audio_improved,
      hash,
      timings: r.audio_timings,
    };
  });
  return { ...(s as unknown as Script), characters, lines };
}

export interface Upload {
  data: Buffer;
  name: string;
  mime: string;
}

/**
 * Creates (id = null) or updates one of the user's scripts from an editor draft.
 * Existing recordings are kept. Creating also counts toward the user's monthly limit.
 */
export async function saveScript(
  userId: string,
  id: string | null,
  d: Draft,
  limits: ScriptLimits,
  file?: Upload
): Promise<string> {
  if (!d.characters.length) throw new Error('A script needs at least one character');
  // Edited text is recorded and analyzed too, so the same size limit applies to it.
  assertWordCount(d.lines.map((l) => `${l.text} ${l.spoken_text || ''}`).join(' '), limits);
  const sql = await db();
  return await sql.begin(async (tx) => {
    let scriptId = id;
    if (!scriptId) {
      const [row] = await tx`
        insert into scripts (user_id, title, author, language, original_file, original_name, original_mime)
        values (${userId}, ${d.title}, ${d.author}, ${d.language}, ${file?.data ?? null},
                ${file?.name ?? null}, ${file?.mime ?? null})
        returning id`;
      scriptId = row.id as string;
      await tx`insert into usage_events (user_id, kind) values (${userId}, 'create')`;
    } else {
      const res = await tx`
        update scripts set title = ${d.title}, author = ${d.author}, language = ${d.language},
               updated_at = now() where id = ${scriptId} and user_id = ${userId}`;
      if (!res.count) throw new HttpError(404, 'not_found', 'Script not found');
    }

    const existingChars = new Set(
      (await tx`select id from characters where script_id = ${scriptId}`).map((r) => r.id as string)
    );
    const charId = new Map<string, string>();
    for (const [idx, c] of d.characters.entries()) {
      if (c.id && existingChars.has(c.id)) {
        await tx`update characters set idx = ${idx}, name = ${c.name}, gender = ${c.gender},
                 description = ${c.description}, voice_id = ${c.voice_id} where id = ${c.id}`;
        existingChars.delete(c.id);
        charId.set(c.key, c.id);
      } else {
        const [row] = await tx`
          insert into characters (script_id, idx, name, gender, description, voice_id)
          values (${scriptId}, ${idx}, ${c.name}, ${c.gender}, ${c.description}, ${c.voice_id})
          returning id`;
        charId.set(c.key, row.id as string);
      }
    }

    const existingLines = new Set(
      (await tx`select id from lines where script_id = ${scriptId}`).map((r) => r.id as string)
    );
    const fresh: Record<string, unknown>[] = [];
    for (const [idx, l] of d.lines.entries()) {
      const character_id = charId.get(l.speaker);
      if (!character_id) throw new Error(`Line ${idx + 1} has an unknown speaker`);
      if (l.id && existingLines.has(l.id)) {
        await tx`update lines set idx = ${idx}, character_id = ${character_id}, text = ${l.text},
                 spoken_text = ${l.spoken_text || ''} where id = ${l.id}`;
        existingLines.delete(l.id);
      } else {
        fresh.push({ script_id: scriptId, idx, character_id, text: l.text, spoken_text: l.spoken_text || '' });
      }
    }
    if (fresh.length) await tx`insert into lines ${tx(fresh as never[])}`;
    if (existingLines.size) await tx`delete from lines where id in ${tx([...existingLines])}`;
    if (existingChars.size) await tx`delete from characters where id in ${tx([...existingChars])}`;

    await tx`update scripts set my_character_id = ${charId.get(d.my) ?? null} where id = ${scriptId}`;
    return scriptId;
  });
}
