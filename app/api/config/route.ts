import { json, route } from '@/lib/auth';
import { isAdmin, personalInworldKey } from '@/lib/plan';
import { getSettings } from '@/lib/settings';

/** What the app needs to know about switches and about this account. */
export const GET = route(async (_req, _params, userId) => {
  const [settings, admin, personalKey] = await Promise.all([getSettings(), isAdmin(userId), personalInworldKey(userId)]);
  // An account with a personal Inworld key keeps its AI voices when the shared ones are switched off.
  return json({ aiVoices: settings.aiVoices || !!personalKey, admin });
});
