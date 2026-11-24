import { json, route } from '@/lib/auth';
import { HttpError } from '@/lib/errors';
import { isAdmin } from '@/lib/plan';
import { listUsers } from '@/lib/users';

/** Registered accounts for the admin panel: ?q= search, ?offset= for the next page. */
export const GET = route(async (req, _params, userId) => {
  if (!(await isAdmin(userId))) throw new HttpError(403, 'forbidden', 'Admins only.');
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim().slice(0, 100);
  const offset = Math.max(0, Math.floor(Number(url.searchParams.get('offset')) || 0));
  return json(await listUsers(userId, q, offset));
});
