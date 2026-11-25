import { json, route } from '@/lib/auth';
import { cleanArc, deleteArc, getArc, updateArc } from '@/lib/arcs';

type P = { id: string };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const GET = route<P>(async (_req, { id }, userId) => {
  const arc = UUID.test(id) ? await getArc(userId, id) : null;
  return arc ? json(arc) : json({ error: 'not found', code: 'not_found' }, 404);
});

/** Saves the answers the actor filled in. */
export const PUT = route<P>(async (req, { id }, userId) => {
  if (!UUID.test(id)) return json({ error: 'not found', code: 'not_found' }, 404);
  await updateArc(userId, id, cleanArc(await req.json()));
  return json({ ok: true });
});

export const DELETE = route<P>(async (_req, { id }, userId) => {
  if (UUID.test(id)) await deleteArc(userId, id);
  return json({ ok: true });
});
