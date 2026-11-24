import { describe, expect, it } from 'vitest';
import { audioHash, isCurrentAiRecording, TTS_MODEL } from '../lib/inworld';
import { costOf } from '../lib/usage';

describe('AI recordings and the model', () => {
  it('uses a current model by default and keeps recordings made with the earlier ones', () => {
    expect(TTS_MODEL).toBe('inworld-tts-2');
    expect(isCurrentAiRecording(audioHash('שלום', 'Amos'), 'שלום', 'Amos')).toBe(true);
    expect(isCurrentAiRecording(audioHash('שלום', 'Amos', 'inworld-tts-1.5-max'), 'שלום', 'Amos')).toBe(true);
    // another text or another voice is another recording
    expect(isCurrentAiRecording(audioHash('שלום', 'Amos', 'inworld-tts-1.5-max'), 'שלום לך', 'Amos')).toBe(false);
    expect(isCurrentAiRecording(audioHash('שלום', 'Amos'), 'שלום', 'Noa')).toBe(false);
    expect(isCurrentAiRecording(null, 'שלום', 'Amos')).toBe(false);
  });
});

describe('estimated cost', () => {
  it('is characters times the price per million', () => {
    expect(costOf(1_000_000, 10)).toBe(10);
    expect(costOf(2500, 10)).toBe(0.025);
    expect(costOf(0, 10)).toBe(0);
  });
});
