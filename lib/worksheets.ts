import { db } from './db';
import { HttpError } from './errors';
import { assertWordCount } from './limits';
import type { ChubbuckInput } from './chubbuck';

/** Saved worksheets a user can keep. */
export const MAX_WORKSHEETS = 100;

export interface WorksheetSummary {
  id: string;
  title: string;
  author: string;
  rows: number;
  updated_at: string;
}

/** Cleans a worksheet sent by the browser and applies the size limits. */
export function cleanWorksheet(body: { title?: unknown; author?: unknown; lines?: unknown }): ChubbuckInput {
  const lines = (Array.isArray(body.lines) ? body.lines : [])
    .map((l: { speaker?: unknown; text?: unknown }) => ({
      speaker: String(l?.speaker ?? '').trim().slice(0, 100),
      text: String(l?.text ?? '').trim(),
    }))
    .filter((l) => l.text);
  if (!lines.length) throw new HttpError(400, 'empty', 'The worksheet has no lines.');
  assertWordCount(lines.map((l) => l.text).join(' '));
  return {
    title: String(body.title ?? '').trim().slice(0, 200),
    author: String(body.author ?? '').trim().slice(0, 200),
    lines,
  };
}

export async function listWorksheets(userId: string): Promise<WorksheetSummary[]> {
  const sql = await db();
  return (await sql`
    select id, title, author, jsonb_array_length(lines) as rows, updated_at
    from worksheets where user_id = ${userId} order by updated_at desc`) as unknown as WorksheetSummary[];
}

export async function getWorksheet(userId: string, id: string): Promise<ChubbuckInput | null> {
  const sql = await db();
  const [row] = await sql`select title, author, lines from worksheets where id = ${id} and user_id = ${userId}`;
  return (row as unknown as ChubbuckInput) ?? null;
}

/** Saves a new worksheet, or replaces one of the user's own (id given). Returns its id. */
export async function saveWorksheet(userId: string, id: string | null, w: ChubbuckInput): Promise<string> {
  const sql = await db();
  if (id) {
    const res = await sql`
      update worksheets set title = ${w.title}, author = ${w.author}, lines = ${sql.json(w.lines)}, updated_at = now()
      where id = ${id} and user_id = ${userId}`;
    if (!res.count) throw new HttpError(404, 'not_found', 'Worksheet not found');
    return id;
  }
  const [{ n }] = await sql`select count(*)::int as n from worksheets where user_id = ${userId}`;
  if (n >= MAX_WORKSHEETS) throw new HttpError(409, 'too_many', `You can keep up to ${MAX_WORKSHEETS} worksheets.`);
  const [row] = await sql`
    insert into worksheets (user_id, title, author, lines)
    values (${userId}, ${w.title}, ${w.author}, ${sql.json(w.lines)}) returning id`;
  return row.id as string;
}

export async function deleteWorksheet(userId: string, id: string) {
  const sql = await db();
  await sql`delete from worksheets where id = ${id} and user_id = ${userId}`;
}
