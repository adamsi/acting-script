import { json, route } from '@/lib/auth';
import { db } from '@/lib/db';

export const GET = route<{ id: string }>(async (_req, { id }, userId) => {
  const sql = await db();
  const [row] = await sql`
    select original_file, original_name, original_mime from scripts where id = ${id} and user_id = ${userId}`;
  if (!row?.original_file) return json({ error: 'not found' }, 404);
  return new Response(new Uint8Array(row.original_file), {
    headers: {
      'Content-Type': row.original_mime || 'application/octet-stream',
      'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(row.original_name || 'script')}`,
      'Cache-Control': 'private, max-age=3600',
    },
  });
});
