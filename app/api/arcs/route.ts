import { json, route } from '@/lib/auth';
import { cleanArc, createArc, listArcs } from '@/lib/arcs';

/** The user's saved character analyses. */
export const GET = route(async (_req, _params, userId) => json(await listArcs(userId)));

/** Saves a finished analysis. */
export const POST = route(async (req, _params, userId) => json({ id: await createArc(userId, cleanArc(await req.json())) }));
