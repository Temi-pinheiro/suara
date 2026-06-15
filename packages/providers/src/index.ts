/**
 * @suara/providers — concrete implementations of the core interfaces.
 *
 * Phase 0 ships mocks only (CI never makes live calls). Real providers
 * (Anthropic, ElevenLabs, Scribe, SpeechSuper, Azure, Supabase) land from
 * Phase 1 behind these same interfaces. Providers depend on @suara/core; the
 * reverse never happens.
 */

export * from './llm/mock';
export * from './tts/mock';
export * from './asr/mock';
export * from './pronunciation/mock';
export * from './pronunciation/coached';
export * from './store/memory';
