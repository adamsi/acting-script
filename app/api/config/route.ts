import { json, route } from '@/lib/auth';
import { isAdmin } from '@/lib/plan';
import { getSettings } from '@/lib/settings';

/** What the app needs to know about switches and about this account. */
export const GET = route(async (_req, _params, userId) => {
  const [settings, admin] = await Promise.all([getSettings(), isAdmin(userId)]);
  return json({ aiVoices: settings.aiVoices, admin });
});
