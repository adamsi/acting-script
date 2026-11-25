import { PDFDocument } from 'pdf-lib';
import { HttpError } from './errors';
import { db } from './db';
import type { ScriptLimits, Usage } from './limits-types';

export type { ScriptLimits, Usage };

export const MAX_SCENES_PER_MONTH = 20;
export const MAX_FILE_BYTES = 4 * 1024 * 1024;
/** A full page of dialogue. The word limit stops a single page crammed with a huge amount of text. */
const WORDS_PER_PAGE = 400;
const limitsForPages = (maxPages: number): ScriptLimits => ({ maxPages, maxWords: maxPages * WORDS_PER_PAGE });
/** Script size for everyone. */
export const STANDARD_LIMITS = limitsForPages(10);
/** Script size for the accounts listed in EXTENDED_LIMIT_EMAILS. */
export const EXTENDED_LIMITS = limitsForPages(30);

/**
 * The script limits for an account. `extendedEmails` is a comma-separated list
 * (the EXTENDED_LIMIT_EMAILS setting); only a verified email on that list gets the longer limit.
 */
export function scriptLimitsFor(verifiedEmail: string | null, extendedEmails: string | undefined): ScriptLimits {
  const list = (extendedEmails || '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean);
  return verifiedEmail && list.includes(verifiedEmail.trim().toLowerCase()) ? EXTENDED_LIMITS : STANDARD_LIMITS;
}

export type UsageKind = 'create' | 'arc';
/** Scripts a user can send to the character analysis (an AI request each) per month. */
export const MAX_ANALYSES_PER_MONTH = 60;

/** Counts this calendar month's (UTC) events. Deleting a scene does not give the creation back. */
async function count(userId: string, kind: UsageKind): Promise<number> {
  const sql = await db();
  const [row] = await sql`
    select count(*)::int as n from usage_events
    where user_id = ${userId} and kind = ${kind}
      and created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'`;
  return row.n;
}

export async function getUsage(userId: string, limits: ScriptLimits): Promise<Usage> {
  const now = new Date();
  return {
    used: await count(userId, 'create'),
    limit: MAX_SCENES_PER_MONTH,
    resets: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)).toISOString(),
    ...limits,
  };
}

export async function assertCanCreate(userId: string) {
  if ((await count(userId, 'create')) >= MAX_SCENES_PER_MONTH)
    throw new HttpError(429, 'monthly_limit', `Monthly limit reached: ${MAX_SCENES_PER_MONTH} new scenes per month.`);
}

export function assertFileSize(bytes: number) {
  if (bytes > MAX_FILE_BYTES)
    throw new HttpError(413, 'file_too_large', `File is too large (max ${MAX_FILE_BYTES / 1024 / 1024}MB).`);
}

const tooLong = (l: ScriptLimits) =>
  new HttpError(413, 'script_too_long', `Script is too long (max ${l.maxPages} pages or ${l.maxWords.toLocaleString('en-US')} words).`);

/**
 * Number of words in a text. Some PDFs lose the spaces between words when their text is
 * extracted, so the count never goes below letters / 5 (an average word).
 */
export function countWords(text: string): number {
  const tokens = text.split(/\s+/).filter(Boolean).length;
  const letters = text.replace(/\s+/g, '').length;
  return Math.max(tokens, Math.ceil(letters / 5));
}

export function assertWordCount(text: string, limits: ScriptLimits) {
  if (countWords(text) > limits.maxWords) throw tooLong(limits);
}

/** Rejects PDFs with too many pages or too much text (however few pages it is squeezed into). */
export async function assertPdfSize(file: Buffer, limits: ScriptLimits) {
  let pages: number;
  try {
    pages = (await PDFDocument.load(file, { ignoreEncryption: true, updateMetadata: false })).getPageCount();
  } catch {
    throw new HttpError(400, 'bad_file', 'This PDF could not be read.');
  }
  if (pages > limits.maxPages) throw tooLong(limits);
  let text = '';
  try {
    const { extractText, getDocumentProxy } = await import('unpdf');
    text = (await extractText(await getDocumentProxy(new Uint8Array(file)), { mergePages: true })).text;
  } catch {
    // No readable text layer (e.g. a scan): the page limit above is what bounds it.
  }
  assertWordCount(text, limits);
}

export async function assertCanAnalyze(userId: string) {
  if ((await count(userId, 'arc')) >= MAX_ANALYSES_PER_MONTH)
    throw new HttpError(429, 'arc_limit', `Monthly limit reached: ${MAX_ANALYSES_PER_MONTH} analysed scripts per month.`);
}

export async function recordAnalysis(userId: string) {
  const sql = await db();
  await sql`insert into usage_events (user_id, kind) values (${userId}, 'arc')`;
}
