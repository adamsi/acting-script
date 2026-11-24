import { json, route } from '@/lib/auth';
import { HttpError } from '@/lib/errors';
import { isAdmin } from '@/lib/plan';
import { deleteUser } from '@/lib/users';

/** Deletes an account and what it saved. Admins only. */
export const DELETE = route<{ id: string }>(async (_req, { id }, userId) => {
  if (!(await isAdmin(userId))) throw new HttpError(403, 'forbidden', 'Admins only.');
  await deleteUser(userId, id);
  return json({ ok: true });
});
