import { json, route } from '@/lib/auth';
import { buildChubbuckDocx } from '@/lib/chubbuck';
import { HttpError } from '@/lib/errors';
import { MAX_CHARS } from '@/lib/limits';

/** Builds the Chubbuck worksheet (.docx) from the lines the user confirmed. Nothing is stored. */
export const POST = route(async (req) => {
  const body = await req.json();
  const lines = (Array.isArray(body.lines) ? body.lines : [])
    .map((l: { speaker?: unknown; text?: unknown }) => ({ speaker: String(l.speaker ?? '').trim(), text: String(l.text ?? '').trim() }))
    .filter((l: { text: string }) => l.text);
  if (!lines.length) return json({ error: 'No lines' }, 400);
  if (lines.reduce((n: number, l: { text: string }) => n + l.text.length, 0) > MAX_CHARS * 2)
    throw new HttpError(413, 'script_too_long', 'Script is too long.');
  const file = await buildChubbuckDocx({
    title: String(body.title ?? '').trim().slice(0, 200),
    author: String(body.author ?? '').trim().slice(0, 200),
    lines,
  });
  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Cache-Control': 'no-store',
    },
  });
});
