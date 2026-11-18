'use client';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/lib/i18n';
import { apiBlob, newKey, pickVoice, playBlob, unlockAudio } from '@/lib/client';
import type { Draft, DraftCharacter, DraftLine, Gender, Voice } from '@/lib/types';

type SetDraft = (fn: (d: Draft) => Draft) => void;

export function CharactersEditor({ draft, setDraft, voices }: { draft: Draft; setDraft: SetDraft; voices: Voice[] }) {
  const { t, lang } = useI18n();
  const [previewing, setPreviewing] = useState('');

  const update = (key: string, patch: Partial<DraftCharacter>) =>
    setDraft((d) => ({ ...d, characters: d.characters.map((c) => (c.key === key ? { ...c, ...patch } : c)) }));

  function setGender(c: DraftCharacter, gender: Gender) {
    const current = voices.find((v) => v.id === c.voice_id);
    const used = new Set(draft.characters.filter((x) => x.key !== c.key).map((x) => x.voice_id));
    update(c.key, {
      gender,
      voice_id: current && current.gender === gender ? c.voice_id : pickVoice(gender, voices, used),
    });
  }

  async function preview(c: DraftCharacter) {
    if (!c.voice_id) return;
    unlockAudio();
    setPreviewing(c.key);
    try {
      const sample = draft.lines.find((l) => l.speaker === c.key)?.text.replace(/\([^)]*\)/g, '').trim();
      const fallback = draft.language === 'he' ? 'שלום, אני אקרא איתך את הסצנה הזאת.' : t('sample');
      const blob = await apiBlob('/voices/preview', {
        method: 'POST',
        body: JSON.stringify({ voice_id: c.voice_id, text: (sample || fallback).slice(0, 120) }),
      });
      await playBlob(blob);
    } catch {
    } finally {
      setPreviewing('');
    }
  }

  const genderLabel = (g: Gender) => (g === 'male' ? t('male') : g === 'female' ? t('female') : '?');

  return (
    <div className="flex flex-col gap-3">
      {draft.characters.map((c) => {
        const lineCount = draft.lines.filter((l) => l.speaker === c.key).length;
        const mine = draft.my === c.key;
        return (
          <div key={c.key} className={`card flex flex-col gap-3 p-4 ${mine ? 'border-mine' : ''}`}>
            <div className="flex items-center gap-2">
              <input
                className="field text-xl font-bold"
                value={c.name}
                aria-label={t('name')}
                dir="auto"
                onChange={(e) => update(c.key, { name: e.target.value })}
              />
              <span className="shrink-0 text-dim">
                {lineCount} {t('linesCount')}
              </span>
            </div>
            <button
              className={`btn ${mine ? 'btn-primary' : ''}`}
              aria-pressed={mine}
              onClick={() => setDraft((d) => ({ ...d, my: c.key }))}
            >
              {mine ? `✓ ${t('thisIsMe')}` : t('thisIsMe')}
            </button>
            {!mine && (
              <div className="flex flex-wrap items-center gap-2">
                <select
                  className="field w-auto"
                  value={c.gender === 'unknown' ? '' : c.gender}
                  aria-label={`${t('male')}/${t('female')}`}
                  onChange={(e) => setGender(c, e.target.value as Gender)}
                >
                  {c.gender === 'unknown' && <option value="">?</option>}
                  <option value="male">{t('male')}</option>
                  <option value="female">{t('female')}</option>
                </select>
                <select
                  className="field min-w-0 flex-1"
                  value={c.voice_id}
                  aria-label={t('voice')}
                  onChange={(e) => update(c.key, { voice_id: e.target.value })}
                >
                  {!voices.some((v) => v.id === c.voice_id) && <option value={c.voice_id}>{c.voice_id || '—'}</option>}
                  {voices.map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.name} · {genderLabel(v.gender)}
                    </option>
                  ))}
                </select>
                <button className="btn" onClick={() => preview(c)} disabled={!c.voice_id || previewing === c.key}>
                  {previewing === c.key ? '…' : `▶ ${t('listen')}`}
                </button>
              </div>
            )}
            {lineCount === 0 && draft.characters.length > 1 && (
              <button
                className="btn btn-danger self-start"
                onClick={() =>
                  setDraft((d) => ({
                    ...d,
                    characters: d.characters.filter((x) => x.key !== c.key),
                    my: d.my === c.key ? '' : d.my,
                  }))
                }
              >
                {t('remove')}
              </button>
            )}
          </div>
        );
      })}
      <button
        className="btn self-start"
        onClick={() =>
          setDraft((d) => {
            const used = new Set(d.characters.map((x) => x.voice_id));
            return {
              ...d,
              characters: [
                ...d.characters,
                { key: newKey(), name: '', gender: 'male', description: '', voice_id: pickVoice('male', voices, used) },
              ],
            };
          })
        }
      >
        + {t('addCharacter')}
      </button>
      <p className="sr-only" lang={lang} />
    </div>
  );
}

