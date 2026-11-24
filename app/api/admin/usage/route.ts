import { json, route } from '@/lib/auth';
import { HttpError } from '@/lib/errors';
import { emailsOf, isAdmin } from '@/lib/plan';
import { getSettings } from '@/lib/settings';
import { usageReport } from '@/lib/usage';

/** This month's Inworld usage per user, with estimated cost and the estimated remaining balance. */
export const GET = route(async (_req, _params, userId) => {
  if (!(await isAdmin(userId))) throw new HttpError(403, 'forbidden', 'Admins only.');
  return json(await usageReport(await getSettings(true), emailsOf));
});
