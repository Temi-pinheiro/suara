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

  const load = useCallback(async () => {
    dispatch({ type: 'LOAD' });
    try {
      const prompt = await api.nextPrompt();
      dispatch({ type: 'PROMPT_READY', prompt });
      await audio.play(prompt.setupAudioUrl);
      if (prompt.classmateAudioUrl) await audio.play(prompt.classmateAudioUrl);
      dispatch({ type: 'PROMPT_PLAYED' });
    } catch (e) {
      dispatch({ type: 'FAIL', error: e instanceof Error ? e.message : String(e) });
    }
  }, [api, audio]);

  const speak = useCallback(async () => {
    if (stateRef.current.phase !== 'awaiting') return;
    dispatch({ type: 'START_RECORDING' });
    await audio.startRecording();
  }, [audio]);

  const stopAndSubmit = useCallback(async () => {
    const current = stateRef.current;
    if (current.phase !== 'recording' || !current.prompt) return;
    const { turnId } = current.prompt;
    try {
      const rec = await audio.stopRecording();
      dispatch({ type: 'SUBMIT', audio: rec });
      const result = await api.submitAttempt(turnId, rec);
      dispatch({ type: 'SCORED', result });
      await audio.play(result.modelAudioUrl); // reveal the model AFTER the attempt
      dispatch({ type: 'FEEDBACK_PLAYED' });
      if (result.decision !== 'rebuild') await load();
    } catch (e) {
      dispatch({ type: 'FAIL', error: e instanceof Error ? e.message : String(e) });
    }
  }, [api, audio, load]);

  useEffect(() => {
    void load();
  }, [load]);

  return { state, speak, stopAndSubmit, reload: load };
}
