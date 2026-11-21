import { clerkClient } from '@clerk/nextjs/server';
import { scriptLimitsFor, STANDARD_LIMITS, type ScriptLimits } from './limits';

const cache = new Map<string, { at: number; limits: ScriptLimits }>();
const TTL = 5 * 60_000;

/**
 * Script size limits for a signed-in user: 10 pages, or 30 for accounts whose verified primary
 * email is listed in EXTENDED_LIMIT_EMAILS (comma separated).
 */
export async function getScriptLimits(userId: string): Promise<ScriptLimits> {
  const extended = process.env.EXTENDED_LIMIT_EMAILS;
  if (!extended?.trim()) return STANDARD_LIMITS;
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL) return hit.limits;
  let limits = STANDARD_LIMITS;
  try {
    const user = await (await clerkClient()).users.getUser(userId);
    // Only an address the user proved they own counts.
    const verified = user.emailAddresses.filter((e) => e.verification?.status === 'verified').map((e) => e.emailAddress);
    limits = verified.map((e) => scriptLimitsFor(e, extended)).find((l) => l !== STANDARD_LIMITS) ?? STANDARD_LIMITS;
    cache.set(userId, { at: Date.now(), limits });
  } catch (e) {
    console.error('could not read the user from Clerk; using standard limits', e);
  }
  return limits;
}
