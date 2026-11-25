'use client';
import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { MAX_ARC_CHARS, MAX_ARC_FILES, MAX_ARC_NAME, type ArcPart, type ArcScene } from '@/lib/arc';
import { api } from '@/lib/client';
import { errorText, useI18n, type Key } from '@/lib/i18n';
import { ReadError } from '@/lib/script/types';
import { Page, ProgressCard, TopBar } from '@/components/ui';

const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPT =
  '.pdf,.docx,.odt,.rtf,.html,.htm,.txt,.md,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text,application/rtf,text/*';
const READ_ERRORS: Record<ReadError['code'], Key> = { unsupported: 'unsupported', old_doc: 'errOldDoc', image: 'errImage', empty: 'errEmpty', broken: 'errBroken' };

/** New character analysis: add the script files, name the character, and the result is saved and opened. */
export default function NewArc() {
  const { t } = useI18n();
  const router = useRouter();
  const [character, setCharacter] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [progress, setProgress] = useState<{ done: number; total: number; name: string } | null>(null);
  const input = useRef<HTMLInputElement>(null);

  function add(list: FileList | File[] | null | undefined) {
    if (!list) return;
    setError('');
    const next = [...files];
    for (const f of Array.from(list)) {
      if (f.size > MAX_BYTES) {
        setError(`${f.name}: ${t('arcTooBig')}`);
        continue;
      }
      if (!next.some((o) => o.name === f.name && o.size === f.size)) next.push(f);
    }
    if (next.length > MAX_ARC_FILES) setError(t('arcTooMany').replace('{n}', String(MAX_ARC_FILES)));
    // episodes in order: "פרק 2" before "פרק 10"
    setFiles(next.slice(0, MAX_ARC_FILES).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })));
  }

  async function analyze() {
    const name = character.trim();
    if (!name || !files.length) return;
    setError('');
    const parts: ArcPart[] = [];
    try {
      const { readScript } = await import('@/lib/script/read');
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        setProgress({ done: i, total: files.length, name: f.name });
        let text: string;
        try {
          text = (await readScript(await f.arrayBuffer(), f.name)).map((l) => l.text).join('\n');
        } catch (e) {
          throw new Error(`${f.name}: ${t(e instanceof ReadError ? READ_ERRORS[e.code] : 'errBroken')}`);
        }
        if (text.length > MAX_ARC_CHARS) throw new Error(`${f.name}: ${t('errTooLong')}`);
        try {
          const { scenes } = await api<{ scenes: ArcScene[] }>('/arc', { method: 'POST', body: JSON.stringify({ character: name, text }) });
          parts.push({ fileName: f.name, scenes });
        } catch (e) {
          throw new Error(files.length > 1 ? `${f.name}: ${errorText(e, t)}` : errorText(e, t));
        }
      }
      if (!parts.some((p) => p.scenes.length)) throw new Error(t('arcNone'));
      const { id } = await api<{ id: string }>('/arcs', { method: 'POST', body: JSON.stringify({ character: name, parts }) }).catch((e) => {
        throw new Error(errorText(e, t));
      });
      router.replace(`/arc/${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setProgress(null);
    }
  }

  return (
    <>
      <TopBar title={t('arcNew')} back="/arc" />
      <Page>
        {progress ? (
          <ProgressCard title={t('arcWorking')} hint={`${progress.name} · ${t('arcWorkingHint')}`} done={progress.total > 1 ? progress.done : undefined} total={progress.total > 1 ? progress.total : undefined} estimateMs={40_000} />
        ) : (
          <>
            <div className="pt-2">
              <h2 className="text-2xl font-bold leading-snug">{t('arcHeading')}</h2>
              <p className="mt-2 text-lg leading-relaxed text-dim">{t('arcIntro')}</p>
            </div>
            {error && (
              <p className="card border-red-400/40! p-4 text-red-300" role="alert">
                {error}
              </p>
            )}
            <section className="card flex flex-col gap-5 p-5">
              <label className="flex flex-col gap-2">
                <span className="text-xl font-bold">{t('arcName')}</span>
                <input className="field text-xl" value={character} maxLength={MAX_ARC_NAME} onChange={(e) => setCharacter(e.target.value)} placeholder={t('arcNamePlaceholder')} dir="auto" autoComplete="off" />
              </label>

              <div className="flex flex-col gap-2">
                <span className="text-xl font-bold">{t('arcFiles')}</span>
                <button
                  type="button"
                  onClick={() => input.current?.click()}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragging(true);
                  }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragging(false);
                    add(e.dataTransfer.files);
                  }}
                  className={`flex flex-col items-center gap-2 rounded-2xl border-2 border-dashed p-6 text-center transition-colors ${dragging ? 'border-mine bg-mine/10' : 'border-line hover:border-ink/40'}`}
                  data-drop
                >
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-mine/15 text-4xl leading-none text-mine" aria-hidden>
                    +
                  </span>
                  <span className="text-lg font-semibold">{t('arcDrop')}</span>
                  <span className="text-sm text-dim">{t('arcDropHint')}</span>
                </button>
                <input
                  ref={input}
                  type="file"
                  multiple
                  className="sr-only"
                  accept={ACCEPT}
                  onChange={(e) => {
                    add(e.target.files);
                    e.target.value = '';
                  }}
                />
                {files.length > 0 && (
                  <ul className="flex flex-col gap-2">
                    {files.map((f) => (
                      <li key={f.name + f.size} className="flex items-center gap-3 rounded-xl bg-card2 px-3 py-2" data-file>
                        <span className="min-w-0 flex-1 truncate" dir="auto">
                          {f.name}
                        </span>
                        <button className="btn btn-sm" aria-label={`${t('arcRemove')} ${f.name}`} onClick={() => setFiles(files.filter((o) => o !== f))}>
                          ✕
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <button className="btn btn-primary min-h-16 text-xl" disabled={!character.trim() || !files.length} onClick={analyze}>
                {t('arcGo')}
              </button>
              {(!character.trim() || !files.length) && <p className="-mt-2 text-center text-sm text-dim">{t('arcNeed')}</p>}
            </section>
          </>
        )}
      </Page>
    </>
  );
}
