import { json, route } from '@/lib/auth';
import { assertCanCreate, assertFileSize, assertPdfSize } from '@/lib/limits';
import { getScriptLimits } from '@/lib/plan';
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
  const limits = await getScriptLimits(userId);
  // The script was read in the browser; the page limit is checked here on the file itself.
  if (upload && (upload.mime === 'application/pdf' || /\.pdf$/i.test(upload.name))) await assertPdfSize(upload.data, limits);
  return json({ id: await saveScript(userId, null, draft, limits, upload) });
});
