import { json, route } from '@/lib/auth';
import { getUsage } from '@/lib/limits';
import { getScriptLimits } from '@/lib/plan';

export const GET = route(async (_req, _params, userId) => json(await getUsage(userId, await getScriptLimits(userId))));
