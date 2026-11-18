'use client';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { api, apiBlob, draftFromScript, ensureAudio, playBlob, unlockAudio } from '@/lib/client';
import { useI18n } from '@/lib/i18n';
import type { Draft, DraftLine, Script, Voice } from '@/lib/types';
import { CharactersEditor, LinesEditor, draftProblem } from '@/components/Editor';
import { Overlay, Page, Status, TopBar } from '@/components/ui';

export default function Settings() {
  const { id } = useParams<{ id: string }>();
  const { t } = useI18n();
  const router = useRouter();
  const [draft, setDraftState] = useState<Draft | null>(null);
  const [voices, setVoices] = useState<Voice[]>([]);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [busyLine, setBusyLine] = useState('');
  const [progress, setProgress] = useState<[number, number] | null>(null);

  const setDraft = (fn: (d: Draft) => Draft) => {
    setNote('');
    setDraftState((d) => (d ? fn(d) : d));
  };

  const load = useCallback(async () => {
    setError('');
    try {
      const s = await api<Script>(`/scripts/${id}`);
      setVoices(await api<Voice[]>(`/voices?lang=${s.language}`));
      setDraftState(draftFromScript(s));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [id]);
  useEffect(() => {
    load();
  }, [load]);

  /** Saves the draft and returns the stored script (line order matches the draft). */
  async function persist(d: Draft): Promise<Script> {
    const s = await api<Script>(`/scripts/${id}`, { method: 'PUT', body: JSON.stringify(d) });
    setDraftState(draftFromScript(s));
    return s;
  }

  async function record(s: Script, opts: Parameters<typeof ensureAudio>[1]) {
    setProgress([0, 0]);
    const r = await ensureAudio(s, opts, (a, b) => setProgress([a, b]));
    setProgress(null);
    setNote(r.failed ? t('recordingFailed') : t('saved'));
  }

  async function save(force = false) {
    if (!draft) return;
    setSaving(true);
    setNote('');
    try {
      await record(await persist(draft), { force });
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
      setProgress(null);
    }
  }

  async function regenerateLine(line: DraftLine) {
    if (!draft) return;
    unlockAudio();
    setBusyLine(line.key);
    setNote('');
    try {
      const idx = draft.lines.findIndex((l) => l.key === line.key);
      const s = await persist(draft);
      const saved = s.lines[idx];
      setBusyLine(saved.id);
      // A manual re-record gets the pronunciation check too (unless the user wrote the pronunciation).
      const r = await ensureAudio(s, { force: true, improve: s.language === 'he', lineIds: [saved.id] });
      if (r.failed) throw new Error(t('recordingFailed'));
      await playBlob(await apiBlob(`/lines/${saved.id}/audio`));
    } catch (e) {
      setNote(e instanceof Error ? e.message : String(e));
    } finally {
      setBusyLine('');
    }
  }

  async function remove() {
    if (!confirm(t('deleteSceneConfirm'))) return;
    await api(`/scripts/${id}`, { method: 'DELETE' });
    router.replace('/');
  }

  if (!draft) return <><TopBar title={t('settings')} back={`/s/${id}`} /><Status error={error} onRetry={load} /></>;
  const invalid = draftProblem(draft);

  return (
    <>
      <TopBar title={t('settings')} back={`/s/${id}`} />
      <Page>
        <input className="field text-2xl font-bold" dir="auto" aria-label={t('title')} placeholder={t('title')} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
        <input className="field" dir="auto" aria-label={t('author')} placeholder={t('author')} value={draft.author} onChange={(e) => setDraft((d) => ({ ...d, author: e.target.value }))} />

        <h2 className="mt-2 text-2xl font-bold">{t('characters')}</h2>
        <CharactersEditor draft={draft} setDraft={setDraft} voices={voices} />

        <h2 className="mt-4 text-2xl font-bold">{t('lines')}</h2>
        <LinesEditor draft={draft} setDraft={setDraft} onRegenerate={regenerateLine} busyLine={busyLine} />

        <div className="mt-6 flex flex-col gap-3">
          <button className="btn" disabled={invalid || saving} onClick={() => confirm(t('regenerateAllConfirm')) && save(true)}>
            ↻ {t('regenerateAll')}
          </button>
          <button className="btn btn-danger" onClick={remove}>
            {t('deleteScene')}
          </button>
        </div>
      </Page>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-bg/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          {note && <span className="text-dim" role="status">{note}</span>}
          <button className="btn btn-primary flex-1 text-xl" disabled={invalid || saving} onClick={() => save()}>
            {saving ? t('saving') : t('save')}
          </button>
        </div>
      </div>

      {progress && progress[1] > 0 && <Overlay title={t('recording')} done={progress[0]} total={progress[1]} />}
    </>
  );
}
