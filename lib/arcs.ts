import { ARC_FIELDS, MAX_ARC_FILES, MAX_ARC_NAME, type ArcPart, type ArcSummary, type SavedArc } from './arc';
import { db } from './db';
import { HttpError } from './errors';

/** Saved analyses a user can keep. */
export const MAX_ARCS = 100;

const text = (v: unknown, max: number) => (typeof v === 'string' ? v : '').slice(0, max);

/** Cleans an analysis sent by the browser (the summaries, and the answers the actor wrote). */
export function cleanArc(body: { character?: unknown; parts?: unknown }): { character: string; parts: ArcPart[] } {
  const character = text(body.character, MAX_ARC_NAME).trim();
  if (!character) throw new HttpError(400, 'bad_name', 'Write the name of the character.');
  const parts: ArcPart[] = (Array.isArray(body.parts) ? body.parts : []).slice(0, MAX_ARC_FILES).map((p: { fileName?: unknown; scenes?: unknown }) => ({
    fileName: text(p?.fileName, 200).trim(),
    scenes: (Array.isArray(p?.scenes) ? p.scenes : [])
      .slice(0, 500)
      .map((s: { number?: unknown; summary?: unknown; answers?: unknown }) => {
        const answers = ARC_FIELDS.map((_, i) => text(Array.isArray(s?.answers) ? s.answers[i] : '', 4000));
        return { number: text(s?.number, 20).trim(), summary: text(s?.summary, 2000).trim(), ...(answers.some((a) => a.trim()) ? { answers } : {}) };
      })
      .filter((s: { summary: string }) => s.summary),
  }));
  if (!parts.length) throw new HttpError(400, 'empty', 'The analysis is empty.');
  return { character, parts };
}

export async function listArcs(userId: string): Promise<ArcSummary[]> {
  const sql = await db();
  return (await sql`
    select id, character, jsonb_array_length(parts) as files, updated_at,
           (select coalesce(sum(jsonb_array_length(p->'scenes')), 0)::int from jsonb_array_elements(parts) p) as scenes
    from arcs where user_id = ${userId} order by updated_at desc`) as unknown as ArcSummary[];
}

export async function getArc(userId: string, id: string): Promise<SavedArc | null> {
  const sql = await db();
  const [row] = await sql`select id, character, parts, updated_at from arcs where id = ${id} and user_id = ${userId}`;
  return (row as unknown as SavedArc) ?? null;
}

export async function createArc(userId: string, a: { character: string; parts: ArcPart[] }): Promise<string> {
  const sql = await db();
  const [{ n }] = await sql`select count(*)::int as n from arcs where user_id = ${userId}`;
  if (n >= MAX_ARCS) throw new HttpError(409, 'too_many_arcs', `You can keep up to ${MAX_ARCS} analyses.`);
  const [row] = await sql`insert into arcs (user_id, character, parts) values (${userId}, ${a.character}, ${sql.json(a.parts as never)}) returning id`;
  return row.id as string;
}

/** Replaces the content of one of the user's own analyses (the answers they filled in). */
export async function updateArc(userId: string, id: string, a: { character: string; parts: ArcPart[] }) {
  const sql = await db();
  const res = await sql`update arcs set character = ${a.character}, parts = ${sql.json(a.parts as never)}, updated_at = now() where id = ${id} and user_id = ${userId}`;
  if (!res.count) throw new HttpError(404, 'not_found', 'Analysis not found');
}

export async function deleteArc(userId: string, id: string) {
  const sql = await db();
  await sql`delete from arcs where id = ${id} and user_id = ${userId}`;
}
