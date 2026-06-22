# Deploy — backend (Node host) + TestFlight build

The app ships in two halves: a **backend** the phone can reach over HTTPS, and the
**Expo iOS build** pointed at it. The hard prerequisite for TestFlight is that the
client no longer talks to `localhost`.

---

## 1. Backend → Node host (Render / Railway / Fly / Cloud Run)

The backend is the **same `pnpm serve` Node server you run locally** (`scripts/serve.mts`
→ `createLanguageRouter` + `createHttpHandler`), containerized by the repo `Dockerfile`.
No Deno, no bundling — the workspace TS runs under tsx exactly as in dev. Auth is our
anonymous `x-user-id` (each install mints one); the cost guardrails in
`packages/server/src/cost` protect the open endpoint.

> Supabase Edge was the original target but its Deno runtime can't resolve the Node-style
> imports in the workspace source (extensionless / directory imports). The `supabase/`
> dir is left as a reference but is **not** the supported path.

### 1a. Migrate + seed the DB (once, from your machine with `.env`)

```bash
pnpm db:migrate
pnpm db:seed cmn && pnpm db:seed jpn && pnpm db:seed kor && pnpm db:seed hin && pnpm db:seed ind
```

### 1b. Deploy the container

Point your host at the repo `Dockerfile` (Render: "Web Service" from the repo, Docker
runtime; Fly: `fly launch` detects it; Railway/Cloud Run similar). It builds, runs
`pnpm serve`, and listens on the injected `$PORT`. Locally:

```bash
docker build -t suara-server .
docker run -p 8787:8787 --env-file .env suara-server
```

### 1c. Set env (on the host dashboard — never in the client)

```
ANTHROPIC_API_KEY   ELEVENLABS_API_KEY
AZURE_SPEECH_KEY    AZURE_REGION
SPEECHSUPER_APP_KEY SPEECHSUPER_SECRET
R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_BUCKET R2_PUBLIC_BASE_URL
DATABASE_URL                              # pooled connection — see below
SUARA_TARGET_VOICE_ID  SUARA_L1_VOICE_ID  # ElevenLabs voice ids
```

- **`DATABASE_URL` should be the pooled connection** (Supavisor, *transaction* mode,
  port `6543`): `postgresql://postgres.<ref>:<pw>@aws-0-<region>.pooler.supabase.com:6543/postgres`.
  The client sets `prepare: false`, which transaction-mode pooling requires. (A direct
  `5432` connection also works for a single always-on instance, but the pooler is safer
  if the host scales out.)
- `SUARA_TARGET_VOICE_ID` / `SUARA_L1_VOICE_ID` pin the voice so the server skips the
  boot-time ElevenLabs fetch and matches the pre-generated audio cache. One multilingual
  voice serves **all five** languages (`eleven_multilingual_v2`) — not one per language.
- **`SUARA_LANG` is optional** — only the default for a request with no `x-suara-lang`
  header. The client always sends that header (the in-app picker), so all five are live
  regardless; omit it and it defaults to `cmn`.

### 1d. Smoke test (no app needed)

```bash
BASE=https://<your-host-url>
curl -s -X POST "$BASE/turn/plan" -H 'x-user-id: smoke-1' -H 'x-suara-lang: cmn' | head
curl -s "$BASE/path" -H 'x-user-id: smoke-1' -H 'x-suara-lang: cmn' | head
```

A 200 with a JSON prompt/path means the brain + TTS + DB + R2 are all wired. The host
gives you an `https://` URL (so iOS ATS is satisfied — unlike the LAN `http` dev URL).

---

## 2. Client → point at the deployed backend, build, submit

Accounts (Apple Developer + Expo/EAS) are ready.

```bash
cd packages/client
# one-time: registers the EAS project and fills extra.eas.projectId in app.json
eas init
```

1. In `eas.json`, replace `EXPO_PUBLIC_SUARA_API` (preview + production) with your
   host's `https://` URL from §1, and fill the `submit.production.ios` credentials
   (`appleId`, `ascAppId`, `appleTeamId`).
2. Build + submit:
   ```bash
   eas build --platform ios --profile production
   eas submit --platform ios --profile production --latest
   ```
3. In App Store Connect: complete the **app privacy** form (data collected: *audio*,
   for app functionality, not linked to identity — testers are anonymous device ids),
   then add the build to a TestFlight group.

`ITSAppUsesNonExemptEncryption: false` (in `app.json`) skips the per-upload export
question — the app uses only standard HTTPS.

---

## 3. Quick reference

| Thing | Where |
|---|---|
| Server entry | `packages/server/scripts/serve.mts` (`pnpm serve`) |
| Container | `Dockerfile` + `.dockerignore` (repo root) |
| Backend URL → client | `packages/client/eas.json` → `EXPO_PUBLIC_SUARA_API` |
| Apple submit creds | `packages/client/eas.json` → `submit.production.ios` |
| Anonymous identity | `packages/client/src/identity.ts` (Keychain) → `x-user-id` |
| Cost cap | `packages/server/src/cost` |
