import { db } from './db';
import { HttpError } from './errors';

/** Switches the admin can turn in the admin panel. */
export interface AppSettings {
  /** AI voices (Inworld). When off, the other characters can only be recorded by the user. */
  aiVoices: boolean;
}

const DEFAULTS: AppSettings = { aiVoices: true };
let cached: { at: number; value: AppSettings } | null = null;
// Short, so a switch turned in the admin panel reaches every server instance quickly.
const TTL = 15_000;

export async function getSettings(fresh = false): Promise<AppSettings> {
  if (!fresh && cached && Date.now() - cached.at < TTL) return cached.value;
  const sql = await db();
  const rows = await sql`select key, value from app_settings`;
  const stored = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  const value: AppSettings = { aiVoices: typeof stored.aiVoices === 'boolean' ? stored.aiVoices : DEFAULTS.aiVoices };
  cached = { at: Date.now(), value };
  return value;
}

export async function updateSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const sql = await db();
  if (typeof patch.aiVoices === 'boolean')
    await sql`insert into app_settings (key, value) values ('aiVoices', ${sql.json(patch.aiVoices)})
              on conflict (key) do update set value = excluded.value, updated_at = now()`;
  return getSettings(true);
}

/**
 * Stops a request that would use an AI voice while AI voices are switched off. The switch is about the
 * shared Inworld key: an account with a personal key pays for itself and keeps its AI voices.
 */
export async function assertAiVoices(personalKey?: string) {
  if (!personalKey && !(await getSettings()).aiVoices) throw new HttpError(403, 'ai_disabled', 'AI voices are switched off.');
}
