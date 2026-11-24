import { json, route } from '@/lib/auth';
import { HttpError } from '@/lib/errors';
import { isAdmin } from '@/lib/plan';
import { getSettings, updateSettings } from '@/lib/settings';

async function requireAdmin(userId: string) {
  if (!(await isAdmin(userId))) throw new HttpError(403, 'forbidden', 'Admins only.');
}

export const GET = route(async (_req, _params, userId) => {
  await requireAdmin(userId);
  return json(await getSettings(true));
});

export const PUT = route(async (req, _params, userId) => {
  await requireAdmin(userId);
  const body = await req.json();
  return json(
    await updateSettings({
      aiVoices: typeof body.aiVoices === 'boolean' ? body.aiVoices : undefined,
      pricePerMillion: typeof body.pricePerMillion === 'number' ? body.pricePerMillion : undefined,
      balanceAmount: body.balanceAmount === null || typeof body.balanceAmount === 'number' ? body.balanceAmount : undefined,
    })
  );
});
