import { json, route } from '@/lib/auth';
import { listVoices } from '@/lib/inworld';

export const GET = route(async (req) => {
  const lang = new URL(req.url).searchParams.get('lang') || 'he';
  const voices = (await listVoices()).filter((v) => v.lang.startsWith(lang));
  return json(voices);
});
