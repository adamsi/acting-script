'use client';
import { useCallback, useEffect, useState } from 'react';
import { api } from '@/lib/client';
import { errorText, useI18n, useUploadLimits, type Key } from '@/lib/i18n';
import { draftFromParsed, newKey, toWorksheet, withoutSpeaker, type Draft } from '@/lib/table-draft';
import { ReadError } from '@/lib/script/types';
import type { WorksheetSummary } from '@/lib/worksheets';
import { CharactersEditor, SpeechesEditor } from '@/components/TableEditor';
import { Page, ProgressCard, Status, Stepper, TopBar } from '@/components/ui';

const MAX_BYTES = 4 * 1024 * 1024;
type View = 'list' | 'upload' | 'check' | 'ready';

/** Turns saved worksheet content back into an editable draft. */
function draftFromWorksheet(w: { title: string; author: string; lines: { speaker: string; text: string }[] }): Draft {
  const keys = new Map<string, string>();
  for (const l of w.lines) if (l.speaker && !keys.has(l.speaker)) keys.set(l.speaker, newKey());
  return {
    title: w.title,
    author: w.author,
    characters: [...keys].map(([name, key]) => ({ key, name })),
    speeches: w.lines.map((l) => ({ key: newKey(), speaker: keys.get(l.speaker) ?? '', text: l.text })),
  };
}

const READ_ERRORS: Record<ReadError['code'], Key> = {
  unsupported: 'unsupported',
  old_doc: 'errOldDoc',
  image: 'errImage',
  empty: 'errEmpty',
  broken: 'errBroken',
};

