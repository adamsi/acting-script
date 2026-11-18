import { json, route } from '@/lib/auth';
import { db } from '@/lib/db';
import { getScript, saveScript } from '@/lib/store';

type P = { id: string };

export const GET = route<P>(async (_req, { id }) => {
  const script = await getScript(id);
  return script ? json(script) : json({ error: 'not found' }, 404);
});

/** Full save from the editor. */
export const PUT = route<P>(async (req, { id }) => {
  await saveScript(id, await req.json());
  return json(await getScript(id));
});

/** Small updates: rehearsal position, who I am. */
export const PATCH = route<P>(async (req, { id }) => {
  const body = await req.json();
  const sql = await db();
  if (typeof body.last_line_idx === 'number')
    await sql`update scripts set last_line_idx = ${body.last_line_idx} where id = ${id}`;
  if (typeof body.my_character_id === 'string')
    await sql`update scripts set my_character_id = ${body.my_character_id}
              where id = ${id} and exists (select 1 from characters
                where id = ${body.my_character_id} and script_id = ${id})`;
  return json({ ok: true });
});

export const DELETE = route<P>(async (_req, { id }) => {
  const sql = await db();
  await sql`delete from scripts where id = ${id}`;
  return json({ ok: true });
});
