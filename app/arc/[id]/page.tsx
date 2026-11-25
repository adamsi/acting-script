'use client';
import { useRouter } from 'next/navigation';
import { use, useCallback, useEffect, useRef, useState } from 'react';
import { ARC_FIELDS, arcToDocx, arcToText, sceneTitle, type SavedArc } from '@/lib/arc';
import { api } from '@/lib/client';
import { errorText, useI18n } from '@/lib/i18n';
import { Page, Status, TopBar } from '@/components/ui';

/** A text box that grows with what is written in it. */
function Answer({ value, onChange, label }: { value: string; onChange: (v: string) => void; label: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return <textarea ref={ref} rows={1} className="field mt-1 w-full resize-none py-2 text-lg leading-relaxed" dir="auto" value={value} aria-label={label} onChange={(e) => onChange(e.target.value)} />;
}

/** One saved analysis: the scenes, the actor's answers (saved as they type), Word / copy / delete. */
export default function Arc({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { t } = useI18n();
  const router = useRouter();
  const [arc, setArc] = useState<SavedArc | null>(null);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState<'' | 'saving' | 'saved' | 'failed'>('');
  const [copied, setCopied] = useState(false);
  const latest = useRef<SavedArc | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dirty = useRef(false);

  const load = useCallback(() => {
    setError('');
    api<SavedArc>(`/arcs/${id}`).then(setArc, (e) => setError(e.status === 404 ? t('arcNotFound') : e.message));
  }, [id, t]);
  useEffect(load, [load]);

  const save = useCallback(async () => {
    const a = latest.current;
    if (!a || !dirty.current) return;
    dirty.current = false;
    setSaveState('saving');
    try {
      await api(`/arcs/${id}`, { method: 'PUT', body: JSON.stringify({ character: a.character, parts: a.parts }) });
      if (!dirty.current) setSaveState('saved');
    } catch {
      dirty.current = true;
      setSaveState('failed');
    }
  }, [id]);

  // save a moment after the last keystroke, and when leaving the page
  function answer(pi: number, si: number, fi: number, value: string) {
    if (!arc) return;
    const next: SavedArc = {
      ...arc,
      parts: arc.parts.map((p, i) =>
        i !== pi ? p : { ...p, scenes: p.scenes.map((s, j) => (j !== si ? s : { ...s, answers: ARC_FIELDS.map((_, k) => (k === fi ? value : (s.answers?.[k] ?? ''))) })) }
      ),
    };
    setArc(next);
    latest.current = next;
    dirty.current = true;
    setSaveState('saving');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(save, 900);
  }
  useEffect(() => {
    const flush = () => {
      if (timer.current) clearTimeout(timer.current);
      const a = latest.current;
      if (a && dirty.current) {
        dirty.current = false;
        fetch(`/api/arcs/${id}`, { method: 'PUT', keepalive: true, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ character: a.character, parts: a.parts }) }).catch(() => {});
      }
    };
    window.addEventListener('pagehide', flush);
    return () => {
      window.removeEventListener('pagehide', flush);
      flush();
    };
  }, [id]);

  async function copy() {
    if (!arc) return;
    await navigator.clipboard.writeText(arcToText(arc.character, arc.parts));
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  async function download() {
    if (!arc) return;
    const url = URL.createObjectURL(await arcToDocx(arc.character, arc.parts));
    const a = document.createElement('a');
    a.href = url;
    a.download = `${t('toolArc')} - ${arc.character}.docx`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function remove() {
    if (!arc || !confirm(`${t('arcDeleteConfirm')}\n${arc.character}`)) return;
    try {
      dirty.current = false;
      await api(`/arcs/${id}`, { method: 'DELETE' });
      router.replace('/arc');
    } catch (e) {
      setError(errorText(e, t));
    }
  }

  const total = arc ? arc.parts.reduce((n, p) => n + p.scenes.length, 0) : 0;

  return (
    <>
      <TopBar title={arc?.character ?? t('toolArc')} back="/arc" />
      <Page>
        {!arc ? (
          <Status error={error} onRetry={load} />
        ) : (
          <>
            {error && (
              <p className="card p-4 text-red-300" role="alert">
                {error}
              </p>
            )}
            <section className="card flex flex-col gap-4 p-5">
              <div>
                <p className="text-dim">{t('arcResultFor')}</p>
                <h2 className="text-3xl font-bold leading-snug" dir="auto">
                  {arc.character}
                </h2>
                <p className="mt-1 text-dim">
                  {total} {t('arcScenes')}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button className="btn btn-primary" onClick={download}>
                  ⬇ {t('arcWord')}
                </button>
                <button className="btn" onClick={copy}>
                  {copied ? `✓ ${t('arcCopied')}` : t('arcCopy')}
                </button>
              </div>
              <p className="text-sm leading-relaxed text-dim">{t('arcFillHint')}</p>
            </section>

            {arc.parts.map((part, pi) => (
              <section key={pi} className="flex flex-col gap-3" dir="rtl" lang="he">
                {arc.parts.length > 1 && (
                  <h2 className="px-1 pt-3 text-xl font-bold text-other" dir="auto">
                    {part.fileName.replace(/\.[^.]+$/, '')}
                  </h2>
                )}
                {part.scenes.length === 0 && <p className="px-1 text-dim">{t('arcNoneInFile')}</p>}
                {part.scenes.map((s, si) => (
                  <article key={si} className="card p-5" data-scene>
                    <h3 className="text-xl font-bold text-mine">{sceneTitle(s.number)}</h3>
                    <p className="mt-2 whitespace-pre-line text-lg leading-relaxed" dir="auto">
                      {s.summary}
                    </p>
                    <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4">
                      {ARC_FIELDS.map((f, fi) => (
                        <label key={f} className="block">
                          <span className="font-semibold text-dim">{f}</span>
                          <Answer value={s.answers?.[fi] ?? ''} label={`${sceneTitle(s.number)} · ${f}`} onChange={(v) => answer(pi, si, fi, v)} />
                        </label>
                      ))}
                    </div>
                  </article>
                ))}
              </section>
            ))}

            <button className="btn btn-danger mt-4 self-center" onClick={remove}>
              🗑 {t('arcDelete')}
            </button>
          </>
        )}
      </Page>
      {arc && saveState && (
        <p
          className={`fixed bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full border border-line bg-card px-4 py-2 text-sm shadow-lg ${saveState === 'failed' ? 'text-red-300' : 'text-dim'}`}
          role="status"
          data-save={saveState}
        >
          {saveState === 'saving' ? t('arcSaving') : saveState === 'saved' ? `✓ ${t('saved')}` : t('arcSaveFailed')}
        </p>
      )}
    </>
  );
}
