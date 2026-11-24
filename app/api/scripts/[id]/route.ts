import { json, route } from '@/lib/auth';
import { db } from '@/lib/db';
import { getScriptLimits } from '@/lib/plan';
import { getScript, saveScript } from '@/lib/store';

type P = { id: string };

export const GET = route<P>(async (_req, { id }, userId) => {
  const script = await getScript(userId, id);
  return script ? json(script) : json({ error: 'not found' }, 404);
});

/** Full save from the editor. */
export const PUT = route<P>(async (req, { id }, userId) => {
  await saveScript(userId, id, await req.json(), await getScriptLimits(userId));
  return json(await getScript(userId, id));
});

/** Small updates: rehearsal position, who I am, how lines are recorded. */
export const PATCH = route<P>(async (req, { id }, userId) => {
  const body = await req.json();
  const sql = await db();
  if (typeof body.last_line_idx === 'number')
    await sql`update scripts set last_line_idx = ${body.last_line_idx}
              where id = ${id} and user_id = ${userId}`;
  if (typeof body.my_character_id === 'string')
    await sql`update scripts set my_character_id = ${body.my_character_id}
              where id = ${id} and user_id = ${userId} and exists (select 1 from characters
                where id = ${body.my_character_id} and script_id = ${id})`;
  if (body.recording_mode === 'ai' || body.recording_mode === 'own')
    await sql`update scripts set recording_mode = ${body.recording_mode} where id = ${id} and user_id = ${userId}`;
  return json({ ok: true });
});

export const DELETE = route<P>(async (_req, { id }, userId) => {
  const sql = await db();
  await sql`delete from scripts where id = ${id} and user_id = ${userId}`;
  return json({ ok: true });
});
