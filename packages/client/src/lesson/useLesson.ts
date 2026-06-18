import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import type { SessionApi } from '../api/types';
import type { AudioIO } from '../audio/types';
import { initialLessonState, lessonReducer } from './machine';

const errMsg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Drives the pure lesson machine with the injected SessionApi + AudioIO.
 * The reducer owns the transitions (and is unit-tested); this hook only performs
 * the side effects (fetch, play, record) and dispatches the results.
 *
 * Audio is best-effort and learner-initiated: the turn becomes usable the instant
 * the prompt loads, and the screen NEVER blocks waiting for a clip to finish. This
 * matters on web (browsers refuse to autoplay without a user gesture) — the learner
 * taps "Listen" to hear the model, and advancing is an explicit tap, not a timer.
 */
export function useLesson(api: SessionApi, audio: AudioIO) {
  const [state, dispatch] = useReducer(lessonReducer, initialLessonState);
  const stateRef = useRef(state);
  stateRef.current = state;
  // Re-entrancy guard: dispatch is async, so the phase guards alone don't stop a
  // rapid double-tap from firing an action twice (double recorder, double submit).
  const busy = useRef(false);
  // Drives the Listen button's "Playing…" state. Not in the reducer because it's
  // pure UI affordance, not a lesson transition.
  const [playing, setPlaying] = useState(false);
  // Running session spend (USD), accumulated from each call's reported cost. In-memory
  // only (CLAUDE.md §6) — resets when the lesson is left and re-entered.
  const [spend, setSpend] = useState(0);
  const addSpend = (usd: number | undefined) => {
    if (usd) setSpend((s) => s + usd);
  };

  // Play a clip without ever wedging the turn. A clip that won't load (autoplay
  // blocked on web, unreachable URL) is logged, not fatal — the learner can retry
  // via Listen and can always proceed.
  const safePlay = useCallback(
    async (url: string | undefined | null) => {
      if (!url) return;
      setPlaying(true);
      try {
        await audio.play(url);
      } catch (e) {
        console.warn('audio playback failed:', url, e);
      } finally {
        setPlaying(false);
      }
    },
    [audio],
  );

  const load = useCallback(async () => {
    dispatch({ type: 'LOAD' });
    try {
      const prompt = await api.nextPrompt();
      addSpend(prompt.costUsd);
      dispatch({ type: 'PROMPT_READY', prompt });
      // Usable immediately — do NOT await audio. Then try a best-effort autoplay of
      // the model (introduce) or the setup; if the browser blocks it, the learner
      // just taps Listen.
      dispatch({ type: 'PROMPT_PLAYED' });
      void safePlay(prompt.teach?.modelAudioUrl ?? prompt.setupAudioUrl);
    } catch (e) {
      dispatch({ type: 'FAIL', error: errMsg(e) });
    }
  }, [api, safePlay]);

  const speak = useCallback(async () => {
    if (busy.current || stateRef.current.phase !== 'awaiting') return;
    busy.current = true;
    try {
      dispatch({ type: 'START_RECORDING' });
      await audio.startRecording();
    } catch (e) {
      dispatch({ type: 'FAIL', error: errMsg(e) });
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
      addSpend(result.costUsd);
      dispatch({ type: 'SCORED', result });
      // Reveal the model AFTER the attempt — best-effort; the learner replays it
      // and advances by tapping, so they can read the cue at their own pace.
      void safePlay(result.modelAudioUrl);
    } catch (e) {
      dispatch({ type: 'FAIL', error: errMsg(e) });
    } finally {
      busy.current = false;
    }
  }, [api, audio, safePlay]);

  // Listen / hear-it-again: replays the current turn's model (or setup) on demand.
  const replay = useCallback(() => {
    const s = stateRef.current;
    const url =
      s.phase === 'feedback'
        ? s.attempt?.modelAudioUrl
        : (s.prompt?.teach?.modelAudioUrl ?? s.prompt?.setupAudioUrl);
    void safePlay(url);
  }, [safePlay]);

  useEffect(() => {
    void load();
    // load is only ever called once on mount here; reload() re-runs it explicitly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // From feedback, "Continue / Try once more" always fetches the NEXT turn. Server
  // turns are single-use (`pending.take` consumes them), so the same turn can't be
  // resubmitted; a missed block is re-surfaced by the invisible SRS on a later turn
  // (an MT invariant), not by a same-turn replay.
  return { state, playing, spend, speak, stopAndSubmit, replay, reload: load };
}
