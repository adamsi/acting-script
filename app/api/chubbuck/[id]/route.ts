import { json, route } from '@/lib/auth';
import { buildChubbuckDocx } from '@/lib/chubbuck';
import { deleteWorksheet, getWorksheet } from '@/lib/worksheets';

type P = { id: string };

/** Downloads the worksheet as a Word file. ?data=1 returns its content for editing instead. */
export const GET = route<P>(async (req, { id }, userId) => {
  const w = await getWorksheet(userId, id);
  if (!w) return json({ error: 'not found' }, 404);
  if (new URL(req.url).searchParams.get('data')) return json(w);
  const name = `${(w.title || 'scene').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80)} - טבלת צ׳בק.docx`;
  return new Response(new Uint8Array(await buildChubbuckDocx(w)), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="chubbuck.docx"; filename*=UTF-8''${encodeURIComponent(name)}`,
      'Cache-Control': 'private, no-store',
    },
  });
});

export const DELETE = route<P>(async (_req, { id }, userId) => {
  await deleteWorksheet(userId, id);
  return json({ ok: true });
});
