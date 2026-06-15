/**
 * @suara/core — the language- and host-agnostic teaching engine.
 *
 * Hard rule (CLAUDE.md §4): this package imports NO provider or infra SDKs.
 * Providers depend on these interfaces; never the reverse.
 */

export * from './types';
export * from './srs';
export * from './brain';
export * from './turn';
