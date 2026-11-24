'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/client';
import { useI18n } from '@/lib/i18n';
import type { UsageReport } from '@/lib/usage';
import type { AdminUser, AdminUserPage } from '@/lib/users';
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

/** Registered accounts: the first ten, a search box, and "show more". */
function Users() {
  const { t, lang } = useI18n();
  const [q, setQ] = useState('');
  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const latest = useRef(0);
  const date = (iso: string) => new Date(iso).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  const fetchPage = useCallback((query: string, offset: number) => {
    const id = ++latest.current;
    setLoading(true);
    setError('');
    api<AdminUserPage>(`/admin/users?q=${encodeURIComponent(query)}&offset=${offset}`).then(
      (page) => {
        if (id !== latest.current) return; // a newer search is on its way
        setUsers((old) => (offset && old ? [...old, ...page.users.filter((u) => !old.some((o) => o.id === u.id))] : page.users));
        setTotal(page.total);
        setLoading(false);
      },
      (e) => {
        if (id !== latest.current) return;
        setError(e instanceof Error ? e.message : String(e));
        setLoading(false);
      }
    );
  }, []);

  // search as you type, after a short pause
  useEffect(() => {
    const timer = setTimeout(() => fetchPage(q.trim(), 0), q ? 300 : 0);
    return () => clearTimeout(timer);
  }, [q, fetchPage]);

  return (
    <section className="card flex flex-col gap-4 p-5" aria-label={t('usersTitle')}>
      <div className="flex items-baseline gap-3">
        <h2 className="min-w-0 flex-1 text-2xl font-bold">{t('usersTitle')}</h2>
        {users && (
          <p className="text-dim tabular-nums" data-users-total>
            {total.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US')}
          </p>
        )}
      </div>
      <input className="field" type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('usersSearch')} aria-label={t('usersSearch')} />
      {error ? (
        <p className="text-red-300" role="alert">
          {error}
        </p>
      ) : !users ? (
        <Status />
      ) : users.length === 0 ? (
        <p className="text-dim">{t('usersNone')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {users.map((u) => (
            <li key={u.id} className="rounded-xl border border-line p-3" data-user={u.id}>
              <p className="truncate font-bold" dir="ltr" title={u.email ?? u.id}>
                {u.email ?? u.id}
              </p>
              <p className="mt-1 text-sm text-dim">
                {u.name ? `${u.name} · ` : ''}
                {t('usersJoined')} {date(u.createdAt)} · {u.scenes} {t('usersScenes')} · {u.worksheets} {t('usersTables')}
              </p>
            </li>
          ))}
        </ul>
      )}
      {users && users.length < total && (
        <button className="btn" disabled={loading} onClick={() => fetchPage(q.trim(), users.length)}>
          {t('showMore')}
        </button>
      )}
    </section>
  );
}

/** Admin panel: only for the accounts listed in EXTENDED_LIMIT_EMAILS (the server checks). */
export default function Admin() {
  const { t, lang } = useI18n();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [usage, setUsage] = useState<UsageReport | null>(null);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const num = (n: number) => n.toLocaleString(lang === 'he' ? 'he-IL' : 'en-US');
  const date = (iso: string) => new Date(iso).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { day: 'numeric', month: 'long', year: 'numeric' });

  const loadUsage = useCallback(() => api<UsageReport>('/admin/usage').then(setUsage, () => {}), []);
  const load = useCallback(() => {
    setError('');
    api<Settings>('/admin/settings').then(
      (s) => {
        setSettings(s);
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
                  <p className="text-sm leading-relaxed text-dim">{t('usageNote')}</p>
                </>
              )}
            </section>

            <Users />
          </>
        )}
      </Page>
    </>
  );
}