export default function Chubbuck() {
  const { t, lang } = useI18n();
  const uploadLimits = useUploadLimits();
  const [view, setView] = useState<View>('list');
  const [tables, setTables] = useState<WorksheetSummary[] | null>(null);
  const [listError, setListError] = useState('');
  const [fileName, setFileName] = useState('');
  const [draft, setDraftState] = useState<Draft | null>(null);
  const [recognized, setRecognized] = useState(true);
  /** id of the saved worksheet being edited (null while it is new) */
  const [savedId, setSavedId] = useState<string | null>(null);
  const [busy, setBusy] = useState<'' | 'parse' | 'save' | 'open'>('');
  const [error, setError] = useState('');

  const setDraft = (fn: (d: Draft) => Draft) => setDraftState((d) => (d ? fn(d) : d));
  const load = useCallback(() => {
    setListError('');
    api<WorksheetSummary[]>('/chubbuck').then(setTables, (e) => setListError(e.message));
  }, []);
  useEffect(load, [load]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view]);

  function startNew() {
    setError('');
    setDraftState(null);
    setSavedId(null);
    setView('upload');
  }

  async function onFile(f: File | undefined) {
    if (!f) return;
    setError('');
    if (f.size > MAX_BYTES) return setError(t('tooBig'));
    setFileName(f.name);
    setBusy('parse');
    try {
      // The script is read in the browser, by code: no server and no AI. The readers are loaded only now.
      const [{ readScript }, { parseScript }] = await Promise.all([import('@/lib/script/read'), import('@/lib/script/parse')]);
      const parsed = parseScript(await readScript(await f.arrayBuffer(), f.name));
      setRecognized(parsed.recognized);
      setDraftState(draftFromParsed(parsed));
      setView('check');
    } catch (e) {
      setError(t(e instanceof ReadError ? READ_ERRORS[e.code] : 'errBroken'));
    } finally {
      setBusy('');
    }
  }

  async function save() {
    if (!draft) return;
    setError('');
    setBusy('save');
    try {
      const { id } = await api<{ id: string }>('/chubbuck', {
        method: 'POST',
        body: JSON.stringify({ id: savedId ?? undefined, ...toWorksheet(draft) }),
      });
      setSavedId(id);
      setView('ready');
      load();
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setBusy('');
    }
  }

  async function edit(id: string) {
    setError('');
    setBusy('open');
    try {
      setDraftState(draftFromWorksheet(await api(`/chubbuck/${id}?data=1`)));
      setSavedId(id);
      setView('check');
    } catch (e) {
      setError(errorText(e, t));
    } finally {
      setBusy('');
    }
  }

  async function remove(w: WorksheetSummary) {
    if (!confirm(`${t('deleteTableConfirm')}\n${w.title}`)) return;
    try {
      await api(`/chubbuck/${w.id}`, { method: 'DELETE' });
      setTables((list) => list && list.filter((x) => x.id !== w.id));
    } catch (e) {
      setError(errorText(e, t));
    }
  }

  const valid = !!draft && toWorksheet(draft).lines.length > 0;
  const missing = draft ? withoutSpeaker(draft) : 0;
  const wizard = view !== 'list';
  const date = (iso: string) => new Date(iso).toLocaleDateString(lang === 'he' ? 'he-IL' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <>
      <TopBar title={t('toolChubbuckShort')} back="/" />
      <Page>
        {wizard && <Stepper steps={[t('stepUpload'), t('stepCheck'), t('stepDownload')]} current={view === 'upload' ? 0 : view === 'check' ? 1 : 2} />}
        {error && <p className="card border-red-400/50 p-4 text-red-300" dir="auto" role="alert">{error}</p>}

        {busy === 'parse' && <ProgressCard title={t('analyzing')} hint={fileName} estimateMs={4000} />}
        {busy === 'save' && <ProgressCard title={t('creatingTable')} estimateMs={3000} />}
        {busy === 'open' && <Status />}

        {!busy && view === 'list' && (
          <>
            <h2 className="pt-2 text-xl text-dim">{t('myTables')}</h2>
            {!tables ? (
              <Status error={listError} onRetry={load} />
            ) : tables.length === 0 ? (
              <p className="p-8 text-center text-xl text-dim">{t('noTables')}</p>
            ) : (
              tables.map((w) => (
                <div key={w.id} className="card flex flex-col gap-3 p-4">
                  <div>
                    <p className="text-2xl font-bold leading-snug" dir="auto">
                      {w.title || '—'}
                    </p>
                    <p className="mt-1 text-dim">
                      {w.author && <span dir="auto">{w.author} · </span>}
                      {w.rows} {t('rowsCount')} · {date(w.updated_at)}
                    </p>
                  </div>
                  <a className="btn btn-primary min-h-12 w-full" href={`/api/chubbuck/${w.id}`} download>
                    ⬇ {t('download')}
                  </a>
                  <div className="flex gap-2">
                    <button className="btn min-h-12 flex-1" onClick={() => edit(w.id)}>
                      ✎ {t('edit')}
                    </button>
                    <button className="btn btn-danger min-h-12 flex-1" onClick={() => remove(w)} aria-label={`${t('deleteTable')}: ${w.title}`}>
                      🗑 {t('delete')}
                    </button>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {!busy && view === 'upload' && (
          <label className="card flex cursor-pointer flex-col items-center gap-4 p-10 text-center">
            <span className="text-6xl" aria-hidden>📄</span>
            <span className="text-xl text-dim">{t('uploadHint')}</span>
            <span className="text-dim">{uploadLimits}</span>
            <span className="btn btn-primary text-xl">{t('chooseFile')}</span>
            <input
              type="file"
              className="sr-only"
              accept=".pdf,.docx,.odt,.rtf,.html,.htm,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text,application/rtf,text/*"
              onChange={(e) => {
                onFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </label>
        )}

        {!busy && view === 'check' && draft && (
          <>
            <input className="field text-2xl font-bold" dir="auto" aria-label={t('title')} placeholder={t('title')} value={draft.title} onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))} />
            <input className="field" dir="auto" aria-label={t('author')} placeholder={t('author')} value={draft.author} onChange={(e) => setDraft((d) => ({ ...d, author: e.target.value }))} />

            <p className={recognized ? 'text-dim' : 'text-mine'}>
              {recognized ? t('found').replace('{c}', String(draft.characters.length)).replace('{s}', String(draft.speeches.length)) : t('notRecognized')}
              {missing > 0 && recognized && <span className="text-red-300"> · {missing === 1 ? t('noSpeakerOne') : t('noSpeaker').replace('{n}', String(missing))}</span>}
            </p>
            <CharactersEditor draft={draft} update={setDraft} />
            <SpeechesEditor draft={draft} update={setDraft} />
          </>
        )}

        {!busy && view === 'ready' && savedId && (
          <div className="card flex flex-col items-center gap-4 p-8 text-center">
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-other/15 text-4xl text-other" aria-hidden>✓</span>
            <p className="text-2xl font-bold">{t('tableReady')}</p>
            <p className="text-dim">
              {draft ? toWorksheet(draft).lines.length : 0} {t('rowsCount')} · {t('tableReadyHint')}
            </p>
            <p className="text-other">{t('tableSaved')}</p>
            <a className="btn btn-primary w-full text-xl" href={`/api/chubbuck/${savedId}`} download>
              ⬇ {t('download')}
            </a>
            <button className="btn w-full" onClick={() => setView('check')}>
              {t('backToEdit')}
            </button>
            <button className="btn w-full" onClick={() => setView('list')}>
              {t('backToTables')}
            </button>
          </div>
        )}
      </Page>

      {!busy && view === 'list' && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-bg/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button className="btn btn-primary mx-auto flex w-full max-w-2xl text-xl" onClick={startNew}>
            + {t('anotherTable')}
          </button>
        </div>
      )}
      {!busy && (view === 'upload' || view === 'check') && (
        <div className="fixed inset-x-0 bottom-0 border-t border-line bg-bg/95 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <div className="mx-auto flex max-w-2xl gap-3">
            <button className="btn" onClick={() => setView(view === 'check' && !savedId ? 'upload' : 'list')}>
              {t('previous')}
            </button>
            {view === 'check' && draft && (
              <button className="btn btn-primary flex-1 text-xl" disabled={!valid} onClick={save}>
                ✓ {savedId ? t('save') : t('createTable')}
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}
