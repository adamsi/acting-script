import { auth, clerkClient } from '@clerk/nextjs/server';
import { EXTENDED_LIMITS, scriptLimitsFor, STANDARD_LIMITS, type ScriptLimits } from './limits';

const cache = new Map<string, { at: number; extended: boolean }>();
const TTL = 5 * 60_000;

/**
 * Is this one of the accounts listed in EXTENDED_LIMIT_EMAILS (comma separated)? Those accounts get the
 * longer script limits and the admin panel. Only an email address the user proved they own counts.
 *
 * The address is taken from the session token when the Clerk instance puts it there (claims `email`
 * and `email_verified`), otherwise it is looked up with Clerk's API.
 */
export async function isExtendedAccount(userId: string): Promise<boolean> {
  const list = process.env.EXTENDED_LIMIT_EMAILS;
  if (!list?.trim()) return false;
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL) return hit.extended;

  let extended = false;
  try {
    const { sessionClaims } = await auth();
    const claims = (sessionClaims ?? {}) as { email?: unknown; email_verified?: unknown };
    if (typeof claims.email === 'string') {
      extended = claims.email_verified === true && scriptLimitsFor(claims.email, list) === EXTENDED_LIMITS;
    } else {
      const user = await (await clerkClient()).users.getUser(userId);
      const verified = user.emailAddresses.filter((e) => e.verification?.status === 'verified').map((e) => e.emailAddress);
      extended = verified.some((e) => scriptLimitsFor(e, list) === EXTENDED_LIMITS);
    }
    cache.set(userId, { at: Date.now(), extended });
  } catch (e) {
    console.error('could not read the user from Clerk; treating the account as a standard one', e);
    // Remember the failure for a minute, so a Clerk outage does not slow down every request.
    cache.set(userId, { at: Date.now() - TTL + 60_000, extended: false });
  }
  return extended;
}

/** Script size limits for a signed-in user: 10 pages, or 30 for the accounts in EXTENDED_LIMIT_EMAILS. */
export async function getScriptLimits(userId: string): Promise<ScriptLimits> {
  return (await isExtendedAccount(userId)) ? EXTENDED_LIMITS : STANDARD_LIMITS;
}

/** The admin panel is for the accounts in EXTENDED_LIMIT_EMAILS. */
export const isAdmin = isExtendedAccount;
