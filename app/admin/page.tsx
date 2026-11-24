'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { useI18n } from '@/lib/i18n';
import type { UsageReport } from '@/lib/usage';
import { Page, Status, TopBar } from '@/components/ui';

interface Settings {
  aiVoices: boolean;
  pricePerMillion: number;
  balance: { amount: number; at: string } | null;
}

function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      dir="ltr"
      className={`relative h-9 w-16 shrink-0 rounded-full transition-colors ${checked ? 'bg-mine' : 'bg-card2 ring-1 ring-line'}`}
    >
      <span className={`absolute top-1 h-7 w-7 rounded-full bg-white shadow transition-all ${checked ? 'left-8' : 'left-1'}`} />
    </button>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-card2 p-3">
      <p className="text-sm text-dim">{label}</p>
      <p className="mt-0.5 text-2xl font-bold tabular-nums" dir="ltr">
        {value}
      </p>
    </div>
  );
}

const money = (n: number) => `$${n < 1 ? n.toFixed(3) : n.toFixed(2)}`;

/** Admin panel: only for the accounts listed in EXTENDED_LIMIT_EMAILS (the server checks). */
export default function Admin() {
  const { t, lang } = useI18n();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [usage, setUsage] = useState<UsageReport | null>(null);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [price, setPrice] = useState('');
  const [balance, setBalance] = useState('');

  const num = (n: number) => n.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US');
  const date = (iso: string) => new Date(iso).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });

  const loadUsage = useCallback(() => api<UsageReport>('/admin/usage').then(setUsage, () => {}), []);
  const load = useCallback(() => {
    setError('');
    api<Settings>('/admin/settings').then(
      (s) => {
        setSettings(s);
        setPrice(String(s.pricePerMillion));
        loadUsage();
      },
      (e) => ((e as { status?: number }).status === 403 ? setDenied(true) : setError(e.message))
    );
  }, [loadUsage]);
  useEffect(load, [load]);

  async function save(patch: { aiVoices?: boolean; pricePerMillion?: number; balanceAmount?: number | null }) {
    if (!settings) return;
    const before = settings;
    if (typeof patch.aiVoices === 'boolean') setSettings({ ...settings, aiVoices: patch.aiVoices });
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      setSettings(await api<Settings>('/admin/settings', { method: 'PUT', body: JSON.stringify(patch) }));
      setSaved(true);
      if (patch.aiVoices === undefined) await loadUsage();
    } catch (e) {
      setSettings(before);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  }

  const priceValue = Number(price);
  const balanceValue = Number(balance);

  return (
    <>
      <TopBar title={t('adminTitle')} back="/" />
      <Page>
        {denied ? (
          <p className="card p-8 text-center text-xl text-dim" role="alert">
            {t('adminNoAccess')}
          </p>
        ) : !settings ? (
          <Status error={error} onRetry={load} />
        ) : (
          <>
            <p className="min-h-6 text-dim" role="status">
              {error ? <span className="text-red-300">{error}</span> : saved ? `✓ ${t('adminSaved')}` : ''}
            </p>

            <section className="card flex flex-col gap-3 p-5">
              <div className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl font-bold">{t('adminAiTitle')}</h2>
                  <p className={`mt-1 font-semibold ${settings.aiVoices ? 'text-other' : 'text-red-300'}`}>{settings.aiVoices ? t('on') : t('off')}</p>
                </div>
                <Switch checked={settings.aiVoices} onChange={(v) => save({ aiVoices: v })} label={t('adminAiTitle')} disabled={saving} />
              </div>
              <p className="leading-relaxed text-dim">{t('adminAiDesc')}</p>
            </section>

            <section className="card flex flex-col gap-4 p-5" aria-label={t('usageTitle')}>
              <div className="flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl font-bold">{t('usageTitle')}</h2>
                  {usage && (
                    <p className="mt-1 text-dim">
                      {t('usageSince')} {date(usage.month)}
                    </p>
                  )}
                </div>
                <button className="btn btn-sm" onClick={loadUsage}>
                  ↻ {t('refresh')}
                </button>
              </div>
              {!usage ? (
                <Status />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <Stat label={t('usageCost')} value={money(usage.total.cost)} />
                    <Stat label={t('usageChars')} value={num(usage.total.characters)} />
                    <Stat label={t('usageRecordings')} value={num(usage.total.recordings)} />
                    <Stat label={t('usageScenes')} value={num(usage.total.scenes)} />
                  </div>
                  <h3 className="text-lg font-bold">{t('usageUsers')}</h3>
                  {usage.users.length === 0 ? (
                    <p className="text-dim">{t('usageNone')}</p>
                  ) : (
                    <ul className="flex flex-col gap-2">
                      {usage.users.map((u) => (
                        <li key={u.userId} className="rounded-xl border border-line p-3" data-user={u.userId}>
                          <div className="flex items-baseline gap-3">
                            <p className="min-w-0 flex-1 truncate font-bold" dir="ltr" title={u.email ?? u.userId}>
                              {u.email ?? u.userId}
                            </p>
                            <p className="text-xl font-bold tabular-nums text-mine" dir="ltr">
                              {money(u.cost)}
                            </p>
                          </div>
                          <p className="mt-1 text-sm text-dim">
                            {num(u.characters)} {t('usageChars')} · {num(u.recordings)} {t('usageRecordings')} · {num(u.previews)} {t('usagePreviews')} · {num(u.scenes)} {t('usageScenes')}
                          </p>
                          {u.personalCharacters > 0 && (
                            <p className="mt-1 text-sm text-other">
                              + {num(u.personalCharacters)} {t('usageChars')} {t('usageOwnKey')}
                            </p>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="text-sm leading-relaxed text-dim">{t('usageNote')}</p>
                </>
              )}
            </section>

            <section className="card flex flex-col gap-4 p-5" aria-label={t('balanceTitle')}>
              <h2 className="text-2xl font-bold">{t('balanceTitle')}</h2>
              {usage?.balance ? (
                <div className="grid grid-cols-2 gap-2">
                  <Stat label={t('balanceRemaining')} value={money(usage.balance.remaining)} />
                  <Stat label={t('balanceUsed')} value={money(usage.balance.usedSince)} />
                  <p className="col-span-2 text-sm text-dim">
                    {t('balanceAsOf')}
                    {date(usage.balance.at)}: <span dir="ltr">{money(usage.balance.amount)}</span>
                  </p>
                </div>
              ) : (
                <p className="text-dim">{t('balanceNotSet')}</p>
              )}
              <p className="text-sm leading-relaxed text-dim">{t('balanceDesc')}</p>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-dim">{t('balanceInput')}</span>
                <span className="flex gap-2">
                  <input className="field flex-1" dir="ltr" inputMode="decimal" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="0.00" />
                  <button className="btn" disabled={saving || balance.trim() === '' || !(balanceValue >= 0)} onClick={() => save({ balanceAmount: balanceValue }).then(() => setBalance(''))}>
                    {t('update')}
                  </button>
                </span>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-sm text-dim">{t('priceInput')}</span>
                <span className="flex gap-2">
                  <input className="field flex-1" dir="ltr" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} />
                  <button className="btn" disabled={saving || price.trim() === '' || !(priceValue >= 0) || priceValue === settings.pricePerMillion} onClick={() => save({ pricePerMillion: priceValue })}>
                    {t('update')}
                  </button>
                </span>
              </label>
              <a className="btn" href="https://platform.inworld.ai/usage" target="_blank" rel="noreferrer">
                ↗ {t('openInworld')}
              </a>
            </section>
          </>
        )}
      </Page>
    </>
  );
}
