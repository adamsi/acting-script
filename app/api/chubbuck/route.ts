import { json, route } from '@/lib/auth';
import { cleanWorksheet, listWorksheets, saveWorksheet } from '@/lib/worksheets';

/** The user's saved worksheets. */
export const GET = route(async (_req, _params, userId) => json(await listWorksheets(userId)));

/** Saves the confirmed worksheet ({ id } replaces an existing one). The Word file is built on download. */
export const POST = route(async (req, _params, userId) => {
  const body = await req.json();
  const id = await saveWorksheet(userId, typeof body.id === 'string' ? body.id : null, cleanWorksheet(body));
  return json({ id });
});