function AutoTextarea({ value, onChange, className, label }: { value: string; onChange: (v: string) => void; className?: string; label: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [value]);
  return (
    <textarea ref={ref} rows={1} dir="auto" aria-label={label} className={className} value={value} onChange={(e) => onChange(e.target.value)} />
  );
}

export function LinesEditor({
  draft,
  setDraft,
  onRegenerate,
  busyLine,
}: {
  draft: Draft;
  setDraft: SetDraft;
  /** settings only: save, re-record this line and play it */
  onRegenerate?: (line: DraftLine) => void;
  busyLine?: string;
}) {
  const { t } = useI18n();
  const update = (key: string, patch: Partial<DraftLine>) =>
    setDraft((d) => ({ ...d, lines: d.lines.map((l) => (l.key === key ? { ...l, ...patch } : l)) }));

  return (
    <div className="flex flex-col gap-3">
      <p className="text-dim">{t('directionsHint')}</p>
      {draft.lines.map((l, i) => {
        const mine = l.speaker === draft.my;
        return (
          <div key={l.key} className={`card flex flex-col gap-2 p-3 ${mine ? 'border-mine/60' : ''}`}>
            <div className="flex items-center gap-2">
              <span className="w-8 shrink-0 text-center text-dim" dir="ltr">
                {i + 1}
              </span>
              <select
                className={`field min-w-0 flex-1 font-bold ${mine ? 'text-mine' : 'text-other'}`}
                value={l.speaker}
                aria-label={t('characters')}
                onChange={(e) => update(l.key, { speaker: e.target.value })}
              >
                {draft.characters.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.name || '—'}
                  </option>
                ))}
              </select>
              <button
                className="btn min-h-12 px-3"
                title={t('addLineBelow')}
                aria-label={t('addLineBelow')}
                onClick={() =>
                  setDraft((d) => {
                    const lines = [...d.lines];
                    lines.splice(i + 1, 0, { key: newKey(), speaker: l.speaker, text: '', spoken_text: '' });
                    return { ...d, lines };
                  })
                }
              >
                +
              </button>
              <button
                className="btn btn-danger min-h-12 px-3"
                title={t('deleteLine')}
                aria-label={t('deleteLine')}
                onClick={() => setDraft((d) => ({ ...d, lines: d.lines.filter((x) => x.key !== l.key) }))}
              >
                ✕
              </button>
            </div>
            <AutoTextarea label={`${t('stepLines')} ${i + 1}`} className="field resize-none text-xl leading-relaxed" value={l.text} onChange={(v) => update(l.key, { text: v })} />
            {onRegenerate && !mine && (
              <div className="flex items-center gap-2">
                <input
                  className="field min-w-0 flex-1 text-base"
                  dir="auto"
                  placeholder={t('pronunciation')}
                  aria-label={t('pronunciation')}
                  value={l.spoken_text}
                  onChange={(e) => update(l.key, { spoken_text: e.target.value })}
                />
                <button className="btn shrink-0 text-base" disabled={!!busyLine} onClick={() => onRegenerate(l)}>
                  {busyLine === l.key ? '…' : `↻ ${t('regenerate')}`}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function draftProblem(d: Draft): boolean {
  return (
    !d.my ||
    !d.lines.length ||
    d.characters.some((c) => !c.name.trim() || (c.key !== d.my && !c.voice_id)) ||
    d.lines.some((l) => !l.text.trim())
  );
}
