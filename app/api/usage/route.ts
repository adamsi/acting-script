import { json, route } from '@/lib/auth';
import { getUsage } from '@/lib/limits';

export const GET = route(async (_req, _params, userId) => json(await getUsage(userId)));
