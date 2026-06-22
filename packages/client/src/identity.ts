/**
 * Anonymous per-device identity. TestFlight testers have no login, so each install
 * needs its OWN stable learner id — otherwise everyone shares (and overwrites) one
 * server-side learner state. We mint a random handle once and keep it.
 *
 * This is an *opaque identifier*, not learner data: the iOS Keychain (expo-secure-store)
 * is the right home for it and it survives app launches/updates. That's distinct from the
 * CLAUDE.md §6 rule against caching learner state on the client — we store no progress here,
 * only a pseudonymous handle the server maps to a LearnerState.
 *
 * Web has no Keychain and the project forbids localStorage/sessionStorage, so the web
 * fallback is an in-memory id (a fresh handle per page load). Web is not the TestFlight
 * target; iOS/Android get true persistence.
 *
 * `EXPO_PUBLIC_SUARA_USER` still overrides everything — handy for dev and for pinning a
 * known learner across devices.
 */

import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const KEY = 'suara.deviceUserId';
const ENV_OVERRIDE = process.env.EXPO_PUBLIC_SUARA_USER;

let cached: string | null = null;

/** RFC4122-ish v4. Not for security — just a collision-resistant anonymous handle. */
function uuidv4(): string {
  const rnd = () => Math.floor(Math.random() * 16);
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = rnd();
    const v = ch === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Resolve this install's learner id. Idempotent: the first call mints + persists the
 * handle, later calls return the cached value. Never throws — Keychain failures degrade
 * to an in-memory id so the app still runs.
 */
export async function getDeviceUserId(): Promise<string> {
  if (ENV_OVERRIDE) return ENV_OVERRIDE;
  if (cached) return cached;

  // Web (and any platform without SecureStore): in-memory only, per the no-storage rule.
  if (Platform.OS === 'web' || !(await isSecureStoreUsable())) {
    cached = uuidv4();
    return cached;
  }

  try {
    const existing = await SecureStore.getItemAsync(KEY);
    if (existing) {
      cached = existing;
      return existing;
    }
    const fresh = uuidv4();
    await SecureStore.setItemAsync(KEY, fresh);
    cached = fresh;
    return fresh;
  } catch {
    cached = uuidv4(); // Keychain unavailable — don't block the lesson on identity.
    return cached;
  }
}

async function isSecureStoreUsable(): Promise<boolean> {
  try {
    return await SecureStore.isAvailableAsync();
  } catch {
    return false;
  }
}
