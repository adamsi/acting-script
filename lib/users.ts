import { clerkClient } from '@clerk/nextjs/server';
import { db } from './db';
import { HttpError } from './errors';
import { EXTENDED_LIMITS, scriptLimitsFor } from './limits';

export interface AdminUser {
  id: string;
  email: string | null;
  name: string;
  /** ISO dates; lastSignInAt is null for an account that never signed in */
  createdAt: string;
  lastSignInAt: string | null;
  worksheets: number;
  /** the admin's own account and the other admin accounts cannot be deleted from the panel */
  canDelete: boolean;
}

export interface AdminUserPage {
  users: AdminUser[];
  /** how many accounts match the search in all */
  total: number;
}

export const USERS_PAGE = 10;

/** Registered accounts, newest first, one page at a time. `q` searches name and email (Clerk's search). */
const isAdminEmail = (email: string) => scriptLimitsFor(email, process.env.EXTENDED_LIMIT_EMAILS) === EXTENDED_LIMITS;

export async function listUsers(me: string, q: string, offset: number): Promise<AdminUserPage> {
  const client = await clerkClient();
  const page = await client.users.getUserList({ query: q || undefined, limit: USERS_PAGE, offset, orderBy: '-created_at' });
  const ids = page.data.map((u) => u.id);
  const counts = new Map<string, number>();
  if (ids.length) {
    const sql = await db();
    const rows = await sql`
      select user_id, count(*)::int as n from worksheets where user_id = any(${ids}::text[]) group by user_id`;
    for (const r of rows) counts.set(r.user_id as string, r.n as number);
  }
  const users = page.data.map((u) => {
    const primary = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId) ?? u.emailAddresses[0];
    return {
      id: u.id,
      email: primary?.emailAddress ?? null,
      name: [u.firstName, u.lastName].filter(Boolean).join(' '),
      createdAt: new Date(u.createdAt).toISOString(),
      lastSignInAt: u.lastSignInAt ? new Date(u.lastSignInAt).toISOString() : null,
      worksheets: counts.get(u.id) ?? 0,
      canDelete: u.id !== me && !u.emailAddresses.some((e) => isAdminEmail(e.emailAddress)),
    };
  });
  return { users, total: page.totalCount };
}

/**
 * Deletes an account for good: the Clerk user, and the scenes (with their recordings) and worksheets it
 * saved. Usage records stay, so the month's totals do not change. Not for one's own account or an admin's.
 */
export async function deleteUser(me: string, id: string): Promise<void> {
  if (id === me) throw new HttpError(400, 'self', 'You cannot delete your own account here.');
  const client = await clerkClient();
  let user;
  try {
    user = await client.users.getUser(id);
  } catch {
    throw new HttpError(404, 'not_found', 'No such user.');
  }
  if (user.emailAddresses.some((e) => isAdminEmail(e.emailAddress))) throw new HttpError(400, 'admin', 'An admin account cannot be deleted here.');
  await client.users.deleteUser(id); // first: if Clerk refuses, nothing was removed
  const sql = await db();
  await sql`delete from scripts where user_id = ${id}`;
  await sql`delete from worksheets where user_id = ${id}`;
  await sql`delete from arcs where user_id = ${id}`;
}
