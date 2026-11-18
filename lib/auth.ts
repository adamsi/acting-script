import { timingSafeEqual, createHash } from 'crypto';

const digest = (s: string) => createHash('sha256').update(s).digest();

export function isAuthorized(req: Request): boolean {
  const expected = process.env.APP_PASSKEY;
  if (!expected) return false;
  const given = req.headers.get('x-passkey') || new URL(req.url).searchParams.get('passkey') || '';
  return timingSafeEqual(digest(given), digest(expected));
}

export const json = (data: unknown, status = 200) => Response.json(data, { status });

type Ctx<P> = { params: Promise<P> };

/** Wraps a route handler with passkey auth and JSON error handling. */
export function route<P = Record<string, string>>(
  fn: (req: Request, params: P) => Promise<Response>
) {
  return async (req: Request, ctx: Ctx<P>): Promise<Response> => {
    if (!process.env.APP_PASSKEY) return json({ error: 'APP_PASSKEY is not configured' }, 500);
    if (!isAuthorized(req)) return json({ error: 'unauthorized' }, 401);
    try {
      return await fn(req, await ctx.params);
    } catch (e) {
      console.error(e);
      return json({ error: e instanceof Error ? e.message : 'server error' }, 500);
    }
  };
}
