import { PDFDocument } from 'pdf-lib';
import { HttpError } from './errors';
import { db } from './db';
import type { Usage } from './limits-types';

export type { Usage };

export const MAX_SCENES_PER_MONTH = 20;
/** Analyses cost money even when the scene is never saved, so they are capped as well. */
export const MAX_ANALYSES_PER_MONTH = 40;
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
export const MAX_PAGES = 30;
/** For files without real pages (.docx, .txt): about 30 pages of dialogue. */
export const MAX_CHARS = MAX_PAGES * 1800;

export type UsageKind = 'create' | 'analyze';

/** Counts this calendar month's (UTC) events. Deleting a scene does not give the creation back. */
async function count(userId: string, kind: UsageKind): Promise<number> {
  const sql = await db();
  const [row] = await sql`
    select count(*)::int as n from usage_events
    where user_id = ${userId} and kind = ${kind}
      and created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'`;
  return row.n;
}

export async function getUsage(userId: string): Promise<Usage> {
  const now = new Date();
  return {
    used: await count(userId, 'create'),
    limit: MAX_SCENES_PER_MONTH,
    resets: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
  };
}

export async function assertCanCreate(userId: string) {
  if ((await count(userId, 'create')) >= MAX_SCENES_PER_MONTH)
    throw new HttpError(429, 'monthly_limit', `Monthly limit reached: ${MAX_SCENES_PER_MONTH} new scenes per month.`);
}

/** `forScene`: the upload is for a new rehearsal scene, so the scene limit applies too. */
export async function assertCanAnalyze(userId: string, forScene = true) {
  if (forScene) await assertCanCreate(userId);
  if ((await count(userId, 'analyze')) >= MAX_ANALYSES_PER_MONTH)
    throw new HttpError(429, 'monthly_limit', 'Monthly limit reached: too many script uploads this month.');
}

export async function recordUsage(userId: string, kind: UsageKind) {
  const sql = await db();
  await sql`insert into usage_events (user_id, kind) values (${userId}, ${kind})`;
}

export function assertFileSize(bytes: number) {
  if (bytes > MAX_FILE_BYTES)
    throw new HttpError(413, 'file_too_large', `File is too large (max ${MAX_FILE_BYTES / 1024 / 1024}MB).`);
}

const tooLong = () =>
  new HttpError(413, 'script_too_long', `Script is too long (max ${MAX_PAGES} pages).`);

export async function assertPdfPages(file: Buffer) {
  let pages: number;
  try {
    pages = (await PDFDocument.load(file, { ignoreEncryption: true, updateMetadata: false })).getPageCount();
  } catch {
    throw new HttpError(400, 'bad_file', 'This PDF could not be read.');
  }
  if (pages > MAX_PAGES) throw tooLong();
}

export function assertTextLength(text: string) {
  if (text.length > MAX_CHARS) throw tooLong();
}
