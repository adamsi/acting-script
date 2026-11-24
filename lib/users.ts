import { clerkClient } from '@clerk/nextjs/server';
import { db } from './db';

export interface AdminUser {
  id: string;
  email: string | null;
  name: string;
  /** ISO dates; lastSignInAt is null for an account that never signed in */
  createdAt: string;
  lastSignInAt: string | null;
  scenes: number;
  worksheets: number;
}

export interface AdminUserPage {
  users: AdminUser[];
  /** how many accounts match the search in all */
  total: number;
}

export const USERS_PAGE = 10;

/** Registered accounts, newest first, one page at a time. `q` searches name and email (Clerk's search). */
export async function listUsers(q: string, offset: number): Promise<AdminUserPage> {
  const client = await clerkClient();
  const page = await client.users.getUserList({ query: q || undefined, limit: USERS_PAGE, offset, orderBy: '-created_at' });
  const ids = page.data.map((u) => u.id);
  const counts = new Map<string, { scenes: number; worksheets: number }>();
  if (ids.length) {
    const sql = await db();
    const rows = await sql`
      select u.id,
             (select count(*) from scripts s where s.user_id = u.id)::int as scenes,
             (select count(*) from worksheets w where w.user_id = u.id)::int as worksheets
      from unnest(${ids}::text[]) as u(id)`;
    for (const r of rows) counts.set(r.id as string, { scenes: r.scenes as number, worksheets: r.worksheets as number });
  }
  const users = page.data.map((u) => {
    const primary = u.emailAddresses.find((e) => e.id === u.primaryEmailAddressId) ?? u.emailAddresses[0];
    return {
      id: u.id,
      email: primary?.emailAddress ?? null,
      name: [u.firstName, u.lastName].filter(Boolean).join(' '),
      createdAt: new Date(u.createdAt).toISOString(),
      lastSignInAt: u.lastSignInAt ? new Date(u.lastSignInAt).toISOString() : null,
      scenes: counts.get(u.id)?.scenes ?? 0,
      worksheets: counts.get(u.id)?.worksheets ?? 0,
    };
  });
  return { users, total: page.totalCount };
}
