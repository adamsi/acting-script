import { json, route } from '@/lib/auth';
import { assertCanCreate, assertFileSize } from '@/lib/limits';
import { listScripts, saveScript, type Upload } from '@/lib/store';

export const GET = route(async (_req, _params, userId) => json(await listScripts(userId)));

export const POST = route(async (req, _params, userId) => {
  await assertCanCreate(userId);
  const form = await req.formData();
  const draft = JSON.parse(String(form.get('data')));
  const file = form.get('file');
  let upload: Upload | undefined;
  if (file instanceof File) {
    assertFileSize(file.size);
    upload = { data: Buffer.from(await file.arrayBuffer()), name: file.name, mime: file.type };
  }
  return json({ id: await saveScript(userId, null, draft, upload) });
});
