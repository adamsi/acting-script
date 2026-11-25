import { json, route } from '@/lib/auth';
import { MAX_ARC_CHARS, MAX_ARC_NAME } from '@/lib/arc';
import { HttpError } from '@/lib/errors';
import { analyzeArc } from '@/lib/gemini';
import { assertCanAnalyze, recordAnalysis } from '@/lib/limits';

export const maxDuration = 300;

/** Summarises one script's scenes for one character. The browser sends the script as text, one file per request. */
export const POST = route(async (req, _params, userId) => {
  const body = (await req.json().catch(() => null)) as { character?: unknown; text?: unknown } | null;
  const character = typeof body?.character === 'string' ? body.character.replace(/["\n\r]/g, ' ').trim() : '';
  const text = typeof body?.text === 'string' ? body.text.trim() : '';
  if (!character || character.length > MAX_ARC_NAME) throw new HttpError(400, 'bad_name', 'Write the name of the character.');
  if (text.length < 50) throw new HttpError(400, 'bad_file', 'No text was found in the file.');
  if (text.length > MAX_ARC_CHARS) throw new HttpError(413, 'script_too_long', 'The script is too long.');
  await assertCanAnalyze(userId);
  const scenes = await analyzeArc(character, text);
  await recordAnalysis(userId);
  return json({ scenes });
});
