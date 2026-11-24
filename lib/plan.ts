import { auth, clerkClient } from '@clerk/nextjs/server';
import { EXTENDED_LIMITS, scriptLimitsFor, STANDARD_LIMITS, type ScriptLimits } from './limits';

const cache = new Map<string, { at: number; emails: string[] }>();
const TTL = 5 * 60_000;

/**
 * The email addresses this user proved they own, in lower case.
 *
 * Taken from the session token when the Clerk instance puts it there (claims `email` and
 * `email_verified`), otherwise looked up with Clerk's API.
 */
async function verifiedEmails(userId: string): Promise<string[]> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.at < TTL) return hit.emails;
  let emails: string[] = [];
  try {
    const { sessionClaims } = await auth();
    const claims = (sessionClaims ?? {}) as { email?: unknown; email_verified?: unknown };
    if (typeof claims.email === 'string') {
      if (claims.email_verified === true) emails = [claims.email];
    } else {
      const user = await (await clerkClient()).users.getUser(userId);
      emails = user.emailAddresses.filter((e) => e.verification?.status === 'verified').map((e) => e.emailAddress);
    }
    emails = emails.map((e) => e.trim().toLowerCase());
    cache.set(userId, { at: Date.now(), emails });
  } catch (e) {
    console.error('could not read the user from Clerk; treating the account as a standard one', e);
    // Remember the failure for a minute, so a Clerk outage does not slow down every request.
    cache.set(userId, { at: Date.now() - TTL + 60_000, emails: [] });
  }
  return emails;
}

/**
 * Is this one of the accounts listed in EXTENDED_LIMIT_EMAILS (comma separated)? Those accounts get the
 * longer script limits and the admin panel.
 */
export async function isExtendedAccount(userId: string): Promise<boolean> {
  const list = process.env.EXTENDED_LIMIT_EMAILS;
  if (!list?.trim()) return false;
  return (await verifiedEmails(userId)).some((e) => scriptLimitsFor(e, list) === EXTENDED_LIMITS);
}

/** Script size limits for a signed-in user: 10 pages, or 30 for the accounts in EXTENDED_LIMIT_EMAILS. */
export async function getScriptLimits(userId: string): Promise<ScriptLimits> {
  return (await isExtendedAccount(userId)) ? EXTENDED_LIMITS : STANDARD_LIMITS;
}

/** The admin panel is for the accounts in EXTENDED_LIMIT_EMAILS. */
export const isAdmin = isExtendedAccount;

/** Environment variables are usually written in capitals; the lower-case spelling is accepted too. */
const env = (name: string) => (process.env[name] || process.env[name.toLowerCase()] || '').trim();

/**
 * A personal Inworld key: the account whose verified email is ADAM_API_KEY_EMAIL has its AI recordings
 * made with ADAM_API_KEY (and billed to that Inworld account) instead of the shared INWORLD_API_KEY.
 * Returns undefined for everyone else.
 */
export async function personalInworldKey(userId: string): Promise<string | undefined> {
  const key = env('ADAM_API_KEY');
  const email = env('ADAM_API_KEY_EMAIL').toLowerCase();
  if (!key || !email) return undefined;
  return (await verifiedEmails(userId)).includes(email) ? key : undefined;
}

/** Email addresses of users, for the admin's usage report. Users that cannot be looked up are left out. */
export async function emailsOf(userIds: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (!userIds.length) return out;
  try {
    const client = await clerkClient();
    for (let i = 0; i < userIds.length; i += 100) {
      const page = await client.users.getUserList({ userId: userIds.slice(i, i + 100), limit: 100 });
      for (const u of page.data) {
        const primary = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId) ?? u.emailAddresses[0];
        if (primary) out.set(u.id, primary.emailAddress);
      }
    }
  } catch (e) {
    console.error('could not read users from Clerk; the report shows user ids', e);
  }
  return out;
}
