import { json, route } from '@/lib/auth';
import { listScripts, saveScript, type Upload } from '@/lib/store';

export const GET = route(async () => json(await listScripts()));

export const POST = route(async (req) => {
  const form = await req.formData();
  const draft = JSON.parse(String(form.get('data')));
  const file = form.get('file');
  let upload: Upload | undefined;
  if (file instanceof File)
    upload = { data: Buffer.from(await file.arrayBuffer()), name: file.name, mime: file.type };
  return json({ id: await saveScript(null, draft, upload) });
});
