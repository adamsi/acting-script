import { db } from './db';
import { HttpError } from './errors';

/** What the admin sets in the admin panel. */
export interface AppSettings {
  /** AI voices (Inworld). When off, the other characters can only be recorded by the user. */
  aiVoices: boolean;
  /** What Inworld charges per million characters on this account's plan (US dollars). Used for cost estimates. */
  pricePerMillion: number;
  /** The Inworld credit balance the admin typed in, and when; null if never set. */
  balance: { amount: number; at: string } | null;
}

const DEFAULTS: AppSettings = { aiVoices: true, pricePerMillion: 10, balance: null };
let cached: { at: number; value: AppSettings } | null = null;
// Short, so a switch turned in the admin panel reaches every server instance quickly.
const TTL = 15_000;

export async function getSettings(fresh = false): Promise<AppSettings> {
  if (!fresh && cached && Date.now() - cached.at < TTL) return cached.value;
  const sql = await db();
  const rows = await sql`select key, value from app_settings`;
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const b = stored.balance as { amount?: unknown; at?: unknown } | null | undefined;
  const value: AppSettings = {
    aiVoices: typeof stored.aiVoices === 'boolean' ? stored.aiVoices : DEFAULTS.aiVoices,
    pricePerMillion: typeof stored.pricePerMillion === 'number' && stored.pricePerMillion >= 0 ? stored.pricePerMillion : DEFAULTS.pricePerMillion,
    balance: b && typeof b.amount === 'number' && typeof b.at === 'string' ? { amount: b.amount, at: b.at } : null,
  };
  cached = { at: Date.now(), value };
  return value;
}

/** `balanceAmount`: a number sets the balance as of now; null clears it. */
export async function updateSettings(patch: { aiVoices?: boolean; pricePerMillion?: number; balanceAmount?: number | null }): Promise<AppSettings> {
  const sql = await db();
  const put = (key: string, value: unknown) =>
    sql`insert into app_settings (key, value) values (${key}, ${sql.json(value as never)})
        on conflict (key) do update set value = excluded.value, updated_at = now()`;
  if (typeof patch.aiVoices === 'boolean') await put('aiVoices', patch.aiVoices);
  if (typeof patch.pricePerMillion === 'number' && isFinite(patch.pricePerMillion) && patch.pricePerMillion >= 0 && patch.pricePerMillion <= 1000)
    await put('pricePerMillion', patch.pricePerMillion);
  if (patch.balanceAmount === null) await put('balance', false); // the column is not-null; anything but an object reads as "not set"
  else if (typeof patch.balanceAmount === 'number' && isFinite(patch.balanceAmount) && patch.balanceAmount >= 0 && patch.balanceAmount <= 1_000_000)
    await put('balance', { amount: patch.balanceAmount, at: new Date().toISOString() });
  return getSettings(true);
}

/**
 * Stops a request that would use an AI voice while AI voices are switched off. The switch is about the
 * shared Inworld key: an account with a personal key pays for itself and keeps its AI voices.
 */
export async function assertAiVoices(personalKey?: string) {
  if (!personalKey && !(await getSettings()).aiVoices) throw new HttpError(403, 'ai_disabled', 'AI voices are switched off.');
}
