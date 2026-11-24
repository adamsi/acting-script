import { json, route } from '@/lib/auth';
import { listVoices } from '@/lib/inworld';
import { personalInworldKey } from '@/lib/plan';

export const GET = route(async (req, _params, userId) => {
  const lang = new URL(req.url).searchParams.get('lang') || 'he';
  const voices = (await listVoices(await personalInworldKey(userId))).filter((v) => v.lang.startsWith(lang));
  return json(voices);
});
