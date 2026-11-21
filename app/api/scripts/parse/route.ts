import { json, route } from '@/lib/auth';
import { assertCanAnalyze, assertFileSize, recordUsage } from '@/lib/limits';
import { parseScript } from '@/lib/parse';

export const maxDuration = 300;

export const POST = route(async (req, _params, userId) => {
  // ?for=table: the script is for a Chubbuck worksheet, not a new rehearsal scene.
  await assertCanAnalyze(userId, new URL(req.url).searchParams.get('for') !== 'table');
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return json({ error: 'file is required' }, 400);
  assertFileSize(file.size);
  // parseScript rejects scripts that are too long before anything is sent for analysis.
  const parsed = await parseScript(Buffer.from(await file.arrayBuffer()), file.name, file.type, () =>
    recordUsage(userId, 'analyze')
  );
  return json(parsed);
});
