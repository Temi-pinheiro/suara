import { useCallback, useEffect, useReducer, useRef } from 'react';
import type { SessionApi } from '../api/types';
import type { AudioIO } from '../audio/types';
import { initialLessonState, lessonReducer } from './machine';

/**
 * Drives the pure lesson machine with the injected SessionApi + AudioIO.
 * The reducer owns the transitions (and is unit-tested); this hook only performs
 * the side effects (fetch, play, record) and dispatches the results.
 */
export function useLesson(api: SessionApi, audio: AudioIO) {
  const [state, dispatch] = useReducer(lessonReducer, initialLessonState);
  const stateRef = useRef(state);
  stateRef.current = state;
  // Re-entrancy guard: dispatch is async, so the phase guards alone don't stop a
  // rapid double-tap from firing an action twice (double recorder, double submit).
  const busy = useRef(false);

  // A clip that won't load (unplayable URL, no audio) must NOT wedge the turn — the
  // learner can still proceed. Failures are logged, not fatal.
  const safePlay = useCallback(
    async (url: string) => {
      try {
        await audio.play(url);
      } catch (e) {
        console.warn('audio playback failed:', url, e);
      }
    },
    [audio],
  );

  const load = useCallback(async () => {
    dispatch({ type: 'LOAD' });
    try {
      const prompt = await api.nextPrompt();
      dispatch({ type: 'PROMPT_READY', prompt });
      await safePlay(prompt.setupAudioUrl);
      // introduce: model the new block so the learner HEARS it before producing it
      if (prompt.teach?.modelAudioUrl) await safePlay(prompt.teach.modelAudioUrl);
      if (prompt.classmateAudioUrl) await safePlay(prompt.classmateAudioUrl);
      dispatch({ type: 'PROMPT_PLAYED' });
    } catch (e) {
      dispatch({ type: 'FAIL', error: e instanceof Error ? e.message : String(e) });
    }
  }, [api, safePlay]);

  const speak = useCallback(async () => {
    if (busy.current || stateRef.current.phase !== 'awaiting') return;
    busy.current = true;
    try {
      dispatch({ type: 'START_RECORDING' });
      await audio.startRecording();
    } catch (e) {
      dispatch({ type: 'FAIL', error: e instanceof Error ? e.message : String(e) });
    } finally {
      busy.current = false;
    }
  }, [audio]);

  const stopAndSubmit = useCallback(async () => {
    const current = stateRef.current;
    if (busy.current || current.phase !== 'recording' || !current.prompt) return;
    busy.current = true;
    const { turnId } = current.prompt;
    try {
      const rec = await audio.stopRecording();
      dispatch({ type: 'SUBMIT', audio: rec });
      const result = await api.submitAttempt(turnId, rec);
      dispatch({ type: 'SCORED', result });
      await safePlay(result.modelAudioUrl); // reveal the model AFTER the attempt
      dispatch({ type: 'FEEDBACK_PLAYED' });
      if (result.decision !== 'rebuild') await load();
    } catch (e) {
      dispatch({ type: 'FAIL', error: e instanceof Error ? e.message : String(e) });
    } finally {
      busy.current = false;
    }
  }, [api, audio, safePlay, load]);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, speak, stopAndSubmit, reload: load };
}
