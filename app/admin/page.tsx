'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { useI18n } from '@/lib/i18n';
import { Page, Status, TopBar } from '@/components/ui';

interface Settings {
  aiVoices: boolean;
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

/** Admin panel: only for the accounts listed in EXTENDED_LIMIT_EMAILS (the server checks). */
export default function Admin() {
  const { t } = useI18n();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const load = useCallback(() => {
    setError('');
    api<Settings>('/admin/settings').then(setSettings, (e) => ((e as { status?: number }).status === 403 ? setDenied(true) : setError(e.message)));
  }, []);
  useEffect(load, [load]);

  async function set(patch: Partial<Settings>) {
    if (!settings) return;
    const before = settings;
    setSettings({ ...settings, ...patch });
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      setSettings(await api<Settings>('/admin/settings', { method: 'PUT', body: JSON.stringify(patch) }));
      setSaved(true);
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
            <section className="card flex flex-col gap-3 p-5">
              <div className="flex items-center gap-4">
                <div className="min-w-0 flex-1">
                  <h2 className="text-2xl font-bold">{t('adminAiTitle')}</h2>
                  <p className={`mt-1 font-semibold ${settings.aiVoices ? 'text-other' : 'text-red-300'}`}>{settings.aiVoices ? t('on') : t('off')}</p>
                </div>
                <Switch checked={settings.aiVoices} onChange={(v) => set({ aiVoices: v })} label={t('adminAiTitle')} disabled={saving} />
              </div>
              <p className="leading-relaxed text-dim">{t('adminAiDesc')}</p>
            </section>
            <p className="min-h-6 text-dim" role="status">
              {error ? <span className="text-red-300">{error}</span> : saved ? `✓ ${t('adminSaved')}` : ''}
            </p>
          </>
        )}
      </Page>
    </>
  );
}
