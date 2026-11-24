import { json, route } from '@/lib/auth';
import { synthesize } from '@/lib/inworld';
import { assertAiVoices } from '@/lib/settings';

export const maxDuration = 60;

export const POST = route(async (req) => {
  await assertAiVoices();
  const { voice_id, text } = await req.json();
  if (!voice_id || !text) return json({ error: 'voice_id and text are required' }, 400);
  const { audio } = await synthesize(String(text).slice(0, 300), voice_id);
  return new Response(new Uint8Array(audio), { headers: { 'Content-Type': 'audio/mpeg' } });
});
