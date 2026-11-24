import { db } from './db';
import type { AppSettings } from './settings';

/**
 * Notes one request to Inworld: who asked, and how many characters were sent (what Inworld bills by).
 * `personal`: it was made with the account's own Inworld key, so it is not on the shared bill.
 * Never fails the request it belongs to.
 */
export async function recordTts(userId: string, kind: 'tts' | 'preview', characters: number, personal: boolean) {
  try {
    const sql = await db();
    await sql`insert into usage_events (user_id, kind, amount, personal) values (${userId}, ${kind}, ${characters}, ${personal})`;
  } catch (e) {
    console.error('could not record usage', e);
  }
}

export interface UserUsage {
  userId: string;
  email: string | null;
  /** characters sent to Inworld with the shared key */
  characters: number;
  /** characters sent with the account's own key (not on the shared bill) */
  personalCharacters: number;
  recordings: number;
  previews: number;
  scenes: number;
  /** estimated cost of `characters` in US dollars */
  cost: number;
}

export interface UsageReport {
  /** first day of the month the report covers (UTC) */
  month: string;
  pricePerMillion: number;
  users: UserUsage[];
  total: { characters: number; personalCharacters: number; recordings: number; previews: number; scenes: number; cost: number };
  /** balance typed in by the admin, what the shared key used since, and what should be left; null if never set */
  balance: { amount: number; at: string; usedSince: number; remaining: number } | null;
}

export const costOf = (characters: number, pricePerMillion: number) => Math.round((characters / 1_000_000) * pricePerMillion * 10000) / 10000;

/** Usage of the current calendar month (UTC), per user, most characters first. */
export async function usageReport(settings: AppSettings, emails: (ids: string[]) => Promise<Map<string, string>>): Promise<UsageReport> {
  const sql = await db();
  const rows = await sql`
    select user_id,
           coalesce(sum(amount) filter (where kind in ('tts', 'preview') and not personal), 0)::int as characters,
           coalesce(sum(amount) filter (where kind in ('tts', 'preview') and personal), 0)::int as personal_characters,
           count(*) filter (where kind = 'tts')::int as recordings,
           count(*) filter (where kind = 'preview')::int as previews,
           count(*) filter (where kind = 'create')::int as scenes
    from usage_events
    where created_at >= date_trunc('month', now() at time zone 'utc') at time zone 'utc'
    group by user_id`;
  const byId = await emails(rows.map((r) => r.user_id as string));
  const price = settings.pricePerMillion;
  const users: UserUsage[] = rows
    .map((r) => ({
      userId: r.user_id as string,
      email: byId.get(r.user_id as string) ?? null,
      characters: r.characters as number,
      personalCharacters: r.personal_characters as number,
      recordings: r.recordings as number,
      previews: r.previews as number,
      scenes: r.scenes as number,
      cost: costOf(r.characters as number, price),
    }))
    .sort((a, b) => b.characters - a.characters || b.recordings - a.recordings);

  const sum = (f: (u: UserUsage) => number) => users.reduce((n, u) => n + f(u), 0);
  const total = {
    characters: sum((u) => u.characters),
    personalCharacters: sum((u) => u.personalCharacters),
    recordings: sum((u) => u.recordings),
    previews: sum((u) => u.previews),
    scenes: sum((u) => u.scenes),
    cost: costOf(sum((u) => u.characters), price),
  };

  let balance: UsageReport['balance'] = null;
  if (settings.balance) {
    const [{ n }] = await sql`
      select coalesce(sum(amount), 0)::int as n from usage_events
      where kind in ('tts', 'preview') and not personal and created_at >= ${settings.balance.at}`;
    const usedSince = costOf(n as number, price);
    balance = { ...settings.balance, usedSince, remaining: Math.round((settings.balance.amount - usedSince) * 10000) / 10000 };
  }
  const now = new Date();
  return { month: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString(), pricePerMillion: price, users, total, balance };
}
