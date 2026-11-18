import { json, route } from '@/lib/auth';
import { parseScript } from '@/lib/parse';

export const maxDuration = 300;

export const POST = route(async (req) => {
  const form = await req.formData();
  const file = form.get('file');
  if (!(file instanceof File)) return json({ error: 'file is required' }, 400);
  const parsed = await parseScript(Buffer.from(await file.arrayBuffer()), file.name, file.type);
  return json(parsed);
});
