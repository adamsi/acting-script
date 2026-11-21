import { auth } from '@clerk/nextjs/server';
import { HttpError } from './errors';

export { HttpError };

export const json = (data: unknown, status = 200) => Response.json(data, { status });

type Ctx<P> = { params: Promise<P> };

/** Wraps a route handler: requires a signed-in Clerk user and turns errors into JSON. */
export function route<P = Record<string, string>>(
  fn: (req: Request, params: P, userId: string) => Promise<Response>
) {
  return async (req: Request, ctx: Ctx<P>): Promise<Response> => {
    try {
      const { userId } = await auth();
      if (!userId) return json({ error: 'unauthorized', code: 'unauthorized' }, 401);
      return await fn(req, await ctx.params, userId);
    } catch (e) {
      if (e instanceof HttpError) return json({ error: e.message, code: e.code }, e.status);
      console.error(e);
      return json({ error: e instanceof Error ? e.message : 'server error' }, 500);
    }
  };
}
