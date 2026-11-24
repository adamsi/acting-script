import { json, route } from '@/lib/auth';
import { synthesize } from '@/lib/inworld';
import { personalInworldKey } from '@/lib/plan';
import { assertAiVoices } from '@/lib/settings';
import { recordTts } from '@/lib/usage';

export const maxDuration = 60;

export const POST = route(async (req, _params, userId) => {
  const apiKey = await personalInworldKey(userId);
  await assertAiVoices(apiKey);
  const { voice_id, text } = await req.json();
  if (!voice_id || !text) return json({ error: 'voice_id and text are required' }, 400);
  const { audio, characters } = await synthesize(String(text).slice(0, 300), voice_id, apiKey);
  await recordTts(userId, 'preview', characters, !!apiKey);
  return new Response(new Uint8Array(audio), { headers: { 'Content-Type': 'audio/mpeg' } });
});
